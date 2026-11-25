/**
 * Phase 1 unit tests (no network): JWT lifecycle in the real apiClient using a fake axios adapter,
 * DRF error parsing of the response shapes observed on the live Django server, CSV export and date helpers.
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { CanceledError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";

// apiClient reads VITE_API_BASE_URL at import time (jiti maps import.meta.env → process.env).
process.env.VITE_API_BASE_URL ||= "http://127.0.0.1:8000/api";

// Minimal localStorage for tokenStorage.
const memory = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window ??= {};
(globalThis as unknown as { window: { localStorage: Storage } }).window.localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, String(v)),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: () => null,
  length: 0,
} as Storage;

const { apiClient, ApiError, parseDrfErrorBody, onSessionExpired, toApiError } = await import(
  "../../../infrastructure/apiClient"
);
const { tokenStorage } = await import("../../../infrastructure/tokenStorage");
const { authService } = await import("../../../services/api/auth.service");
const { downloadProtectedFile, protectedFilePaths } = await import("../../../infrastructure/protectedDownload");
const { csvCell, employeesToCsv } = await import("../lib/export-employees");
const { todayLocalISO } = await import("../lib/dates");

type Handler = (config: InternalAxiosRequestConfig) => { status: number; data: unknown };

function useFakeServer(handler: Handler) {
  const calls: { url: string; auth: string | null }[] = [];
  const adapter: AxiosAdapter = async (config) => {
    const auth = (config.headers?.get?.("Authorization") as string | undefined) ?? null;
    calls.push({ url: String(config.url), auth });
    await new Promise((r) => setTimeout(r, 5));
    const { status, data } = handler(config);
    const response = { data, status, statusText: String(status), headers: {}, config, request: {} };
    if (status >= 200 && status < 300) return response;
    const { AxiosError } = await import("axios");
    throw new AxiosError(`HTTP ${status}`, String(status), config, {}, response);
  };
  apiClient.defaults.adapter = adapter;
  return calls;
}

describe("JWT lifecycle (real apiClient, fake transport)", () => {
  beforeEach(() => memory.clear());

  it("injects the Bearer access token", async () => {
    tokenStorage.setTokens({ access: "A1", refresh: "R1" });
    const calls = useFakeServer(() => ({ status: 200, data: { ok: true } }));
    await apiClient.get("/employees/");
    assert.equal(calls[0].auth, "Bearer A1");
  });

  it("refreshes once for concurrent 401s (single flight) and replays every request", async () => {
    tokenStorage.setTokens({ access: "OLD", refresh: "R1" });
    const calls = useFakeServer((config) => {
      if (config.url === "/accounts/token/refresh/") return { status: 200, data: { access: "NEW" } };
      const auth = config.headers.get("Authorization");
      return auth === "Bearer NEW"
        ? { status: 200, data: { url: config.url } }
        : { status: 401, data: { detail: "Given token not valid for any token type", code: "token_not_valid" } };
    });
    const results = await Promise.all([apiClient.get("/employees/"), apiClient.get("/accounts/profile/"), apiClient.get("/employees/1/")]);
    assert.deepEqual(results.map((r) => r.data.url), ["/employees/", "/accounts/profile/", "/employees/1/"]);
    assert.equal(calls.filter((c) => c.url === "/accounts/token/refresh/").length, 1);
    assert.equal(calls.find((c) => c.url === "/accounts/token/refresh/")?.auth, null, "refresh must not send Bearer");
    assert.equal(tokenStorage.getAccess(), "NEW");
    assert.equal(tokenStorage.getRefresh(), "R1", "keeps the refresh token when the backend does not return a new one");
  });

  it("clears the session and emits session-expired when the refresh token is rejected", async () => {
    tokenStorage.setTokens({ access: "OLD", refresh: "BLACKLISTED" });
    let expired = 0;
    const off = onSessionExpired(() => expired++);
    useFakeServer((config) =>
      config.url === "/accounts/token/refresh/"
        ? { status: 401, data: { detail: "Token is invalid", code: "token_not_valid" } }
        : { status: 401, data: { detail: "expired", code: "token_not_valid" } },
    );
    await assert.rejects(apiClient.get("/employees/"), (e: unknown) => e instanceof ApiError && e.kind === "unauthorized");
    off();
    assert.equal(expired, 1);
    assert.equal(tokenStorage.hasSession(), false);
  });

  it("does not replay a request more than once", async () => {
    tokenStorage.setTokens({ access: "OLD", refresh: "R1" });
    const calls = useFakeServer((config) =>
      config.url === "/accounts/token/refresh/"
        ? { status: 200, data: { access: "NEW" } }
        : { status: 401, data: { detail: "User is inactive", code: "user_inactive" } },
    );
    await assert.rejects(apiClient.get("/employees/"));
    assert.equal(calls.filter((c) => c.url === "/employees/").length, 2);
  });

  it("keeps tokens on network failure during refresh (no forced logout)", async () => {
    tokenStorage.setTokens({ access: "OLD", refresh: "R1" });
    apiClient.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      const { AxiosError } = await import("axios");
      if (config.url === "/accounts/token/refresh/") throw new AxiosError("Network Error", "ERR_NETWORK", config);
      throw new AxiosError("401", "401", config, {}, { data: {}, status: 401, statusText: "", headers: {}, config });
    }) as AxiosAdapter;
    await assert.rejects(apiClient.get("/employees/"), (e: unknown) => e instanceof ApiError && e.kind === "network");
    assert.equal(tokenStorage.getRefresh(), "R1");
  });
});

describe("Token storage hardening (security audit H3)", () => {
  beforeEach(() => {
    tokenStorage.clear();
    memory.clear();
  });

  it("never writes the access token to localStorage", () => {
    tokenStorage.setTokens({ access: "ACCESS-SECRET", refresh: "R1" });
    assert.equal(tokenStorage.getAccess(), "ACCESS-SECRET");
    assert.ok(![...memory.values()].includes("ACCESS-SECRET"), "access token must stay in memory");
    assert.equal(memory.get("promocraft.auth.refresh"), "R1");
  });

  it("stores the rotated refresh token returned by the backend", async () => {
    tokenStorage.setTokens({ access: "OLD", refresh: "R1" });
    useFakeServer((config) => {
      if (String(config.url).includes("token/refresh")) return { status: 200, data: { access: "NEW", refresh: "R2" } };
      const auth = config.headers?.get?.("Authorization");
      return auth === "Bearer NEW" ? { status: 200, data: { ok: true } } : { status: 401, data: { code: "token_not_valid" } };
    });
    await apiClient.get("/employees/");
    assert.equal(tokenStorage.getAccess(), "NEW");
    assert.equal(tokenStorage.getRefresh(), "R2");
  });

  it("logout revokes server-side even when only the refresh token survived a reload", async () => {
    tokenStorage.setTokens({ access: "A1", refresh: "R1" });
    tokenStorage.setTokens({ access: "", refresh: undefined }); // simulate reload: memory access lost
    assert.equal(tokenStorage.getAccess(), null);
    const bodies: unknown[] = [];
    const calls = useFakeServer((config) => {
      bodies.push(JSON.parse(String(config.data ?? "{}")));
      return { status: 200, data: { message: "Logged out successfully." } };
    });
    await authService.logout();
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.endsWith("/accounts/logout/"));
    assert.deepEqual(bodies[0], { refresh: "R1" });
    assert.equal(tokenStorage.hasSession(), false);
    assert.equal(memory.get("promocraft.auth.refresh"), undefined);
  });

  it("logout clears local tokens even if the server is unreachable", async () => {
    tokenStorage.setTokens({ access: "A1", refresh: "R1" });
    useFakeServer(() => ({ status: 503, data: {} }));
    await authService.logout();
    assert.equal(tokenStorage.hasSession(), false);
  });
});

describe("Private file downloads (security audit H5)", () => {
  it("fetches through the authenticated API as a blob, never a public /media/ URL", async () => {
    tokenStorage.setTokens({ access: "A1", refresh: "R1" });
    const clicked: string[] = [];
    (globalThis as unknown as { document: unknown }).document = {
      createElement: () => ({ click() { clicked.push(this.download as string); }, remove() {} }),
      body: { appendChild: () => undefined },
    };
    const seen: { url: string; responseType?: string }[] = [];
    const calls = useFakeServer((config) => {
      seen.push({ url: String(config.url), responseType: config.responseType });
      return { status: 200, data: new Blob(["%PDF"]) };
    });
    await downloadProtectedFile(protectedFilePaths.expenseReceipt(7), "receipt.pdf");
    assert.equal(seen[0].url, "/finance/expenses/7/receipt/");
    assert.equal(seen[0].responseType, "blob");
    assert.equal(calls[0].auth, "Bearer A1");
    assert.deepEqual(clicked, ["receipt.pdf"]);
    assert.equal(protectedFilePaths.taskAttachment(3, 9), "/work-items/3/attachments/9/download/");
  });
});

describe("DRF error parsing — shapes observed on the live server", () => {
  it("login: invalid credentials → non_field_errors message", () => {
    const r = parseDrfErrorBody({ non_field_errors: ["Invalid email or password"] }, "fallback");
    assert.equal(r.message, "Invalid email or password");
    assert.deepEqual(r.fieldErrors, {});
  });
  it("login: missing fields → per-field errors", () => {
    const r = parseDrfErrorBody({ email: ["This field is required."], password: ["This field is required."] }, "fb");
    assert.deepEqual(Object.keys(r.fieldErrors).sort(), ["email", "password"]);
  });
  it("token refresh: detail + code", () => {
    const r = parseDrfErrorBody({ detail: "Token is invalid", code: "token_not_valid" }, "fb");
    assert.equal(r.message, "Token is invalid");
    assert.equal(r.code, "token_not_valid");
  });
  it("never surfaces an HTML error page", () => {
    assert.equal(parseDrfErrorBody("<!DOCTYPE html><html>…", "Server error").message, "Server error");
  });
  it("cancellation is normalized", () => {
    assert.equal(toApiError(new CanceledError()).kind, "cancelled");
  });
});

describe("Employee CSV export", () => {
  it("quotes commas, quotes and newlines", () => {
    assert.equal(csvCell('a,"b"\nc'), '"a,""b""\nc"');
    assert.equal(csvCell(null), "");
  });
  it("neutralizes spreadsheet formulas", () => {
    assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
    assert.equal(csvCell("+91"), "'+91");
  });
  it("writes a header and one line per employee", () => {
    const csv = employeesToCsv([
      { id: 1, employee_id: "E1", name: "A, B", email: "a@x.io", designation: "D", department: "Dep", employment_type: "FULL_TIME", joining_date: "2026-01-01", status: "ACTIVE", salary: "100.00" },
    ]);
    const lines = csv.split("\r\n");
    assert.equal(lines.length, 2);
    assert.ok(lines[0].startsWith("Employee ID,Name,Email"));
    assert.ok(lines[1].startsWith('E1,"A, B",a@x.io'));
  });
});

describe("Local date helper", () => {
  it("uses local calendar date, not UTC", () => {
    assert.equal(todayLocalISO(new Date(2026, 10, 15, 0, 30)), "2026-11-15");
    assert.equal(todayLocalISO(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
  });
});
