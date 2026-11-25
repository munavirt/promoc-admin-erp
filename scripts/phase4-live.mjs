#!/usr/bin/env node
/**
 * Phase 4 finance live verification — READ-ONLY.
 *
 * Rebuilt on 2026-11-16 from the checks documented in
 * PHASE_4_FINANCE_INTEGRATION_REPORT.md (§6/§7). The original scratchpad copy
 * was lost when its temp directory was cleaned up.
 *
 * Safety guarantees:
 *   - HTTP: only GET requests, plus one POST /api/accounts/login/ (authenticated mode only).
 *     No finance, settings or category record is ever created, changed or deleted.
 *   - Database: opened with SQLite readOnly=true; SELECT statements only.
 *   - Credentials come only from env vars; the password and tokens are never printed or saved.
 *
 * Usage (from promocraft-agency-hub/):
 *   node scripts/phase4-live.mjs                      # unauthenticated checks only
 *   PHASE4_EMAIL=… PHASE4_PASSWORD=… node scripts/phase4-live.mjs   # full read-only run
 *
 * Optional env:
 *   PHASE4_API_BASE  default http://127.0.0.1:8000/api
 *   PHASE4_DB_PATH   default ../promocraft-admin-backend/db.sqlite3 (relative to this project)
 *   PHASE4_MEDIA_DIR default ../promocraft-admin-backend/media
 *
 * Requires Node >= 22.5 (built-in fetch and node:sqlite). No npm dependencies.
 * Exit code: 0 = all checks passed, 1 = at least one FAIL, 2 = setup error.
 */
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const backendRoot = path.resolve(projectRoot, "..", "promocraft-admin-backend");

const API = (process.env.PHASE4_API_BASE || "http://127.0.0.1:8000/api").replace(/\/+$/, "");
const DB_PATH = path.resolve(process.env.PHASE4_DB_PATH || path.join(backendRoot, "db.sqlite3"));
const MEDIA_DIR = path.resolve(process.env.PHASE4_MEDIA_DIR || path.join(backendRoot, "media"));
const EMAIL = process.env.PHASE4_EMAIL || "";
const PASSWORD = process.env.PHASE4_PASSWORD || "";
const RESULTS_FILE = path.join(here, "phase4-live-results.json");

if (process.env.PHASE4_CREATE_QA) {
  console.error("PHASE4_CREATE_QA is not supported: this script is read-only and never creates records.");
  process.exit(2);
}

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 5)) {
  console.error(`Node ${process.versions.node} is too old: need >= 22.5 for node:sqlite.`);
  process.exit(2);
}

// node:sqlite prints an ExperimentalWarning on some Node versions; keep output clean.
const origEmit = process.emitWarning;
process.emitWarning = (w, ...rest) =>
  String(w?.message ?? w).includes("SQLite") ? undefined : origEmit.call(process, w, ...rest);
const { DatabaseSync } = await import("node:sqlite");

// ───────────────────────── helpers ─────────────────────────
const results = [];
function record(id, name, pass, detail = "") {
  results.push({ id, name, status: pass ? "PASS" : "FAIL", detail });
  console.log(`${pass ? "✅ PASS" : "❌ FAIL"}  ${id.padEnd(4)} ${name}${detail ? `\n         ${detail}` : ""}`);
}
function skip(id, name, why) {
  results.push({ id, name, status: "SKIP", detail: why });
  console.log(`⏭️  SKIP  ${id.padEnd(4)} ${name}\n         ${why}`);
}

/** Decimal string/number → integer paise, without float drift. */
function paise(v) {
  if (v === null || v === undefined || v === "") return 0;
  const s = String(v).trim();
  const neg = s.startsWith("-");
  const [int, frac = ""] = s.replace(/^[-+]/, "").split(".");
  const n = Number(int || "0") * 100 + Number((frac + "00").slice(0, 2));
  return neg ? -n : n;
}

let accessToken = null;
async function get(pathAndQuery, { auth = true } = {}) {
  const headers = { Accept: "application/json" };
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(`${API}${pathAndQuery}`, { method: "GET", headers });
  let body = null;
  const text = await res.text();
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
}

async function getAllPages(listPath) {
  const items = [];
  let url = `${listPath}${listPath.includes("?") ? "&" : "?"}page=1`;
  let count = null;
  for (let page = 1; page < 1000; page++) {
    const r = await get(url);
    if (r.status !== 200) throw new Error(`GET ${url} → ${r.status}`);
    if (Array.isArray(r.body)) return { count: r.body.length, items: r.body };
    count = r.body.count;
    items.push(...(r.body.results || []));
    if (!r.body.next) break;
    url = `${listPath}${listPath.includes("?") ? "&" : "?"}page=${page + 1}`;
  }
  return { count, items };
}

const arrayOf = (b) =>
  Array.isArray(b) ? b : b?.results ?? b?.trends ?? b?.data ?? b?.transactions ?? null;

// ───────────────────────── pre-flight ─────────────────────────
console.log(`Phase 4 live verification (read-only)\n  API: ${API}\n  DB : ${DB_PATH}\n  Mode: ${EMAIL ? "authenticated" : "unauthenticated only"}\n`);

try {
  const h = await fetch(`${API}/health/`);
  record("P0", "Backend reachable (GET /health/)", h.ok, `HTTP ${h.status}`);
} catch (e) {
  record("P0", "Backend reachable (GET /health/)", false, `${e.cause?.code || e.message} — is Django running on ${API}?`);
  finish();
}

let db = null;
if (!existsSync(DB_PATH)) {
  record("P1", "SQLite database found (read-only)", false, `Not found: ${DB_PATH} (set PHASE4_DB_PATH)`);
} else {
  try {
    db = new DatabaseSync(DB_PATH, { readOnly: true });
    db.prepare("SELECT 1").get();
    record("P1", "SQLite database opened read-only", true);
  } catch (e) {
    record("P1", "SQLite database opened read-only", false, e.message);
  }
}
const q = (sql, ...p) => db.prepare(sql).all(...p);
const q1 = (sql, ...p) => db.prepare(sql).get(...p);

// ───────────────────────── U1: unauthenticated ─────────────────────────
const protectedPaths = [
  "/settings/",
  "/finance/categories/",
  "/finance/income/",
  "/finance/expenses/",
  "/finance/overview/",
  "/finance/overview/trends/",
  "/finance/overview/recent-transactions/",
];
const unauth = [];
for (const p of protectedPaths) unauth.push([p, (await get(p, { auth: false })).status]);
const bad = unauth.filter(([, s]) => s !== 401);
record(
  "U1",
  "Unauthenticated finance/settings GETs are rejected with 401",
  bad.length === 0,
  bad.length ? bad.map(([p, s]) => `${p} → ${s}`).join(", ") : `${unauth.length}/${unauth.length} → 401`,
);

if (db) {
  const c = q1("SELECT COUNT(*) n FROM finance_categories").n;
  const i = q1("SELECT COUNT(*) n FROM finance_income_records").n;
  const e = q1("SELECT COUNT(*) n FROM finance_expense_records").n;
  const s = q1("SELECT COUNT(*) n FROM agency_settings").n;
  console.log(`\n  DB snapshot (read-only): ${c} categories · ${i} income · ${e} expenses · ${s} agency settings\n`);
}

// ───────────────────────── authenticated ─────────────────────────
if (!EMAIL || !PASSWORD) {
  for (const [id, n] of [
    ["A0", "Admin login"], ["S1", "Agency settings API = DB"], ["C1", "Categories API = DB"],
    ["L1", "Income count API = DB"], ["M1", "Income records API = DB rows"],
    ["L2", "Expense count API = DB"], ["M2", "Expense records API = DB rows (incl. receipt)"],
    ["O1", "Overview this_year totals = DB sums"], ["O2", "Trends + recent transactions load"],
  ]) skip(id, n, "Set PHASE4_EMAIL and PHASE4_PASSWORD to run authenticated checks.");
  finish();
}

// A0 — login (the only non-GET request; it creates no finance data)
try {
  const res = await fetch(`${API}/accounts/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const body = await res.json().catch(() => ({}));
  accessToken = body?.access || body?.tokens?.access || null;
  const role = body?.user?.role ?? "unknown";
  record("A0", "Admin login", res.ok && !!accessToken && String(role).toUpperCase() === "ADMIN",
    res.ok ? `role=${role}` : `HTTP ${res.status} (credentials rejected)`);
} catch (e) {
  record("A0", "Admin login", false, e.message);
}
if (!accessToken) finish();
if (!db) {
  skip("--", "DB comparisons", "Database unavailable; see P1.");
  finish();
}

// S1 — agency settings (read-only)
try {
  const r = await get("/settings/");
  const rows = q("SELECT * FROM agency_settings");
  if (r.status === 404) {
    record("S1", "Agency settings API = DB", rows.length === 0,
      rows.length === 0 ? "Not configured: API 404, DB 0 rows (expected until you use the setup form)"
                        : `API 404 but DB has ${rows.length} row(s)`);
  } else if (r.status === 200) {
    const ok = rows.length === 1 && rows[0].agency_name === r.body.agency_name;
    record("S1", "Agency settings API = DB", ok, `API "${r.body.agency_name}" · DB ${rows.length} row(s)`);
  } else {
    record("S1", "Agency settings API = DB", false, `HTTP ${r.status}`);
  }
} catch (e) { record("S1", "Agency settings API = DB", false, e.message); }

// C1 — categories
try {
  const api = await getAllPages("/finance/categories/");
  const dbRows = q("SELECT id, name, type, is_active FROM finance_categories");
  const byId = new Map(dbRows.map((r) => [r.id, r]));
  const mismatch = api.items.filter((c) => {
    const d = byId.get(c.id);
    return !d || d.name !== c.name || d.type !== c.type || Boolean(d.is_active) !== Boolean(c.is_active);
  });
  record("C1", "Categories API = DB", api.items.length === dbRows.length && mismatch.length === 0,
    `API ${api.items.length} · DB ${dbRows.length}${mismatch.length ? ` · mismatched ids: ${mismatch.map((m) => m.id).join(",")}` : ""}`);
} catch (e) { record("C1", "Categories API = DB", false, e.message); }

// L1/M1 — income
try {
  const api = await getAllPages("/finance/income/");
  const dbRows = q(`SELECT id, category_id, description, amount, received_date, payment_method,
                           reference_number, notes FROM finance_income_records`);
  record("L1", "Income count API = DB", api.count === dbRows.length && api.items.length === dbRows.length,
    `API count ${api.count} (fetched ${api.items.length}) · DB ${dbRows.length}`);
  const byId = new Map(dbRows.map((r) => [r.id, r]));
  const problems = [];
  for (const a of api.items) {
    const d = byId.get(a.id);
    if (!d) { problems.push(`#${a.id} missing in DB`); continue; }
    const diffs = [];
    if (d.category_id !== a.category) diffs.push("category");
    if (d.description !== a.description) diffs.push("description");
    if (paise(d.amount) !== paise(a.amount)) diffs.push(`amount ${a.amount}≠${d.amount}`);
    if (String(d.received_date) !== a.received_date) diffs.push("received_date");
    if (d.payment_method !== a.payment_method) diffs.push("payment_method");
    if ((d.reference_number ?? "") !== (a.reference_number ?? "")) diffs.push("reference_number");
    if ((d.notes ?? "") !== (a.notes ?? "")) diffs.push("notes");
    if (diffs.length) problems.push(`#${a.id}: ${diffs.join(", ")}`);
  }
  record("M1", "Income records API = DB rows", problems.length === 0 && api.items.length > 0,
    api.items.length === 0 ? "No income records yet — create one through the UI first"
      : problems.length ? problems.join("; ")
      : api.items.map((a) => `#${a.id} "${a.description}" ${a.amount}`).join("; "));
} catch (e) { record("M1", "Income records API = DB rows", false, e.message); }

// L2/M2 — expenses
try {
  const api = await getAllPages("/finance/expenses/");
  const dbRows = q(`SELECT id, category_id, description, amount, expense_date, payment_method,
                           vendor_name, reference_number, receipt_file, notes FROM finance_expense_records`);
  record("L2", "Expense count API = DB", api.count === dbRows.length && api.items.length === dbRows.length,
    `API count ${api.count} (fetched ${api.items.length}) · DB ${dbRows.length}`);
  const byId = new Map(dbRows.map((r) => [r.id, r]));
  const problems = [];
  for (const a of api.items) {
    const d = byId.get(a.id);
    if (!d) { problems.push(`#${a.id} missing in DB`); continue; }
    const diffs = [];
    if (d.category_id !== a.category) diffs.push("category");
    if (d.description !== a.description) diffs.push("description");
    if (paise(d.amount) !== paise(a.amount)) diffs.push(`amount ${a.amount}≠${d.amount}`);
    if (String(d.expense_date) !== a.expense_date) diffs.push("expense_date");
    if (d.payment_method !== a.payment_method) diffs.push("payment_method");
    if ((d.vendor_name ?? "") !== (a.vendor_name ?? "")) diffs.push("vendor_name");
    if ((d.reference_number ?? "") !== (a.reference_number ?? "")) diffs.push("reference_number");
    if ((d.notes ?? "") !== (a.notes ?? "")) diffs.push("notes");
    const dbFile = d.receipt_file || "";
    const apiFile = a.receipt_file || "";
    if (Boolean(dbFile) !== Boolean(apiFile)) diffs.push("receipt presence");
    else if (dbFile) {
      if (!decodeURIComponent(apiFile).endsWith(dbFile)) diffs.push("receipt path");
      if (!existsSync(path.join(MEDIA_DIR, dbFile))) diffs.push("receipt file missing on disk");
    }
    if (diffs.length) problems.push(`#${a.id}: ${diffs.join(", ")}`);
  }
  record("M2", "Expense records API = DB rows (incl. receipt)", problems.length === 0 && api.items.length > 0,
    api.items.length === 0 ? "No expense records yet — create one through the UI first"
      : problems.length ? problems.join("; ")
      : api.items.map((a) => `#${a.id} "${a.description}" ${a.amount}${a.receipt_file ? " +receipt" : ""}`).join("; "));
} catch (e) { record("M2", "Expense records API = DB rows (incl. receipt)", false, e.message); }

// O1 — overview totals vs DB sums over the API's own period window
try {
  const r = await get("/finance/overview/?period=this_year");
  if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
  const o = r.body;
  const { period_start: s, period_end: e } = o;
  const inc = q("SELECT amount FROM finance_income_records WHERE received_date BETWEEN ? AND ?", s, e);
  const exp = q("SELECT amount FROM finance_expense_records WHERE expense_date BETWEEN ? AND ?", s, e);
  const dbInc = inc.reduce((t, x) => t + paise(x.amount), 0);
  const dbExp = exp.reduce((t, x) => t + paise(x.amount), 0);
  const ok =
    paise(o.total_income) === dbInc && paise(o.total_expenses) === dbExp &&
    paise(o.net_cash_flow) === dbInc - dbExp &&
    o.income_transaction_count === inc.length && o.expense_transaction_count === exp.length;
  const fmt = (p) => (p / 100).toFixed(2);
  record("O1", "Overview this_year totals = DB sums", ok,
    `${s}…${e} · income API ${o.total_income}/DB ${fmt(dbInc)} (${o.income_transaction_count}/${inc.length}) · ` +
    `expenses API ${o.total_expenses}/DB ${fmt(dbExp)} (${o.expense_transaction_count}/${exp.length}) · ` +
    `net API ${o.net_cash_flow}/DB ${fmt(dbInc - dbExp)}`);
} catch (e) { record("O1", "Overview this_year totals = DB sums", false, e.message); }

// O2 — trends + recent transactions load
try {
  const t6 = await get("/finance/overview/trends/?period=6m&grouping=month");
  const t1 = await get("/finance/overview/trends/?period=1y&grouping=month");
  const rc = await get("/finance/overview/recent-transactions/?limit=10");
  const a6 = arrayOf(t6.body), a1 = arrayOf(t1.body), ar = arrayOf(rc.body);
  const monthly = (a) => Array.isArray(a) && a.every((x) => /^\d{4}-\d{2}$/.test(String(x.period)));
  const ok = t6.status === 200 && t1.status === 200 && rc.status === 200 && monthly(a6) && monthly(a1) && Array.isArray(ar);
  record("O2", "Trends (6m, 1y monthly) + recent transactions load", ok,
    `trends 6m HTTP ${t6.status} (${a6?.length ?? "?"} buckets) · 1y HTTP ${t1.status} (${a1?.length ?? "?"}) · recent HTTP ${rc.status} (${ar?.length ?? "?"} items)`);
} catch (e) { record("O2", "Trends + recent transactions load", false, e.message); }

finish();

// ───────────────────────── output ─────────────────────────
function finish() {
  try { db?.close(); } catch {}
  const summary = {
    generated_at: new Date().toISOString(),
    api_base: API,
    db_path: DB_PATH,
    mode: EMAIL && PASSWORD ? "authenticated-read-only" : "unauthenticated",
    pass: results.filter((r) => r.status === "PASS").length,
    fail: results.filter((r) => r.status === "FAIL").length,
    skip: results.filter((r) => r.status === "SKIP").length,
    results, // never contains credentials or tokens
  };
  writeFileSync(RESULTS_FILE, JSON.stringify(summary, null, 2) + "\n");
  console.log(`\n${summary.pass} passed · ${summary.fail} failed · ${summary.skip} skipped`);
  console.log(`Results saved to ${path.relative(process.cwd(), RESULTS_FILE) || RESULTS_FILE}`);
  process.exit(summary.fail ? 1 : 0);
}
