/**
 * Phase 4 unit tests (no network): the real finance service over a fake axios transport.
 * Shapes follow finance/api and agency_settings/api in the Django backend.
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";

process.env.VITE_API_BASE_URL ||= "http://127.0.0.1:8000/api";
const g = globalThis as unknown as { window?: { localStorage?: Storage } };
g.window ??= {};
if (!g.window.localStorage) {
  const mem = new Map<string, string>();
  g.window.localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

const { apiClient } = await import("../../../../infrastructure/apiClient");
const { tokenStorage } = await import("../../../../infrastructure/tokenStorage");
const { financeApiService: fin } = await import("../../../../services/api/finance.service");
const { removeLegacyFinanceStorage, LEGACY_FINANCE_STORAGE_KEYS } = await import("../../utils/legacy-storage");

interface Call { method: string; url: string; params?: Record<string, unknown>; data: unknown; headers: Record<string, unknown> }
function fakeServer(handler: (c: Call) => { status: number; data: unknown }): Call[] {
  const calls: Call[] = [];
  apiClient.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
    const call: Call = {
      method: String(config.method).toUpperCase(),
      url: String(config.url),
      params: config.params,
      data: config.data,
      headers: (config.headers?.toJSON?.() ?? {}) as Record<string, unknown>,
    };
    calls.push(call);
    const { status, data } = handler(call);
    const response = { data, status, statusText: String(status), headers: {}, config, request: {} };
    if (status < 300) return response;
    throw new AxiosError(`HTTP ${status}`, String(status), config, {}, response);
  }) as AxiosAdapter;
  return calls;
}
const body = (c: Call) => (typeof c.data === "string" ? JSON.parse(c.data) : c.data);
const page = <T,>(results: T[], next: string | null = null) => ({ count: results.length, next, previous: null, results });

beforeEach(() => tokenStorage.setTokens({ access: "A", refresh: "R" }));

describe("Agency settings", () => {
  it("GET 404 (not configured) → null, not an error and not demo data", async () => {
    fakeServer(() => ({ status: 404, data: { detail: "Agency settings have not been configured yet." } }));
    assert.equal(await fin.getAgencySettings(), null);
  });
  it("other errors propagate", async () => {
    fakeServer(() => ({ status: 403, data: { detail: "forbidden" } }));
    await assert.rejects(fin.getAgencySettings(), (e: unknown) => (e as { status: number }).status === 403);
  });
  it("create = POST /settings/, update = PATCH /settings/", async () => {
    const calls = fakeServer(() => ({ status: 200, data: { id: 1 } }));
    await fin.createAgencySettings({ agency_name: "A", address_line_1: "x", city: "c", state: "s", postal_code: "1" });
    await fin.updateAgencySettings({ gst_registered: true, gstin: "29ABCDE1234F1Z5" });
    assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), ["POST /settings/", "PATCH /settings/"]);
  });
});

describe("Categories / income / expenses", () => {
  it("categories are filtered by type and walk every page", async () => {
    const calls = fakeServer((c) =>
      c.url === "/finance/categories/"
        ? { status: 200, data: page([{ id: 1, type: "INCOME" }], "http://127.0.0.1:8000/api/finance/categories/?page=2") }
        : { status: 200, data: page([{ id: 2, type: "INCOME" }]) },
    );
    const cats = await fin.listCategories({ type: "INCOME", is_active: true });
    assert.deepEqual(cats.map((c) => c.id), [1, 2]);
    assert.deepEqual(calls[0].params, { ordering: "name", type: "INCOME", is_active: true });
  });

  it("income list passes server-side filters; create sends only writable fields with the real category id", async () => {
    const calls = fakeServer((c) => (c.method === "GET" ? { status: 200, data: page([]) } : { status: 201, data: { id: 7 } }));
    await fin.listIncome({ page: 2, search: "", category: 3, payment_method: "UPI" });
    assert.deepEqual(calls[0].params, { page: 2, category: 3, payment_method: "UPI" });
    const saved = await fin.createIncome({ category: 3, description: "QA", amount: "10.50", received_date: "2026-11-16", payment_method: "UPI", created_by: "x", clientId: "c" } as never);
    assert.equal(saved.id, 7);
    assert.equal(calls[1].url, "/finance/income/");
    assert.deepEqual(Object.keys(body(calls[1])).sort(), ["amount", "category", "description", "payment_method", "received_date"]);
    assert.equal(body(calls[1]).amount, "10.50", "decimal kept as string");
  });

  it("income update is PATCH /finance/income/{id}/ (no DELETE exists)", async () => {
    const calls = fakeServer(() => ({ status: 200, data: { id: 7 } }));
    await fin.updateIncome(7, { notes: "edited" });
    assert.equal(`${calls[0].method} ${calls[0].url}`, "PATCH /finance/income/7/");
    assert.deepEqual(body(calls[0]), { notes: "edited" });
  });

  it("expense without receipt → JSON; with receipt → multipart FormData (receipt_file), no JSON content type", async () => {
    const calls = fakeServer(() => ({ status: 201, data: { id: 9 } }));
    const payload = { category: 5, description: "QA", amount: "1.00", expense_date: "2026-11-16", payment_method: "CASH" as const, vendor_name: "V" };
    await fin.createExpense(payload);
    assert.equal(body(calls[0]).vendor_name, "V");
    const file = new File(["%PDF-1.4"], "r.pdf", { type: "application/pdf" });
    await fin.createExpense(payload, file);
    assert.ok(calls[1].data instanceof FormData);
    const form = calls[1].data as FormData;
    assert.equal(form.get("category"), "5");
    assert.ok(form.get("receipt_file") instanceof Blob);
    assert.ok(!/application\/json/i.test(String(calls[1].headers["Content-Type"] ?? "")));
  });
});

describe("Overview", () => {
  it("summary/trends/recent hit the real endpoints with period params", async () => {
    const calls = fakeServer(() => ({ status: 200, data: { results: [] } }));
    await fin.getOverviewSummary({ period: "this_year", grouping: "month" });
    await fin.getOverviewTrends({ period: "6m", grouping: "month" });
    await fin.getRecentTransactions({ limit: 8 });
    assert.deepEqual(calls.map((c) => c.url), ["/finance/overview/", "/finance/overview/trends/", "/finance/overview/recent-transactions/"]);
    assert.deepEqual(calls[0].params, { period: "this_year" }, "grouping is not sent to the summary endpoint");
    assert.deepEqual(calls[1].params, { period: "6m", grouping: "month" });
    assert.deepEqual(calls[2].params, { limit: 8 });
  });
});

describe("Legacy demo ledger", () => {
  it("removes the old localStorage finance keys", () => {
    const ls = g.window!.localStorage!;
    LEGACY_FINANCE_STORAGE_KEYS.forEach((k) => ls.setItem(k, "{}"));
    removeLegacyFinanceStorage();
    LEGACY_FINANCE_STORAGE_KEYS.forEach((k) => assert.equal(ls.getItem(k), null));
  });
});
