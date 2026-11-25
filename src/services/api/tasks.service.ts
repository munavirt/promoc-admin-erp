/**
 * Real Work Item ("task") service — Django `work_item` app (WorkItemViewSet).
 * `/api/tasks/` is only a URL alias of the same router; this service uses the canonical `/api/work-items/`.
 *
 *   GET    /work-items/                     ?page, search (title, description, project__project_name, assigned_to__user__name),
 *                                           status, priority, project, assigned_to, ordering (due_date, priority, created_at, progress),
 *                                           include_cancelled  — CANCELLED excluded from lists by default
 *   POST   /work-items/                     WorkItemCreateSerializer → response has NO id (see `create`)
 *   GET    /work-items/{id}/                WorkItemSerializer (nested comments + attachments)
 *   PATCH  /work-items/{id}/                WorkItemCreateSerializer fields → response has NO id / nested data
 *   DELETE /work-items/{id}/                soft: status=CANCELLED → { message }
 *   PATCH  /work-items/{id}/update_status/  { status }   (sets started_at / completed_at, progress 100 on COMPLETED)
 *   PATCH  /work-items/{id}/update_progress/{ progress } (100 → COMPLETED)
 *   PATCH  /work-items/{id}/assign_employee/{ assigned_to } (admin only)
 *   GET/POST /work-items/{id}/comments/     POST { comment } → { message }
 *   GET/POST /work-items/{id}/attachments/  POST multipart field `file` (≤10 MB, extension whitelist, magic bytes)
 *   GET    /work-items/my_work/ | due_today/ | overdue/   (unpaginated arrays)
 * Employees: queryset limited to items assigned to them; no create/delete/assign.
 */
import type { AxiosProgressEvent } from "axios";
import type {
  TaskAttachment,
  TaskBackend,
  TaskComment,
  TaskListParams,
  TaskWritePayload,
} from "@/api/tasks.api";
import { apiClient, cleanParams, isPaginated, type Paginated } from "@/infrastructure/apiClient";

const BASE = "/work-items/";
const detailUrl = (id: string | number) => `${BASE}${encodeURIComponent(String(id))}/`;
const MAX_PAGES = 100;

const WRITABLE_FIELDS = [
  "project", "title", "description", "assigned_to", "priority", "status", "progress", "estimated_hours", "due_date",
] as const;

function pickWritable(payload: Partial<TaskWritePayload>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const key of WRITABLE_FIELDS) {
    if (payload[key] !== undefined) body[key] = payload[key];
  }
  if (body.estimated_hours === "") body.estimated_hours = null;
  return body;
}

async function walk<T>(url: string, params: Record<string, unknown>, signal?: AbortSignal): Promise<T[]> {
  const { data } = await apiClient.get<Paginated<T> | T[]>(url, { params: cleanParams(params), signal });
  if (!isPaginated<T>(data)) return Array.isArray(data) ? data : [];
  const all = [...data.results];
  let next = data.next;
  let pages = 1;
  while (next && pages < MAX_PAGES) {
    const res = await apiClient.get<Paginated<T>>(next, { signal });
    all.push(...res.data.results);
    next = res.data.next;
    pages += 1;
  }
  return all;
}

const asArray = <T,>(data: T[] | Paginated<T>): T[] => (isPaginated<T>(data) ? data.results : Array.isArray(data) ? data : []);

export const tasksService = {
  async list(params: TaskListParams = {}, signal?: AbortSignal): Promise<Paginated<TaskBackend>> {
    const { data } = await apiClient.get<Paginated<TaskBackend> | TaskBackend[]>(BASE, { params: cleanParams({ ...params }), signal });
    if (isPaginated<TaskBackend>(data)) return data;
    const list = Array.isArray(data) ? data : [];
    return { count: list.length, next: null, previous: null, results: list };
  },

  listAll(params: Omit<TaskListParams, "page"> = {}, signal?: AbortSignal): Promise<TaskBackend[]> {
    return walk<TaskBackend>(BASE, { ...params }, signal);
  },

  async getById(id: string | number, signal?: AbortSignal): Promise<TaskBackend> {
    const { data } = await apiClient.get<TaskBackend>(detailUrl(id), { signal });
    return data;
  },

  /**
   * POST returns WorkItemCreateSerializer data without `id`. The new item is resolved by listing
   * `ordering=-created_at` within the same project and matching every submitted field, newest first.
   * Returns `task: null` if it cannot be resolved unambiguously.
   */
  async create(payload: TaskWritePayload): Promise<{ created: Partial<TaskBackend>; task: TaskBackend | null }> {
    const body = pickWritable(payload);
    const { data } = await apiClient.post<Partial<TaskBackend>>(BASE, body);
    if (data && data.id !== undefined && data.id !== null) {
      return { created: data, task: data as TaskBackend };
    }
    try {
      const page = await tasksService.list({
        project: payload.project,
        search: payload.title,
        ordering: "-created_at",
        include_cancelled: true,
      });
      const match = page.results.find(
        (t) =>
          t.title === payload.title &&
          String(t.project) === String(payload.project) &&
          t.due_date === payload.due_date &&
          String(t.assigned_to ?? "") === String(payload.assigned_to ?? ""),
      );
      return { created: data, task: match ?? null };
    } catch {
      return { created: data, task: null };
    }
  },

  /** PATCH (partial). The response lacks id/nested data, so the full record is re-read. */
  async update(id: string | number, payload: Partial<TaskWritePayload>): Promise<TaskBackend> {
    await apiClient.patch(detailUrl(id), pickWritable(payload));
    return tasksService.getById(id);
  },

  /** Soft delete — status CANCELLED; hidden from lists (still retrievable by id). */
  async archive(id: string | number): Promise<{ message: string }> {
    const { data } = await apiClient.delete<{ message: string }>(detailUrl(id));
    return data;
  },

  async updateStatus(id: string | number, status: string): Promise<TaskBackend> {
    const { data } = await apiClient.patch<TaskBackend>(`${detailUrl(id)}update_status/`, { status });
    return data;
  },

  async updateProgress(id: string | number, progress: number): Promise<TaskBackend> {
    const { data } = await apiClient.patch<TaskBackend>(`${detailUrl(id)}update_progress/`, { progress });
    return data;
  },

  async assignEmployee(id: string | number, assignedTo: string | number): Promise<TaskBackend> {
    const { data } = await apiClient.patch<TaskBackend>(`${detailUrl(id)}assign_employee/`, { assigned_to: assignedTo });
    return data;
  },

  async getComments(id: string | number, signal?: AbortSignal): Promise<TaskComment[]> {
    const { data } = await apiClient.get<TaskComment[] | Paginated<TaskComment>>(`${detailUrl(id)}comments/`, { signal });
    return asArray(data);
  },

  async addComment(id: string | number, comment: string): Promise<{ message: string }> {
    const { data } = await apiClient.post<{ message: string }>(`${detailUrl(id)}comments/`, { comment });
    return data;
  },

  async getAttachments(id: string | number, signal?: AbortSignal): Promise<TaskAttachment[]> {
    const { data } = await apiClient.get<TaskAttachment[] | Paginated<TaskAttachment>>(`${detailUrl(id)}attachments/`, { signal });
    return asArray(data);
  },

  /**
   * Multipart upload (field `file`). No Content-Type is set manually: axios/the browser add the
   * multipart boundary for FormData. Upload progress is reported via axios onUploadProgress.
   */
  async uploadAttachment(
    id: string | number,
    file: File | Blob,
    opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal; fileName?: string } = {},
  ): Promise<TaskAttachment> {
    const form = new FormData();
    if (opts.fileName) form.append("file", file, opts.fileName);
    else form.append("file", file);
    const { data } = await apiClient.post<TaskAttachment>(`${detailUrl(id)}attachments/`, form, {
      signal: opts.signal,
      timeout: 120000,
      onUploadProgress: (e: AxiosProgressEvent) => {
        if (opts.onProgress && e.total) opts.onProgress(Math.min(1, e.loaded / e.total));
      },
    });
    return data;
  },

  async myWork(signal?: AbortSignal): Promise<TaskBackend[]> {
    const { data } = await apiClient.get<TaskBackend[] | Paginated<TaskBackend>>(`${BASE}my_work/`, { signal });
    return asArray(data);
  },

  async dueToday(signal?: AbortSignal): Promise<TaskBackend[]> {
    const { data } = await apiClient.get<TaskBackend[] | Paginated<TaskBackend>>(`${BASE}due_today/`, { signal });
    return asArray(data);
  },

  async overdue(signal?: AbortSignal): Promise<TaskBackend[]> {
    const { data } = await apiClient.get<TaskBackend[] | Paginated<TaskBackend>>(`${BASE}overdue/`, { signal });
    return asArray(data);
  },
};
