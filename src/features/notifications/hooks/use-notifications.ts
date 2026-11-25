import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  countNotifications, getNotificationCount, listNotifications, markAllAsRead, markAsRead,
  type NotificationListParams,
} from "@/api/notifications.api";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";

/**
 * All keys live under ["notifications"] so a single invalidation refreshes the bell count,
 * the dropdown, the page, its stats and the employee portal.
 * There is no WebSocket/push support in the backend: the unread count is polled every 60 s
 * and refreshed on window focus.
 */
const POLL_MS = 60_000;

export const useNotificationCount = () =>
  useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: ({ signal }) => getNotificationCount(signal),
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

/** Newest notifications (first page) for the header dropdown and dashboards. */
export const useRecentNotifications = (enabled = true) =>
  useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: async ({ signal }) => (await listNotifications({ ordering: "-created_at" }, signal)).results,
    enabled,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
/** Legacy name. */
export const useNotifications = useRecentNotifications;

/** One server page with filters (notifications page). */
export const useNotificationsPage = (params: NotificationListParams) =>
  useQuery({
    queryKey: ["notifications", "list", params],
    queryFn: ({ signal }) => listNotifications({ ordering: "-created_at", ...params }, signal),
    placeholderData: keepPreviousData,
  });

/** Exact counts from server filters (no client-side tally of a partial page). */
export const useNotificationStats = () =>
  useQuery({
    queryKey: ["notifications", "stats"],
    queryFn: async ({ signal }) => {
      const unreadOf = (notification_type: string) => countNotifications({ is_read: false, notification_type }, signal);
      const [all, unread, assigned, updated, completed, project, meeting, general] = await Promise.all([
        countNotifications({}, signal),
        getNotificationCount(signal),
        unreadOf("WORK_ITEM_ASSIGNED"),
        unreadOf("WORK_ITEM_UPDATED"),
        unreadOf("WORK_ITEM_COMPLETED"),
        unreadOf("PROJECT_UPDATED"),
        unreadOf("MEETING_CREATED"),
        unreadOf("GENERAL"),
      ]);
      return {
        all,
        unread,
        read: all - unread,
        unreadByGroup: { tasks: assigned + updated + completed, projects: project, meetings: meeting, general },
      };
    },
  });

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string | number) => markAsRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (err) => toast.error(extractApiErrorMessage(err, "Could not mark the notification as read.").message),
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllAsRead(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success(res?.message || "All notifications marked as read.");
    },
    onError: (err) => toast.error(extractApiErrorMessage(err, "Could not mark notifications as read.").message),
  });
};
