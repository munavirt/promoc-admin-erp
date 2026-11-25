/**
 * Real authentication service — Django `accounts` app.
 *
 *   POST  /api/accounts/login/          { email, password } -> { refresh, access, user }
 *   POST  /api/accounts/token/refresh/  { refresh }         -> { access, refresh }  (rotated)
 *   POST  /api/accounts/logout/         { refresh }         -> { message }
 *   GET   /api/accounts/profile/                            -> UserSerializer
 *   PATCH /api/accounts/profile/        { name?, email?, phone? } -> UserSerializer
 */
import type { LoginResponse, UserProfile } from "@/api/accounts.api";
import { ApiError, AUTH_ENDPOINTS, apiClient } from "@/infrastructure/apiClient";
import { tokenStorage } from "@/infrastructure/tokenStorage";

export const authService = {
  hasSession(): boolean {
    return tokenStorage.hasSession();
  },

  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>(
      AUTH_ENDPOINTS.login,
      { email: email.trim(), password },
      { skipAuth: true },
    );
    if (!data?.access || !data?.refresh) {
      throw new ApiError("Login succeeded but the server returned no tokens.", { kind: "unknown" });
    }
    tokenStorage.setTokens({ access: data.access, refresh: data.refresh });
    return data;
  },

  async getProfile(signal?: AbortSignal): Promise<UserProfile> {
    const { data } = await apiClient.get<UserProfile>(AUTH_ENDPOINTS.profile, { signal });
    return data;
  },

  async updateProfile(patch: { name?: string; email?: string; phone?: string }): Promise<UserProfile> {
    // UserSerializer accepts name, email, phone; role/is_active/etc. are read-only.
    const body: Record<string, string> = {};
    if (patch.name !== undefined) body.name = patch.name;
    if (patch.email !== undefined) body.email = patch.email;
    if (patch.phone !== undefined) body.phone = patch.phone;
    const { data } = await apiClient.patch<UserProfile>(AUTH_ENDPOINTS.profile, body);
    return data;
  },

  /**
   * Server logout, then always clears local tokens.
   * The backend blacklists the refresh token (and the current access token, if sent), so
   * neither can be reused. The endpoint does not require a valid session, so this works
   * even after the in-memory access token was lost on reload.
   */
  async logout(): Promise<void> {
    const refresh = tokenStorage.getRefresh();
    try {
      if (refresh) {
        await apiClient.post(AUTH_ENDPOINTS.logout, { refresh }, { timeout: 5000 });
      }
    } catch {
      // Ignore — local sign-out must succeed even if the server is unreachable.
    } finally {
      tokenStorage.clear();
    }
  },
};
