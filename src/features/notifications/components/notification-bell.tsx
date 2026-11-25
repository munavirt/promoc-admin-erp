import { useState } from "react";
import { Bell } from "lucide-react";
import { NotificationBadge } from "./notification-badge";
import { NotificationDropdown } from "./notification-dropdown";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotificationCount } from "../hooks/use-notifications";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  
  const { data: unreadCount = 0 } = useNotificationCount();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground shadow-[0_1px_2px_rgba(32,43,60,0.04),0_6px_18px_-10px_rgba(16,50,110,0.2)] transition-colors hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <Bell className="h-[18px] w-[18px]" />
          <NotificationBadge count={unreadCount} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] sm:w-[420px] p-0" sideOffset={8}>
        <NotificationDropdown onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
