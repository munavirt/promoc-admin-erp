# PromoCraft ERP — Phase 2 Frontend Live API Integration Report
## Clients Management + Projects Management

Date: 2026-11-15 · Scope: `promocraft-agency-hub/` only · Nothing committed, pushed or deployed.

> **Status: implementation complete; build, type-check and unit tests pass. The authenticated live suite (§12) is pending a developer run with ADMIN credentials.** No authenticated workflow is reported as passed until that run happens.

---

## 1. Files inspected

**Docs:** `docs/README.md`, `api-reference/complete-api-reference.md` (§4 Clients, §5 Projects, §6 Work items), `openapi/openapi.yaml`, `frontend-integration/{endpoint-to-page-mapping,api-client-specification,error-handling}.md`, `architecture/{database-relationships,module-dependencies}.md`.

**Backend (read only):**
- `clients/models.py`, `clients/api/{serializers,views,urls}.py`
- `projects/models.py`, `projects/api/{serializers,views,urls}.py`
- `work_item/api/{views,serializers}.py`, `work_item/models.py`
- `me/api/views.py`, `accounts/permissions.py`, `project/urls.py`, `project/settings.py`

**Frontend:**
- Phase 1 infrastructure (`apiClient`, `tokenStorage`, store, adapters)
- `src/api/{clients,projects,tasks}.api.ts`
- `src/features/clients/pages/*`, `src/features/projects/{pages,hooks}/*`
- `src/pages/{ClientDetail,ProjectDetail,Reports}.tsx`
- `src/features/dashboard/*`, `src/features/tasks/pages/{create,edit}-task-page.tsx`
- `src/services/mock/mock-{clients,projects,me}.service.ts`, `src/mocks/*`
- `src/components/shared/{data-table,status-badge,action-dropdown,data-source-notice}.tsx`

## 2. Files changed

| File | Change |
|---|---|
| **new** `src/services/api/clients.service.ts` | Real client service (list / listAll / get / create / update / deactivate). |
| **new** `src/services/api/projects.service.ts` | Real project service (list / listAll / get / create / update / archive / members / work items). |
| `src/adapters/erp.adapters.ts` | `clientsAdapter` and `projectsAdapter` point to the real services. |
| `src/api/clients.api.ts` | Rewritten: serializer-accurate types, enums and labels, paginated and all-pages functions, counts, `countClientsCreatedSince`, `deactivateClient`. |
| `src/api/projects.api.ts` | Rewritten: serializer-accurate types, status/priority/role enums and labels, paginated and all-pages functions, `getClientProjects`, `archiveProject`, member and work-item functions. |
| `src/features/projects/hooks/use-projects.ts` | Real hooks. Shared `invalidateProjectData` (projects, project detail, client project tabs, client stats). Archive and member hooks show the backend's messages. |
| **new** `src/features/clients/components/client-form.tsx` | Shared Add/Edit form. Same sections and markup; validation follows the model and serializer; backend field errors mapped to inputs. |
| `src/features/clients/pages/{add,edit}-client-page.tsx` | Now use the shared form. Create resolves the new id (see §8). Edit PATCHes only changed fields and warns before an Inactive save. |
| `src/features/clients/pages/clients-page.tsx` | Server-side search, status, ordering and pagination. Real stat cards. Real CSV export. **Delete renamed Deactivate**, with an accurate dialog. |
| `src/pages/ClientDetail.tsx` | Real projects tab via the API. Meetings and Activity mock data removed. Deactivate dialog, Created By / Created / Updated rows, 404 vs error+retry states. |
| **new** `src/features/projects/components/project-form.tsx` | Shared Create/Edit form. Same sections and markup. Real client and employee pickers. Backend rules mirrored (one PM, active employees only, no duplicates, deadline ≥ start, progress 0–100, budget decimal). |
| **new** `src/features/projects/lib/{assign-members,employee-labels}.ts` | Sequential member assignment that captures every failure. |
| `src/features/projects/pages/{create,edit}-project-page.tsx` | Create then assign members, with partial failure reported. Edit PATCHes only changed fields; unsaved edits survive refetches; failed member rows stay for retry. |
| `src/features/projects/pages/projects-page.tsx` | Server-side search, status, priority, ordering and pagination; same table primitives. Exact summary counts. **Delete renamed Archive**, with a confirmation dialog. Empty budget shows "—", not ₹0. |
| `src/pages/ProjectDetail.tsx` | Real members (removal confirmed), real read-only work items, Activity mock data removed, Archive dialog, project manager / created-by / timestamps, 404/403/error states. |
| **new** `src/components/shared/confirm-dialog.tsx` | Generic confirmation (blocks dismissal while pending). |
| **new** `src/lib/csv.ts` | Shared CSV helper. `features/employees/lib/export-employees.ts` now uses it. |
| `src/features/dashboard/{lib/dashboard-insights.ts,components/dashboard-page.tsx}` | Prefer the API's `client_name` (works when the client is inactive). |
| `src/services/mock/mock-projects.service.ts` | Type fix only (still backs the mock Employee Portal / Tasks). |
| **deleted** `src/services/mock/mock-clients.service.ts` | No longer referenced. |
| `src/mocks/__tests__/erp-mock-services.test.ts` | Removed the mock-clients CRUD case. The projects case now calls `mockProjectsService` directly. |
| **new** `src/features/projects/__tests__/phase2-units.test.ts` | 11 unit tests. |
| `package.json` | `test` script includes the new file. |

## 3. Client endpoints integrated

| Purpose | Endpoint | Notes |
|---|---|---|
| List | `GET /api/clients/` | `page`, `search` (company_name, contact_person, email, phone), `status`, `ordering` (company_name, created_at). PAGE_SIZE 10. |
| Create | `POST /api/clients/` | `ClientCreateSerializer`. `created_by` is set by the server and never sent. |
| Detail | `GET /api/clients/{id}/` | |
| Update | `PATCH /api/clients/{id}/` | Changed fields only. |
| Deactivate | `DELETE /api/clients/{id}/` | Soft delete, see §14. |
| Client's projects | `GET /api/projects/?search=<company_name>` + exact `client` id match | There is no `?client=` filter (documented). |
| Projects Running card | `GET /api/projects/?status=IN_PROGRESS` → `count` | |

`PUT` is supported by the backend but not used.

## 4. Project endpoints integrated

| Purpose | Endpoint | Notes |
|---|---|---|
| List | `GET /api/projects/` | `page`, `search` (project_name, client__company_name, description), `status`, `priority`, `ordering` (created_at, deadline, start_date, progress). |
| Create | `POST /api/projects/` | `client` must be an ACTIVE client PK. |
| Detail | `GET /api/projects/{id}/` | Includes `client_name`, nested `members`, `project_manager`. |
| Update | `PATCH /api/projects/{id}/` | Changed fields only. `client` is sent only if changed. |
| Archive | `DELETE /api/projects/{id}/` | Soft delete, see §14. |
| Members | `GET` / `POST /api/projects/{id}/members/`, `DELETE /api/projects/{id}/members/{member_id}/` | `POST {employee, role_in_project}`. |
| Work items (read-only) | `GET /api/work-items/?project={id}` | Project detail Tasks tab. |
| Pickers | `GET /api/clients/` (all pages), `GET /api/employees/?status=ACTIVE` (all pages) | |

## 5. Client operations completed

- **List:**
  - Search, status filter, 4 sort orders and pagination all run on the server.
  - Skeleton, empty, no-match and error+retry states. Steps back a page on DRF's 404 "Invalid page".
  - Optional fields show "—", and an empty email is not rendered.
- **Summary cards:**
  - **Total**: `count` of the API, labelled "Excludes inactive".
  - **Active**: `count` with `status=ACTIVE`.
  - **Inactive**: "—" / Not available (the API hides them).
  - **New This Month**: walks `ordering=-created_at` until the first older record, which gives an exact count.
  - **Projects Running**: exact `IN_PROGRESS` project count.
  - **Total Revenue**: "—" / Coming Soon (Finance not integrated).
- **Export:** CSV of all pages matching the current filters (no export API exists).
- **Create:**
  - Required: company name (≤255) and contact person (≤150).
  - Optional: email (validated), phone (digits ≤20), website (http/https URL ≤200), address, notes.
  - Status is fixed to Active, because an Inactive client could never be opened again.
  - Created By is shown read-only and assigned by the server.
  - Backend field errors (duplicate name, phone, email, URL) appear on their inputs. Duplicate submits are blocked.
  - On success: toast, cache invalidation, and navigation to the **real** new client's page.
- **Detail:**
  - Real fields, Created By, created/updated dates, and the real Projects tab with loading/error/empty states.
  - The Notes tab is real.
  - Meetings and Activity show "Backend integration pending".
  - 404 page explains that the client may have been deactivated.
- **Edit:**
  - PATCHes changed fields only.
  - An inline warning explains what saving as Inactive does; after such a save the user goes back to the list.
  - Invalidates the client list, client detail and projects (`client_name` and the client picker).
- **Deactivate:** confirmation explains the soft delete, the hiding, kept projects, and that the app can't undo it. Backend errors are shown.

## 6. Project operations completed

- **List:**
  - Search covers name, client and description, on the server.
  - Status filter (excludes Cancelled, which the API hides), priority filter, 6 sort orders, server pagination.
  - Real `client_name`, budget ("—" when null), progress, local-date due dates, team from nested `members`.
- **Summary:**
  - "N projects · M in flight", with N = `count` and M = N − `count(status=COMPLETED)` = Planning + In Progress + On Hold.
  - Exact; never computed from the loaded page.
- **Create:**
  - Real active-client dropdown (integer ids, loading/error/empty states, link to Add Client), and creation is blocked without a client.
  - Budget is optional (null allowed). Progress is an integer 0–100. Deadline must be ≥ start date.
  - Status options exclude Cancelled.
  - Team: after the project is created, each member gets its own `POST …/members/` using the **real new id**.
  - If any member fails, a toast names each failure and the page moves to Edit so they can be added. Nothing is reported as succeeded unless it did.
- **Detail:**
  - Real fields, project manager, created by and timestamps.
  - Members tab with roles; removing a member asks for confirmation.
  - Tasks tab lists real work items, read-only. It doesn't link to the still-mock task pages.
  - Activity shows "pending".
  - 404 / 403 / error+retry states.
- **Edit:**
  - PATCHes changed fields only. `client` is sent only when changed, because re-sending an inactive current client would be rejected; the inactive client stays visible as "(inactive)".
  - Member removal is immediate and confirmed. New members are added on save; failed rows stay for retry while saved values are kept.
  - The form isn't reset by background refetches.
- **Archive:** confirmation explains the consequences; the list refreshes and the client project tabs and stats are invalidated.

**Cache invalidation map:**

| Change | Invalidates |
|---|---|
| Client create | `["clients"]` |
| Client edit | `["clients"]`, `["client", id]`, `["projects"]`, `["project"]` |
| Client deactivate | `["clients"]`, removes `["client", id]`, `["projects"]` |
| Project create/edit/archive/member change | `["projects"]`, `["project", id]`, `["client"]` (client project tabs), `["clients","stats"]` |

## 7. Mock data removed

- `mockClientsService` (deleted). `clientsAdapter` and `projectsAdapter` are real. **There is no mock fallback.** When Django is down, each page shows the normalized connection error with Retry.
- Client detail: mock Meetings, Activity and project matching removed.
- Project detail: mock Tasks and Activity removed.
- Client list: client-side filtering, sorting and pagination of the mock array removed. The old Inactive count of the mock array is gone.
- Project list: client-side search and the ₹0 budget fallback removed.

**Kept on purpose:** `mockProjectsService` and the mock seed data still back the **mock Employee Portal (`/api/me`) and mock Tasks**, which aren't integrated yet. The Clients and Projects modules never read them.

## 8. Unsupported functionality and documentation discrepancies

| Item | Detail |
|---|---|
| **Inactive clients are invisible** | `ClientViewSet.get_queryset()` excludes `INACTIVE` for every action. They can't be listed, counted, opened, edited or reactivated through the API. Status filter "Inactive" always returns 0 (the UI explains this). |
| **Archived projects are invisible** | `ProjectViewSet.get_queryset()` excludes `CANCELLED`, and so does `/api/me/projects/`. No restore. |
| **Client create response has no `id`** | `ClientCreateSerializer` fields exclude `id`. The frontend finds the new client by exact, case-insensitive company name (unique on create). If that fails, it falls back to the list. *The docs show a full record with `id`.* The live suite records the actual response shape (step C5). |
| Client status enum | Docs say `LEAD`, `ACTIVE`; the model has **`ACTIVE`, `INACTIVE`**. |
| No `?client=` project filter | Documented. Client project lists use the client-name search plus an exact id match. That result is complete, because every project of the client matches its company name. |
| Phone and name-uniqueness validation only on create | `ClientSerializer` (update) has no digit-only phone check and no duplicate company-name check. The frontend applies the digit rule on edit too; **duplicate names are possible via edit**. |
| Member role change | No PATCH endpoint. Remove and re-add instead. |
| Revenue, meetings, activity | Not available (Finance not integrated; no meetings or activity endpoints). |
| Project members on the list | Present (nested `members`); no extra requests. |

## 9. TypeScript results

`tsc --strict --noEmit` (scratch config; `typescript` isn't a project dependency):
- **0 errors in Phase 2 files.**
- **32 errors in total, down from 38.** The 6 earlier errors in the project create/edit pages are gone.
- All 32 remaining errors are pre-existing, in finance, tasks, users, the employee portal, `main.tsx`, and the finance-settings part of the mock test.

ESLint on the Phase 2 files (scratch config, formatting rules off): **0 errors.** 5 warnings are dev-only `react-refresh/only-export-components` warnings, because the form modules also export helpers.

## 10. Build results

`npm run build`: ✅ success (pre-existing >500 kB chunk warning).

## 11. Unit test results

`npm test`: **48/48 pass.**
- 37 existing: 1 mock-clients case removed with its service.
- 11 new Phase 2 tests, each running the real service over a fake transport:
  - Created client resolved by exact name, not a substring match.
  - Only writable fields are sent (`created_by` never).
  - Deactivate uses DELETE and shows the backend message.
  - "New this month" walks pages and stops early.
  - Empty filters are not sent.
  - Client projects are filtered by exact id.
  - Project PATCH whitelist, with an empty budget sent as `null`.
  - Archive and member-removal URLs.
  - Work-items `?project=` query.
  - Sequential member assignment reports a partial failure and continues.
  - Enum label helpers.

## 12. Live backend test results

Script: `phase2-live.mjs` (session scratchpad). It runs the real frontend modules through Vite SSR against `http://127.0.0.1:8000`, with read-only DB cross-checks.

| # | Workflow | Result |
|---|---|---|
| U1 | Unauthenticated clients/projects → 401 | ✅ PASS |
| Client 1–13 | listing, search, status filter, pagination, create, required/email/website/phone validation, detail, edit, deactivation, related-project restriction | ⏳ **NOT TESTED**: awaiting developer run with ADMIN credentials |
| Project 1–14 | listing, search, status/priority filter, pagination, client dropdown, create, required/invalid-client validation, detail, edit, team (PM rule, duplicate, inactive employee, remove), archive | ⏳ **NOT TESTED**: same |
| Project 13 | Archive with work items | **NOT TESTED** (would require creating work items, which is Tasks scope). Backend code shows DELETE only changes status. |
| Multi-page pagination | | **Expected NOT TESTED**: DB has 1 client and 1 project (< page size 10). The script checks single page, page-2 404 and ordering. |
| UI-level refresh after mutations | | Verified by code review of the invalidation map (§6), not in a browser. |

## 13. Failed and untested workflows

- **Failed:** none so far.
- **Untested:** everything authenticated (pending), multi-page pagination (not enough data), archive with work items, CLIENT role (no account), browser/mobile visual checks.
- **Phase 1:** the authenticated suite is also still pending.

## 14. Deletion behavior and relationship restrictions

| | Client `DELETE` | Project `DELETE` |
|---|---|---|
| Type | **Soft**: `status = INACTIVE` | **Soft**: `status = CANCELLED` ("archived") |
| Afterwards | 404 on every client endpoint; gone from list and pickers | 404 on project endpoints; gone from list and `/api/me/projects/` |
| Related records | Projects keep their FK and `client_name`. Projects can't be (re)assigned to the client (`ProjectSerializer.client` queryset is ACTIVE only). Finance invoices/payments use PROTECT, but they're never triggered because nothing is hard-deleted. | `ProjectMember` rows and work items untouched |
| Restrictions | **None**: a client with projects can be deactivated | **None** |
| Permissions | ADMIN only (`IsAdmin`) | ADMIN only (employees: read-only, member-scoped) |
| Undo via API | ❌ | ❌ |
| UI label | "Deactivate" (was "Delete … permanently") | "Archive" (was "Delete", and the list deleted without confirmation) |

The model has `Project.client` = CASCADE, but because client deletion is soft, the cascade never runs from the app.

## 15. Remaining limitations

1. No reactivation or restore for clients or projects through the API (backend).
2. Duplicate company names are possible through edit (backend validates only on create).
3. Cross-module: the **Tasks** create/edit pages now list **real** projects, but the Tasks service is still mock. Creating a task there writes to the mock DB against a real project id. This is resolved in the Tasks phase. The mock **Employee Portal** still shows demo projects.
4. Page size is fixed at 10. Pickers walk all pages (capped at 100 pages = 1,000 records).
5. Revenue / meetings / activity have no backend source yet.
6. The Phase 1 tooling gaps remain (no in-project `typescript`; `npm run lint` is broken by the missing `typescript-eslint`).

## 16. Backend files

**No backend files were modified.** Django source, models, serializers, views, URLs and migrations were only read. The database was only read, through `mode=ro` connections. No data was changed by this implementation work. The live suite, once run, creates only the labelled QA records listed in its header.
