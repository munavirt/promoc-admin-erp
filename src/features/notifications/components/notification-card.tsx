import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  ClipboardCheck, RefreshCcw, CheckCircle2, FolderKanban,
  CalendarDays, Bell, MoreHorizontal, Trash2, CheckCircle, ExternalLink
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { notificationTarget, type NotificationBackend } from "@/api/notifications.api";
import { useStore } from "@/store";
import { useMarkNotificationRead } from "../hooks/use-notifications";
import { formatDistanceToNow } from "date-fns";

interface NotificationCardProps {
  notification: NotificationBackend;
  onClick?: () => void;
  isDropdown?: boolean;
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  // Backend notifications.models.NotificationType
  "WORK_ITEM_ASSIGNED":  { icon: <ClipboardCheck className="h-4 w-4" />, color: "text-blue-600",    bg: "bg-blue-100" },
  "WORK_ITEM_UPDATED":   { icon: <RefreshCcw className="h-4 w-4" />,     color: "text-orange-600",  bg: "bg-orange-100" },
  "WORK_ITEM_COMPLETED": { icon: <CheckCircle2 className="h-4 w-4" />,   color: "text-emerald-600", bg: "bg-emerald-100" },
  "TASK_ASSIGNED":   { icon: <ClipboardCheck className="h-4 w-4" />, color: "text-blue-600",    bg: "bg-blue-100" },
  "TASK_UPDATED":    { icon: <RefreshCcw className="h-4 w-4" />,     color: "text-orange-600",  bg: "bg-orange-100" },
  "TASK_COMPLETED":  { icon: <CheckCircle2 className="h-4 w-4" />,   color: "text-emerald-600", bg: "bg-emerald-100" },
  "PROJECT_UPDATED": { icon: <FolderKanban className="h-4 w-4" />,   color: "text-purple-600",  bg: "bg-purple-100" },
  "MEETING_CREATED": { icon: <CalendarDays className="h-4 w-4" />,   color: "text-teal-600",    bg: "bg-teal-100" },
  "GENERAL":         { icon: <Bell className="h-4 w-4" />,           color: "text-slate-600",   bg: "bg-slate-100" },
};

const PRIORITY_COLORS: Record<string, string> = {
  HIGH:   "bg-red-500",
  MEDIUM: "bg-amber-400",
  LOW:    "bg-emerald-500",
};

export function NotificationCard({ notification, onClick, isDropdown }: NotificationCardProps) {
  const navigate = useNavigate();
  const { currentUser } = useStore();
  const markReadMutation = useMarkNotificationRead();
  const config = TYPE_CONFIG[notification.notification_type] || TYPE_CONFIG["GENERAL"];
  const priorityColor = PRIORITY_COLORS[notification.priority] || "bg-slate-300";

  // Only navigate when the backend supplied a resolvable reference (WORK_ITEM → task).
  const actionUrl = notificationTarget(notification, currentUser?.role);

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent navigation if clicking dropdown menu
    if ((e.target as HTMLElement).closest('[data-dropdown-trigger]')) return;
    
    if (!notification.is_read && !markReadMutation.isPending) {
      markReadMutation.mutate(notification.id);
    }

    if (onClick) onClick();

    if (actionUrl) {
      navigate(actionUrl);
    }
  };

  const created = new Date(notification.created_at);
  const timeAgo = Number.isNaN(created.getTime()) ? "" : formatDistanceToNow(created, { addSuffix: true });

  return (
    <div
      onClick={handleCardClick}
      role={actionUrl ? "link" : undefined}
      aria-label={`${notification.is_read ? "" : "Unread: "}${notification.title}`}
      className={cn(
        "group relative flex items-start gap-3 p-3.5 transition-all duration-200 cursor-pointer overflow-hidden",
        isDropdown ? "rounded-lg" : "rounded-xl border border-border/50",
        !notification.is_read ? "bg-blue-50/50" : "bg-white hover:bg-secondary/30",
        !isDropdown && "hover:shadow-sm hover:border-primary/20"
      )}
    >
      {/* Priority Indicator - tiny left bar */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1", priorityColor)} />

      {/* Icon */}
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5", config.bg, config.color)}>
        {config.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-6">
        <p className={cn("text-[13px] font-semibold truncate", !notification.is_read ? "text-foreground" : "text-muted-foreground/90")}>
          {notification.title}
        </p>
        <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
          {notification.message}
        </p>
        <p className="text-[10px] font-medium text-muted-foreground/70 mt-1.5" title={created.toLocaleString()}>
          {timeAgo}{!actionUrl && notification.reference_type ? ` · ${notification.reference_type.toLowerCase().replace("_", " ")}` : ""}
        </p>
      </div>

      {/* Unread Dot (Dropdown) or Actions (Page) */}
      <div className="absolute right-3 top-3 flex items-center">
        {!notification.is_read && isDropdown && (
          <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_4px_rgba(59,130,246,0.1)]" />
        )}
        
        {!isDropdown && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button data-dropdown-trigger className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary transition-colors opacity-0 group-hover:opacity-100">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {actionUrl && (
                <DropdownMenuItem onClick={() => navigate(actionUrl)} className="gap-2 text-[12px] cursor-pointer">
                  <ExternalLink className="h-3.5 w-3.5" /> Open
                </DropdownMenuItem>
              )}
              {!notification.is_read && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); markReadMutation.mutate(notification.id); }} className="gap-2 text-[12px] cursor-pointer">
                  <CheckCircle className="h-3.5 w-3.5" /> Mark Read
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      
      {/* Unread indicator for full page (if not hovered) */}
      {!isDropdown && !notification.is_read && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 group-hover:opacity-0 transition-opacity">
           <span className="block h-2.5 w-2.5 rounded-full bg-primary" />
        </div>
      )}
    </div>
  );
}
