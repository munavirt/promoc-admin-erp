import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationEmptyProps {
  isDropdown?: boolean;
}

export function NotificationEmpty({ isDropdown }: NotificationEmptyProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center",
      isDropdown ? "py-12" : "py-24 rounded-2xl border border-dashed border-border/80 bg-slate-50/50"
    )}>
      <div className={cn(
        "flex items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-4",
        isDropdown ? "h-12 w-12" : "h-16 w-16"
      )}>
        <Bell className={isDropdown ? "h-6 w-6" : "h-8 w-8"} />
      </div>
      <h3 className="text-[14px] font-semibold text-foreground">No notifications yet</h3>
      <p className="mt-1 text-[12px] text-muted-foreground">You're all caught up.</p>
    </div>
  );
}
