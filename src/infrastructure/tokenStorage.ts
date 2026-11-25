/**
 * JWT token persistence.
 *
 * - The access token (short-lived, 15 min) is kept in memory only, so it is never
 *   written to browser storage. After a page reload the client obtains a new one from
 *   the refresh token on the first 401 (see apiClient).
 * - The refresh token is kept in localStorage so a session survives a reload. The
 *   backend rotates it on every refresh, blacklists the previous one, and revokes it on
 *   logout, which limits the value of a stolen copy.
 * Token values are never logged.
 */
const LEGACY_ACCESS_KEY = "promocraft.auth.access";
const REFRESH_KEY = "promocraft.auth.refresh";

let accessToken: string | null = null;

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null): void {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // Storage unavailable (private mode / blocked) — the session simply won't persist.
  }
}

// Remove access tokens persisted by older builds.
safeSet(LEGACY_ACCESS_KEY, null);

export const tokenStorage = {
  getAccess: (): string | null => accessToken,
  getRefresh: (): string | null => safeGet(REFRESH_KEY),
  setTokens(tokens: { access: string; refresh?: string | null }): void {
    accessToken = tokens.access || null;
    if (tokens.refresh !== undefined) safeSet(REFRESH_KEY, tokens.refresh);
  },
  clear(): void {
    accessToken = null;
    safeSet(REFRESH_KEY, null);
    safeSet(LEGACY_ACCESS_KEY, null);
  },
  hasSession(): boolean {
    return Boolean(accessToken || safeGet(REFRESH_KEY));
  },
};
