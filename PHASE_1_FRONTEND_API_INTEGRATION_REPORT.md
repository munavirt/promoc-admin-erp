# PromoCraft ERP — Phase 1 Frontend Live API Integration Report
## Authentication + Employee Management

Date: 2026-11-15 · Scope: `promocraft-agency-hub/` only · Nothing committed, pushed or deployed.

This session built on an earlier Phase 1 pass (see `PHASE_1_AUTH_EMPLOYEE_INTEGRATION.md`). That pass had already added the API client, token storage, real auth/employee services and role routing. This session re-checked all of it against the docs, the backend source and the running server, then closed the remaining gaps.

---

## 1. Files inspected

**Docs:** `docs/README.md`, `api-reference/complete-api-reference.md` (§2 accounts, §3 employees), `openapi/openapi.yaml`, `frontend-integration/{api-client-specification,authentication-integration,error-handling,endpoint-to-page-mapping}.md`, `architecture/database-relationships.md`.

**Backend (read only):** `accounts/api/{views,serializers,urls}.py`, `accounts/permissions.py`, `employees/models.py`, `employees/api/{views,serializers,urls}.py`, `project/settings.py` (SIMPLE_JWT, REST_FRAMEWORK, CORS, INSTALLED_APPS).

**Frontend:** `src/infrastructure/{apiClient,tokenStorage}.ts`, `src/services/api/{auth,employees}.service.ts`, `src/api/{accounts,employees,users,me}.api.ts`, `src/adapters/erp.adapters.ts`, `src/store.ts`, `src/App.tsx`, `src/pages/{Login,EmployeeDetail}.tsx`, `src/features/employees/pages/*`, `src/features/dashboard/components/{admin,employee}-routes.tsx`, `src/components/shared/{action-dropdown,data-source-notice,empty-state}.tsx`, existing tests.

## 2. Files changed (this session)

| File | Change |
|---|---|
| `src/pages/Login.tsx` | Per-field required/email validation (`noValidate`, inline messages), backend field errors mapped to inputs, duplicate-submit guard, inputs disabled while signing in, "Signing in..." label, `autocomplete`/`htmlFor`/`aria-*`. Same visual design. |
| `src/App.tsx` | Clears the React Query cache on **any** transition to signed out (logout or expiry). Previously only on expiry and login, so a second user in the same tab could briefly see cached data. |
| `src/features/employees/pages/employees-page.tsx` | Stat cards show a skeleton while loading and "—" when the counts can't be loaded, instead of a fabricated `0`. Export now works (it used to do nothing). Row action renamed **Terminate**. Shared confirmation dialog. |
| `src/features/employees/pages/add-employee-page.tsx` | Required/optional fields now match `EmployeeCreateSerializer`: phone and emergency contact fields are optional. Phone is digits only when given. Joining date can't be in the future, checked against the **local** date. `Terminated` removed from the create status options. Duplicate-submit guard. |
| `src/features/employees/pages/edit-employee-page.tsx` | Edit no longer offers `Terminated`, and a terminated record can't be switched back to Active here. A plain status PATCH doesn't change `user.is_active`, so that would have left a "terminated" user able to sign in, or a "reactivated" user still locked out. Phone digits-only, duplicate-submit guard. |
| `src/pages/EmployeeDetail.tsx` | Terminate and Reactivate use a confirmation dialog. **Mock data removed** from the Projects / Assigned Work / Meetings / Activity tabs (Meetings showed every demo meeting for every employee). They now show a "Backend integration pending" notice. Retry button on load errors. |
| `src/components/shared/action-dropdown.tsx` | Optional `deleteLabel` / `deleteIcon` props (default unchanged). |
| `src/api/employees.api.ts` | `listAllEmployees(filters)` for export. |
| **new** `src/features/employees/components/employee-lifecycle-dialog.tsx` | Terminate/Reactivate confirmation with accurate consequences. |
| **new** `src/features/employees/lib/export-employees.ts` | CSV serialization (RFC 4180 quoting + formula-injection guard). |
| **new** `src/features/employees/lib/dates.ts` | `todayLocalISO()`. |
| **new** `src/features/employees/__tests__/phase1-integration-units.test.ts` | 14 unit tests (§8). |
| `package.json` | `test` script also runs the new test file and sets a test `VITE_API_BASE_URL`. |

## 3. API endpoints integrated

| Purpose | Endpoint | Used by |
|---|---|---|
| Login | `POST /api/accounts/login/` `{email,password}` → `{refresh, access, user}` | Login |
| Refresh | `POST /api/accounts/token/refresh/` `{refresh}` → `{access}` | apiClient interceptor |
| Logout | `POST /api/accounts/logout/` `{refresh}` | store.logout |
| Profile | `GET /api/accounts/profile/` | session restore |
| Employees | `GET/POST /api/employees/`, `GET/PATCH/DELETE /api/employees/{id}/` | list/create/detail/edit/terminate |
| Linked account | `GET/PATCH /api/accounts/users/{uuid}/` (name, phone, is_active) | detail/edit/reactivate |

`PUT /api/employees/{id}/` exists but isn't used; PATCH sends only what changed.

### Documentation vs. running server (verified live)
| Topic | Docs say | Actual |
|---|---|---|
| Login failure body | `{"detail": "Invalid credentials or account is inactive."}` | `{"non_field_errors": ["Invalid email or password"]}` or `["Account is Disabled"]` (400) |
| Logout response | `"Successfully logged out."`; 400 on bad token | `"Logged out successfully."`; always 200 (exceptions swallowed) |
| Logout blacklisting | refresh token blacklisted | `token_blacklist` **not** in `INSTALLED_APPS`, so not revoked |
| Profile `email` | read-only | writable in `UserSerializer` |
| Profile phone validation | "phone format validation" | none on `UserSerializer` / users PATCH |

## 4. Authentication implementation

- **Client:** single axios instance (`apiClient.ts`), base URL from `VITE_API_BASE_URL`, adds `Bearer` header except on `skipAuth` (login/refresh).
- **Refresh:** a 401 triggers **one shared refresh** (single-flight promise), then each failed request is replayed **once**.
- **Expired or invalid session:** a rejected refresh clears the tokens and emits `onSessionExpired`. The store signs out, the cache is cleared, a toast is shown, and `ProtectedRoute` redirects to `/login` with `state.from` and an "expired" notice.
- **Server unavailable:** network failure, timeout or 5xx keeps the tokens and shows a "Unable to restore your session" retry screen. It never falls back to demo data.
- **Session restore:** `initAuth` reads `promocraft.auth.*` from localStorage and calls `GET /accounts/profile/`.
- **Logout:** sends `{refresh}` to the backend (best effort), always clears local tokens and the query cache.
- **Roles:** `ADMIN` gets admin routes, `EMPLOYEE` gets the employee portal, `CLIENT` or unknown gets a "No workspace access" screen. The backend `IsAdmin` check (403) remains the real control.
- **Errors:** every failure becomes `ApiError` with a `kind` (network / timeout / cancelled / unauthorized / forbidden / not_found / validation / server / config) plus DRF field errors. Raw HTML error pages are never shown.

## 5. Employee operations implemented

| Operation | Implementation |
|---|---|
| List | Server-side `search`, `department`, `status`, `employment_type`, `ordering` (`employee_id`, `joining_date`, `created_at` only), `page`. Skeleton, empty, no-match and error+retry states. Steps back a page if DRF returns 404 "Invalid page". |
| Summary cards | Exact `count` from filtered requests (`status=ACTIVE/ON_LEAVE/RESIGNED`, `employment_type=FREELANCER`). Never derived from the loaded page. "—" if unavailable. |
| Export | No export API exists. The CSV is built from `GET /api/employees/` across all pages with the active filters. |
| Create | One `POST /api/employees/` (atomic User + Employee). `role: "EMPLOYEE"`. Backend field errors shown on their inputs. `temporary_password` shown once in the success dialog, never stored. Then navigates to the detail page. |
| Detail | Real record plus linked account status. 404 shows "Employee not found"; other errors show the message and Retry. |
| Edit | HR fields go to `PATCH /api/employees/{id}/`. Name and phone go to `PATCH /api/accounts/users/{uuid}/`, only when changed. Partial failure is reported. Email is read-only (no admin endpoint can change it). |
| Terminate | `DELETE /api/employees/{id}/`, which is a **soft** termination: `status=TERMINATED`, `user.is_active=False`, record kept. Labelled "Terminate"; the dialog explains this. |
| Reactivate | No dedicated endpoint, so it's `PATCH status=ACTIVE` then `PATCH user is_active=true`. Two calls, not atomic. Confirmation dialog. |

## 6. Mock data removed

- **This session:** the mock Projects/Tasks/Meetings/Activity data on the employee detail page, and the fabricated `0` stat values.
- **Earlier Phase 1 pass:** `mock-employees.service.ts`, the fake temporary password, the random employee ID, the demo login box and the demo role switch.
- `employeesAdapter`/`authAdapter` = real services. **No mock fallback exists.**

## 7. TypeScript and build results

| Check | Result |
|---|---|
| `npm run build` | ✅ success (pre-existing >500 kB chunk warning) |
| `tsc --strict --noEmit` (scratch config; `typescript` isn't a project dependency) | ✅ **0 errors in Phase 1 files.** 38 pre-existing errors elsewhere (finance, projects, tasks, users, employee portal, `main.tsx`, mock test). |
| ESLint (scratch config; `npm run lint` is broken because `typescript-eslint` isn't installed) | ✅ No rule violations in Phase 1 files except 2 pre-existing `no-explicit-any` in `store.ts` workspace types. Prettier formatting differences exist in these files already; nothing was reformatted. |

## 8. Unit test results

`npm test`: **38/38 pass** (24 existing + 14 new). The new tests run the real `apiClient` with a fake transport:
- Bearer token added to requests.
- 3 concurrent 401s cause exactly 1 refresh, and all 3 requests are replayed.
- The refresh request is sent without a Bearer header.
- The refresh token is kept, because the backend doesn't rotate it.
- A rejected refresh clears the session and emits the expiry event.
- A request is never replayed more than once.
- A network error during refresh doesn't log the user out.

The other new tests cover:
- DRF error parsing of the exact shapes the live server returns.
- HTML error bodies are never shown.
- Cancelled requests are normalized.
- CSV quoting and formula-injection guard.
- Local-date handling.

## 9. Live backend integration test results

Script: `phase1-live.mjs` (session scratchpad). It loads the real frontend modules through Vite SSR against `http://127.0.0.1:8000`, and DB cross-checks use a read-only SQLite connection.

| # | Workflow | Result |
|---|---|---|
| Auth 3 | Invalid / unknown email → "Invalid email or password", no tokens stored | ✅ PASS |
| Auth 3b | Malformed email → `email` field error | ✅ PASS |
| Auth 4 | Missing fields → `email` + `password` field errors | ✅ PASS |
| Auth 7 | Invalid refresh token → expiry event, tokens cleared, store signed out | ✅ PASS |
| — | No token → 401 on `/employees/` | ✅ PASS |
| — | CORS preflight from `http://localhost:3001` | ✅ PASS (curl) |
| Auth 1, 2, 5, 6, 8, 9 | Admin login, wrong password, session restore, live refresh, logout, role routing | ⏳ **NOT TESTED**: needs admin credentials; developer run pending |
| Emp 1–13 | List/search/filters/pagination/create/validation/detail/update/terminate/blocked login/reactivate | ⏳ **NOT TESTED**: same |

The developer chose to run the authenticated suite themselves. The script reads `PHASE1_EMAIL` / `PHASE1_PASSWORD` and never prints secrets. It creates exactly one QA employee (`phase1.qa.<n>@promocraft.test`) and leaves it terminated.

## 10. Failed or untested workflows

- **Failed:** none.
- **Not tested:** every authenticated workflow (until the developer run), the **CLIENT role** (no CLIENT account exists in the DB), and **multi-page pagination** (the DB has 1 employee, under the page size of 10).
- **Browser checks not run:** a real browser refresh and mobile layout. Session restore is covered by the `initAuth` path in the script.

## 11. Remaining limitations (backend)

1. Logout doesn't revoke the refresh token (`token_blacklist` not installed). It stays valid for up to 7 days.
2. No admin endpoint changes an employee's email or resets their password.
3. Reactivation is two non-atomic calls.
4. **RESIGNED employees keep an active login.** Only DELETE disables it.
5. `PATCH /accounts/users/{id}/` applies values without validation.
6. No name ordering, no `page_size` param (fixed at 10), no distinct-departments endpoint (department options come from walking all pages).
7. No meetings or employee-activity endpoints.
8. Tokens are stored in localStorage. httpOnly cookies would need backend changes.

## 12. Backend files

**No backend files were modified in this session.** Backend source, models, serializers, views, URLs and migrations were only read. The database was only read, through a read-only connection, and no data was changed. (The earlier Phase 1 pass, under explicit authorization, removed one stray `}` in `finance/reports.py`; see `PHASE_1_AUTH_EMPLOYEE_INTEGRATION.md` §0.)
