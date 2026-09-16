/**
 * Desktop adapter — the single seam between the web runtime and the Tauri
 * desktop shell. Every native capability the app uses funnels through here:
 *
 *   - `isDesktop()`            feature detection (window.__TAURI_INTERNALS__)
 *   - `desktopStore`           universe-state JSON + payload bytes on real files
 *   - `realityApi()`           reality-folder daemon endpoints (native commands
 *                              on desktop, fetch('/api/...') on web)
 *
 * Web mode keeps its current behavior untouched: every desktop path is
 * tried first and silently skipped when unavailable.
 */

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && !!(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}

type TauriInvoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
let invokeFn: TauriInvoke | null | undefined;

async function getInvoke(): Promise<TauriInvoke | null> {
  if (invokeFn !== undefined) return invokeFn;
  if (!isDesktop()) {
    invokeFn = null;
    return null;
  }
  try {
    const core = await import('@tauri-apps/api/core');
    invokeFn = core.invoke as TauriInvoke;
  } catch {
    invokeFn = null;
  }
  return invokeFn;
}

/* ------------------------------- state JSON ------------------------------- */

export const desktopStore = {
  /** Read the persisted universe state from disk. null = no desktop store. */
  async readState(): Promise<string | null> {
    const call = await getInvoke();
    if (!call) return null;
    try {
      const res = await call<{ json: string | null }>('store_state_read');
      return res.json ?? null;
    } catch (err) {
      console.warn('[desktop] state read failed:', err);
      return null;
    }
  },

  /** Write the universe state to disk. Returns false when not on desktop. */
  async writeState(json: string): Promise<boolean> {
    const call = await getInvoke();
    if (!call) return false;
    try {
      await call('store_state_write', { json });
      return true;
    } catch (err) {
      console.warn('[desktop] state write failed:', err);
      return false;
    }
  },
};

/* -------------------------------- payloads -------------------------------- */

export const desktopPayloads = {
  /**
   * Store payload bytes on disk. Uses Tauri raw IPC with a length-prefixed
   * framing: [u16 LE idLen][id UTF-8][payload] — large media crosses the
   * bridge without JSON encoding.
   */
  async put(id: string, bytes: Uint8Array): Promise<boolean> {
    const call = await getInvoke();
    if (!call) return false;
    try {
      const idBytes = new TextEncoder().encode(id);
      if (idBytes.length > 65535) return false;
      const frame = new Uint8Array(2 + idBytes.length + bytes.length);
      frame[0] = idBytes.length & 0xff;
      frame[1] = (idBytes.length >> 8) & 0xff;
      frame.set(idBytes, 2);
      frame.set(bytes, 2 + idBytes.length);
      await call('store_payload_put', frame as unknown as Record<string, unknown>);
      return true;
    } catch (err) {
      console.warn('[desktop] payload put failed:', err);
      return false;
    }
  },

  async get(id: string): Promise<Uint8Array | null> {
    const call = await getInvoke();
    if (!call) return null;
    try {
      const res = await call<number[] | null>('store_payload_get', { id });
      return res ? Uint8Array.from(res) : null;
    } catch (err) {
      console.warn('[desktop] payload get failed:', err);
      return null;
    }
  },

  async delete(id: string): Promise<boolean> {
    const call = await getInvoke();
    if (!call) return false;
    try {
      await call('store_payload_delete', { id });
      return true;
    } catch (err) {
      console.warn('[desktop] payload delete failed:', err);
      return false;
    }
  },
};

/* --------------------------- reality daemon API --------------------------- */

function mapRealityEndpoint<T = unknown>(path: string, body: unknown): { cmd: string; args: Record<string, unknown> } | null {
  const b = (body ?? {}) as Record<string, unknown>;
  switch (path) {
    case '/api/realities/rename-folder':
      return { cmd: 'reality_rename', args: { realityId: b.realityId, newName: b.newName } };
    case '/api/realities/bin/move-to-bin':
      return { cmd: 'reality_move_to_bin', args: { realityId: b.realityId, folderName: b.folderName } };
    case '/api/realities/bin/restore':
      return { cmd: 'reality_restore', args: { realityId: b.realityId, folderName: b.folderName } };
    case '/api/realities/bin/purge':
      return { cmd: 'reality_purge', args: { realityId: b.realityId, folderName: b.folderName } };
    case '/api/realities/bin/empty':
      return { cmd: 'reality_empty_bin', args: {} };
    case '/api/realities/daemon-status':
      return { cmd: 'reality_daemon_status', args: {} };
    case '/api/realities/bin':
      return { cmd: 'reality_bin_list', args: {} };
    case '/api/realities/folders':
      return { cmd: 'reality_list', args: {} };
    case '/api/realities/create-folder': {
      const cfg = b as Record<string, unknown>;
      return {
        cmd: 'reality_create_folder',
        args: {
          id: cfg.id ?? null,
          name: cfg.name,
          codeName: cfg.codeName ?? null,
          spectral: cfg.spectral ?? null,
          description: cfg.description ?? null,
          colorA: cfg.colorA ?? '#00f5d4',
          colorB: cfg.colorB ?? '#8b5cf6',
          starColor: cfg.starColor ?? '#ffeedd',
          bodies: JSON.stringify(cfg.bodies ?? []),
          entries: JSON.stringify(cfg.entries ?? []),
          folderName: cfg.folderName ?? null,
        },
      };
    }
    default:
      return null;
  }
}

/**
 * Reality daemon call that works in both runtimes. Returns parsed JSON on
 * success, null on failure (callers already degrade gracefully on null).
 */
export async function realityApi<T = unknown>(path: string, body?: unknown, method: 'GET' | 'POST' = 'POST'): Promise<T | null> {
  if (isDesktop()) {
    const mapped = mapRealityEndpoint(path, body);
    if (!mapped) {
      console.warn('[desktop] no native command for', path);
      return null;
    }
    const call = await getInvoke();
    if (!call) return null;
    try {
      return await call<T>(mapped.cmd, mapped.args);
    } catch (err) {
      console.warn('[desktop] reality command failed:', path, err);
      return null;
    }
  }
  try {
    const res = await fetch(path, method === 'POST' ? {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    } : undefined);
    return (await res.json()) as T;
  } catch (err) {
    console.warn('[api] fetch failed:', path, err);
    return null;
  }
}
