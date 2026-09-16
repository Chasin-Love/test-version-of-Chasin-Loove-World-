import path from 'path';

/**
 * Filesystem safety helpers for the reality folder APIs.
 *
 * Every user-supplied path component must pass through `sanitizeFolderName`
 * and the final resolved path must be verified with `isInside` before any
 * fs write, rename, or remove. These two rules together close the path
 * traversal hole where a request body such as `folderName: "../../x"`
 * escaped `src/realities`.
 */

/**
 * Reduce a user-supplied folder name to a safe single path segment.
 * Strips separators, dots, and anything else that could alter path
 * resolution. Returns '' when nothing safe remains.
 */
export function sanitizeFolderName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const segment = raw.replace(/[^a-zA-Z0-9-_]/g, '');
  // A lone dash/underscore run is a valid segment only if non-empty;
  // '.'/'..' are impossible after stripping, but keep the guard explicit.
  if (!segment || segment === '.' || segment === '..') return '';
  return segment;
}

/**
 * True when `child` resolves strictly inside `parent` (never equal to it,
 * never escaping it). On Windows this also rejects drive-absolute inputs.
 */
export function isInside(parent: string, child: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}
