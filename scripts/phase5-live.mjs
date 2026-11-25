#!/usr/bin/env node
/**
 * Phase 5 live verification — READ-ONLY (invoices, payments, allocations, reports, exports).
 *
 * Safety:
 *   - HTTP: only GET requests, plus POST /api/accounts/login/ in authenticated mode. Never creates,
 *     issues, cancels, deletes, allocates, reverses or voids anything.
 *   - SQLite opened with readOnly=true; SELECT only.
 *   - Credentials from env vars only; never printed or saved. Results file contains no tokens.
 *
 * Usage (from promocraft-agency-hub/):
 *   node scripts/phase5-live.mjs                                    # unauthenticated checks only
 *   PHASE5_EMAIL=… PHASE5_PASSWORD=… node scripts/phase5-live.mjs   # full read-only run (ADMIN account)
 *   Optional: PHASE5_NONADMIN_EMAIL / PHASE5_NONADMIN_PASSWORD — an existing non-admin account, to check 403s.
 *   Optional: PHASE5_API_BASE (default http://127.0.0.1:8000/api), PHASE5_DB_PATH.
 *
 * Requires Node >= 22.5 (fetch, node:sqlite). Exit: 0 all passed · 1 a check failed · 2 setup error.
 */
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, "..", "..", "promocraft-admin-backend");
const API = (process.env.PHASE5_API_BASE || "http://127.0.0.1:8000/api").replace(/\/+$/, "");
const DB_PATH = path.resolve(process.env.PHASE5_DB_PATH || path.join(backendRoot, "db.sqlite3"));
const EMAIL = process.env.PHASE5_EMAIL || "";
const PASSWORD = process.env.PHASE5_PASSWORD || "";
const NA_EMAIL = process.env.PHASE5_NONADMIN_EMAIL || "";
const NA_PASSWORD = process.env.PHASE5_NONADMIN_PASSWORD || "";
const RESULTS_FILE = path.join(here, "phase5-live-results.json");

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 5)) {
  console.error(`Node ${process.versions.node} is too old: need >= 22.5 for node:sqlite.`);
  process.exit(2);
}
const origEmit = process.emitWarning;
process.emitWarning = (w, ...rest) => (String(w?.message ?? w).includes("SQLite") ? undefined : origEmit.call(process, w, ...rest));
const { DatabaseSync } = await import("node:sqlite");

/* ─── helpers ─── */
const results = [];
function record(id, name, pass, detail = "") {
  results.push({ id, name, status: pass ? "PASS" : "FAIL", detail });
  console.log(`${pass ? "✅ PASS" : "❌ FAIL"}  ${id.padEnd(4)} ${name}${detail ? `\n         ${detail}` : ""}`);
}
function skip(id, name, why) {
  results.push({ id, name, status: "SKIP", detail: why });
  console.log(`⏭️  SKIP  ${id.padEnd(4)} ${name}\n         ${why}`);
}
/** Decimal string/number → integer paise (no float drift). */
function paise(v) {
  if (v === null || v === undefined || v === "") return 0;
  const s = typeof v === "number" ? v.toFixed(2) : String(v).trim();
  const neg = s.startsWith("-");
  const [int, frac = ""] = s.replace(/^[-+]/, "").split(".");
  const n = Number(int || "0") * 100 + Number((frac + "00").slice(0, 2));
  return neg ? -n : n;
}
const fmt = (p) => (p / 100).toFixed(2);
const hex = (uuid) => String(uuid).replace(/-/g, "").toLowerCase();

let token = null;
async function req(p, { auth = true, bearer, raw = false } = {}) {
  const headers = { Accept: raw ? "*/*" : "application/json" };
  const t = bearer ?? (auth ? token : null);
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(`${API}${p}`, { method: "GET", headers });
  if (raw) return { status: res.status, type: res.headers.get("content-type") || "", buf: Buffer.from(await res.arrayBuffer()) };
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
}
async function all(listPath) {
  const items = [];
  let count = null;
  for (let page = 1; page < 500; page++) {
    const r = await req(`${listPath}${listPath.includes("?") ? "&" : "?"}page=${page}`);
    if (r.status !== 200) throw new Error(`GET ${listPath} page ${page} → ${r.status}`);
    count = r.body.count;
    items.push(...r.body.results);
    if (!r.body.next) break;
  }
  return { count, items };
}
async function login(email, password) {
  const res = await fetch(`${API}/accounts/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const b = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, access: b?.access || b?.tokens?.access || null, role: b?.user?.role ?? "unknown" };
}
function finish() {
  try { db?.close(); } catch {}
  const s = {
    generated_at: new Date().toISOString(),
    api_base: API,
    mode: EMAIL && PASSWORD ? "authenticated-read-only" : "unauthenticated",
    pass: results.filter((r) => r.status === "PASS").length,
    fail: results.filter((r) => r.status === "FAIL").length,
    skip: results.filter((r) => r.status === "SKIP").length,
    results,
  };
  writeFileSync(RESULTS_FILE, JSON.stringify(s, null, 2) + "\n");
  console.log(`\n${s.pass} passed · ${s.fail} failed · ${s.skip} skipped\nResults saved to ${path.relative(process.cwd(), RESULTS_FILE) || RESULTS_FILE}`);
  process.exit(s.fail ? 1 : 0);
}

/* ─── pre-flight ─── */
console.log(`Phase 5 live verification (read-only)\n  API: ${API}\n  DB : ${DB_PATH}\n  Mode: ${EMAIL ? "authenticated" : "unauthenticated only"}\n`);
try {
  const h = await fetch(`${API}/health/`);
  record("P0", "Backend reachable (GET /health/)", h.ok, `HTTP ${h.status}`);
} catch (e) {
  record("P0", "Backend reachable (GET /health/)", false, `${e.cause?.code || e.message} — is Django running?`);
  finish();
}
let db = null;
try {
  if (!existsSync(DB_PATH)) throw new Error(`Not found: ${DB_PATH}`);
  db = new DatabaseSync(DB_PATH, { readOnly: true });
  db.prepare("SELECT 1").get();
  record("P1", "SQLite database opened read-only", true);
} catch (e) {
  record("P1", "SQLite database opened read-only", false, e.message);
}
const q = (sql, ...p) => db.prepare(sql).all(...p);
const q1 = (sql, ...p) => db.prepare(sql).get(...p);

/* ─── S1: unauthenticated access is rejected ─── */
const firstInvoiceId = db ? q1("SELECT id FROM finance_invoices ORDER BY id LIMIT 1")?.id ?? 1 : 1;
const protectedPaths = [
  "/finance/invoices/",
  `/finance/invoices/${firstInvoiceId}/`,
  `/finance/invoices/${firstInvoiceId}/pdf/`,
  "/finance/payments/",
  "/finance/allocations/",
  "/finance/reports/profit-loss/",
  "/finance/reports/income/",
  "/finance/reports/expenses/",
  "/finance/reports/outstanding-invoices/",
  "/finance/reports/payments/",
  "/finance/reports/tax-summary/",
  "/finance/reports/profit-loss/?export=csv",
  "/finance/reports/tax-summary/?export=pdf",
];
const unauth = [];
for (const p of protectedPaths) unauth.push([p, (await req(p, { auth: false })).status]);
const bad = unauth.filter(([, s]) => s !== 401);
record("S1", "Unauthenticated invoice/payment/report/export GETs → 401", bad.length === 0,
  bad.length ? bad.map(([p, s]) => `${p} → ${s}`).join(", ") : `${unauth.length}/${unauth.length} → 401`);

let snapshot = null;
if (db) {
  snapshot = {
    invoices: q1("SELECT COUNT(*) n FROM finance_invoices").n,
    invoice_items: q1("SELECT COUNT(*) n FROM finance_invoice_items").n,
    payments: q1("SELECT COUNT(*) n FROM finance_payments").n,
    allocations: q1("SELECT COUNT(*) n FROM finance_payment_allocations").n,
    income: q1("SELECT COUNT(*) n FROM finance_income_records").n,
    expenses: q1("SELECT COUNT(*) n FROM finance_expense_records").n,
    agency_settings: q1("SELECT COUNT(*) n FROM agency_settings").n,
  };
  console.log(`\n  DB snapshot (read-only): ${Object.entries(snapshot).map(([k, v]) => `${v} ${k}`).join(" · ")}\n`);

  // F0 — the Phase 4 real records are untouched.
  const web = q("SELECT amount FROM finance_income_records WHERE description = 'Website Development'");
  const tea = q("SELECT amount FROM finance_expense_records WHERE description = 'Tea'");
  record("F0", "Phase 4 records intact (Website Development ₹250,000 income · Tea ₹50 expense)",
    web.length === 1 && paise(web[0].amount) === 25000000 && tea.length === 1 && paise(tea[0].amount) === 5000,
    `income rows ${web.length} (${web.map((r) => fmt(paise(r.amount))).join(",")}) · expense rows ${tea.length} (${tea.map((r) => fmt(paise(r.amount))).join(",")})`);

  // F1 — payment → income integrity (pure DB): CONFIRMED ⇒ exactly one IncomeRecord, VOIDED ⇒ none, no orphans.
  const pays = q("SELECT id, payment_number, status, amount FROM finance_payments");
  const incByPay = new Map(q("SELECT payment_id, COUNT(*) n, SUM(CAST(ROUND(amount*100) AS INTEGER)) p FROM finance_income_records WHERE payment_id IS NOT NULL GROUP BY payment_id").map((r) => [hex(r.payment_id), r]));
  const problems = [];
  for (const p of pays) {
    const inc = incByPay.get(hex(p.id));
    if (p.status === "CONFIRMED" && (!inc || inc.n !== 1)) problems.push(`${p.payment_number}: ${inc?.n ?? 0} income records`);
    if (p.status === "CONFIRMED" && inc && inc.p !== paise(p.amount)) problems.push(`${p.payment_number}: income ${fmt(inc.p)} ≠ payment ${fmt(paise(p.amount))}`);
    if (p.status === "VOIDED" && inc) problems.push(`${p.payment_number} is VOIDED but still has ${inc.n} income record(s)`);
  }
  const payIds = new Set(pays.map((p) => hex(p.id)));
  for (const k of incByPay.keys()) if (!payIds.has(k)) problems.push(`income references missing payment ${k}`);
  record("F1", "Payment → IncomeRecord integrity (exactly one per confirmed payment, none for voided)", problems.length === 0,
    problems.length ? problems.join("; ") : `${pays.length} payments checked (${pays.filter((p) => p.status === "CONFIRMED").length} confirmed)`);

  // F2 — allocation rules hold in the DB.
  const allocProblems = [];
  for (const a of q(`SELECT a.status, a.allocated_amount, p.status pstatus, p.client_id pc, i.client_id ic, i.status istatus, i.invoice_number
                     FROM finance_payment_allocations a JOIN finance_payments p ON p.id=a.payment_id JOIN finance_invoices i ON i.id=a.invoice_id`)) {
    if (a.pc !== a.ic) allocProblems.push(`${a.invoice_number}: client mismatch`);
    if (a.status === "ACTIVE" && a.pstatus !== "CONFIRMED") allocProblems.push(`${a.invoice_number}: ACTIVE allocation on ${a.pstatus} payment`);
    if (a.status === "ACTIVE" && a.istatus !== "ISSUED") allocProblems.push(`${a.invoice_number}: ACTIVE allocation on ${a.istatus} invoice`);
  }
  for (const p of q(`SELECT p.payment_number, p.amount, COALESCE(SUM(CASE WHEN a.status='ACTIVE' THEN CAST(ROUND(a.allocated_amount*100) AS INTEGER) END),0) alloc
                     FROM finance_payments p LEFT JOIN finance_payment_allocations a ON a.payment_id=p.id GROUP BY p.id`)) {
    if (p.alloc > paise(p.amount)) allocProblems.push(`${p.payment_number}: allocated ${fmt(p.alloc)} > amount`);
  }
  for (const i of q(`SELECT i.invoice_number, i.total_amount, COALESCE(SUM(CASE WHEN a.status='ACTIVE' THEN CAST(ROUND(a.allocated_amount*100) AS INTEGER) END),0) alloc
                     FROM finance_invoices i LEFT JOIN finance_payment_allocations a ON a.invoice_id=i.id GROUP BY i.id`)) {
    if (i.alloc > paise(i.total_amount)) allocProblems.push(`${i.invoice_number}: allocated ${fmt(i.alloc)} > total`);
  }
  record("F2", "Allocation integrity (same client, ISSUED invoice, CONFIRMED payment, no over-allocation)", allocProblems.length === 0,
    allocProblems.length ? allocProblems.join("; ") : `${snapshot.allocations} allocations checked`);
}

/* ─── authenticated ─── */
const AUTH_CHECKS = [
  ["A0", "Admin login"], ["I1", "Invoice list count API = DB"], ["I2", "Invoice fields, items and totals API = DB"],
  ["I3", "Invoice paid/outstanding/payment_status = DB allocations"], ["I4", "Invoice numbers are backend-format and unique"],
  ["I5", "Invoice PDFs download as application/pdf"], ["P1", "Payment list count API = DB"], ["P2", "Payment fields, allocations and balances API = DB"],
  ["P3", "Payment income visible via API exactly once"], ["R1", "P&L totals = DB sums (payment income counted once)"],
  ["R2", "Income/expense report totals = DB"], ["R3", "Outstanding report = DB"], ["R4", "Payments report = DB"],
  ["R5", "GST summary = DB (issued invoices)"], ["E1", "CSV exports for all 6 reports"], ["E2", "PDF exports (P&L, GST)"],
  ["X1", "Non-admin is denied (403)"],
];
if (!EMAIL || !PASSWORD) {
  for (const [id, n] of AUTH_CHECKS) skip(id, n, "Set PHASE5_EMAIL and PHASE5_PASSWORD to run authenticated checks.");
  finish();
}

try {
  const l = await login(EMAIL, PASSWORD);
  token = l.access;
  record("A0", "Admin login", l.ok && !!token && String(l.role).toUpperCase() === "ADMIN", l.ok ? `role=${l.role}` : `HTTP ${l.status} (credentials rejected)`);
} catch (e) {
  record("A0", "Admin login", false, e.message);
}
if (!token || !db) finish();

/* Invoices */
let apiInvoices = [];
try {
  const r = await all("/finance/invoices/");
  apiInvoices = r.items;
  const dbN = q1("SELECT COUNT(*) n FROM finance_invoices").n;
  record("I1", "Invoice list count API = DB", r.count === dbN && r.items.length === dbN, `API ${r.count} (fetched ${r.items.length}) · DB ${dbN}`);

  const byId = new Map(q("SELECT * FROM finance_invoices").map((x) => [x.id, x]));
  const itemsBy = new Map();
  for (const it of q("SELECT * FROM finance_invoice_items")) {
    if (!itemsBy.has(it.invoice_id)) itemsBy.set(it.invoice_id, []);
    itemsBy.get(it.invoice_id).push(it);
  }
  const problems = [];
  const money = ["subtotal", "discount_amount", "taxable_amount", "cgst_amount", "sgst_amount", "igst_amount", "total_amount"];
  for (const a of r.items) {
    const d = byId.get(a.id);
    if (!d) { problems.push(`#${a.id} missing in DB`); continue; }
    const diffs = [];
    if (d.invoice_number !== a.invoice_number) diffs.push("invoice_number");
    if (d.status !== a.status) diffs.push("status");
    if (d.client_id !== a.client) diffs.push("client");
    if (String(d.issue_date) !== a.issue_date) diffs.push("issue_date");
    for (const k of money) if (paise(d[k]) !== paise(a[k])) diffs.push(`${k} ${a[k]}≠${fmt(paise(d[k]))}`);
    const its = itemsBy.get(a.id) ?? [];
    if (its.length !== a.items.length) diffs.push(`items ${a.items.length}≠${its.length}`);
    const lineSum = its.reduce((t, it) => t + paise(it.line_total), 0);
    if (its.length && lineSum !== paise(d.total_amount)) diffs.push(`Σ line_total ${fmt(lineSum)} ≠ total ${fmt(paise(d.total_amount))}`);
    const tax = paise(d.cgst_amount) + paise(d.sgst_amount) + paise(d.igst_amount);
    if (paise(d.taxable_amount) + tax !== paise(d.total_amount)) diffs.push("taxable + GST ≠ total");
    if (paise(d.cgst_amount) !== paise(d.sgst_amount)) diffs.push("CGST ≠ SGST");
    if (paise(d.igst_amount) > 0 && paise(d.cgst_amount) > 0) diffs.push("both IGST and CGST set");
    if (diffs.length) problems.push(`${a.invoice_number}: ${diffs.join(", ")}`);
  }
  record("I2", "Invoice fields, items and totals API = DB", problems.length === 0,
    r.items.length === 0 ? "No invoices yet (nothing to compare)" : problems.length ? problems.join("; ") : `${r.items.length} invoices, ${[...itemsBy.values()].flat().length} items match`);

  const paid = new Map(q(`SELECT a.invoice_id, SUM(CAST(ROUND(a.allocated_amount*100) AS INTEGER)) p FROM finance_payment_allocations a
                          JOIN finance_payments pm ON pm.id=a.payment_id WHERE a.status='ACTIVE' AND pm.status='CONFIRMED' GROUP BY a.invoice_id`).map((x) => [x.invoice_id, x.p]));
  const balProblems = [];
  for (const a of r.items) {
    const d = byId.get(a.id);
    if (!d) continue;
    const p = paid.get(a.id) ?? 0;
    const out = Math.max(0, paise(d.total_amount) - p);
    const st = d.status === "DRAFT" || p <= 0 ? "UNPAID" : p < paise(d.total_amount) ? "PARTIALLY_PAID" : "PAID";
    if (paise(a.total_paid) !== p || paise(a.outstanding_amount) !== out || a.payment_status !== st)
      balProblems.push(`${a.invoice_number}: API paid ${a.total_paid}/out ${a.outstanding_amount}/${a.payment_status} vs DB ${fmt(p)}/${fmt(out)}/${st}`);
  }
  record("I3", "Invoice paid/outstanding/payment_status = DB allocations", balProblems.length === 0,
    r.items.length === 0 ? "No invoices yet" : balProblems.length ? balProblems.join("; ") : `${r.items.length} invoices balanced`);

  const nums = r.items.map((i) => i.invoice_number);
  const fmtOk = nums.every((n) => /^[A-Z]+\/\d{4}-\d{2}\/\d{4,}$/.test(n));
  record("I4", "Invoice numbers are backend-format and unique", fmtOk && new Set(nums).size === nums.length,
    nums.length ? nums.join(", ") : "No invoices yet");
} catch (e) {
  record("I1", "Invoice checks", false, e.message);
}

try {
  if (apiInvoices.length === 0) {
    skip("I5", "Invoice PDFs download as application/pdf", "No invoices exist yet.");
  } else {
    const bad = [];
    for (const inv of apiInvoices.slice(0, 20)) {
      const r = await req(`/finance/invoices/${inv.id}/pdf/`, { raw: true });
      if (r.status !== 200 || !r.type.startsWith("application/pdf") || r.buf.subarray(0, 4).toString() !== "%PDF") bad.push(`${inv.invoice_number}: ${r.status} ${r.type}`);
    }
    record("I5", "Invoice PDFs download as application/pdf", bad.length === 0, bad.length ? bad.join("; ") : `${Math.min(20, apiInvoices.length)} PDFs OK (%PDF header)`);
  }
} catch (e) { record("I5", "Invoice PDFs download as application/pdf", false, e.message); }

/* Payments */
try {
  const r = await all("/finance/payments/");
  const dbRows = q("SELECT * FROM finance_payments");
  record("P1", "Payment list count API = DB", r.count === dbRows.length && r.items.length === dbRows.length, `API ${r.count} (fetched ${r.items.length}) · DB ${dbRows.length}`);
  const byId = new Map(dbRows.map((x) => [hex(x.id), x]));
  const allocs = q("SELECT * FROM finance_payment_allocations");
  const problems = [];
  for (const a of r.items) {
    const d = byId.get(hex(a.id));
    if (!d) { problems.push(`${a.payment_number} missing in DB`); continue; }
    const diffs = [];
    if (d.payment_number !== a.payment_number) diffs.push("payment_number");
    if (d.status !== a.status) diffs.push("status");
    if (d.client_id !== a.client) diffs.push("client");
    if (paise(d.amount) !== paise(a.amount)) diffs.push("amount");
    if (String(d.payment_date) !== a.payment_date) diffs.push("payment_date");
    if (d.payment_method !== a.payment_method) diffs.push("payment_method");
    const mine = allocs.filter((x) => hex(x.payment_id) === hex(a.id));
    if (mine.length !== a.allocations.length) diffs.push(`allocations ${a.allocations.length}≠${mine.length}`);
    const activeSum = mine.filter((x) => x.status === "ACTIVE").reduce((t, x) => t + paise(x.allocated_amount), 0);
    const expAlloc = d.status === "VOIDED" ? 0 : activeSum;
    const expUn = d.status === "VOIDED" ? 0 : Math.max(0, paise(d.amount) - activeSum);
    if (paise(a.allocated_amount) !== expAlloc || paise(a.unallocated_amount) !== expUn) diffs.push(`balance API ${a.allocated_amount}/${a.unallocated_amount} vs DB ${fmt(expAlloc)}/${fmt(expUn)}`);
    if (diffs.length) problems.push(`${a.payment_number}: ${diffs.join(", ")}`);
  }
  record("P2", "Payment fields, allocations and balances API = DB", problems.length === 0,
    r.items.length === 0 ? "No payments yet (nothing to compare)" : problems.length ? problems.join("; ") : `${r.items.length} payments match`);

  const inc = await all("/finance/income/");
  const incProblems = [];
  for (const p of r.items) {
    const n = inc.items.filter((x) => x.is_payment_receipt && x.payment_number === p.payment_number).length;
    if (p.status === "CONFIRMED" && n !== 1) incProblems.push(`${p.payment_number}: ${n} income records via API`);
    if (p.status === "VOIDED" && n !== 0) incProblems.push(`${p.payment_number} (voided): ${n} income records via API`);
  }
  record("P3", "Payment income visible via API exactly once", incProblems.length === 0,
    r.items.length === 0 ? `No payments yet · ${inc.items.length} income records, ${inc.items.filter((x) => x.is_payment_receipt).length} from payments` : incProblems.length ? incProblems.join("; ") : `${r.items.length} payments checked`);
} catch (e) { record("P1", "Payment checks", false, e.message); }

/* Reports (fixed period so DB comparisons use the response's own window) */
const PERIOD = "current_fy";
const sumBetween = (table, col, s, e, extra = "") =>
  q(`SELECT amount FROM ${table} WHERE ${col} BETWEEN ? AND ? ${extra}`, s, e).reduce((t, x) => t + paise(x.amount), 0);
const countBetween = (table, col, s, e) => q1(`SELECT COUNT(*) n FROM ${table} WHERE ${col} BETWEEN ? AND ?`, s, e).n;

let reports = {};
try {
  for (const k of ["profit-loss", "income", "expenses", "outstanding-invoices", "payments", "tax-summary"]) {
    const r = await req(`/finance/reports/${k}/${k === "outstanding-invoices" ? "" : `?period=${PERIOD}`}`);
    if (r.status !== 200) throw new Error(`${k} → HTTP ${r.status}`);
    reports[k] = r.body;
  }
  const pl = reports["profit-loss"];
  const inc = sumBetween("finance_income_records", "received_date", pl.start_date, pl.end_date);
  const exp = sumBetween("finance_expense_records", "expense_date", pl.start_date, pl.end_date);
  const payIncome = sumBetween("finance_income_records", "received_date", pl.start_date, pl.end_date, "AND payment_id IS NOT NULL");
  const confirmedPay = sumBetween("finance_payments", "payment_date", pl.start_date, pl.end_date, "AND status='CONFIRMED'");
  record("R1", "P&L totals = DB sums (payment income counted once)",
    paise(pl.total_income) === inc && paise(pl.total_expenses) === exp && paise(pl.net_profit) === inc - exp && payIncome === confirmedPay,
    `${pl.period} ${pl.start_date}…${pl.end_date} · income API ${pl.total_income}/DB ${fmt(inc)} · expenses ${pl.total_expenses}/${fmt(exp)} · net ${pl.net_profit}/${fmt(inc - exp)} · payment-income ${fmt(payIncome)} = confirmed payments ${fmt(confirmedPay)}`);

  const ir = reports.income, er = reports.expenses;
  const iDb = sumBetween("finance_income_records", "received_date", ir.start_date, ir.end_date);
  const eDb = sumBetween("finance_expense_records", "expense_date", er.start_date, er.end_date);
  const manual = sumBetween("finance_income_records", "received_date", ir.start_date, ir.end_date, "AND payment_id IS NULL");
  record("R2", "Income/expense report totals = DB",
    paise(ir.total_received) === iDb && ir.transaction_count === countBetween("finance_income_records", "received_date", ir.start_date, ir.end_date) &&
    paise(ir.manual_income_total) === manual && paise(ir.manual_income_total) + paise(ir.payment_income_total) === paise(ir.total_received) &&
    paise(er.total_expenses) === eDb && er.transaction_count === countBetween("finance_expense_records", "expense_date", er.start_date, er.end_date),
    `income ${ir.total_received}/DB ${fmt(iDb)} (manual ${ir.manual_income_total} + payments ${ir.payment_income_total}) · expenses ${er.total_expenses}/DB ${fmt(eDb)}`);

  const orr = reports["outstanding-invoices"];
  const issued = q("SELECT id, total_amount FROM finance_invoices WHERE status='ISSUED'");
  const paid = new Map(q(`SELECT a.invoice_id, SUM(CAST(ROUND(a.allocated_amount*100) AS INTEGER)) p FROM finance_payment_allocations a
                          JOIN finance_payments pm ON pm.id=a.payment_id WHERE a.status='ACTIVE' AND pm.status='CONFIRMED' GROUP BY a.invoice_id`).map((x) => [x.invoice_id, x.p]));
  const invoiced = issued.reduce((t, x) => t + paise(x.total_amount), 0);
  const outstanding = issued.reduce((t, x) => t + Math.max(0, paise(x.total_amount) - (paid.get(x.id) ?? 0)), 0);
  record("R3", "Outstanding report = DB", orr.total_invoices_count === issued.length && paise(orr.total_invoiced_value) === invoiced && paise(orr.total_outstanding_amount) === outstanding,
    `issued ${orr.total_invoices_count}/${issued.length} · invoiced ${orr.total_invoiced_value}/${fmt(invoiced)} · outstanding ${orr.total_outstanding_amount}/${fmt(outstanding)}`);

  const pr = reports.payments;
  const conf = q("SELECT amount FROM finance_payments WHERE status='CONFIRMED' AND payment_date BETWEEN ? AND ?", pr.start_date, pr.end_date);
  const vd = q("SELECT amount FROM finance_payments WHERE status='VOIDED' AND payment_date BETWEEN ? AND ?", pr.start_date, pr.end_date);
  const confSum = conf.reduce((t, x) => t + paise(x.amount), 0);
  record("R4", "Payments report = DB",
    pr.total_confirmed_payments_count === conf.length && paise(pr.total_confirmed_amount) === confSum && pr.total_voided_payments_count === vd.length &&
    paise(pr.total_allocated_amount) + paise(pr.total_unallocated_amount) === confSum,
    `confirmed ${pr.total_confirmed_payments_count}/${conf.length} = ${pr.total_confirmed_amount}/DB ${fmt(confSum)} · allocated ${pr.total_allocated_amount} + unallocated ${pr.total_unallocated_amount} · voided ${pr.total_voided_payments_count}`);

  const tr = reports["tax-summary"];
  const ti = q("SELECT taxable_amount, cgst_amount, sgst_amount, igst_amount, total_amount FROM finance_invoices WHERE status='ISSUED' AND issue_date BETWEEN ? AND ?", tr.start_date, tr.end_date);
  const S = (k) => ti.reduce((t, x) => t + paise(x[k]), 0);
  record("R5", "GST summary = DB (issued invoices)",
    tr.total_issued_invoices_count === ti.length && paise(tr.total_taxable_value) === S("taxable_amount") && paise(tr.total_cgst) === S("cgst_amount") &&
    paise(tr.total_sgst) === S("sgst_amount") && paise(tr.total_igst) === S("igst_amount") && paise(tr.total_gst) === S("cgst_amount") + S("sgst_amount") + S("igst_amount"),
    `${tr.total_issued_invoices_count} invoices · taxable ${tr.total_taxable_value} · CGST ${tr.total_cgst} · SGST ${tr.total_sgst} · IGST ${tr.total_igst} · GST ${tr.total_gst}`);
} catch (e) { record("R1", "Report checks", false, e.message); }

/* Exports */
try {
  const bad = [];
  const checks = [];
  for (const k of ["profit-loss", "income", "expenses", "outstanding-invoices", "payments", "tax-summary"]) {
    const qs = k === "outstanding-invoices" ? "?export=csv" : `?period=${PERIOD}&export=csv`;
    const r = await req(`/finance/reports/${k}/${qs}`, { raw: true });
    const text = r.buf.toString("utf8");
    if (r.status !== 200 || !r.type.startsWith("text/csv") || text.split("\n").length < 2) { bad.push(`${k}: ${r.status} ${r.type}`); continue; }
    checks.push(`${k} ${text.trim().split("\n").length - 1} rows`);
  }
  // Totals in the P&L CSV must equal the JSON report.
  const plCsv = (await req(`/finance/reports/profit-loss/?period=${PERIOD}&export=csv`, { raw: true })).buf.toString("utf8");
  const pl = reports["profit-loss"];
  if (pl && !(plCsv.includes(`,${pl.total_income},`) && plCsv.includes(`,${pl.total_expenses},`))) bad.push("profit-loss CSV totals differ from JSON");
  record("E1", "CSV exports for all 6 reports (P&L CSV totals = JSON)", bad.length === 0, bad.length ? bad.join("; ") : checks.join(" · "));
} catch (e) { record("E1", "CSV exports", false, e.message); }

try {
  const bad = [];
  for (const k of ["profit-loss", "tax-summary"]) {
    const r = await req(`/finance/reports/${k}/?period=${PERIOD}&export=pdf`, { raw: true });
    if (r.status !== 200 || !r.type.startsWith("application/pdf") || r.buf.subarray(0, 4).toString() !== "%PDF") bad.push(`${k}: ${r.status} ${r.type}`);
  }
  record("E2", "PDF exports (P&L, GST) return application/pdf", bad.length === 0, bad.length ? bad.join("; ") : "2/2 PDFs OK (%PDF header)");
} catch (e) { record("E2", "PDF exports", false, e.message); }

/* Non-admin denial */
if (!NA_EMAIL || !NA_PASSWORD) {
  skip("X1", "Non-admin is denied (403)", "Set PHASE5_NONADMIN_EMAIL / PHASE5_NONADMIN_PASSWORD for an existing non-admin account.");
} else {
  try {
    const l = await login(NA_EMAIL, NA_PASSWORD);
    if (!l.ok || !l.access) record("X1", "Non-admin is denied (403)", false, `login HTTP ${l.status}`);
    else if (String(l.role).toUpperCase() === "ADMIN") record("X1", "Non-admin is denied (403)", false, "the supplied account is an ADMIN");
    else {
      const paths = ["/finance/invoices/", "/finance/payments/", "/finance/reports/profit-loss/", "/finance/reports/tax-summary/?export=pdf"];
      const codes = [];
      for (const p of paths) codes.push([p, (await req(p, { bearer: l.access, raw: true })).status]);
      const wrong = codes.filter(([, s]) => s !== 403);
      record("X1", "Non-admin is denied (403)", wrong.length === 0, `role=${l.role} · ${codes.map(([p, s]) => `${p} → ${s}`).join(", ")}`);
    }
  } catch (e) { record("X1", "Non-admin is denied (403)", false, e.message); }
}

finish();
