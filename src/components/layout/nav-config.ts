import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bell,
  Building2,
  CalendarDays,
  ChartNoAxesColumn,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  PieChart,
  Settings,
  UsersRound,
  Wallet,
} from "lucide-react";

/**
 * Single source of truth for the admin workspace navigation.
 * Consumed by the desktop sidebar, the mobile drawer and the ⌘K command palette,
 * so a route only ever needs to be declared once.
 */

export type NavRole = "ADMIN" | "MANAGER" | "EMPLOYEE";

export interface NavLeaf {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  /** Match only the exact path (used for index routes such as `/` and `/finance`). */
  exact?: boolean;
  /** Roles allowed to see the entry. Omit for every admin-workspace role. */
  roles?: NavRole[];
  /** Requires finance view permission (resolved at runtime). */
  requiresFinance?: boolean;
  /** Quieter styling for less frequent destinations. */
  secondary?: boolean;
  /** Renders a small labelled divider above this entry (expanded sidebar only). */
  dividerBefore?: string;
  /** Keywords to improve command palette search. */
  keywords?: string[];
}

export interface NavGroup {
  id: string;
  label: string;
  /** Renders the group heading as an expand/collapse toggle. */
  collapsible?: boolean;
  /** Initial open state for collapsible groups (the group always opens when it contains the active route). */
  defaultOpen?: boolean;
  /** Visually de-emphasised group (smaller, muted) for less frequent tasks. */
  secondary?: boolean;
  items: NavLeaf[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { id: "dashboard", label: "Dashboard", to: "/", icon: LayoutDashboard, exact: true },
      { id: "employees", label: "Employees", to: "/employees", icon: UsersRound, keywords: ["team", "staff"] },
      { id: "clients", label: "Clients", to: "/clients", icon: Building2, keywords: ["customers", "accounts"] },
      { id: "projects", label: "Projects", to: "/projects", icon: FolderKanban },
      {
        id: "tasks",
        label: "Tasks & Work Items",
        to: "/tasks",
        icon: ListChecks,
        keywords: ["todo", "work items", "assignments"],
      },
      { id: "meetings", label: "Meetings", to: "/meetings", icon: CalendarDays, keywords: ["calendar", "schedule"] },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    collapsible: true,
    defaultOpen: true,
    items: [
      {
        id: "finance-overview",
        label: "Finance Overview",
        to: "/finance",
        icon: PieChart,
        exact: true,
        requiresFinance: true,
      },
      { id: "income", label: "Income", to: "/finance/income", icon: ArrowDownToLine, requiresFinance: true },
      { id: "expenses", label: "Expenses", to: "/finance/expenses", icon: ArrowUpFromLine, requiresFinance: true },
      {
        id: "invoices",
        label: "Invoices",
        to: "/finance/invoices",
        icon: FileText,
        requiresFinance: true,
        keywords: ["billing", "gst"],
      },
      { id: "payments", label: "Payments", to: "/finance/payments", icon: Wallet, requiresFinance: true },
      {
        id: "reports",
        label: "Financial Reports",
        to: "/finance/reports",
        icon: ChartNoAxesColumn,
        roles: ["ADMIN"],
        requiresFinance: true,
        keywords: ["profit", "loss", "gst summary", "p&l"],
      },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { id: "notifications", label: "Notifications", to: "/notifications", icon: Bell },
      { id: "settings", label: "Settings", to: "/settings", icon: Settings, keywords: ["agency", "gst", "profile"] },
    ],
  },
];

export function isNavLeafActive(item: NavLeaf, pathname: string): boolean {
  if (item.exact) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function resolveNavRole(role?: string | null): NavRole {
  const upper = (role || "").toUpperCase();
  if (upper === "MANAGER") return "MANAGER";
  if (upper === "EMPLOYEE") return "EMPLOYEE";
  return "ADMIN";
}

/** Filters the navigation for the current role and finance access. Empty groups are dropped. */
export function getVisibleNavGroups(role: NavRole, canViewFinance: boolean): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.roles && !item.roles.includes(role)) return false;
      if (item.requiresFinance && !canViewFinance) return false;
      return true;
    }),
  })).filter((group) => group.items.length > 0);
}

/** Finds the deepest nav entry matching a path, for page titles and breadcrumbs. */
export function findActiveNavLeaf(pathname: string): { group: NavGroup; item: NavLeaf } | null {
  let best: { group: NavGroup; item: NavLeaf } | null = null;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (isNavLeafActive(item, pathname)) {
        if (!best || item.to.length > best.item.to.length) best = { group, item };
      }
    }
  }
  return best;
}
