import { notificationsAdapter } from "@/adapters/erp.adapters";
import type { Paginated } from "@/infrastructure/apiClient";

/** notifications.models.NotificationType */
export type NotificationType =
  | "WORK_ITEM_ASSIGNED" | "WORK_ITEM_UPDATED" | "WORK_ITEM_COMPLETED"
  | "PROJECT_UPDATED" | "MEETING_CREATED" | "GENERAL";

/** notifications.api.serializers.NotificationSerializer */
export interface NotificationBackend {
  id: number | string;
  recipient?: string;
  recipient_name?: string;
  title: string;
  message: string;
  notification_type: NotificationType | string;
  priority: "LOW" | "MEDIUM" | "HIGH" | string;
  is_read: boolean;
  read_at: string | null;
  /** CharField (blank allowed). The only backend producer sets the work item id. */
  reference_id: string | number | null;
  /** CharField (blank allowed). The only backend producer sets "WORK_ITEM". */
  reference_type: string | null;
  created_at: string;
}

export interface NotificationListParams {
  page?: number;
  is_read?: boolean;
  notification_type?: string;
  priority?: string;
  ordering?: "created_at" | "-created_at";
}

/**
 * In-app destination for a notification, only when the backend gave a reference we can resolve.
 * WORK_ITEM → admin task page, or the employee portal task drawer. Anything else → no link.
 */
export function notificationTarget(n: Pick<NotificationBackend, "reference_type" | "reference_id">, role?: string | null): string | null {
  const id = n.reference_id === null || n.reference_id === undefined ? "" : String(n.reference_id).trim();
  if (!id || !/^\d+$/.test(id)) return null;
  const type = String(n.reference_type || "").toUpperCase();
  const isEmployee = String(role || "").toUpperCase() === "EMPLOYEE";
  if (type === "WORK_ITEM" || type === "TASK") return isEmployee ? `/tasks?task=${id}` : `/tasks/${id}`;
  if (type === "PROJECT") return isEmployee ? `/projects/${id}` : `/projects/${id}`;
  return null;
}

export const listNotifications = (params: NotificationListParams = {}, signal?: AbortSignal): Promise<Paginated<NotificationBackend>> =>
  notificationsAdapter.list(params, signal);

export const countNotifications = async (params: Omit<NotificationListParams, "page" | "ordering"> = {}, signal?: AbortSignal) =>
  (await notificationsAdapter.list(params, signal)).count;

/** Most recent notifications (first page, newest first). */
export const getAllNotifications = async (signal?: AbortSignal): Promise<NotificationBackend[]> =>
  (await notificationsAdapter.list({ ordering: "-created_at" }, signal)).results;

export const getNotificationCount = (signal?: AbortSignal): Promise<number> => notificationsAdapter.unreadCount(signal);

export const markAsRead = (id: string | number): Promise<NotificationBackend> => notificationsAdapter.markAsRead(id);

export const markAllAsRead = (): Promise<{ message: string }> => notificationsAdapter.markAllAsRead();
