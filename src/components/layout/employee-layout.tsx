import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useNotificationCount } from "@/features/notifications/hooks/use-notifications";
import { useStore } from "@/store";
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  Bell,
  CalendarDays,
  UserCircle,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const NAVIGATION = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Projects", href: "/projects", icon: FolderKanban },
  { name: "Notifications", href: "/notifications", icon: Bell },
];

const SECONDARY_NAVIGATION = [
  { name: "Profile", href: "/profile", icon: UserCircle },
  { name: "Settings", href: "/settings", icon: Settings },
];

function getInitials(name?: string) {
  if (!name) return "U";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
}

export function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentUser, logout } = useStore();
  const { data: unreadCount = 0 } = useNotificationCount();

  const handleLogout = () => {
    logout();
    queryClient.clear();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[260px] bg-white border-r border-border/50 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] flex flex-col transform transition-transform duration-300 lg:translate-x-0 lg:static lg:shrink-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-6 border-b border-border/50">
          <Link to="/" className="flex items-center gap-2.5 outline-none group">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm group-hover:shadow-md transition-all">
              <span className="font-bold text-lg leading-none">P</span>
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-foreground">
              PromoCraft
            </span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-md text-muted-foreground hover:bg-secondary/80 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* User Info */}
        <div className="px-5 py-5 border-b border-border/50">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border border-border/50 shadow-sm">
              <AvatarImage src="" />
              <AvatarFallback className="bg-secondary text-[13px] font-semibold text-foreground">
                {getInitials(currentUser?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-[13px] font-semibold text-foreground line-clamp-1">{currentUser?.name}</span>
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mt-0.5">{currentUser?.role}</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-5 px-3 space-y-7 custom-scrollbar">
          <div className="space-y-1">
            {NAVIGATION.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-[12px] px-3.5 py-3 text-[14px] font-medium transition-all duration-200 group relative",
                    isActive
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground")} />
                  {item.name}
                  {item.name === "Notifications" && unreadCount > 0 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                      {unreadCount}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="space-y-1">
            <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-muted-foreground/60 uppercase">
              Preferences
            </div>
            {SECONDARY_NAVIGATION.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-[12px] px-3.5 py-3 text-[14px] font-medium transition-all duration-200",
                    isActive
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground")} />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Logout */}
        <div className="p-4 border-t border-border/50 bg-secondary/20 space-y-2">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-red-600 transition-all duration-200 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden flex h-14 items-center justify-between px-4 border-b border-border/50 bg-white shrink-0 z-30">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <span className="font-bold text-sm leading-none">P</span>
            </div>
            <span className="text-[14px] font-semibold text-foreground">PromoCraft</span>
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary/80 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
