import { useEffect, useState } from "react";
import { notificationTarget, type NotificationBackend } from "@/api/notifications.api";
import { Button } from "@/components/ui/button";
import { AlertCircle, Bell, Check, FolderKanban, CheckSquare, Info, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useStore } from "@/store";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import {
  useMarkAllNotificationsRead, useMarkNotificationRead, useNotificationCount, useNotificationsPage,
} from "@/features/notifications/hooks/use-notifications";

type Filter = "ALL" | "UNREAD" | "TASK" | "PROJECT";
/** Filters map to server-side query params (exact notification_type values from the backend). */
const FILTER_PARAMS: Record<Filter, { is_read?: boolean; notification_type?: string }> = {
  ALL: {},
  UNREAD: { is_read: false },
  TASK: { notification_type: "WORK_ITEM_ASSIGNED" },
  PROJECT: { notification_type: "PROJECT_UPDATED" },
};
const PAGE_SIZE = 10;

export function EmployeeNotificationsPage() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [pageState, setPageState] = useState({ filter: "ALL" as Filter, page: 1 });
  const page = pageState.filter === filter ? pageState.page : 1;
  const { currentUser } = useStore();

  // GET /api/notifications/ — only the signed-in user's notifications are ever returned.
  const pageQuery = useNotificationsPage({ page, ...FILTER_PARAMS[filter] });
  const notifications = pageQuery.data?.results ?? [];
  const total = pageQuery.data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isLoading = pageQuery.isLoading;
  const { data: unreadCount = 0 } = useNotificationCount();

  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const errStatus = (pageQuery.error as { status?: number | null } | null)?.status;
  useEffect(() => {
    if (errStatus === 404 && page > 1) setPageState({ filter, page: page - 1 });
  }, [errStatus, page, filter]);

  const filteredNotifications = notifications;

  const getIcon = (type: string) => {
    if (type?.includes("WORK_ITEM") || type?.includes("TASK")) return CheckSquare;
    if (type?.includes("PROJECT")) return FolderKanban;
    return Info;
  };

  return (
    <div className="flex flex-col min-h-full w-full bg-[#F8F9FA] pb-10">
      <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1000px] mx-auto w-full space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <span className="bg-blue-600 text-white text-[11px] px-2 py-0.5 rounded-full font-bold ml-1">
                  {unreadCount} new
                </span>
              )}
            </h1>
            <p className="text-muted-foreground text-[14px] mt-1">Stay updated with your latest assignments and activity.</p>
          </div>
          {unreadCount > 0 && (
            <Button 
              variant="outline" 
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="h-9 text-[13px] font-semibold bg-white"
            >
              {markAllReadMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}
              Mark all as read
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {(["ALL", "UNREAD", "TASK", "PROJECT"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors whitespace-nowrap border",
                filter === f 
                  ? "bg-foreground text-background border-foreground shadow-sm" 
                  : "bg-white text-muted-foreground border-border/70 hover:bg-secondary/50"
              )}
            >
              {f === "ALL" ? "All Activity" : 
               f === "UNREAD" ? "Unread" : 
               f === "TASK" ? "Tasks" : "Projects"}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl border border-border/70 shadow-sm overflow-hidden min-h-[400px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 h-full text-muted-foreground">
              <Bell className="w-8 h-8 mb-4 opacity-20 animate-pulse" />
              Loading notifications...
            </div>
          ) : pageQuery.isError ? (
            <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
              <AlertCircle className="w-7 h-7 text-red-400" />
              <p className="text-[14px] font-semibold text-foreground">Unable to load notifications</p>
              <p className="text-[13px] text-muted-foreground">{extractApiErrorMessage(pageQuery.error, "Please try again.").message}</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => void pageQuery.refetch()}>Retry</Button>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 h-full text-center">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-5">
                <Bell className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-[16px] font-bold text-foreground">All caught up!</h3>
              <p className="text-[14px] text-muted-foreground mt-2 max-w-sm">
                {filter === "ALL" 
                  ? "You don't have any notifications right now." 
                  : `You don't have any ${filter.toLowerCase()} notifications.`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredNotifications.map((notif: NotificationBackend) => {
                const Icon = getIcon(notif.notification_type);
                const link = notificationTarget(notif, currentUser?.role);
                return (
                  <div 
                    key={notif.id} 
                    className={cn(
                      "p-5 sm:p-6 flex flex-col sm:flex-row gap-5 transition-colors group relative",
                      !notif.is_read ? "bg-blue-50/30" : "hover:bg-secondary/20"
                    )}
                  >
                    {!notif.is_read && (
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-blue-600 rounded-r-full" />
                    )}
                    
                    <div className="flex gap-4 flex-1 min-w-0">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center shrink-0 border",
                        !notif.is_read ? "bg-blue-100 border-blue-200 text-blue-600" : "bg-secondary border-border/70 text-muted-foreground"
                      )}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col gap-1 min-w-0 flex-1 pt-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className={cn("text-[14px] leading-tight", !notif.is_read ? "font-bold text-foreground" : "font-semibold text-foreground/80")}>
                            {notif.title}
                          </h4>
                          {!notif.is_read && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                          )}
                        </div>
                        <p className="text-[13px] text-muted-foreground leading-relaxed mt-0.5 pr-4">
                          {notif.message}
                        </p>
                        <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider mt-2">
                          {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:self-start ml-14 sm:ml-0">
                      {!notif.is_read && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          disabled={markReadMutation.isPending}
                          onClick={() => markReadMutation.mutate(notif.id)}
                          className="h-8 text-[12px] font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          Mark read
                        </Button>
                      )}
                      {link && (
                        <Button asChild variant="outline" size="sm" className="h-8 text-[12px] font-semibold bg-white shadow-sm">
                          <Link to={link} onClick={() => !notif.is_read && markReadMutation.mutate(notif.id)}>
                            Open
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {pageCount > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs bg-white" disabled={!pageQuery.data?.previous || pageQuery.isFetching} onClick={() => setPageState({ filter, page: page - 1 })}>Previous</Button>
              <span className="text-xs text-muted-foreground">Page {page} of {pageCount}</span>
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs bg-white" disabled={!pageQuery.data?.next || pageQuery.isFetching} onClick={() => setPageState({ filter, page: page + 1 })}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
