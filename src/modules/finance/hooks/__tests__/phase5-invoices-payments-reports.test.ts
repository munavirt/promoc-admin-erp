/**
 * Phase 5 unit tests (no network): invoices, payments, allocations, reports and file downloads through the
 * real finance service and shared apiClient, over a fake axios transport. Request/response shapes follow
 * finance/api (views, serializers), finance/services.py and finance/reports.py in the Django backend.
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

const { apiClient, ApiError } = await import("../../../../infrastructure/apiClient");
const { tokenStorage } = await import("../../../../infrastructure/tokenStorage");
const { financeApiService: fin, invoicePdfFilename } = await import("../../../../services/api/finance.service");
const dec = await import("../../utils/decimal");

interface Call { method: string; url: string; params?: Record<string, unknown>; data: unknown; headers: Record<string, unknown>; responseType?: string }
type Reply = { status: number; data: unknown; headers?: Record<string, string> };
function fakeServer(handler: (c: Call) => Reply): Call[] {
  const calls: Call[] = [];
  apiClient.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
    const call: Call = {
      method: String(config.method).toUpperCase(),
      url: String(config.url),
      params: config.params,
      data: config.data,
      headers: (config.headers?.toJSON?.() ?? {}) as Record<string, unknown>,
      responseType: config.responseType,
    };
    calls.push(call);
    const { status, data, headers } = handler(call);
    const response = { data, status, statusText: String(status), headers: headers ?? {}, config, request: {} };
    if (status < 300) return response;
    throw new AxiosError(`HTTP ${status}`, String(status), config, {}, response);
  }) as AxiosAdapter;
  return calls;
}
const body = (c: Call) => (typeof c.data === "string" ? JSON.parse(c.data) : c.data);
const bytes = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;
const page = <T,>(results: T[]) => ({ count: results.length, next: null, previous: null, results });

beforeEach(() => tokenStorage.setTokens({ access: "A", refresh: "R" }));

describe("Invoices", () => {
  it("list sends server-side filters, search, ordering and page", async () => {
    const calls = fakeServer(() => ({ status: 200, data: page([]) }));
    await fin.listInvoices({ page: 2, search: "PC/", client: 1, status: "ISSUED", payment_status: "PARTIALLY_PAID", start_issue_date: "2026-04-01", ordering: "-issue_date" });
    assert.equal(calls[0].url, "/finance/invoices/");
    assert.deepEqual(calls[0].params, { page: 2, search: "PC/", client: 1, status: "ISSUED", payment_status: "PARTIALLY_PAID", start_issue_date: "2026-04-01", ordering: "-issue_date" });
  });

  it("create posts only writable fields — never invoice_number, status or totals; decimals stay strings", async () => {
    const calls = fakeServer(() => ({ status: 201, data: { id: 7, invoice_number: "PC/2026-27/0001", status: "DRAFT" } }));
    const saved = await fin.createInvoice({
      client: 1,
      issue_date: "2026-11-16",
      due_date: null,
      client_state: "Kerala",
      notes: "n",
      terms: "",
      items: [{ description: "Design", hsn_sac: "998314", quantity: "2", unit_price: "1000.50", discount_amount: "0", gst_rate: "18.00" }],
      // Smuggled read-only fields must be stripped by the whitelist.
      ...({ invoice_number: "FAKE/1", status: "ISSUED", total_amount: "1" } as object),
    } as never);
    assert.equal(saved.invoice_number, "PC/2026-27/0001");
    const b = body(calls[0]);
    assert.equal(calls[0].method, "POST");
    assert.deepEqual(Object.keys(b).sort(), ["client", "client_state", "due_date", "issue_date", "items", "notes", "terms"]);
    assert.equal(b.items[0].unit_price, "1000.50");
    assert.equal(typeof b.items[0].quantity, "string");
    assert.equal(b.invoice_number, undefined);
  });

  it("draft edit is PATCH; issue, cancel and delete hit the lifecycle endpoints", async () => {
    const calls = fakeServer(() => ({ status: 200, data: { id: 7, invoice_number: "PC/2026-27/0001" } }));
    await fin.updateInvoice(7, { notes: "x" });
    await fin.issueInvoice(7);
    await fin.cancelInvoice(7, "Raised in error");
    await fin.cancelInvoice(8);
    await fin.deleteDraftInvoice(9);
    assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), [
      "PATCH /finance/invoices/7/",
      "POST /finance/invoices/7/issue/",
      "POST /finance/invoices/7/cancel/",
      "POST /finance/invoices/8/cancel/",
      "DELETE /finance/invoices/9/",
    ]);
    assert.deepEqual(body(calls[0]), { notes: "x" });
    assert.deepEqual(body(calls[2]), { reason: "Raised in error" });
    assert.deepEqual(body(calls[3]), {});
  });

  it("backend immutability errors surface as ApiError with Django's message", async () => {
    fakeServer(() => ({ status: 400, data: { non_field_errors: ["Invoices in 'ISSUED' status cannot be modified. Only DRAFT invoices can be updated."] } }));
    await assert.rejects(fin.updateInvoice(7, { notes: "x" }), (e: unknown) => e instanceof ApiError && /cannot be modified/.test(e.message));
  });
});

describe("Invoice PDF", () => {
  it("authenticated binary GET; returns a PDF blob with the backend's filename scheme", async () => {
    const calls = fakeServer(() => ({ status: 200, data: bytes("%PDF-1.4 fake"), headers: { "content-type": "application/pdf" } }));
    const file = await fin.downloadInvoicePdf({ id: 7, invoice_number: "PC/2026-27/0001" });
    assert.equal(calls[0].url, "/finance/invoices/7/pdf/");
    assert.equal(calls[0].responseType, "arraybuffer");
    assert.equal(calls[0].headers.Authorization, "Bearer A");
    // Regression: a bare "application/pdf" makes DRF answer 406 before the view runs.
    assert.equal(calls[0].headers.Accept, "application/pdf, application/json;q=0.9");
    assert.equal(file.filename, "Invoice-PC-2026-27-0001.pdf");
    assert.equal(file.contentType, "application/pdf");
    assert.equal(await file.blob.text(), "%PDF-1.4 fake");
    assert.equal(invoicePdfFilename("PC/2026-27/0001"), "Invoice-PC-2026-27-0001.pdf");
  });

  it("a non-PDF response is rejected instead of being saved as a .pdf", async () => {
    fakeServer(() => ({ status: 200, data: bytes("<html>"), headers: { "content-type": "text/html" } }));
    await assert.rejects(fin.downloadInvoicePdf({ id: 7, invoice_number: "X" }), /instead of a PDF/);
  });

  it("error bodies on binary requests keep Django's detail message", async () => {
    fakeServer(() => ({ status: 404, data: bytes(JSON.stringify({ detail: "No Invoice matches the given query." })) }));
    await assert.rejects(fin.downloadInvoicePdf({ id: 99, invoice_number: "X" }), (e: unknown) => e instanceof ApiError && e.status === 404 && e.message === "No Invoice matches the given query.");
  });
});

describe("Payments", () => {
  it("create posts only PaymentSerializer writable fields — no bank account, no income call", async () => {
    const calls = fakeServer(() => ({ status: 201, data: { id: "u-1", payment_number: "PAY/2026-27/0001" } }));
    await fin.createPayment({
      client: 1, amount: "1500.00", payment_date: "2026-11-16", payment_method: "UPI", reference_number: "UTR1", notes: "",
      initial_allocations: [{ invoice: 7, amount: "1000.00" }],
      ...({ bank_account: 3, status: "VOIDED", payment_number: "X" } as object),
    } as never);
    assert.equal(calls.length, 1, "exactly one request: the backend creates the IncomeRecord itself");
    assert.equal(calls[0].url, "/finance/payments/");
    const b = body(calls[0]);
    assert.deepEqual(Object.keys(b).sort(), ["amount", "client", "initial_allocations", "notes", "payment_date", "payment_method", "reference_number"]);
    assert.deepEqual(b.initial_allocations, [{ invoice: 7, amount: "1000.00" }]);
    assert.equal(calls.some((c) => c.url.includes("/finance/income/")), false);
  });

  it("sends the Idempotency-Key header when given (security audit M5), and none otherwise", async () => {
    const calls = fakeServer(() => ({ status: 201, data: { id: "u-3", payment_number: "PAY/2026-27/0003" } }));
    const payload = { client: 1, amount: "500.00", payment_date: "2026-11-16", payment_method: "CASH", initial_allocations: [] } as const;
    await fin.createPayment({ ...payload }, { idempotencyKey: "form-key-123456" });
    await fin.createPayment({ ...payload });
    assert.equal(calls[0].headers["Idempotency-Key"], "form-key-123456");
    assert.equal("Idempotency-Key" in calls[1].headers, false);
    assert.equal("idempotency_key" in body(calls[0]), false, "the key travels in a header, not the body");
  });

  it("an advance payment omits initial_allocations entirely", async () => {
    const calls = fakeServer(() => ({ status: 201, data: { id: "u-2", payment_number: "PAY/2026-27/0002" } }));
    await fin.createPayment({ client: 1, amount: "500.00", payment_date: "2026-11-16", payment_method: "CASH", initial_allocations: [] });
    assert.equal("initial_allocations" in body(calls[0]), false);
  });

  it("list filters; void sends the reason; allocate and reverse-allocation bodies match the serializers", async () => {
    const calls = fakeServer(() => ({ status: 200, data: page([]) }));
    await fin.listPayments({ client: 1, status: "CONFIRMED", payment_method: "UPI", start_date: "2026-04-01", end_date: "2026-11-30", has_unallocated: true, ordering: "-amount" });
    await fin.voidPayment("u-1", "Cheque bounced");
    await fin.allocatePayment("u-1", 7, "250.00");
    await fin.reverseAllocation("u-1", "a-9", "wrong invoice");
    assert.deepEqual(calls[0].params, { client: 1, status: "CONFIRMED", payment_method: "UPI", start_date: "2026-04-01", end_date: "2026-11-30", has_unallocated: true, ordering: "-amount" });
    assert.deepEqual([calls[1].url, body(calls[1])], ["/finance/payments/u-1/void/", { reason: "Cheque bounced" }]);
    assert.deepEqual([calls[2].url, body(calls[2])], ["/finance/payments/u-1/allocate/", { invoice: 7, amount: "250.00" }]);
    assert.deepEqual([calls[3].url, body(calls[3])], ["/finance/payments/u-1/reverse-allocation/", { allocation_id: "a-9", reason: "wrong invoice" }]);
  });
});

describe("Reports and exports", () => {
  it("report JSON uses the report endpoint with only the given params", async () => {
    const calls = fakeServer(() => ({ status: 200, data: { total_income: "0.00" } }));
    await fin.getReport("profit-loss", { period: "current_fy", payment_method: "UPI" });
    await fin.getReport("outstanding-invoices", { client: 1 });
    assert.equal(calls[0].url, "/finance/reports/profit-loss/");
    assert.deepEqual(calls[0].params, { period: "current_fy", payment_method: "UPI" });
    assert.deepEqual(calls[1].params, { client: 1 });
  });

  it("CSV/PDF exports keep the report filters, add export=…, and use the backend file", async () => {
    const calls = fakeServer((c) =>
      c.params?.export === "pdf"
        ? { status: 200, data: bytes("%PDF"), headers: { "content-type": "application/pdf" } }
        : { status: 200, data: bytes("Section,Item\n"), headers: { "content-type": "text/csv; charset=utf-8" } },
    );
    const csv = await fin.exportReport("income", { period: "custom", start_date: "2026-04-01", end_date: "2026-11-30", client: 1 }, "csv");
    const pdf = await fin.exportReport("tax-summary", { period: "current_fy" }, "pdf");
    assert.deepEqual(calls[0].params, { period: "custom", start_date: "2026-04-01", end_date: "2026-11-30", client: 1, export: "csv" });
    assert.equal(csv.filename, "Income-Report.csv");
    assert.equal(await csv.blob.text(), "Section,Item\n");
    assert.equal(pdf.filename, "GST-Tax-Summary-Report.pdf");
    assert.equal(calls[1].params?.export, "pdf");
    // Regression: bare "text/csv" / "application/pdf" Accept headers are rejected by DRF with 406.
    assert.equal(calls[0].headers.Accept, "text/csv, application/json;q=0.9");
    assert.equal(calls[1].headers.Accept, "application/pdf, application/json;q=0.9");
  });

  it("uses Content-Disposition when the browser can read it", async () => {
    fakeServer(() => ({ status: 200, data: bytes("x"), headers: { "content-type": "text/csv", "content-disposition": 'attachment; filename="Payments-Report.csv"' } }));
    assert.equal((await fin.exportReport("payments", {}, "csv")).filename, "Payments-Report.csv");
  });

  it("report validation errors (bad custom range) keep the backend message on exports", async () => {
    fakeServer(() => ({ status: 400, data: bytes(JSON.stringify({ detail: "'end_date' cannot be earlier than 'start_date'." })) }));
    await assert.rejects(
      fin.exportReport("profit-loss", { period: "custom", start_date: "2026-11-30", end_date: "2026-04-01" }, "csv"),
      (e: unknown) => e instanceof ApiError && e.status === 400 && /cannot be earlier/.test(e.message),
    );
  });
});

describe("Decimal helpers (preview only, mirrors ROUND_HALF_UP)", () => {
  it("parses and formats 2-dp decimals exactly", () => {
    assert.equal(dec.toCents("1000.5"), 100050n);
    assert.equal(dec.toCents("0.10"), 10n);
    assert.equal(dec.toCents("1.234"), null);
    assert.equal(dec.toCents("abc"), null);
    assert.equal(dec.toCents("-12.50"), -1250n);
    assert.equal(dec.centsToDecimal(100050n), "1000.50");
    assert.equal(dec.centsToDecimal(-5n), "-0.05");
    assert.equal(dec.isDecimal2("12.345"), false);
  });
  it("quantity × price rounds half-up to 2 dp without float error", () => {
    assert.equal(dec.multiplyCents(dec.toCents("0.10")!, dec.toCents("0.10")!), 1n); // 0.01
    assert.equal(dec.multiplyCents(dec.toCents("1.50")!, dec.toCents("0.33")!), 50n); // 0.495 → 0.50
    assert.equal(dec.multiplyCents(dec.toCents("3")!, dec.toCents("0.10")!), 30n); // 0.30, not 0.30000000000000004
    assert.equal(dec.sumCents([10n, null, 20n]), 30n);
  });
});
