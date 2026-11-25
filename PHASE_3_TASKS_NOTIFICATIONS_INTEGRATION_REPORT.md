# PromoCraft ERP — Phase 3 Frontend Live API Integration Report
## Tasks / Work Items + Comments + Attachments + Notifications + Employee Portal

Date: 2026-11-16 · Scope: `promocraft-agency-hub/` only · Nothing committed, pushed or deployed.

> **Status: implementation complete; build, type-check and unit tests pass. The authenticated live suite (§13–14) is ready but pending a developer run with ADMIN credentials.** No authenticated workflow is reported as passed until that run happens. The Phase 1 and Phase 2 authenticated suites are also still pending.

---

## 1. Files inspected

**Docs:** `README.md`, `api-reference/complete-api-reference.md` (§6 Tasks, §7 Notifications, §8 `/api/me`), `openapi/openapi.yaml`, `frontend-integration/{endpoint-to-page-mapping,api-client-specification,error-handling}.md`, `architecture/{database-relationships,module-dependencies}.md`, `workflows/business-workflows.md` (§7 notification delivery).

**Backend (read only):**

| Area | Files |
|---|---|
| `work_item/` | `models.py`, `validators.py`, `api/{views,serializers,urls}.py` |
| `tasks/` | entire app |
| `notifications/` | `models.py`, `services.py`, `signals.py`, `apps.py`, `api/{views,serializers,urls}.py` |
| `me/api/` | `views.py`, `urls.py` |
| `project/` | `urls.py` (media serving, `/api/tasks/` alias), `settings.py` (`INSTALLED_APPS`, `MEDIA_*`) |

The `tasks/` app is empty and not in `INSTALLED_APPS`.

**Frontend:**

| Area | Files |
|---|---|
| API | `src/api/{tasks,notifications,me}.api.ts` |
| Tasks | `src/features/tasks/{pages,hooks}/*`, `src/pages/TaskDetail.tsx` |
| Notifications | `src/features/notifications/{components,hooks,pages}/*` |
| Employee portal | `src/features/employee-portal/pages/*` |
| Layout & routing | `src/components/layout/{navbar,sidebar,employee-layout}.tsx`, `src/features/dashboard/*` |
| Mocks | `src/services/mock/mock-{tasks,notifications,me,projects}.service.ts`, `src/mocks/*` |

## 2. Files changed

| File | Change |
|---|---|
| **new** `src/services/api/tasks.service.ts` | Real work-item service: list, all pages, detail, create (with id resolution), PATCH + re-read, archive, `update_status`, `update_progress`, `assign_employee`, comments, multipart attachments with progress, `my_work`/`due_today`/`overdue`. |
| **new** `src/services/api/notifications.service.ts` | list, unread-count, mark-as-read, mark-all-as-read. |
| **new** `src/services/api/me.service.ts` | `/me/projects/`, `/me/tasks/` (all pages). |
| `src/adapters/erp.adapters.ts` | `tasksAdapter`, `notificationsAdapter`, `meAdapter` now use the real services. |
| `src/api/tasks.api.ts` | Rewritten:<br>• serializer-accurate types (task, comment, attachment)<br>• status/priority enums + labels<br>• paginated / all-pages / count calls<br>• media-URL resolution<br>• attachment validator mirroring `validators.py` |
| `src/api/notifications.api.ts` | Rewritten: types, filter params, role-aware `notificationTarget()`, paginated list, count. |
| `src/api/me.api.ts` | Real endpoints; abort signal support. |
| `src/features/tasks/hooks/use-tasks.ts` | Real hooks; one `invalidateTaskData()` covering tasks, task detail, `me-tasks`, project work-items and due/overdue lists; comment/attachment hooks. |
| **new** `src/features/tasks/components/task-form.tsx` | Shared Create/Edit form, same sections and markup:<br>• real project and ACTIVE-employee pickers<br>• backend rules mirrored<br>• create-only queued real uploads + Live Preview |
| **new** `src/features/tasks/components/task-comments.tsx` | Real comment thread + composer (used by the admin page and the employee drawer). |
| **new** `src/features/tasks/components/task-attachments.tsx` | Real list, drag-drop multipart upload with progress, client-side validation, download. |
| `src/features/tasks/pages/tasks-page.tsx` | Server-side search, filters, ordering and pagination; board view per status column; exact stats; real CSV export; Delete → Archive with confirmation. |
| `src/features/tasks/pages/{create,edit}-task-page.tsx` | Real create (id resolution, then uploads, partial-failure report) and edit (changed fields only; snapshot keeps unsaved edits). `?project=` preselects the project. |
| `src/pages/TaskDetail.tsx` | Real detail:<br>• comments and attachments tabs<br>• Activity built from real timestamps<br>• Mark complete / Reopen via `update_status`<br>• Archive dialog, archived banner<br>• 404/403/error states |
| `src/pages/ProjectDetail.tsx` | Tasks tab now links to real task pages and has **New Task** (preselected project). |
| `src/features/notifications/hooks/use-notifications.ts` | Rewritten: unread count polled every 60 s + on focus; recent list, server page, exact stats; mark one / all. |
| `src/features/notifications/components/notification-{card,dropdown,list}.tsx` | Backend `WORK_ITEM_*` types and `reference_type="WORK_ITEM"` navigation (role-aware); unread total from `/unread-count/`; loading/error states; marks read only when unread. |
| `src/features/notifications/pages/notifications-page.tsx` | Server pagination with `is_read` / `notification_type` filters; exact counts; search removed (backend has no search). |
| `src/features/employee-portal/pages/my-tasks.tsx` | Real `/me/tasks/`; status via `update_status`; drawer driven by `?task=<id>` (deep link from notifications), reloads the task, uses the **real** comments and attachments components. |
| `src/features/employee-portal/pages/notifications.tsx` | Server pagination and filters; links use the **referenced task id**. |
| `src/features/employee-portal/pages/dashboard.tsx` | Mock activity timeline replaced with real task timestamps; project/task name fields fixed; `?task=` links; local-date "due today". |
| `src/features/employee-portal/pages/project-detail.tsx` | Fabricated activity (all dated "today") replaced with project `created_at` + members' `joined_at`; member name/role/designation fields fixed; client name fixed. |
| `src/features/employee-portal/pages/profile.tsx` | Fabricated HR data removed (shown as "Not available", with an explanation); activity from real task timestamps; exact unread count. |
| `src/features/employee-portal/pages/my-projects.tsx` | Real client name and member names. |
| `src/features/dashboard/components/employee-dashboard-page.tsx` | Abort-signal fix (component is unreachable — see §16). |
| **deleted** `src/services/mock/mock-{tasks,notifications,me,projects}.service.ts` | No longer referenced. |
| `src/mocks/__tests__/erp-mock-services.test.ts` | Reduced to the modules that are still mock-backed (users, workspace/finance reset, legacy demo auth). |
| **new** `src/features/tasks/__tests__/phase3-units.test.ts` | 12 unit tests. |
| `package.json` | `test` runs the new file. |

## 3. Task endpoints integrated

**Authoritative implementation:** the `work_item` app (`WorkItemViewSet`). `/api/tasks/` is only a URL alias of the same router (`project/urls.py`); the `tasks/` app has no models and isn't installed. The frontend uses `/api/work-items/`.

| Purpose | Endpoint |
|---|---|
| List | `GET /work-items/`: `page`, `search` (title, description, project name, assignee name), `status`, `priority`, `project`, `assigned_to`, `ordering` (`due_date`, `created_at`, `progress`; `priority` exists but sorts alphabetically, so it isn't offered), `include_cancelled` |
| Create | `POST /work-items/` (`WorkItemCreateSerializer`) |
| Detail | `GET /work-items/{id}/` (nested `comments`, `attachments`) |
| Edit | `PATCH /work-items/{id}/`, changed fields only |
| Archive | `DELETE /work-items/{id}/` (soft) |
| Status / progress | `PATCH /work-items/{id}/update_status/`, `…/update_progress/` |
| Overdue count | `GET /work-items/overdue/` |
| Read only | `GET /work-items/?project={id}` (project Tasks tab) |

Wrapped but not wired to a separate UI: `assign_employee` (the edit form PATCHes `assigned_to`), `my_work`, `due_today`.

## 4. Comment endpoints integrated

| Purpose | Endpoint | Notes |
|---|---|---|
| List | `GET /work-items/{id}/comments/` | Newest first |
| Add | `POST /work-items/{id}/comments/` with `{comment}` | Returns `{message}` only, so the list is refetched |

- The author (`user_name`) and `created_at` come from the backend. "(you)" is shown only when `comment.user` equals the signed-in user's id.
- Empty comments are blocked on the client, and the backend's `comment` field error is shown.
- **There are no edit or delete endpoints, so none are offered.**

## 5. Attachment endpoints integrated

| Purpose | Endpoint |
|---|---|
| List | `GET /work-items/{id}/attachments/` |
| Upload | `POST /work-items/{id}/attachments/` (multipart, field `file`) |

- **Uploading:**
  - Uses `FormData`. No `Content-Type` is set manually; axios/the browser add the boundary, and a unit test asserts this.
  - Progress comes from axios `onUploadProgress`, with a 120 s timeout.
  - Several files can be uploaded at once, one request each; failures are reported per file.
- **Validation:**
  - The backend (`validators.py`) enforces a 10 MB limit, an extension whitelist (pdf, doc(x), xls(x), csv, txt, rtf, png, jpg/jpeg, gif, webp, svg, zip), a dangerous-extension blacklist, and magic-byte checks.
  - The frontend applies the same size and extension rules before upload. The backend's `file` errors (e.g. content mismatch) are shown per file.
- **Display:** the file name comes from the stored path, plus uploader name and relative upload time. **File size isn't shown, because the API doesn't return it.**
- **Download:** a link to the stored file URL. Custom-action responses are relative (`/media/…`) and are resolved against the backend origin.
- **There's no delete endpoint, so none is offered.**
- On **Create Task**, the drop zone queues files and uploads them to the real new task right after creation, reporting any partial failure.

## 6. Notification endpoints integrated

| Purpose | Endpoint |
|---|---|
| List (page / dropdown / portal) | `GET /notifications/` with `page`, `is_read`, `notification_type`, `ordering=-created_at` |
| Bell + exact counts | `GET /notifications/unread-count/` → `{unread_count}` |
| Mark one read | `PATCH /notifications/{id}/mark-as-read/` |
| Mark all read | `PATCH /notifications/mark-all-as-read/` |

**Delivery model:**
- The backend has no WebSocket or push support.
- The unread count is polled every 60 s and refreshed on window focus.
- Every mutation invalidates all `["notifications", …]` queries, so the bell, dropdown, page, stats and portal stay consistent.
- Already-read items are shown as read and never re-marked.

**Navigation (`notificationTarget`):** only when `reference_type` is `WORK_ITEM` (or `TASK`/`PROJECT`) **and** `reference_id` is numeric.

| Role | Destination |
|---|---|
| ADMIN | `/tasks/{id}` |
| EMPLOYEE | `/tasks?task={id}` (opens the portal drawer) |
| anything else | no link; no destination is invented |

**Not used:**

| Endpoint | Why |
|---|---|
| `POST /notifications/` | Would fabricate notifications |
| `PATCH /notifications/{id}/` | A generic edit |
| `DELETE /notifications/{id}/` | A hard delete |
| `GET /notifications/unread/` | Unpaginated |

## 7. Employee portal integration

| Page | Source |
|---|---|
| Dashboard | `/me/tasks/`, `/me/projects/`, first notification page; activity from real task timestamps |
| Tasks | `/me/tasks/` (all pages, so its client-side filters and counts are exact). Status via `update_status`. Drawer: `GET /work-items/{id}/` + real comments and attachments. Deep link `?task=`. |
| Projects / project detail | `/me/projects/` (+ nested members), `/me/tasks/` |
| Notifications | server-paginated list, filters, mark read / all |
| Sidebar badge / profile | `/unread-count/` |

**Access** (verified in code; to be confirmed live):
- The backend scopes `/work-items/` and `/me/*` to the employee's own items. Tasks they aren't assigned return 404.
- Employees get 403 for create, archive, `assign_employee` and `/employees/`, and can't change project or assignee.
- The portal never calls admin-only endpoints. The profile's HR fields would need `GET /employees/{id}/` (IsAdmin), so they're shown as "Not available".

## 8. Mock data removed

- Mock services deleted: `mockTasksService`, `mockNotificationsService`, `mockMeService`, `mockProjectsService`. **There's no mock fallback. When Django is down, every page shows the normalized connection error with Retry.**
- **Admin task pages:**
  - Client-side filtering, sorting and pagination of a mock array removed.
  - The fake "Comments module coming soon", "0 files" and "Activity logs coming soon" placeholders and the non-functional upload button removed.
  - The fake create-page drop zone now does real uploads.
- **Employee drawer:** removed **fake local comments** (author "You", time "Just now") and **fake local file list**.
- **Employee notifications:** fixed links that used the **notification id as a task id**, and type filters (`TASK_*`) that matched nothing from the backend.
- **Employee dashboard / profile / project detail:**
  - Mock `activities` timelines removed, and the fake "today" activity entries.
  - Fabricated HR data removed: "Engineering", "EMP-2023-042", "Oct 12, 2023", a San Francisco address, "Jane Doe" emergency contact, "Sarah Jenkins" manager, `+1 (555)` phone.
- **Display fixes for real data:** `project.name` → `project_name`, `member.name` → `employee_name`, client id → `client_name`, `member.email` (not in serializer) → role/designation.

Still mock-backed (out of scope): Users, Meetings/workspace, Finance, the legacy demo-auth service.

## 9. Unsupported features and documentation discrepancies

| Item | Detail |
|---|---|
| **Create/update responses lack `id`** | `POST`/`PATCH /work-items/` return `WorkItemCreateSerializer` data (no id, no nested data). Create resolves the new task by listing `project`+`search=title`, `ordering=-created_at` and matching every submitted field. If that fails, it falls back to the list and says so. Update re-reads the record. *The docs show a full record with `id`.* |
| COMPLETED on create/PATCH | The docs say COMPLETED "auto-sets progress = 100". On create/PATCH the serializer **rejects** COMPLETED unless progress is 100. The form sets the slider to 100 visibly and validates. `update_status` does auto-set it. |
| Notifications generated | **Only on work-item creation with an assignee** (`post_save`, `created=True`). **No notification** for reassignment (PATCH or `assign_employee`), status/progress changes, completion, comments or uploads. `WORK_ITEM_UPDATED` / `WORK_ITEM_COMPLETED` / `PROJECT_UPDATED` / `MEETING_CREATED` types exist but are never produced. Nothing is faked, and the edit form says reassigning doesn't notify. |
| Notification title | The docs/workflow say "Task Assigned"; the code uses "New Work Item Assigned". |
| `estimated_hours` | The docs show `"8.00"`; the field is `Decimal(5,1)` (`"8.0"`). |
| Archived tasks | `DELETE` = soft (`CANCELLED`). Hidden from lists (`include_cancelled=true` shows them), **still retrievable by id**. No restore. |
| Comment edit/delete, attachment delete, file size | Not in the API. |
| Media files are public | Served by Django `static()` (DEBUG only) **without authentication**: anyone with the URL can download. Production serving isn't configured. |
| Notification search | No `search_fields`, so the search box was removed (no client-side substitute over a single page). |
| Assignee vs. project membership | The backend doesn't require the assignee to be a project member. |
| Due date "not in the past" | Checked against the server date (`timezone.now().date()`). The form checks the browser's local date, so near midnight the two can differ by a day; the backend error is shown if so. |
| Employee may PATCH title/description/priority/due date of own tasks | Allowed by the backend (`update`/`partial_update` are permitted). The portal only offers status changes. |
| Real-time | None. 60 s polling + refresh on focus. |

## 10. Build results

`npm run build`: ✅ success (pre-existing >500 kB chunk warning).

## 11. TypeScript results

`tsc --strict --noEmit` (scratch config; `typescript` isn't a project dependency):
- **0 errors in Phase 3 files.**
- **25 errors total, down from 32** (the task create/edit page and My Tasks errors are gone).
- All 25 remaining errors are pre-existing, in finance, users, `main.tsx`, the finance-settings part of the mock test, and one in `employee-portal/pages/dashboard.tsx`.

ESLint (scratch config, formatting rules off):
- **0 errors in the new task and notification files.**
- 16 pre-existing errors remain in the employee-portal pages (`no-explicit-any`, one `no-case-declarations`) on lines this phase didn't author.
- 5 warnings are dev-only `react-refresh/only-export-components` warnings in the form modules.

## 12. Unit test results

`npm test`: **59/59 pass.**
- 12 new Phase 3 tests run the real services over a fake transport:
  - `/work-items/` filters sent server-side.
  - Create resolves the id by matching every submitted field.
  - PATCH sends only writable fields (`""` hours → `null`) and re-reads.
  - Status, progress and archive use the dedicated actions.
  - Comments GET/POST bodies.
  - Uploads are `FormData` with no JSON content type, and progress is reported.
  - The validator follows the whitelist and the 10 MB limit.
  - Media URLs are resolved.
  - Overdue is an unpaginated array.
  - Notification routes and filters.
  - Role-aware navigation, rejecting non-numeric or unknown references.
  - `/me/tasks/` walks every page.
- The mock suite shrank, because the mock services it exercised were deleted.

## 13. Live backend test results

Script: `phase3-live.mjs` (session scratchpad). It runs the real frontend modules via Vite SSR against `http://127.0.0.1:8000`, with read-only DB cross-checks.

| # | Workflow | Result |
|---|---|---|
| U1 | Unauthenticated work-items / notifications / `/me` → 401 | ✅ PASS |
| Tasks 1–11 | list, search, project/status/priority/assignee filters, create, required/past-date/COMPLETED-progress/inactive-assignee validation, detail, edit, `update_status`, archive (+ `include_cancelled`, retrieve) | ⏳ **NOT TESTED**: awaiting developer run |
| Comments 1–4 | load, add, empty rejected, author/timestamp | ⏳ **NOT TESTED** |
| Comments 5 | edit/delete | **NOT TESTED**: unsupported by the backend |
| Attachments 1–5 | load, upload PDF (progress), reject .exe / fake .pdf / >10 MB, download bytes | ⏳ **NOT TESTED** |
| Attachments 6 | delete | **NOT TESTED**: unsupported by the backend |
| Notifications 1–8 | list, unread count, mark one, mark all, count updates, open → target, task loads, employee isolation | ⏳ **NOT TESTED** |

## 14. End-to-end workflow results (§8 of the brief)

Scripted in `phase3-live.mjs` (steps S1, T6, E1-4, N-login, N1-N8, E7, C1-4, A2-A5, E10, T10, N-gap). It uses a QA client, project and employee created by the script.

| Step | Expected | Result |
|---|---|---|
| 1–3 Admin creates and assigns a task; backend saves it | `POST` + id resolved + DB row | ⏳ pending run |
| 4 Notification generated | 1 × `WORK_ITEM_ASSIGNED` for the assignee, reference `WORK_ITEM/{id}`; none for the unassigned task | ⏳ pending run |
| 5–6 Employee opens it and reaches the task | target `/tasks?task={id}`, task retrievable | ⏳ pending run |
| 7 Employee updates status | `update_status` → `IN_PROGRESS`, `started_at` | ⏳ pending run |
| 8–9 Employee comments and uploads | comment author = employee; PDF stored | ⏳ pending run |
| 10 Admin sees the updates | status, comment and attachment visible | ⏳ pending run |
| — | No notification for status/comment/upload | Expected per backend code; the run records the actual count |

## 15. Failed and untested operations

- **Failed:** none so far.
- **Pending:** every authenticated workflow above, plus the Phase 1 and Phase 2 authenticated suites.
- **Not testable:** comment edit/delete and attachment delete (no endpoints), real-time delivery (not supported), multi-page task/notification pagination (the DB has 1 work item), CLIENT role (no account).
- **Not run:** browser/mobile visual checks.

## 16. Remaining limitations

1. **Notifications only on creation.** Reassignment, status, comments and uploads notify nobody (backend signal design).
2. Uploaded files are **publicly reachable** by URL, and only served in DEBUG. Files can't be deleted through the API.
3. Archived tasks can't be restored through the API.
4. Create-id resolution depends on listing; two identical tasks created at the same moment could be ambiguous, in which case the app falls back to the list.
5. Page size is fixed at 10. Pickers walk all pages (capped at 1,000 records).
6. `features/dashboard/components/employee-dashboard-page.tsx` is dead code: only reachable from the ADMIN routes, never for EMPLOYEE users. It was left in place.
7. Tooling gaps from Phase 1 remain: no in-project `typescript`; `npm run lint` is broken by the missing `typescript-eslint`.
8. Still mock-backed: Users, Meetings, Finance (out of scope).

## 17. Backend files

**No backend files were modified.** Django source, models, serializers, views, URLs and migrations were only read. The database was only read, through `mode=ro` connections. No data was changed by this implementation work. The live suite, once run, creates only the labelled QA records listed in its header. Comments, the uploaded PDF and notifications can't be removed through the API.
