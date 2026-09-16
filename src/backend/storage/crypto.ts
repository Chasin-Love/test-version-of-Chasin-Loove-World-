/**
 * WebCrypto Vault Cryptography Engine
 * Provides PBKDF2 key derivation, AES-GCM 256-bit payload encryption/decryption,
 * verifier generation, and SHA-256 digesting.
 */

import type { PasswordRecord, VaultFile, VaultSecrets } from '../types';

export const KDF_TARGET_ROUNDS = 310000;
export const KDF_LEGACY_ROUNDS = 90000;
export const KDF_LEGACY_RECORD_ROUNDS = 120000;

export const b64enc = (buf: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buf)));

export const b64dec = (s: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function deriveKey(
  passphrase: string,
  salt: BufferSource,
  rounds: number
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: rounds, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptRecords(
  passphrase: string,
  records: PasswordRecord[],
  rounds = KDF_TARGET_ROUNDS
): Promise<VaultSecrets> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, rounds);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(JSON.stringify(records))
  );
  return {
    salt: b64enc(salt.buffer as ArrayBuffer),
    iv: b64enc(iv.buffer as ArrayBuffer),
    data: b64enc(ct),
    rounds,
  };
}

export async function decryptRecords(
  passphrase: string,
  secrets: VaultSecrets
): Promise<PasswordRecord[]> {
  const key = await deriveKey(
    passphrase,
    b64dec(secrets.salt),
    secrets.rounds ?? KDF_LEGACY_RECORD_ROUNDS
  );
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64dec(secrets.iv) as BufferSource },
    key,
    b64dec(secrets.data)
  );
  return JSON.parse(new TextDecoder().decode(pt)) as PasswordRecord[];
}

export async function makeVerifier(
  passphrase: string,
  rounds = KDF_TARGET_ROUNDS
): Promise<{ salt: string; verifier: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: rounds, hash: 'SHA-256' },
    base,
    256
  );
  return {
    salt: b64enc(salt.buffer as ArrayBuffer),
    verifier: b64enc(bits),
  };
}

export async function checkVerifier(
  passphrase: string,
  saltB64: string,
  verifier: string,
  rounds = KDF_TARGET_ROUNDS
): Promise<boolean> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: b64dec(saltB64) as BufferSource, iterations: rounds, hash: 'SHA-256' },
    base,
    256
  );
  return b64enc(bits) === verifier;
}

let payloadSessionKey: CryptoKey | null = null;
const authorizedVaultFiles = new Set<string>();
const PAYLOAD_MAGIC = new TextEncoder().encode('EVENTIDE-PAYLOAD-V1\\n');
const PAYLOAD_ENVELOPE_TYPE = 'application/x-eventide-encrypted';

/** Derive an in-memory payload key for the currently authenticated identity. */
export async function unlockPayloadSession(
  passphrase: string,
  saltB64: string,
  rounds = KDF_TARGET_ROUNDS,
): Promise<void> {
  payloadSessionKey = await deriveKey(passphrase, b64dec(saltB64), rounds);
  authorizedVaultFiles.clear();
}

/** Drop the derived key and every per-object unlock grant. */
export function clearPayloadSession(): void {
  payloadSessionKey = null;
  authorizedVaultFiles.clear();
}

export function authorizeVaultFile(id: string): void {
  authorizedVaultFiles.add(id);
}

export function revokeVaultFileAuthorization(id: string): void {
  authorizedVaultFiles.delete(id);
}

export function isVaultFileAuthorized(id: string): boolean {
  return authorizedVaultFiles.has(id);
}

export function hasPayloadSession(): boolean {
  return payloadSessionKey !== null;
}

export function isVaultFileLocked(file: Pick<VaultFile, 'lock' | 'legacyLock'>): boolean {
  return Boolean(file.lock || file.legacyLock);
}

export async function encryptPayload(blob: Blob): Promise<Blob> {
  if (!payloadSessionKey) throw new Error('vault payload session is locked');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    payloadSessionKey,
    await blob.arrayBuffer(),
  );
  const header = new TextEncoder().encode(JSON.stringify({
    version: 1,
    iv: b64enc(iv.buffer as ArrayBuffer),
    mime: blob.type || 'application/octet-stream',
  }));
  const result = new Uint8Array(PAYLOAD_MAGIC.length + 4 + header.length + ciphertext.byteLength);
  result.set(PAYLOAD_MAGIC, 0);
  new DataView(result.buffer).setUint32(PAYLOAD_MAGIC.length, header.length, true);
  result.set(header, PAYLOAD_MAGIC.length + 4);
  result.set(new Uint8Array(ciphertext), PAYLOAD_MAGIC.length + 4 + header.length);
  return new Blob([result], { type: PAYLOAD_ENVELOPE_TYPE });
}

export function hasPayloadEnvelope(raw: Uint8Array): boolean {
  return raw.length >= PAYLOAD_MAGIC.length + 4 && PAYLOAD_MAGIC.every((v, i) => raw[i] === v);
}

export async function decryptPayload(blob: Blob): Promise<Blob> {
  const raw = new Uint8Array(await blob.arrayBuffer());
  if (!hasPayloadEnvelope(raw)) {
    return blob;
  }
  if (!payloadSessionKey) throw new Error('vault payload is encrypted and the vault is locked');

  const headerLength = new DataView(raw.buffer as ArrayBuffer).getUint32(PAYLOAD_MAGIC.length, true);
  const headerStart = PAYLOAD_MAGIC.length + 4;
  const payloadStart = headerStart + headerLength;
  if (payloadStart > raw.length) throw new Error('invalid vault payload envelope');

  const header = JSON.parse(new TextDecoder().decode(raw.slice(headerStart, payloadStart))) as {
    version: number;
    iv: string;
    mime?: string;
  };
  if (header.version !== 1 || !header.iv) throw new Error('unsupported vault payload envelope');
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64dec(header.iv) as BufferSource },
    payloadSessionKey,
    raw.slice(payloadStart) as BufferSource,
  );
  return new Blob([plaintext], { type: header.mime || 'application/octet-stream' });
}

export async function sha256Hex(s: string): Promise<string> {
  const dig = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(dig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
