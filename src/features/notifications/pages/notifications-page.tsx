import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ArrowUpRight, Bell, CalendarDays, Check, CheckCheck, CircleCheck, ClipboardList, FolderKanban, Loader2, RefreshCcw, type LucideIcon } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/shared/section";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState, SkeletonRows } from "@/components/shared/states";
import { IconTile, type Pastel } from "@/components/shared/icon-tile";
import { BellIllustration } from "@/components/shared/illustrations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { notificationTarget, type NotificationBackend } from "@/api/notifications.api";
import { useStore } from "@/store";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotificationStats, useNotificationsPage } from "../hooks/use-notifications";

/** Backend uses WORK_ITEM_*; the demo dataset uses TASK_*. Both map to the same presentation. */
const TYPE_META: Record<string, { label: string; icon: LucideIcon; tone: Pastel; group: string }> = {
  WORK_ITEM_ASSIGNED: { label: "Task assigned", icon: ClipboardList, tone: "blue", group: "tasks" },
  TASK_ASSIGNED: { label: "Task assigned", icon: ClipboardList, tone: "blue", group: "tasks" },
  WORK_ITEM_UPDATED: { label: "Task updated", icon: RefreshCcw, tone: "peach", group: "tasks" },
  TASK_UPDATED: { label: "Task updated", icon: RefreshCcw, tone: "peach", group: "tasks" },
  WORK_ITEM_COMPLETED: { label: "Task completed", icon: CircleCheck, tone: "mint", group: "tasks" },
  TASK_COMPLETED: { label: "Task completed", icon: CircleCheck, tone: "mint", group: "tasks" },
  PROJECT_UPDATED: { label: "Project update", icon: FolderKanban, tone: "sky", group: "projects" },
  MEETING_CREATED: { label: "Meeting", icon: CalendarDays, tone: "butter", group: "meetings" },
  GENERAL: { label: "General", icon: Bell, tone: "rose", group: "general" },
};

const meta = (t: string) => TYPE_META[t] || TYPE_META.GENERAL;


function dayBucket(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return "This week";
  return "Earlier";
}

type ReadFilter = "all" | "unread" | "read";
/** Server filter `notification_type` is exact-match, so chips map to single backend types. */
const TYPE_FILTERS = [
  { value: "", label: "Everything" },
  { value: "WORK_ITEM_ASSIGNED", label: "Task assigned" },
  { value: "WORK_ITEM_UPDATED", label: "Task updated" },
  { value: "WORK_ITEM_COMPLETED", label: "Task completed" },
  { value: "PROJECT_UPDATED", label: "Projects" },
  { value: "MEETING_CREATED", label: "Meetings" },
  { value: "GENERAL", label: "General" },
];
const GROUP_TO_TYPE: Record<string, string> = { tasks: "WORK_ITEM_ASSIGNED", projects: "PROJECT_UPDATED", meetings: "MEETING_CREATED", general: "GENERAL" };
const PAGE_SIZE = 10;

function NotificationRow({ n }: { n: NotificationBackend }) {
  const markRead = useMarkNotificationRead();
  const { currentUser } = useStore();
  const m = meta(n.notification_type);
  const link = notificationTarget(n, currentUser?.role);
  return (
    <li className={cn("group relative flex gap-3.5 rounded-[18px] p-3.5 transition-[background-color,box-shadow]", n.is_read ? "hover:bg-[#f8faff]" : "bg-[#f2f7ff] hover:shadow-sm")}>
      <IconTile icon={m.icon} tone={m.tone} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className={cn("text-[13.5px] text-foreground", n.is_read ? "font-semibold" : "font-bold")}>{n.title}</span>
          {String(n.priority).toUpperCase() === "HIGH" && <span className="rounded-full bg-rose px-2 py-px text-[10.5px] font-bold text-negative">High priority</span>}
        </div>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{n.message}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-medium text-subtle">
          <span>{m.label}</span>
          <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
          {link && (
            <Link
              to={link}
              onClick={() => !n.is_read && markRead.mutate(n.id)}
              className="inline-flex items-center gap-0.5 font-semibold text-primary hover:underline"
            >
              Open {String(n.reference_type).toUpperCase() === "WORK_ITEM" ? "task" : String(n.reference_type).toLowerCase().replace("_", " ")} <ArrowUpRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        {!n.is_read ? (
          <>
            <span className="h-2 w-2 rounded-full bg-primary" aria-label="Unread" />
            <button
              type="button"
              disabled={markRead.isPending}
              onClick={() => markRead.mutate(n.id)}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-semibold text-muted-foreground opacity-100 transition-colors hover:bg-brand-soft hover:text-primary sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
            >
              {markRead.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Mark read
            </button>
          </>
        ) : (
          <span className="text-[11px] font-medium text-faint">Read</span>
        )}
      </div>
    </li>
  );
}

export function NotificationsPage() {
  const markAll = useMarkAllNotificationsRead();
  const [filter, setFilter] = useState<ReadFilter>("all");
  const [type, setType] = useState("");

  const filterKey = `${filter}|${type}`;
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;

  // Server-side: is_read + notification_type filters, newest first, PAGE_SIZE 10.
  const pageQuery = useNotificationsPage({
    page,
    is_read: filter === "all" ? undefined : filter === "read",
    notification_type: type || undefined,
  });
  const statsQuery = useNotificationStats();
  const notifications = pageQuery.data?.results ?? [];
  const total = pageQuery.data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const stats = statsQuery.data;
  const unread = stats?.unread ?? 0;

  const errStatus = (pageQuery.error as { status?: number | null } | null)?.status;
  useEffect(() => {
    if (errStatus === 404 && page > 1) setPageState({ key: filterKey, page: page - 1 });
  }, [errStatus, page, filterKey]);

  const buckets = useMemo(() => {
    const order = ["Today", "Yesterday", "This week", "Earlier"];
    const map = new Map<string, NotificationBackend[]>();
    notifications.forEach((n) => {
      const b = dayBucket(n.created_at);
      map.set(b, [...(map.get(b) || []), n]);
    });
    return order.filter((o) => map.has(o)).map((o) => [o, map.get(o)!] as const);
  }, [notifications]);
  const isLoading = pageQuery.isLoading;
  const isError = pageQuery.isError;
  const refetch = pageQuery.refetch;
  const filtered = notifications;

  return (
    <AppLayout>
      <PageHeader eyebrow="System" title="Notifications" description="Assignments, updates and completions from across the workspace.">
        <Button variant="outline" size="sm" className="gap-1.5" disabled={!unread || markAll.isPending} onClick={() => markAll.mutate()}>
          {markAll.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />} Mark all as read
        </Button>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Surface className="min-w-0 p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <SegmentedControl<ReadFilter>
              aria-label="Read state"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All", count: stats?.all },
                { value: "unread", label: "Unread", count: stats?.unread },
                { value: "read", label: "Read", count: stats?.read },
              ]}
            />
          </div>
          <div className="hide-scrollbar mb-4 flex gap-2 overflow-x-auto">
            {TYPE_FILTERS.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => setType(g.value)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                  type === g.value ? "bg-primary text-white shadow-[0_6px_14px_-8px_rgba(0,98,255,0.9)]" : "bg-secondary text-muted-foreground hover:bg-brand-soft hover:text-primary",
                )}
              >
                {g.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <SkeletonRows rows={5} />
          ) : isError ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : filtered.length === 0 ? (
            <EmptyState
              compact
              illustration={<BellIllustration className="h-24 w-[120px]" />}
              title={filter === "unread" ? "You're all caught up" : "No notifications here"}
              description={filter === "unread" ? "New assignments will appear here." : "Try a different filter."}
            />
          ) : (
            <div className="space-y-5">
              {buckets.map(([label, items]) => (
                <section key={label}>
                  <h2 className="eyebrow mb-2 px-1">{label}</h2>
                  <ul className="space-y-1.5">
                    {items.map((n) => (
                      <NotificationRow key={String(n.id)} n={n} />
                    ))}
                  </ul>
                </section>
              ))}
              {pageCount > 1 && (
                <div className="flex items-center justify-between border-t border-border/60 pt-3">
                  <p className="text-xs text-muted-foreground">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-8 px-3 text-xs" disabled={!pageQuery.data?.previous || pageQuery.isFetching} onClick={() => setPageState({ key: filterKey, page: page - 1 })}>Previous</Button>
                    <span className="text-xs text-muted-foreground">Page {page} of {pageCount}</span>
                    <Button variant="outline" size="sm" className="h-8 px-3 text-xs" disabled={!pageQuery.data?.next || pageQuery.isFetching} onClick={() => setPageState({ key: filterKey, page: page + 1 })}>Next</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Surface>

        <aside className="space-y-5">
          <Surface className="p-5 text-center">
            <BellIllustration className="mx-auto h-24 w-[120px]" />
            <div className="figure mt-2 text-[34px] leading-none font-extrabold">{stats ? unread : "—"}</div>
            <div className="mt-1 text-[13px] font-semibold text-muted-foreground">unread {unread === 1 ? "notification" : "notifications"}</div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-left">
              {[
                ["Tasks", "tasks", "bg-brand-soft"],
                ["Projects", "projects", "bg-sky"],
                ["Meetings", "meetings", "bg-butter"],
                ["General", "general", "bg-rose"],
              ].map(([label, g, tone]) => (
                <button key={g} type="button" onClick={() => { setType(GROUP_TO_TYPE[g]); setFilter("unread"); }} className={cn("rounded-[14px] px-3 py-2 text-left transition-transform hover:-translate-y-px", tone)}>
                  <div className="figure text-[16px] font-extrabold text-foreground">{stats ? stats.unreadByGroup[g as keyof typeof stats.unreadByGroup] : "—"}</div>
                  <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
                </button>
              ))}
            </div>
          </Surface>
          <p className="px-1 text-[12px] leading-relaxed text-subtle">
            Notifications are delivered in-app. The unread count refreshes every minute and when you return to this tab; push and real-time delivery aren't available. The backend currently only creates notifications when a task is created with an assignee.
          </p>
        </aside>
      </div>
    </AppLayout>
  );
}
