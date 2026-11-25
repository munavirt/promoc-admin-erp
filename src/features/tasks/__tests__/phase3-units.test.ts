/**
 * Phase 3 unit tests (no network): real task / notification / me services over a fake axios transport.
 * Shapes follow work_item/api, notifications/api and me/api in the Django backend.
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

const { apiClient } = await import("../../../infrastructure/apiClient");
const { tokenStorage } = await import("../../../infrastructure/tokenStorage");
const tasks = await import("../../../api/tasks.api");
const notifications = await import("../../../api/notifications.api");
const me = await import("../../../api/me.api");

interface Call { method: string; url: string; params?: Record<string, unknown>; data: unknown; headers: Record<string, unknown>; config: InternalAxiosRequestConfig }

function fakeServer(handler: (c: Call) => { status: number; data: unknown }): Call[] {
  const calls: Call[] = [];
  apiClient.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
    const call: Call = {
      method: String(config.method).toUpperCase(),
      url: String(config.url),
      params: config.params,
      data: config.data,
      headers: (config.headers?.toJSON?.() ?? {}) as Record<string, unknown>,
      config,
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

describe("Work items (tasks)", () => {
  it("uses /work-items/ and passes server-side filters", async () => {
    const calls = fakeServer(() => ({ status: 200, data: page([]) }));
    await tasks.listTasks({ page: 2, project: 3, assigned_to: 5, status: "TODO", priority: "", ordering: "due_date" });
    assert.equal(calls[0].url, "/work-items/");
    assert.deepEqual(calls[0].params, { page: 2, project: 3, assigned_to: 5, status: "TODO", ordering: "due_date" });
  });

  it("create: response has no id → resolves the new task by matching all submitted fields", async () => {
    const payload = { project: 3, title: "QA task", due_date: "2026-12-01", assigned_to: 5, status: "TODO", progress: 0 };
    const calls = fakeServer((c) => {
      if (c.method === "POST") return { status: 201, data: { project: 3, title: "QA task", due_date: "2026-12-01", assigned_to: 5 } };
      return {
        status: 200,
        data: page([
          { id: 11, project: 3, title: "QA task", due_date: "2026-12-02", assigned_to: 5 },
          { id: 10, project: 3, title: "QA task", due_date: "2026-12-01", assigned_to: 5 },
        ]),
      };
    });
    const res = await tasks.createTask(payload);
    assert.equal(res.task?.id, 10);
    assert.deepEqual(calls[1].params, { project: 3, search: "QA task", ordering: "-created_at", include_cancelled: true });
    assert.deepEqual(Object.keys(body(calls[0])).sort(), ["assigned_to", "due_date", "progress", "project", "status", "title"]);
  });

  it("update PATCHes writable fields only, maps empty hours to null, then re-reads the record", async () => {
    const calls = fakeServer((c) => (c.method === "PATCH" ? { status: 200, data: { title: "x" } } : { status: 200, data: { id: 4, title: "x" } }));
    const t = await tasks.updateTask(4, { title: "x", estimated_hours: "", comments: [] } as never);
    assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), ["PATCH /work-items/4/", "GET /work-items/4/"]);
    assert.deepEqual(body(calls[0]), { title: "x", estimated_hours: null });
    assert.equal(t.id, 4);
  });

  it("status / progress / archive use the dedicated backend actions", async () => {
    const calls = fakeServer(() => ({ status: 200, data: { id: 4 } }));
    await tasks.updateTaskStatus(4, "IN_REVIEW");
    await tasks.updateTaskProgress(4, 60);
    await tasks.archiveTask(4);
    assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), [
      "PATCH /work-items/4/update_status/", "PATCH /work-items/4/update_progress/", "DELETE /work-items/4/",
    ]);
    assert.deepEqual(body(calls[0]), { status: "IN_REVIEW" });
    assert.deepEqual(body(calls[1]), { progress: 60 });
  });

  it("comments: GET list, POST { comment }", async () => {
    const calls = fakeServer((c) => (c.method === "GET"
      ? { status: 200, data: [{ id: 1, user: "u", user_name: "Asha", comment: "hi", created_at: "2026-11-16T10:00:00Z" }] }
      : { status: 201, data: { message: "Comment added successfully." } }));
    const list = await tasks.getTaskComments(7);
    const res = await tasks.addTaskComment(7, "Looks good");
    assert.equal(list[0].user_name, "Asha");
    assert.equal(calls[1].url, "/work-items/7/comments/");
    assert.deepEqual(body(calls[1]), { comment: "Looks good" });
    assert.equal(res.message, "Comment added successfully.");
  });

  it("attachments: multipart FormData field `file`, no forced JSON content type, progress reported", async () => {
    let progress = 0;
    const calls = fakeServer((c) => {
      c.config.onUploadProgress?.({ loaded: 50, total: 100, bytes: 50, lengthComputable: true } as never);
      return { status: 201, data: { id: 9, file: "/media/work_items/a.pdf", uploaded_by_name: "Asha", uploaded_at: "2026-11-16T10:00:00Z" } };
    });
    const att = await tasks.uploadTaskAttachment(7, new Blob(["%PDF-1.4"], { type: "application/pdf" }), { fileName: "a.pdf", onProgress: (p) => (progress = p) });
    assert.equal(calls[0].url, "/work-items/7/attachments/");
    assert.ok(calls[0].data instanceof FormData);
    assert.ok((calls[0].data as FormData).get("file") instanceof Blob);
    const ct = String(calls[0].headers["Content-Type"] ?? "");
    assert.ok(!/application\/json/i.test(ct), `unexpected content type ${ct}`);
    assert.equal(progress, 0.5);
    assert.equal(att.id, 9);
  });

  it("validateAttachment mirrors the backend whitelist and 10 MB limit", () => {
    assert.equal(tasks.validateAttachment({ name: "report.PDF", size: 1000 }), null);
    assert.match(tasks.validateAttachment({ name: "run.exe", size: 10 }) || "", /not allowed/);
    assert.match(tasks.validateAttachment({ name: "big.zip", size: 10 * 1024 * 1024 + 1 }) || "", /10 MB/);
    assert.match(tasks.validateAttachment({ name: "noext", size: 10 }) || "", /not allowed/);
  });

  it("media URLs from custom actions are made absolute against the backend origin", () => {
    assert.equal(tasks.resolveMediaUrl("/media/work_items/a.pdf"), "http://127.0.0.1:8000/media/work_items/a.pdf");
    assert.equal(tasks.resolveMediaUrl("http://x/media/a.pdf"), "http://x/media/a.pdf");
    assert.equal(tasks.attachmentFileName("http://127.0.0.1:8000/media/work_items/my%20file.pdf"), "my file.pdf");
  });

  it("overdue / due_today are unpaginated arrays", async () => {
    fakeServer(() => ({ status: 200, data: [{ id: 1 }, { id: 2 }] }));
    assert.equal((await tasks.getOverdueTasks()).length, 2);
  });
});

describe("Notifications", () => {
  it("list / unread-count / mark-as-read / mark-all-as-read hit the confirmed routes", async () => {
    const calls = fakeServer((c) => {
      if (c.url.endsWith("unread-count/")) return { status: 200, data: { unread_count: 3 } };
      if (c.method === "GET") return { status: 200, data: page([{ id: 1, is_read: false }]) };
      return { status: 200, data: { message: "ok" } };
    });
    await notifications.listNotifications({ is_read: false, notification_type: "WORK_ITEM_ASSIGNED", page: 1 });
    assert.equal(await notifications.getNotificationCount(), 3);
    await notifications.markAsRead(1);
    await notifications.markAllAsRead();
    assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), [
      "GET /notifications/", "GET /notifications/unread-count/", "PATCH /notifications/1/mark-as-read/", "PATCH /notifications/mark-all-as-read/",
    ]);
    assert.deepEqual(calls[0].params, { is_read: false, notification_type: "WORK_ITEM_ASSIGNED", page: 1 });
  });

  it("navigation target only for resolvable references, role-aware", () => {
    const n = { reference_type: "WORK_ITEM", reference_id: "42" };
    assert.equal(notifications.notificationTarget(n, "ADMIN"), "/tasks/42");
    assert.equal(notifications.notificationTarget(n, "EMPLOYEE"), "/tasks?task=42");
    assert.equal(notifications.notificationTarget({ reference_type: "", reference_id: "" }, "ADMIN"), null);
    assert.equal(notifications.notificationTarget({ reference_type: "INVOICE", reference_id: "5" }, "ADMIN"), null);
    assert.equal(notifications.notificationTarget({ reference_type: "WORK_ITEM", reference_id: "../x" }, "ADMIN"), null);
  });
});

describe("Employee portal (/api/me)", () => {
  it("walks every page of /me/tasks/", async () => {
    const calls = fakeServer((c) =>
      c.url === "/me/tasks/"
        ? { status: 200, data: { count: 3, next: "http://127.0.0.1:8000/api/me/tasks/?page=2", previous: null, results: [{ id: 1 }, { id: 2 }] } }
        : { status: 200, data: { count: 3, next: null, previous: "x", results: [{ id: 3 }] } },
    );
    const list = await me.getMeTasks();
    assert.deepEqual(list.map((t) => t.id), [1, 2, 3]);
    assert.equal(calls.length, 2);
  });
});
