/**
 * Centralized API client for the PromoCraft Django REST backend.
 *
 * - Base URL comes from VITE_API_BASE_URL (must include the `/api` prefix).
 * - Attaches `Authorization: Bearer <access>` (SIMPLE_JWT AUTH_HEADER_TYPES = Bearer).
 * - On 401 it refreshes the access token once via POST /accounts/token/refresh/
 *   ({ refresh } -> { access, refresh }; the backend rotates the refresh token and the new one is stored)
 *   and replays the original request. Concurrent 401s share a single refresh call.
 * - All failures are normalized to `ApiError` (DRF `detail`, field errors, `non_field_errors`,
 *   network, timeout and cancellation).
 * - Accepts AbortSignal via axios `signal` so React Query can cancel in-flight requests.
 *
 * Token values are never logged.
 */
import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { MockValidationError } from "@/mocks/types";
import { tokenStorage } from "./tokenStorage";

// Re-exported for modules that still run on mock services (finance, projects, …).
export { MockValidationError };

declare module "axios" {
  interface AxiosRequestConfig {
    /** Do not attach the Authorization header / do not attempt token refresh. */
    skipAuth?: boolean;
    /** Internal: request has already been replayed after a refresh. */
    _retried?: boolean;
  }
}

const RAW_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
export const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, "");

if (!API_BASE_URL && import.meta.env.DEV) {
  console.error(
    "[apiClient] VITE_API_BASE_URL is not set. Add it to .env.local, e.g. VITE_API_BASE_URL=http://127.0.0.1:8000/api",
  );
}

export const AUTH_ENDPOINTS = {
  login: "/accounts/login/",
  logout: "/accounts/logout/",
  refresh: "/accounts/token/refresh/",
  profile: "/accounts/profile/",
} as const;

/* ─── Error model ─────────────────────────────────────────────────────── */

export type ApiErrorKind =
  | "network"
  | "timeout"
  | "cancelled"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation"
  | "server"
  | "config"
  | "unknown";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  /** Field-level messages, keyed by backend field name (nested keys joined with "."). */
  readonly fieldErrors: Record<string, string[]>;
  /** DRF error `code` when present, e.g. "token_not_valid". */
  readonly code?: string;

  constructor(
    message: string,
    opts: {
      kind: ApiErrorKind;
      status?: number | null;
      fieldErrors?: Record<string, string[]>;
      code?: string;
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = opts.kind;
    this.status = opts.status ?? null;
    this.fieldErrors = opts.fieldErrors ?? {};
    this.code = opts.code;
  }

  get hasFieldErrors(): boolean {
    return Object.keys(this.fieldErrors).length > 0;
  }
}

function toStringList(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(toStringList);
  if (typeof value === "string") return [value];
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  return [];
}

function collectFieldErrors(
  data: Record<string, unknown>,
  prefix = "",
  out: Record<string, string[]> = {},
): Record<string, string[]> {
  for (const [key, value] of Object.entries(data)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      collectFieldErrors(value as Record<string, unknown>, path, out);
    } else {
      const messages = toStringList(value);
      if (messages.length) out[path] = messages;
    }
  }
  return out;
}

/** Normalizes a DRF error body into a message + field errors. */
export function parseDrfErrorBody(
  data: unknown,
  fallback: string,
): { message: string; fieldErrors: Record<string, string[]>; code?: string } {
  if (typeof data === "string") {
    // Django HTML debug pages and proxies return strings — never surface raw HTML.
    const trimmed = data.trim();
    return { message: trimmed && !trimmed.startsWith("<") ? trimmed : fallback, fieldErrors: {} };
  }
  if (Array.isArray(data)) {
    const list = toStringList(data);
    return { message: list[0] || fallback, fieldErrors: {} };
  }
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const code = typeof record.code === "string" ? record.code : undefined;
    if (typeof record.detail === "string") {
      return { message: record.detail, fieldErrors: {}, code };
    }
    const { code: _code, messages: _messages, ...rest } = record;
    const fieldErrors = collectFieldErrors(rest);
    const nonField = fieldErrors.non_field_errors ?? fieldErrors.detail;
    delete fieldErrors.non_field_errors;
    delete fieldErrors.detail;
    const firstField = Object.values(fieldErrors)[0]?.[0];
    return {
      message: nonField?.[0] || firstField || fallback,
      fieldErrors,
      code,
    };
  }
  return { message: fallback, fieldErrors: {} };
}

function kindForStatus(status: number): ApiErrorKind {
  if (status === 400) return "validation";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status >= 500) return "server";
  return "unknown";
}

const DEFAULT_MESSAGES: Partial<Record<ApiErrorKind, string>> = {
  network: "Unable to reach the PromoCraft server. Check your connection and try again.",
  timeout: "The server took too long to respond. Please try again.",
  cancelled: "Request cancelled.",
  unauthorized: "Your session has expired. Please sign in again.",
  forbidden: "You do not have permission to perform this action.",
  not_found: "The requested record was not found.",
  server: "The server encountered an error. Please try again later.",
  validation: "Please correct the highlighted fields.",
};

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (axios.isCancel(err)) {
    return new ApiError(DEFAULT_MESSAGES.cancelled!, { kind: "cancelled" });
  }
  if (err instanceof AxiosError) {
    if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
      return new ApiError(DEFAULT_MESSAGES.timeout!, { kind: "timeout" });
    }
    if (!err.response) {
      return new ApiError(DEFAULT_MESSAGES.network!, { kind: "network" });
    }
    const status = err.response.status;
    const kind = kindForStatus(status);
    const fallback = DEFAULT_MESSAGES[kind] || `Request failed (${status}).`;
    const parsed = parseDrfErrorBody(err.response.data, fallback);
    return new ApiError(kind === "server" ? fallback : parsed.message, {
      kind,
      status,
      fieldErrors: parsed.fieldErrors,
      code: parsed.code,
    });
  }
  if (err instanceof Error) {
    return new ApiError(err.message || "An unexpected error occurred.", { kind: "unknown" });
  }
  return new ApiError("An unexpected error occurred.", { kind: "unknown" });
}

export function isCancelledError(err: unknown): boolean {
  return axios.isCancel(err) || (err instanceof ApiError && err.kind === "cancelled");
}

/* ─── Session-expiry notifications ────────────────────────────────────── */

type SessionListener = () => void;
const sessionExpiredListeners = new Set<SessionListener>();

/** Subscribe to "refresh token rejected" events. Returns an unsubscribe function. */
export function onSessionExpired(listener: SessionListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

function emitSessionExpired() {
  tokenStorage.clear();
  sessionExpiredListeners.forEach((l) => {
    try {
      l();
    } catch {
      /* listener errors must not break the request pipeline */
    }
  });
}

/* ─── Axios instance ──────────────────────────────────────────────────── */

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { Accept: "application/json" },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (!API_BASE_URL) {
    throw new ApiError("API base URL is not configured (VITE_API_BASE_URL).", { kind: "config" });
  }
  if (!config.skipAuth) {
    const access = tokenStorage.getAccess();
    if (access) config.headers.set("Authorization", `Bearer ${access}`);
  }
  return config;
});

let refreshInFlight: Promise<string> | null = null;

/**
 * Exchanges the stored refresh token for a new access token.
 * Rejects with ApiError; kind "unauthorized" means the refresh token itself is invalid/expired.
 */
export function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;
  const refresh = tokenStorage.getRefresh();
  if (!refresh) {
    return Promise.reject(
      new ApiError(DEFAULT_MESSAGES.unauthorized!, { kind: "unauthorized", status: 401 }),
    );
  }
  refreshInFlight = apiClient
    .post<{ access: string; refresh?: string }>(AUTH_ENDPOINTS.refresh, { refresh }, { skipAuth: true })
    .then((res) => {
      const access = res.data?.access;
      if (!access) {
        throw new ApiError("Token refresh returned no access token.", { kind: "unauthorized", status: 401 });
      }
      // Only overwrite the refresh token if the backend rotated it.
      tokenStorage.setTokens({ access, refresh: res.data.refresh ?? undefined });
      return access;
    })
    .catch((err: unknown) => {
      const apiErr = toApiError(err);
      // SimpleJWT answers 401 (token_not_valid) for an expired/invalid refresh token.
      if (apiErr.kind === "unauthorized" || apiErr.status === 400) {
        throw new ApiError(DEFAULT_MESSAGES.unauthorized!, { kind: "unauthorized", status: 401, code: apiErr.code });
      }
      throw apiErr;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!(error instanceof AxiosError) || !error.config) {
      return Promise.reject(toApiError(error));
    }
    const config = error.config as InternalAxiosRequestConfig & AxiosRequestConfig;
    const status = error.response?.status;

    if (status === 401 && !config.skipAuth && !config._retried) {
      if (!tokenStorage.getRefresh()) {
        emitSessionExpired();
        return Promise.reject(toApiError(error));
      }
      try {
        const access = await refreshAccessToken();
        config._retried = true;
        config.headers.set("Authorization", `Bearer ${access}`);
        return apiClient.request(config);
      } catch (refreshErr) {
        const apiErr = toApiError(refreshErr);
        if (apiErr.kind === "unauthorized") emitSessionExpired();
        return Promise.reject(apiErr);
      }
    }

    return Promise.reject(toApiError(error));
  },
);

/* ─── DRF helpers ─────────────────────────────────────────────────────── */

/** DRF PageNumberPagination envelope. */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export function isPaginated<T>(data: unknown): data is Paginated<T> {
  return Boolean(
    data && typeof data === "object" && Array.isArray((data as Paginated<T>).results) && "count" in (data as object),
  );
}

/** Drops undefined / empty-string params so filters are only sent when set. */
export function cleanParams(params: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v as string | number | boolean;
  }
  return out;
}

/* ─── UI error extraction ─────────────────────────────────────────────── */

export function extractApiErrorMessage(
  err: unknown,
  fallback = "An unexpected error occurred.",
): { message: string; fieldErrors?: Record<string, string[]> } {
  if (err instanceof ApiError) {
    return {
      message: err.message || fallback,
      fieldErrors: err.hasFieldErrors ? err.fieldErrors : undefined,
    };
  }
  if (err instanceof MockValidationError) {
    return {
      message: err.message || fallback,
      fieldErrors: err.fieldErrors,
    };
  }
  if (err instanceof AxiosError) {
    return extractApiErrorMessage(toApiError(err), fallback);
  }
  if (err && typeof err === "object") {
    const record = err as { message?: unknown; fieldErrors?: unknown };
    if (record.fieldErrors && typeof record.fieldErrors === "object") {
      return {
        message: typeof record.message === "string" ? record.message : fallback,
        fieldErrors: record.fieldErrors as Record<string, string[]>,
      };
    }
    if (typeof record.message === "string" && record.message) {
      return { message: record.message };
    }
  }
  return { message: fallback };
}
