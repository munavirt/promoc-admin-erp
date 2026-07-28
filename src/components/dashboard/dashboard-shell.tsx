import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  House,
  Building2,
  FolderKanban,
  ListTodo,
  UsersRound,
  CalendarDays,
  FolderOpen,
  BarChart3,
  Settings,
  Search,
  Plus,
  Bell,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
  Command,
  LogOut,
  CircleUserRound,
  Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store";

import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

const allNavItems = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/", adminOnly: true },
  { label: "Workspace", icon: House, to: "/", employeeOnly: true },
  { label: "My Tasks", icon: ListTodo, to: "/tasks", badge: "8", employeeOnly: true },
  { label: "Tasks", icon: ListTodo, to: "/tasks", badge: "8", adminOnly: true },
  { label: "Projects", icon: FolderKanban, to: "/projects", badge: "12" },
  { label: "Calendar", icon: CalendarDays, to: "/meetings", employeeOnly: true },
  { label: "Meetings", icon: CalendarDays, to: "/meetings", adminOnly: true },
  { label: "Files", icon: FolderOpen, to: "/files", adminOnly: true },
  { label: "Notifications", icon: Bell, to: "/notifications", employeeOnly: true, badge: "3" },
  { label: "Profile", icon: CircleUserRound, to: "/profile", employeeOnly: true },
  { label: "Clients", icon: Building2, to: "/clients", adminOnly: true },
  { label: "Employees", icon: UsersRound, to: "/employees", adminOnly: true },
  { label: "Reports", icon: BarChart3, to: "/reports", adminOnly: true },
  { label: "Settings", icon: Settings, to: "/settings", adminOnly: true },
];

export function DashboardShell({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const { currentUser, logout } = useStore();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const [openCommand, setOpenCommand] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = allNavItems.filter((item) => {
    if (currentUser?.role === "Employee") {
      return !item.adminOnly;
    }
    return !item.employeeOnly;
  });

  useEffect(() => {
    const down = (e) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpenCommand((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (action: () => void) => {
    setOpenCommand(false);
    action();
  };

  const MobileNav = () => (
    <nav className="flex-1 px-3 py-4 overflow-y-auto">
      <ul className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          return (
            <li key={item.label}>
              <Link
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-all duration-200",
                  active
                    ? "bg-secondary text-primary"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0 transition-colors",
                    active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <span className={cn(
                    "ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none transition-colors",
                    active ? "bg-background text-primary shadow-[0_1px_2px_rgba(0,0,0,0.04)] border border-border/50" : "bg-border/50 text-muted-foreground group-hover:bg-border group-hover:text-foreground"
                  )}>
                    {item.badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return (
    <div className="min-h-screen bg-transparent text-foreground selection:bg-primary/10 selection:text-primary overflow-hidden p-4 md:p-6 flex flex-col">
      <div className="flex flex-1 bg-card rounded-[20px] border border-border/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden relative z-10 w-full max-w-[1600px] mx-auto">
        
        {/* Desktop Sidebar */}
        <aside
          className={cn(
            "hidden md:flex sticky top-0 h-full shrink-0 border-r border-border/60 shadow-[1px_0_2px_rgba(0,0,0,0.01)] bg-sidebar transition-[width] duration-200 ease-out flex-col",
            collapsed ? "w-[64px]" : "w-[240px]",
          )}
        >
          <div className="flex h-[57px] items-center px-4 border-b border-border/50">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground text-[13px] font-bold shadow-sm">
              P
            </div>
            {!collapsed && (
              <span className="ml-2.5 text-[14px] font-semibold tracking-tight text-sidebar-foreground truncate">
                PromoCraft
              </span>
            )}
          </div>

          <nav className="flex-1 px-3 py-4 overflow-y-auto">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                return (
                  <li key={item.label}>
                    <Link
                      to={item.to}
                      className={cn(
                        "group flex items-center rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-all duration-200",
                        active
                          ? "bg-secondary text-primary"
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                        collapsed ? "justify-center" : "gap-3"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0 transition-colors",
                          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                        )}
                        strokeWidth={active ? 2.5 : 2}
                      />
                      {!collapsed && (
                        <>
                          <span className="truncate">{item.label}</span>
                          {item.badge && (
                            <span className={cn(
                              "ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none transition-colors",
                              active ? "bg-background text-primary shadow-[0_1px_2px_rgba(0,0,0,0.04)] border border-border/50" : "bg-border/50 text-muted-foreground group-hover:bg-border group-hover:text-foreground"
                            )}>
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="p-3 border-t border-border/50">
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className={cn(
                "flex w-full items-center rounded-md py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground",
                collapsed ? "justify-center" : "gap-3 px-2.5"
              )}
            >
              {collapsed ? (
                <PanelLeft className="h-[18px] w-[18px]" />
              ) : (
                <>
                  <PanelLeftClose className="h-[18px] w-[18px]" />
                  <span className="truncate">Collapse sidebar</span>
                </>
              )}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="sticky top-0 z-10 flex h-[57px] shrink-0 items-center gap-2 sm:gap-4 border-b border-border/60 bg-card px-4 sm:px-6 z-20">
            
            {/* Mobile Sidebar Toggle */}
            <div className="flex md:hidden shrink-0">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground -ml-2">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[260px] p-0 flex flex-col bg-sidebar border-r-border">
                  <div className="flex h-[57px] items-center px-4 border-b border-border/50 shrink-0">
                    <div className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground text-[13px] font-bold shadow-sm">
                      P
                    </div>
                    <span className="ml-2.5 text-[14px] font-semibold tracking-tight text-sidebar-foreground">
                      PromoCraft
                    </span>
                  </div>
                  <MobileNav />
                </SheetContent>
              </Sheet>
            </div>

            <div className="relative w-full max-w-[200px] sm:max-w-[320px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted-foreground" />
              <button
                type="button"
                onClick={() => setOpenCommand(true)}
                className="flex h-[34px] w-full items-center justify-between rounded-md border border-border/60 bg-secondary/50 pl-8 pr-2 text-[12px] sm:text-[13px] text-muted-foreground hover:bg-secondary/80 hover:border-border transition-colors shadow-sm"
              >
                <span className="truncate mr-2">Search...</span>
                <div className="pointer-events-none hidden select-none items-center gap-1 rounded-[4px] border border-border/60 bg-background/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:flex">
                  <Command className="h-3 w-3" />
                  <span>K</span>
                </div>
              </button>
            </div>

            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <Button size="sm" className="h-[34px] gap-1.5 px-2.5 sm:px-3 text-[12px] sm:text-[13px] font-medium shadow-sm transition-transform active:scale-95" asChild>
                <Link to="/projects">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">New Project</span>
                </Link>
              </Button>
              
              <div className="mx-1 h-5 w-[1px] bg-border hidden sm:block" />
              
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    aria-label="Notifications"
                  >
                    <Bell className="h-[18px] w-[18px]" />
                    <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-background" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[300px] sm:w-[320px] p-0" sideOffset={8}>
                  <div className="p-4 border-b border-border/50">
                    <h4 className="text-[14px] font-semibold text-foreground">Notifications</h4>
                  </div>
                  <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
                    {[
                      { title: "Alex completed a task", desc: "Homepage wireframes have been marked as done.", time: "10m ago", read: false },
                      { title: "New meeting scheduled", desc: "Design Review with Halcyon Media.", time: "1h ago", read: false },
                      { title: "Invoice paid", desc: "Vertex Retail paid Invoice #INV-042.", time: "2h ago", read: true },
                    ].map((n, i) => (
                      <div key={i} className={cn("flex flex-col gap-1 rounded-md p-3 text-[13px] transition-colors hover:bg-secondary/50", n.read ? "opacity-70" : "bg-secondary/20")}>
                        <div className="flex items-center justify-between">
                          <span className={cn("font-medium", n.read ? "text-muted-foreground" : "text-foreground")}>{n.title}</span>
                          {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                        </div>
                        <p className="text-[12px] text-muted-foreground leading-snug">{n.desc}</p>
                        <span className="text-[10px] font-medium text-muted-foreground/80 mt-1">{n.time}</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-2 border-t border-border/50">
                    <Button variant="ghost" size="sm" className="w-full h-8 text-[12px]">Mark all as read</Button>
                  </div>
                </PopoverContent>
              </Popover>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex shrink-0 items-center gap-1 sm:gap-2.5 rounded-md p-1 pl-1.5 pr-1.5 sm:pr-2 transition-colors hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                      {currentUser?.initials || "U"}
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56" sideOffset={8}>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-[13px] font-medium leading-none">{currentUser?.name || "User"}</p>
                      <p className="text-[11px] leading-none text-muted-foreground">{currentUser?.email || "user@promocraft.co"}</p>
                      <p className="text-[10px] font-semibold text-primary mt-1 uppercase tracking-wider">{currentUser?.role || "Employee"}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-[13px] cursor-pointer" onClick={() => navigate("/settings")}>
                    <CircleUserRound className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-[13px] cursor-pointer" onClick={() => navigate("/settings")}>
                    <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-[13px] cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

            </div>
          </header>

          <main className="flex-1 px-4 py-6 md:px-8 md:py-8 overflow-y-auto">{children}</main>
        </div>
      </div>

      <CommandDialog open={openCommand} onOpenChange={setOpenCommand}>
        <CommandInput placeholder="Type a command or search..." className="text-[13px]" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Go to">
            {navItems.map((item) => (
              <CommandItem
                key={item.label}
                onSelect={() => runCommand(() => navigate(item.to))}
                className="text-[13px] gap-2"
              >
                <item.icon className="h-4 w-4 text-muted-foreground" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => runCommand(() => navigate("/projects"))} className="text-[13px] gap-2">
              <Plus className="h-4 w-4 text-muted-foreground" />
              <span>Create new project</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/tasks"))} className="text-[13px] gap-2">
              <ListTodo className="h-4 w-4 text-muted-foreground" />
              <span>Create new task</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

    </div>
  );
}