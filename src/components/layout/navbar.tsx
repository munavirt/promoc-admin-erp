import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, CircleUserRound, LogOut, Menu, Search, Settings } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { BrandMark, SidebarNav } from "./sidebar";
import { findActiveNavLeaf } from "./nav-config";

interface NavbarProps {
  setMobileMenuOpen: (v: boolean) => void;
  mobileMenuOpen: boolean;
  setOpenCommand: (v: boolean) => void;
}

const SUBPAGE_LABELS: Array<[RegExp, string]> = [
  [/\/new$/, "New"],
  [/\/edit$/, "Edit"],
];

function Breadcrumbs() {
  const { pathname } = useLocation();
  const match = findActiveNavLeaf(pathname);
  if (!match) return null;
  const { group, item } = match;
  const isSubpage = pathname !== item.to;
  const subLabel = isSubpage
    ? SUBPAGE_LABELS.find(([re]) => re.test(pathname))?.[1] || "Details"
    : null;

  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-[13px] md:flex">
      <span className="text-subtle">{group.label}</span>
      <span className="text-faint">/</span>
      {isSubpage ? (
        <>
          <Link to={item.to} className="truncate text-muted-foreground transition-colors hover:text-foreground">
            {item.label}
          </Link>
          <span className="text-faint">/</span>
          <span className="truncate font-medium text-foreground">{subLabel}</span>
        </>
      ) : (
        <span className="truncate font-medium text-foreground">{item.label}</span>
      )}
    </nav>
  );
}

export function Navbar({ setMobileMenuOpen, mobileMenuOpen, setOpenCommand }: NavbarProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentUser, logout } = useStore();

  const handleLogout = () => {
    logout();
    queryClient.clear();
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 bg-background/80 px-3 backdrop-blur-md sm:px-6 lg:px-10">
      <Button
        variant="ghost"
        size="icon"
        className="-ml-1 h-9 w-9 text-muted-foreground md:hidden"
        onClick={() => setMobileMenuOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="md:hidden">
        <BrandMark collapsed />
      </div>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="flex w-[272px] max-w-[85vw] flex-col gap-0 border-r-sidebar-border bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-14 shrink-0 items-center px-[18px]">
            <BrandMark />
          </div>
          <div className="thin-scrollbar flex-1 overflow-y-auto px-3 pt-2 pb-8">
            <SidebarNav touch onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <Breadcrumbs />

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <button
          type="button"
          onClick={() => setOpenCommand(true)}
          className="group flex h-10 items-center gap-2 rounded-full bg-card px-3.5 text-[13px] text-subtle shadow-[0_1px_2px_rgba(32,43,60,0.04),0_6px_18px_-10px_rgba(16,50,110,0.2)] transition-shadow hover:text-muted-foreground hover:shadow-[0_1px_2px_rgba(32,43,60,0.04),0_10px_24px_-10px_rgba(16,50,110,0.3)] sm:w-[280px]"
          aria-label="Search and jump"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search or type a command</span>
          <kbd className="ml-auto hidden items-center rounded-md bg-accent px-1.5 py-0.5 font-sans text-[10px] font-bold text-primary sm:flex">
            ⌘K
          </kbd>
        </button>

        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild className="md:hidden">
            <button
              type="button"
              className="flex shrink-0 items-center gap-1.5 rounded-[7px] p-1 transition-colors hover:bg-secondary focus:outline-none"
              aria-label="Account menu"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#cfe0ff] to-[#d6e6ff] text-[11px] font-bold text-[#004fcc] ring-2 ring-white">
                {currentUser?.initials || "U"}
              </span>
              <ChevronDown className="hidden h-3.5 w-3.5 text-subtle sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60" sideOffset={8}>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1">
                <p className="text-[13px] font-medium leading-none">{currentUser?.name || "User"}</p>
                <p className="text-[12px] leading-none text-muted-foreground">{currentUser?.email}</p>
                <p className="eyebrow mt-1.5 !text-primary">{currentUser?.role || "ADMIN"}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer text-[13px]" onClick={() => navigate("/settings?tab=account")}>
              <CircleUserRound className="mr-2 h-4 w-4 text-muted-foreground" />
              Account settings
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer text-[13px]" onClick={() => navigate("/settings")}>
              <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
              Agency settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-[13px] text-negative focus:bg-negative-soft focus:text-negative"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
