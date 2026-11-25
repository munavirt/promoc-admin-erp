import { useNavigate } from "react-router-dom";
import { NotificationList } from "./notification-list";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCheck, Loader2 } from "lucide-react";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { useMarkAllNotificationsRead, useNotificationCount, useRecentNotifications } from "../hooks/use-notifications";

interface NotificationDropdownProps {
  onClose: () => void;
}

export function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  // Recent = newest server page; the unread total comes from /unread-count/ (not the loaded page).
  const recentQuery = useRecentNotifications();
  const notifications = recentQuery.data ?? [];
  const { data: unreadCount = 0 } = useNotificationCount();
  const markAllReadMutation = useMarkAllNotificationsRead();
  const navigate = useNavigate();

  const handleViewAll = () => {
    onClose();
    navigate("/notifications");
  };

  return (
    <>
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div>
          <h4 className="text-[14px] font-semibold text-foreground leading-none">Notifications</h4>
          <p className="text-[12px] text-muted-foreground mt-1">
            {unreadCount} unread
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            className="flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
          >
            {markAllReadMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
            Mark all read
          </button>
        )}
      </div>
      
      <div className="max-h-[420px] overflow-y-auto">
        {recentQuery.isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 rounded-lg bg-secondary/60 animate-pulse" />)}
          </div>
        ) : recentQuery.isError ? (
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <p className="text-[12px] text-muted-foreground">{extractApiErrorMessage(recentQuery.error, "Could not load notifications.").message}</p>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void recentQuery.refetch()}>Retry</Button>
          </div>
        ) : (
          <NotificationList notifications={notifications} isDropdown={true} onItemClick={onClose} />
        )}
      </div>
      
      <div className="p-3 border-t border-border/50">
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-9 text-[13px] font-medium"
          onClick={handleViewAll}
        >
          View all notifications
        </Button>
      </div>
    </>
  );
}
