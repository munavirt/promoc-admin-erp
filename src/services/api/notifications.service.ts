/**
 * Real Notification service — Django `notifications` app (NotificationViewSet, IsAuthenticated;
 * queryset = request.user's own notifications only).
 *
 *   GET   /notifications/                    ?page, is_read, notification_type, priority, ordering (created_at)
 *   GET   /notifications/unread-count/       → { unread_count }
 *   PATCH /notifications/{id}/mark-as-read/  → NotificationSerializer
 *   PATCH /notifications/mark-all-as-read/   → { message }
 * Not used: POST (would create notifications — never fabricated here), PATCH /{id}/ (generic edit),
 * DELETE /{id}/ (hard delete), GET /unread/ (unpaginated).
 */
import type { NotificationBackend, NotificationListParams } from "@/api/notifications.api";
import { apiClient, cleanParams, isPaginated, type Paginated } from "@/infrastructure/apiClient";

const BASE = "/notifications/";

export const notificationsService = {
  async list(params: NotificationListParams = {}, signal?: AbortSignal): Promise<Paginated<NotificationBackend>> {
    const { data } = await apiClient.get<Paginated<NotificationBackend> | NotificationBackend[]>(BASE, {
      params: cleanParams({ ...params }),
      signal,
    });
    if (isPaginated<NotificationBackend>(data)) return data;
    const list = Array.isArray(data) ? data : [];
    return { count: list.length, next: null, previous: null, results: list };
  },

  async unreadCount(signal?: AbortSignal): Promise<number> {
    const { data } = await apiClient.get<{ unread_count: number }>(`${BASE}unread-count/`, { signal });
    return Number(data?.unread_count ?? 0);
  },

  async markAsRead(id: string | number): Promise<NotificationBackend> {
    const { data } = await apiClient.patch<NotificationBackend>(`${BASE}${encodeURIComponent(String(id))}/mark-as-read/`);
    return data;
  },

  async markAllAsRead(): Promise<{ message: string }> {
    const { data } = await apiClient.patch<{ message: string }>(`${BASE}mark-all-as-read/`);
    return data;
  },
};
