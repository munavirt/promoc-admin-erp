import { tasksAdapter } from "@/adapters/erp.adapters";
import { API_BASE_URL, type Paginated } from "@/infrastructure/apiClient";

/** work_item.models.WorkItemStatus / WorkItemPriority */
export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "COMPLETED" | "BLOCKED" | "CANCELLED";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  COMPLETED: "Completed",
  BLOCKED: "Blocked",
  CANCELLED: "Cancelled",
};
/** Statuses offered in forms (CANCELLED is reached through the archive action). */
export const SELECTABLE_TASK_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "BLOCKED"];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" };

/** work_item.api.serializers.WorkItemCommentSerializer */
export interface TaskComment {
  id: number | string;
  /** User UUID. */
  user: string;
  user_name?: string | null;
  comment: string;
  created_at: string;
}

/** work_item.api.serializers.WorkItemAttachmentSerializer */
export interface TaskAttachment {
  id: number | string;
  /** File URL — absolute or relative to the backend origin (e.g. /media/work_items/x.pdf). */
  file: string;
  uploaded_by?: string | null;
  uploaded_by_name?: string | null;
  uploaded_at: string;
}

/** work_item.api.serializers.WorkItemSerializer */
export interface TaskBackend {
  id: number | string;
  project: number | string;
  project_name?: string;
  title: string;
  description: string;
  /** Employee PK or null. */
  assigned_to: number | string | null;
  assigned_to_name?: string | null;
  assigned_to_designation?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  priority: TaskPriority | string;
  status: TaskStatus | string;
  progress: number;
  /** DecimalField(5,1) serialized as string, or null. */
  estimated_hours: string | number | null;
  due_date: string;
  started_at?: string | null;
  completed_at?: string | null;
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
  created_at?: string;
  updated_at?: string;
}

/**
 * WorkItemCreateSerializer write fields. Required: project, title (≤255), due_date (YYYY-MM-DD, not in the past on create).
 * Optional: description, assigned_to (ACTIVE employee PK or null), priority (default MEDIUM), status (default TODO),
 * progress (0–100; must be 100 when status is COMPLETED), estimated_hours (decimal 5,1, nullable).
 */
export interface TaskWritePayload {
  project: number | string;
  title: string;
  description?: string;
  assigned_to?: number | string | null;
  priority?: TaskPriority | string;
  status?: TaskStatus | string;
  progress?: number;
  estimated_hours?: string | number | null;
  due_date: string;
}

export type CreateTaskPayload = TaskWritePayload;
export type UpdateTaskPayload = Partial<TaskWritePayload>;

export interface TaskListParams {
  page?: number;
  search?: string;
  status?: string;
  priority?: string;
  project?: string | number;
  assigned_to?: string | number;
  /** due_date | priority | created_at | progress, "-" for descending. */
  ordering?: string;
  include_cancelled?: boolean;
}

export const labelForTaskStatus = (s?: string | null) => (s && (TASK_STATUS_LABELS as Record<string, string>)[s]) || s || "—";
export const labelForTaskPriority = (p?: string | null) => (p && (TASK_PRIORITY_LABELS as Record<string, string>)[p]) || p || "—";

/** Backend origin (VITE_API_BASE_URL without the /api suffix), used for media URLs. */
export const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api$/, "");

/** Attachment URLs from custom actions are relative (no request context); make them absolute. */
export function resolveMediaUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  return `${BACKEND_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** File name from a stored path ("work_items/report_AbC12.pdf" → "report_AbC12.pdf"). */
export function attachmentFileName(url: string): string {
  try {
    const path = /^https?:\/\//i.test(url) ? new URL(url).pathname : url;
    return decodeURIComponent(path.split("/").filter(Boolean).pop() || url);
  } catch {
    return url.split("/").pop() || url;
  }
}

/** Mirrors work_item/validators.py so files are rejected before upload. Backend remains authoritative. */
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_ALLOWED_EXTENSIONS = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt", ".rtf",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".zip",
];
export function validateAttachment(file: { name: string; size: number }): string | null {
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  if (!ATTACHMENT_ALLOWED_EXTENSIONS.includes(ext)) {
    return `"${file.name}": file type ${ext || "(none)"} is not allowed. Allowed: ${ATTACHMENT_ALLOWED_EXTENSIONS.join(", ")}.`;
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(2)} MB; the limit is 10 MB.`;
  }
  if (file.size === 0) return `"${file.name}" is empty.`;
  return null;
}

/* ─── Calls ───────────────────────────────────────── */

export const listTasks = (params: TaskListParams = {}, signal?: AbortSignal): Promise<Paginated<TaskBackend>> =>
  tasksAdapter.list(params, signal);

export const listAllTasks = (params: Omit<TaskListParams, "page"> = {}, signal?: AbortSignal): Promise<TaskBackend[]> =>
  tasksAdapter.listAll(params, signal);

/** Every visible task (legacy signature used by dashboard and reports). */
export const getTasks = (signal?: AbortSignal): Promise<TaskBackend[]> => tasksAdapter.listAll({}, signal);

export const countTasks = async (params: Omit<TaskListParams, "page" | "ordering"> = {}, signal?: AbortSignal): Promise<number> =>
  (await tasksAdapter.list(params, signal)).count;

export const getTask = (id: string | number, signal?: AbortSignal): Promise<TaskBackend> => tasksAdapter.getById(id, signal);

export const createTask = (data: TaskWritePayload) => tasksAdapter.create(data);

export const updateTask = (id: string | number, data: UpdateTaskPayload): Promise<TaskBackend> => tasksAdapter.update(id, data);

/** DELETE — soft (status CANCELLED). */
export const archiveTask = (id: string | number): Promise<{ message: string }> => tasksAdapter.archive(id);
export const deleteTask = archiveTask;

export const assignEmployee = (id: string | number, assigned_to: string | number): Promise<TaskBackend> =>
  tasksAdapter.assignEmployee(id, assigned_to);

export const updateTaskProgress = (id: string | number, progress: number): Promise<TaskBackend> =>
  tasksAdapter.updateProgress(id, progress);

export const updateTaskStatus = (id: string | number, status: string): Promise<TaskBackend> =>
  tasksAdapter.updateStatus(id, status);

export const getTaskComments = (id: string | number, signal?: AbortSignal): Promise<TaskComment[]> =>
  tasksAdapter.getComments(id, signal);

export const addTaskComment = (id: string | number, comment: string): Promise<{ message: string }> =>
  tasksAdapter.addComment(id, comment);

export const getTaskAttachments = (id: string | number, signal?: AbortSignal): Promise<TaskAttachment[]> =>
  tasksAdapter.getAttachments(id, signal);

export const uploadTaskAttachment = (
  id: string | number,
  file: File | Blob,
  opts?: { onProgress?: (fraction: number) => void; signal?: AbortSignal; fileName?: string },
): Promise<TaskAttachment> => tasksAdapter.uploadAttachment(id, file, opts);

export const getDueTodayTasks = (signal?: AbortSignal): Promise<TaskBackend[]> => tasksAdapter.dueToday(signal);
export const getMyTasks = (signal?: AbortSignal): Promise<TaskBackend[]> => tasksAdapter.myWork(signal);
export const getOverdueTasks = (signal?: AbortSignal): Promise<TaskBackend[]> => tasksAdapter.overdue(signal);
