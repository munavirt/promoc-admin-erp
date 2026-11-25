# PromoCraft ERP — Phase 1: Authentication + Employee Management Integration

Status: **Implementation complete. Backend startup fixed and verified. Final acceptance PENDING: the developer still has to run the admin workflow suite with their own credentials (§7, §9).**

_Last updated: 2026-11-15 (Phase 1 finalization)._

Scope: `promocraft-agency-hub` (frontend) only. No backend source, models or migrations were changed. Nothing was committed, pushed or deployed.

---

## 0. Backend syntax correction & startup verification (finalization)

### 0.1 The error
`promocraft-admin-backend/finance/reports.py`, `FinancialReportService.get_income_report` (starts at line 289). Its `return { … }` dict opens at line 396 and is properly closed at line 410. Line 411 had a second `}` at the same indentation:

```python
            "transactions": transactions,
        }
        }          # ← line 411: unmatched, SyntaxError
```

### 0.2 Why the brace was genuinely unnecessary
- Every key from 397–409 is inside the dict that closes at 410, so nothing was left unclosed.
- No `{`, `(` or `[` is open at that point, so a bare `}` can't close anything. Python rejects it (`SyntaxError: unmatched '}'`).
- The sibling `get_expense_report` return (lines 522–533) has the identical shape and ends at its single `}`.
- `finance/` is untracked in git, so there's no prior version to diff against. The file's mtime (13:41) is close to `agency_settings/models.py` (13:29) and `finance/models.py` (13:36), which suggests it's a leftover from today's edit that removed bank reconciliation (see 0.4).

### 0.3 Correction
**One line deleted (line 411). No other change**, to finance logic, models or migrations.

### 0.4 Startup verification (real `project.settings`, no harness)

| Check | Result |
|---|---|
| `py_compile` of every backend `.py` (excl. venv) | ✅ all compile |
| `python manage.py check` | ✅ `System check identified no issues (0 silenced).` |
| `python manage.py makemigrations --check --dry-run` | ❌ **exit 1: model/migration drift (pre-existing, not caused by this fix; no migration was created).** See below. |
| Dev server (`manage.py runserver`, `DJANGO_SETTINGS_MODULE=project.settings`) | ✅ Running: the developer's own server (pid started 14:58; autoreloaded 14:59:58 right after the fix). My own `runserver` attempt got "port already in use", so I verified against that server instead of starting a second one. |
| Full URLconf import under `project.settings` | ✅ 276 patterns: admin 125, accounts 7, employees 6, projects 10, clients 6, work-items 22, tasks 22, notifications 14, me 2, settings 1, **finance 56**, schema/docs/redoc, media |
| `GET /api/health/` | ✅ 200 `{"status":"ok","service":"PromoCraft ERP Backend"}` |
| Auth/employee endpoints, no token | ✅ `/accounts/profile/`, `/accounts/users/`, `/employees/`, `/employees/1/` → 401; `/finance/` → 401 (route loaded) |
| `POST /accounts/login/` invalid | ✅ 400 with field errors |
| `POST /accounts/token/refresh/` invalid | ✅ 401 `token_not_valid` |

The temporary scratch harness (which skipped `api/finance/`) is **no longer used** and was stopped.

**Migration drift (new finding, needs the finance owner's decision):** `makemigrations --dry-run` wants to create `finance/0006_…` (remove `BankStatementImportBatch` and `BankStatementTransaction`, plus the `bank_account` / matched FK fields on payment, income and expense; alter `invoice.payment_instructions_snapshot`) and `agency_settings/0003_delete_agencybankaccount`. Migration `finance.0005` (bank reconciliation) **is applied** and its tables and columns still exist in `db.sqlite3`. Since the orphaned `bank_account_id` columns are all **nullable**, inserts from the current models still work and Phase 1 isn't affected. Either restore the bank-reconciliation models or generate and apply those migrations deliberately. Not done here (out of scope / forbidden).

## 1. Actual endpoints used

All paths relative to `VITE_API_BASE_URL` (= `http://127.0.0.1:8000/api`). Verified by reading `accounts/api/*`, `employees/api/*`, `project/urls.py`, `project/settings.py`.

| Purpose | Method & path | Request | Response (actual) | Permission |
|---|---|---|---|---|
| Login | `POST /accounts/login/` | `{email, password}` | `{refresh, access, user}` | AllowAny |
| Refresh | `POST /accounts/token/refresh/` | `{refresh}` | `{access}` (ROTATE_REFRESH_TOKENS = False) | AllowAny |
| Logout | `POST /accounts/logout/` | `{refresh}` | `{message}` | IsAuthenticated |
| Current user | `GET /accounts/profile/` | — | `UserSerializer` | IsAuthenticated |
| Update own profile | `PATCH /accounts/profile/` | `{name?, email?, phone?}` | `UserSerializer` | IsAuthenticated |
| List employees | `GET /employees/` | `page, search, department, designation, status, employment_type, ordering` | `{count, next, previous, results[]}` (PAGE_SIZE 10) | IsAdmin |
| Create employee | `POST /employees/` | `EmployeeCreateSerializer` | employee + `temporary_password` | IsAdmin |
| Employee detail | `GET /employees/{id}/` | — | `EmployeeSerializer` | IsAdmin |
| Edit employee | `PATCH /employees/{id}/` | writable fields (§3) | `EmployeeSerializer` | IsAdmin |
| Terminate | `DELETE /employees/{id}/` | — | `{message}`; sets `status=TERMINATED`, `user.is_active=False` | IsAdmin |
| Linked account | `GET /accounts/users/{uuid}/` | — | `UserSerializer` | IsAdmin |
| Account edit / re-enable | `PATCH /accounts/users/{uuid}/` | `{name?, phone?, is_active?}` (backend whitelist: name, phone, is_active, role) | `UserSerializer` | IsAdmin |

Error shapes observed live: `{"non_field_errors": [...]}`, `{"field": ["msg"]}`, `{"detail": "...", "code": "token_not_valid", "messages": [...]}`.

---

## 2. Authentication implementation

| File | Role |
|---|---|
| `src/infrastructure/apiClient.ts` | Central axios instance. `baseURL` = `VITE_API_BASE_URL`. Adds `Authorization: Bearer <access>`. On 401: one shared refresh (`/accounts/token/refresh/`), then replays the request once. A rejected refresh clears tokens and emits `onSessionExpired`. Every failure becomes an `ApiError` (`kind`: network / timeout / cancelled / unauthorized / forbidden / not_found / validation / server / config) with parsed DRF `fieldErrors`. Raw HTML 5xx bodies are never shown. Supports `AbortSignal`. `skipAuth` is used for login and refresh. |
| `src/infrastructure/tokenStorage.ts` | `localStorage` persistence of access + refresh tokens (`promocraft.auth.*`), with guarded access. Tokens are never logged. |
| `src/services/api/auth.service.ts` | login / getProfile / updateProfile / logout against the endpoints above. Logout is best effort on the server; local tokens are always cleared. |
| `src/api/accounts.api.ts` | `LoginResponse = {access, refresh, user}`, `UserProfile` matches `UserSerializer`. `updateProfileApi` drops `timezone` (not a backend field). `simulateDemoRoleApi` removed. |
| `src/store.ts` | `initAuth` restores the session from stored tokens via `GET /accounts/profile/`. An invalid session clears tokens. Network, timeout or 5xx keeps the tokens and sets `authError`, so the user gets a retry screen instead of a silent logout or demo data. `logout` flips to signed-out synchronously. Subscribes to `onSessionExpired`. Demo role switching removed. |
| `src/App.tsx` | `ProtectedRoute`: loading → `authError` retry screen → redirect to `/login` with `state.from`. **Role-based routing:** `ADMIN` gets admin routes, `EMPLOYEE` gets the employee portal, and `CLIENT` or any unknown role gets a "No workspace access" screen. Previously every non-EMPLOYEE role, CLIENT included, fell through to the admin UI. On session expiry it clears the React Query cache and shows a toast. |
| `src/pages/Login.tsx` | Real login. Backend message shown inline ("Invalid email or password", "Account is Disabled", network error). Redirects back to the original route. Shows a "session expired" notice. The demo-credentials box (`admin@promocraft.co / 1234`) was removed because it would not work against Django. |
| `src/components/layout/employee-layout.tsx` | Removed the "Switch to Admin View (Demo)" button: there's no backend equivalent, and it presented a client-side role switch. |
| `.env.local`, `.env.example`, `src/vite-env.d.ts` | `VITE_API_BASE_URL=http://127.0.0.1:8000/api`. |

The backend still enforces authorization. Frontend role routing is a UX guard only, and the backend's `IsAdmin` returning 403 is the real control (see test 10).

---

## 3. Employee API mapping

`src/services/api/employees.service.ts` (real) ← `src/adapters/erp.adapters.ts` (`employeesAdapter`) ← `src/api/employees.api.ts`.

### Create form → `EmployeeCreateSerializer`

| Form field | Backend field | Notes |
|---|---|---|
| Full name | `name` → `User.name` | |
| Email | `email` → `User.email` | backend checks uniqueness |
| Phone | `phone` → `User.phone` | **backend requires digits only**; the form now validates the same rule (placeholder changed to `9876543210`) |
| *(new)* Employee ID | `employee_id` | **Required and unique on the backend; there is no server-side generator.** The old code silently sent a random `EMP-xxxx`. Now it's a visible, pre-filled, editable field. |
| Department | `department` | max 100 |
| Designation | `designation` | max 100 |
| Employment type | `employment_type` | FULL_TIME / PART_TIME / INTERN / FREELANCER |
| Status | `status` | ACTIVE / ON_LEAVE / RESIGNED / TERMINATED |
| Joining date | `joining_date` | backend rejects future dates; `max` set on the input |
| Monthly salary | `salary` | Decimal(10,2), ≥ 0, sent as string or `null` |
| Emergency contact name / phone | `emergency_contact_name` / `emergency_contact_phone` | |
| Residential address | `address` | |
| — | `role` | always `"EMPLOYEE"` (required by the serializer) |

The backend creates the `User` and `Employee` in one `transaction.atomic` and returns `temporary_password` once. The frontend makes **one** request and creates no extra account. The success dialog shows the real password. The fake fallback `"AB12CD34EF"` was removed.

### Edit form

- `PATCH /employees/{id}/`: employee_id, department, designation, employment_type, joining_date, salary (blank → `null`), status, emergency contacts, address.
- Name and phone are read-only in `EmployeeSerializer`, so they go to `PATCH /accounts/users/{user_uuid}/`, and only when changed. If the employee save succeeds but the account save fails, the user is told exactly that.
- Email is shown read-only; no admin endpoint changes it.
- The stored department stays selectable even if it isn't in the preset list.

### List page
Search, department, status and type filters, ordering and pagination all run **server-side**. The stat cards use exact `count` values from filtered requests. Department options come from all records, following `next` pages. There are loading, inline error + Retry, empty and "no matches for filters" states. The sort option "Employee Name" was replaced with "Employee ID" and "Recently Added", because `ordering_fields` is only `employee_id, joining_date, created_at`.

### Detail page
Real record and linked login-account status. **Terminate** (`DELETE`, soft) asks for confirmation and is hidden when already terminated. **Reactivate** = `PATCH status=ACTIVE` (only from TERMINATED/RESIGNED) + `PATCH user is_active=true`. That's two real calls, not atomic. The hardcoded "Recent Activity" entries were replaced with the real `created_at` / `updated_at` and account info.

Validation errors from every endpoint map to their form fields. Unmapped keys appear in a toast with the field name.

---

## 4. Remaining limitations: not supported by the backend (no frontend workarounds added)

The five confirmed limitations:

1. **Server-side logout invalidation:** `rest_framework_simplejwt.token_blacklist` isn't in `INSTALLED_APPS`. `LogoutView`'s `token.blacklist()` fails and the error is swallowed, so a refresh token stays usable for up to 7 days after logout. The frontend only clears its local copy.
2. **Employee email change:** read-only in `EmployeeSerializer`, and not in the `PATCH /accounts/users/{id}/` whitelist. Shown read-only.
3. **Employee password reset by admin:** no endpoint. The UI fields were removed (previously they faked success).
4. **Employee ID generation:** not implemented by the backend. `employee_id` is required and unique, so the admin enters it (pre-filled suggestion).
5. **Server-side employee name sorting:** `ordering_fields` = `employee_id, joining_date, created_at` only. Name sort isn't offered.

Full detail:

| Item | Status |
|---|---|
| Admin changes an employee's **email** | No endpoint (EmployeeSerializer read-only; users PATCH whitelist excludes email). Field shown read-only. |
| Admin sets or resets an employee's **password** | No endpoint. The "Change Password" fields on the edit page were removed. They had never been sent before, so they always faked success. |
| **Server-side logout / token revocation** | `LogoutView` calls `token.blacklist()`, but `rest_framework_simplejwt.token_blacklist` is not in `INSTALLED_APPS`. The resulting error is swallowed, so **refresh tokens stay valid for up to 7 days after logout**. The frontend clears them locally. |
| Employee ID auto-generation | Not in the backend; now an explicit form field. |
| Sorting by employee name | Not in `ordering_fields`. |
| `page_size` query param | Not enabled; page size is fixed at 10. |
| Profile `timezone` (Settings page) | Not a `User` field. Not sent; kept in memory only for the session. |
| Distinct departments endpoint | None; derived from the full list. |
| `PATCH /accounts/users/{id}/` validation | The backend applies values with `setattr` and **no validation**, e.g. the phone digit rule isn't enforced there. The edit form keeps a 20-character max. |
| Atomic reactivate | No single endpoint; two calls. |
| `MANAGER` role | Backend roles are ADMIN / EMPLOYEE / CLIENT only. Frontend finance/nav code still references MANAGER (unchanged, other modules). |

---

## 5. Mock data removed

- **Deleted** `src/services/mock/mock-employees.service.ts` (mock list/create/edit/delete, fake `Promo@xxxx` passwords).
- `employeesAdapter` and `authAdapter` now point to real services. Neither falls back to mock data.
- Removed the fake temporary-password fallback, the client-side random employee ID, the hardcoded "Recent Activity" items on the employee detail page, the demo login box and the demo role switcher.
- Mock auth/employee cases removed from `src/mocks/__tests__/erp-mock-services.test.ts`. The Employee Portal case now calls `mockAuthService` directly.

**Kept on purpose** (they belong to modules not yet integrated):
- `src/mocks/data/employees.ts`: seed rows inside the shared mock DB. Mock **Projects, Tasks and the Employee Portal** use them to hydrate assignee names. The Employees module never shows them. Retyped as `MockEmployeeRecord` (string ids) in `src/mocks/types.ts`.
- `src/services/mock/mock-auth.service.ts`: no longer used for sign-in, but `mock-me` and `mock-tasks` still read its demo session. Marked as legacy.

---

## 6. Files changed

New: `src/infrastructure/tokenStorage.ts`, `src/services/api/auth.service.ts`, `src/services/api/employees.service.ts`, this report.
Modified: `src/infrastructure/apiClient.ts`, `src/api/accounts.api.ts`, `src/api/employees.api.ts`, `src/adapters/erp.adapters.ts`, `src/store.ts`, `src/App.tsx`, `src/pages/Login.tsx`, `src/pages/EmployeeDetail.tsx`, `src/features/employees/pages/{employees-page,add-employee-page,edit-employee-page}.tsx`, `src/components/layout/employee-layout.tsx`, `src/services/mock/mock-auth.service.ts` (type + comment), `src/mocks/types.ts`, `src/mocks/data/employees.ts` (type + comment), `src/mocks/__tests__/erp-mock-services.test.ts`, `src/vite-env.d.ts`, `.env.example`, `.env.local`.
Deleted: `src/services/mock/mock-employees.service.ts`.

Backend (finalization, explicitly authorized): `promocraft-admin-backend/finance/reports.py`, one stray `}` removed at line 411. No other backend file touched.

---

## 7. Test results

### Static checks
| Check | Result |
|---|---|
| `npm run build` | ✅ success (pre-existing >500 kB chunk warning only) |
| `npm test` (existing node:test suites) | ✅ 24/24 pass |
| ESLint, touched files | ✅ 0 errors from Phase 1 code. 2 pre-existing `no-explicit-any` in `store.ts` workspace types (untouched). **`npm run lint` itself is broken:** `eslint.config.js` imports `typescript-eslint`, which is not installed. It was run with an identical scratch config. |
| TypeScript (`tsc --strict --noEmit`, scratch tsconfig) | ✅ 0 errors in Phase 1 files. 38 pre-existing errors elsewhere (finance schemas/forms, projects/tasks/users RHF resolver typing, `main.tsx`, employee portal). **`typescript` is not a project dependency** and `tsconfig.json` has no compiler options, so the project has no working type-check command. |

### Static checks: re-run at finalization (identical results)
Build ✅ · `npm test` 24/24 ✅ · TypeScript: **0 errors in Phase 1 files**; 38 total, all pre-existing in finance / projects / tasks / users / employee-portal / `main.tsx` · ESLint on Phase 1 files: **0 new**; 2 pre-existing `no-explicit-any` in `store.ts` workspace types · `npm run lint` script still fails (missing `typescript-eslint`, pre-existing).

**No mock employee fallback:** `employeesAdapter = employeesService` and `authAdapter = authService` (real). `mock-employees.service.ts` is deleted, and no module references it. The only remaining mock employee seed (`mocks/data/employees.ts`) feeds the mock Projects/Tasks DB, never the Employees module. The network-failure test shows an error, not data.

### Live integration: real frontend modules (via Vite SSR loader) → **real** Django (`project.settings`)
Script: `phase1-integration.mjs` (session scratchpad).

| # | Check | Result |
|---|---|---|
| — | Base URL from `VITE_API_BASE_URL`, `/health/` | ✅ |
| — | Wrong password → "Invalid email or password", no tokens stored | ✅ |
| — | Empty login → per-field errors parsed | ✅ |
| 10a | No token → 401 on `/employees/` | ✅ |
| — | Invalid refresh token → session-expired event + tokens cleared | ✅ |
| — | 3 parallel 401s → exactly 1 refresh request | ✅ |
| — | Server unreachable → `network` error, no demo fallback | ✅ |
| — | AbortSignal cancellation | ✅ |
| — | CORS preflight from `http://localhost:3000` with `Authorization` | ✅ |

### Admin workflow: **to be run by the developer** (not run by Claude)
By instruction, no admin account was created or modified, authentication wasn't bypassed, and the password was neither requested nor printed. Results will be filled in from the developer's run.

| # | Workflow | Script step | Result |
|---|---|---|---|
| 1 | Admin login | `1. Admin logs in` | ⏳ pending developer run |
| 2 | Session restoration (+ transparent access refresh) | `2.` / `2b.` | ⏳ |
| 3 | Employee listing (API count == SQLite count; search/filter/order) | `3.` / `3b.` | ⏳ |
| 4 | Employee creation (one request, `temporary_password`) | `4.` | ⏳ |
| 5 | Database persistence (row + exactly one linked user) | `5.` | ⏳ |
| 6 | Employee details / visible after refresh | `6/7.` | ⏳ |
| 7 | Employee editing (employee + account; read-only fields ignored) | `8.` / `8b.` | ⏳ |
| 8 | Invalid submissions → field errors | `9a.` / `9b.` | ⏳ |
| 9 | Termination + Reactivation | `Terminate (DELETE) … Reactivate restores` | ⏳ |
| 10 | Unauthorized access (EMPLOYEE token → 403) | `10.` | ⏳ |
| — | Logout clears tokens; known blacklist gap documented | last two steps | ⏳ |

**How to run** (backend already running on :8000):
```bash
cd promocraft-agency-hub
read -rs PHASE1_PASSWORD && export PHASE1_PASSWORD   # typed, not echoed, not stored in history
PHASE1_EMAIL='<your admin email>' node /private/tmp/claude-501/-Users-munavirt-Desktop-promocraft-admin/b2d4ba77-da8c-40cc-8ccf-08b06a0fb548/scratchpad/phase1-integration.mjs
unset PHASE1_PASSWORD
```
Prints `PASS`/`FAIL` per step plus a summary, and never prints tokens or passwords. It creates **one** labelled test employee (`phase1.qa.<n>@promocraft.test`, employee_id `P1-<n>`). The API can only soft-delete it, so remove it in Django admin if unwanted. The scratchpad can be cleared on reboot; if the file is gone, ask for it to be re-created.

## 8. Remaining issues / next steps

1. **Developer:** run the admin workflow suite (§7) and report any `FAIL` lines.
2. **Finance owner:** resolve the model/migration drift (§0.4). Don't run `makemigrations` blindly; it would drop the bank-reconciliation tables.
3. **Restart the Vite dev server** (`npm run dev`) so it picks up `VITE_API_BASE_URL` from `.env.local`.
4. Backend (future): add `token_blacklist` to `INSTALLED_APPS` + migrate, so logout revokes refresh tokens.
5. Backend: the production `CORS_ALLOWED_ORIGINS` default lacks `http://127.0.0.1:3000`. Today it only works because DEBUG allows all origins.
6. Cross-module (Phase 2+): Projects/Tasks pickers list real employees, but their mock services can't resolve real ids. The Employee Portal reads the demo session, so a real EMPLOYEE login sees empty "my projects/tasks".
7. Tooling: add `typescript` and `typescript-eslint` devDependencies and real `tsconfig.json` compiler options so `npm run lint` and type-checking work in-project.
8. Tokens live in `localStorage` (required for session persistence). httpOnly cookies would need backend changes.

---

## 9. Final Phase 1 acceptance status

| Area | Status |
|---|---|
| Backend startup (syntax fix, `check`, full URLconf, real server) | ✅ Accepted |
| Backend migration consistency | ⚠️ Pre-existing finance/agency_settings drift; not Phase 1; owner decision needed |
| Frontend build / tests / types / lint (Phase 1 scope) | ✅ Accepted: no new errors |
| Centralized API client, token refresh, error handling, cancellation | ✅ Verified live |
| Unauthenticated security paths (401, bad login, expired refresh, network) | ✅ Verified live |
| Mock employee data removed from the Employees module | ✅ Verified |
| Admin workflows 1–10 | ⏳ **Awaiting developer-run results** |
| Backend limitations (§4) | 📄 Documented, no workarounds |

**Overall: CONDITIONALLY COMPLETE.** Phase 1 is accepted once the developer's admin-suite run shows all PASS (or any FAIL is triaged). **Phase 2 has not been started and won't start until the developer reviews and approves this report.**
