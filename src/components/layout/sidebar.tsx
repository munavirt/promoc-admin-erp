import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  CircleUserRound,
  LogOut,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStore } from "@/store";
import { useNotificationCount } from "@/features/notifications/hooks/use-notifications";
import { useFinancePermissions } from "@/modules/finance/hooks/use-finance";
import {
  getVisibleNavGroups,
  isNavLeafActive,
  resolveNavRole,
  type NavGroup,
  type NavLeaf,
} from "./nav-config";

const GROUP_STATE_KEY = "promocraft_nav_groups_v2";

function readGroupState(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(GROUP_STATE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function BrandMark({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link
      to="/"
      className="flex min-w-0 items-center gap-2.5 rounded-md outline-none"
      aria-label="PromoCraft home"
    >
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#3384ff] to-[#004fcc] text-[14px] font-extrabold text-white shadow-[0_6px_14px_-6px_rgba(0,79,204,0.7)]">
        P
        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-accent-2" />
      </span>
      {!collapsed && (
        <span className="truncate text-[14px] font-semibold tracking-[-0.01em] text-foreground">
          PromoCraft
        </span>
      )}
    </Link>
  );
}

/** Nav groups visible to the current user (role + finance permission). */
export function useVisibleNav() {
  const { currentUser } = useStore();
  const { data: financePermissionData } = useFinancePermissions();
  const role = resolveNavRole(currentUser?.role);
  const canViewFinance = financePermissionData?.permissions?.canViewFinance ?? role === "ADMIN";
  return getVisibleNavGroups(role, canViewFinance);
}

/* ─── Item ─────────────────────────────────────────────────────────────── */

interface NavItemProps {
  item: NavLeaf;
  active: boolean;
  collapsed: boolean;
  secondary?: boolean;
  touch?: boolean;
  badge?: number;
  onNavigate?: () => void;
}

function NavItem({ item, active, collapsed, secondary, touch, badge, onNavigate }: NavItemProps) {
  const Icon = item.icon;
  const link = (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center rounded-[10px] outline-none transition-colors duration-150",
        "focus-visible:ring-2 focus-visible:ring-primary/30",
        touch ? "h-[42px]" : "h-[38px]",
        collapsed ? "mx-auto w-10 justify-center" : "gap-3 px-3",
        secondary ? "text-[13px]" : "text-[13.5px]",
        active
          ? "bg-accent font-semibold text-primary-deep"
          : cn(
              "font-medium hover:bg-sidebar-accent hover:text-foreground",
              secondary ? "text-muted-foreground" : "text-[#3d4859]",
            ),
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute top-[10px] bottom-[10px] -left-3 w-[3px] rounded-r-full bg-primary"
        />
      )}
      <Icon
        className={cn(
          "shrink-0",
          secondary ? "h-4 w-4" : "h-[17px] w-[17px]",
          active ? "text-primary" : "text-subtle group-hover:text-primary/80",
        )}
        strokeWidth={active ? 2 : 1.75}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!!badge && badge > 0 && (
        <span
          className={cn(
            "figure flex items-center justify-center rounded-full text-[10.5px] font-semibold",
            collapsed
              ? "absolute top-1 right-1 h-[15px] min-w-[15px] bg-primary px-1 text-primary-foreground"
              : "ml-auto h-[19px] min-w-[20px] bg-primary px-1.5 text-white",
          )}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );

  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="text-[12px]">
        {item.label}
        {!!badge && badge > 0 ? ` · ${badge} unread` : ""}
      </TooltipContent>
    </Tooltip>
  );
}

/* ─── Tree ─────────────────────────────────────────────────────────────── */

interface SidebarNavProps {
  collapsed?: boolean;
  /** Larger touch targets for the mobile drawer. */
  touch?: boolean;
  onNavigate?: () => void;
}

/** Navigation tree shared by the desktop sidebar and the mobile drawer. */
export function SidebarNav({ collapsed = false, touch = false, onNavigate }: SidebarNavProps) {
  const { pathname } = useLocation();
  const groups = useVisibleNav();
  const { data: unreadCount = 0 } = useNotificationCount();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => readGroupState());

  const groupHasActive = (group: NavGroup) => group.items.some((i) => isNavLeafActive(i, pathname));
  const isGroupOpen = (group: NavGroup) => openGroups[group.id] ?? group.defaultOpen ?? true;

  // Open the group that contains the current route.
  useEffect(() => {
    const target = groups.find((g) => g.collapsible && groupHasActive(g) && !isGroupOpen(g));
    if (target) setOpenGroups((prev) => ({ ...prev, [target.id]: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleGroup = (id: string, open: boolean) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [id]: open };
      try {
        localStorage.setItem(GROUP_STATE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  };

  const renderItems = (group: NavGroup) => (
    <ul className="space-y-0.5">
      {group.items.map((item) => (
        <li key={item.id}>
          {item.dividerBefore && !collapsed && (
            <div className="mt-2.5 mb-1 flex items-center gap-2 px-3" aria-hidden>
              <span className="text-[10.5px] font-semibold tracking-[0.05em] text-faint uppercase">{item.dividerBefore}</span>
              <span className="h-px flex-1 bg-sidebar-border" />
            </div>
          )}
          {item.dividerBefore && collapsed && <div className="mx-auto my-1.5 h-px w-4 bg-sidebar-border" aria-hidden />}
          <NavItem
            item={item}
            collapsed={collapsed}
            touch={touch}
            secondary={group.secondary || item.secondary}
            active={isNavLeafActive(item, pathname)}
            badge={item.id === "notifications" ? unreadCount : undefined}
            onNavigate={onNavigate}
          />
        </li>
      ))}
    </ul>
  );

  return (
    <TooltipProvider delayDuration={120}>
      <nav aria-label="Main" className="flex flex-col gap-3">
        {groups.map((group, index) => {
          // Collapsed rail: flat icon list with hairline separators between groups.
          if (collapsed) {
            return (
              <div key={group.id} className="flex flex-col items-center">
                {index > 0 && <div className="mb-2 h-px w-5 bg-sidebar-border" aria-hidden />}
                {renderItems(group)}
              </div>
            );
          }

          const labelClass = cn(
            "flex h-[26px] w-full items-center gap-1.5 px-3 text-[10.5px] font-bold tracking-[0.07em] uppercase",
            group.secondary ? "text-faint" : "text-subtle",
          );

          if (!group.collapsible) {
            return (
              <div key={group.id}>
                <div className={labelClass}>{group.label}</div>
                {renderItems(group)}
              </div>
            );
          }

          const open = isGroupOpen(group);
          const hiddenActive = !open && groupHasActive(group);
          return (
            <Collapsible key={group.id} open={open} onOpenChange={(v) => toggleGroup(group.id, v)}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  aria-label={`${open ? "Collapse" : "Expand"} ${group.label}`}
                  className={cn(
                    labelClass,
                    "group rounded-[5px] text-left transition-colors hover:text-muted-foreground",
                  )}
                >
                  <span className="truncate">{group.label}</span>
                  {hiddenActive && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  )}
                  <ChevronRight
                    className={cn(
                      "ml-auto h-3.5 w-3.5 shrink-0 text-faint transition-transform duration-200",
                      open && "rotate-90",
                    )}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                {renderItems(group)}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </nav>
    </TooltipProvider>
  );
}

/* ─── Desktop / tablet: floating brand icon rail ───────────────────────── */

function RailItem({ item, active, badge }: { item: NavLeaf; active: boolean; badge?: number }) {
  const Icon = item.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={item.to}
          aria-label={item.label}
          aria-current={active ? "page" : undefined}
          className={cn(
            "group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] outline-none transition-[background-color,color,box-shadow,transform] duration-200",
            "focus-visible:ring-2 focus-visible:ring-white/70",
            active
              ? "bg-white text-primary shadow-[0_8px_18px_-8px_rgba(0,30,90,0.55)]"
              : "text-white/80 hover:-translate-y-px hover:bg-white/15 hover:text-white",
          )}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.1 : 1.7} />
          {!!badge && badge > 0 && (
            <span
              className={cn(
                "figure absolute -top-1 -right-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[9.5px] font-extrabold ring-2",
                active ? "bg-primary text-white ring-white" : "bg-white text-primary ring-primary",
              )}
            >
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={14} className="text-[12px]">
        {item.label}
        {!!badge && badge > 0 ? ` · ${badge} unread` : ""}
      </TooltipContent>
    </Tooltip>
  );
}

function RailAccount() {
  const { currentUser, logout } = useStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const handleLogout = () => {
    logout();
    queryClient.clear();
    navigate("/login", { replace: true });
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex h-11 w-11 items-center justify-center rounded-full outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[11.5px] font-extrabold text-primary ring-[3px] ring-white/30">
            {currentUser?.initials || "U"}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" sideOffset={16} className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-[13px] font-semibold">{currentUser?.name || "User"}</p>
          <p className="truncate text-[12px] text-muted-foreground">{currentUser?.email}</p>
          <p className="eyebrow mt-1.5 !text-primary">{currentUser?.role || "ADMIN"}</p>
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
        <DropdownMenuItem className="cursor-pointer text-[13px] text-negative focus:bg-negative-soft focus:text-negative" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const RAIL_FILL = "#0062ff";

/** S-curved cap that flows the rail into the left screen edge (top or bottom end). */
function RailCap({ position }: { position: "top" | "bottom" }) {
  const d =
    position === "top"
      ? "M0 0 C0 34 72 26 72 64 L72 64 L0 64 Z"
      : "M0 64 C0 30 72 38 72 0 L0 0 Z";
  return (
    <svg aria-hidden className="block h-16 w-full shrink-0" viewBox="0 0 72 64" preserveAspectRatio="none">
      <path d={d} fill={RAIL_FILL} />
    </svg>
  );
}

/**
 * Edge-tab brand rail: a #0062FF tab attached to the left screen edge, vertically centred,
 * with S-curved ends flowing into the edge. White outline icons; the active destination is a
 * white tile holding a blue icon. Labels surface as tooltips; the mobile drawer keeps full labels.
 */
export function Sidebar() {
  const { pathname } = useLocation();
  const groups = useVisibleNav();
  const { data: unreadCount = 0 } = useNotificationCount();
  const mainGroups = groups.filter((g) => g.id !== "system");
  const bottomItems = groups.find((g) => g.id === "system")?.items ?? [];

  return (
    <TooltipProvider delayDuration={80}>
      <aside
        className="relative hidden h-full w-[88px] shrink-0 flex-col justify-center md:flex"
        aria-label="Main navigation"
      >
        <div className="relative flex max-h-full w-[72px] flex-col drop-shadow-[0_18px_30px_rgba(0,70,200,0.28)]">
          <RailCap position="top" />

          <div className="relative -my-px flex min-h-0 flex-col items-center gap-1.5 py-1" style={{ backgroundColor: RAIL_FILL }}>
            <Link
              to="/"
              aria-label="PromoCraft home"
              className="relative mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-white text-[15px] font-extrabold text-primary shadow-[0_8px_18px_-8px_rgba(0,30,90,0.6)] transition-transform hover:scale-105"
            >
              P
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-primary bg-[#7fdcff]" />
            </Link>

            <nav className="hide-scrollbar flex min-h-0 w-full flex-col items-center gap-1.5 overflow-y-auto py-1">
              {mainGroups.map((group, gi) => (
                <div key={group.id} className="flex flex-col items-center gap-1.5">
                  {gi > 0 && <span className="my-1 h-px w-6 rounded-full bg-white/25" aria-hidden />}
                  {group.items.map((item) => (
                    <RailItem
                      key={item.id}
                      item={item}
                      active={isNavLeafActive(item, pathname)}
                      badge={item.id === "notifications" ? unreadCount : undefined}
                    />
                  ))}
                </div>
              ))}
            </nav>

            {/* System shortcuts (Notifications, Settings) sit at the bottom, next to the account avatar. */}
            <div className="flex shrink-0 flex-col items-center gap-1.5">
              {bottomItems.length > 0 && <span className="my-1 h-px w-6 rounded-full bg-white/25" aria-hidden />}
              {bottomItems.map((item) => (
                <RailItem
                  key={item.id}
                  item={item}
                  active={isNavLeafActive(item, pathname)}
                  badge={item.id === "notifications" ? unreadCount : undefined}
                />
              ))}
              <div className="mt-1">
                <RailAccount />
              </div>
            </div>
          </div>

          <RailCap position="bottom" />
        </div>
      </aside>
    </TooltipProvider>
  );
}
