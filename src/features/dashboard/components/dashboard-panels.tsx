import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlarmClock,
  ArrowRight,
  ArrowUpRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  FileText,
  FolderKanban,
  ListChecks,
  Plus,
  Receipt,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ProjectBackend } from "@/api/projects.api";
import type { TaskBackend } from "@/api/tasks.api";
import { cn } from "@/lib/utils";
import { Meter, ProgressRing } from "@/components/shared/meter";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { EmptyState } from "@/components/shared/empty-state";
import { SkeletonBlock } from "@/components/shared/states";
import { IconTile, type Pastel } from "@/components/shared/icon-tile";
import {
  daysFromToday,
  dueLabel,
  formatShortDate,
  isTaskDueSoon,
  isTaskOverdue,
  plural,
  projectClientName,
  projectHealth,
  PROJECT_STATUS_LABEL,
  relativeTime,
  todayISO,
  type ProjectHealth,
} from "../lib/dashboard-insights";

/* ─── Primitives ────────────────────────────────────────────────────────── */

export function PanelHeader({ title, meta, action, className }: { title: ReactNode; meta?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 px-5 pt-5 pb-3 sm:px-6", className)}>
      <div className="flex min-w-0 items-baseline gap-2">
        <h2 className="text-[16px] font-bold tracking-[-0.015em] text-foreground">{title}</h2>
        {meta && <span className="truncate text-[12.5px] font-medium text-subtle">{meta}</span>}
      </div>
      {action}
    </div>
  );
}

export function ViewAllLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary transition-colors hover:text-primary-deep">
      {children}
      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
    </Link>
  );
}

const AVATAR_TONES = ["from-[#d6e6ff] to-[#b3ceff]", "from-[#d6e6ff] to-[#b8d3ff]", "from-[#cfeee0] to-[#b2e3cd]", "from-[#d8e3ff] to-[#bfd0ff]", "from-[#ffe9b3] to-[#ffd98a]"];

export function Avatar({ name, size = 28, className }: { name?: string | null; size?: number; className?: string }) {
  const initials = (name || "?").split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const tone = AVATAR_TONES[[...(name || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  return (
    <span
      title={name || undefined}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-[#003d9e] ring-2 ring-white", tone, className)}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.36) }}
    >
      {initials}
    </span>
  );
}

const PRIORITY_PILL: Record<string, { label: string; className: string }> = {
  URGENT: { label: "Urgent", className: "bg-rose text-negative" },
  HIGH: { label: "High", className: "bg-caution-soft text-caution" },
  MEDIUM: { label: "Medium", className: "bg-brand-soft text-[#004fcc]" },
  LOW: { label: "Low", className: "bg-mint text-[#1f8a60]" },
};

function PriorityPill({ priority }: { priority?: string }) {
  const p = PRIORITY_PILL[String(priority).toUpperCase()];
  if (!p) return null;
  return <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold", p.className)}>{p.label}</span>;
}

/* ─── Agency pulse ──────────────────────────────────────────────────────── */

interface PulseProps {
  loading: boolean;
  projects: ProjectBackend[];
  openTasks: TaskBackend[];
  overdueTasks: TaskBackend[];
  clients: { total: number; active: number };
  team: { active: number; onLeave: number };
}

const STATUS_SEGMENTS = [
  { key: "IN_PROGRESS", label: "In progress", className: "bg-primary" },
  { key: "PLANNING", label: "Planning", className: "bg-[#a8c8ff]" },
  { key: "ON_HOLD", label: "On hold", className: "bg-accent-2" },
];

function PulseStat({ to, icon, tone, label, value, note, alert }: { to: string; icon: LucideIcon; tone: Pastel; label: string; value: ReactNode; note: string; alert?: boolean }) {
  return (
    <Link to={to} className="group flex min-w-0 items-start gap-3 rounded-[16px] p-3 transition-colors hover:bg-[#f5f8fd]">
      <IconTile icon={icon} tone={tone} size="sm" />
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-muted-foreground">{label}</div>
        <div className={cn("figure text-[22px] leading-tight font-extrabold", alert ? "text-negative" : "text-foreground")}>{value}</div>
        <div className="truncate text-[11.5px] text-subtle">{note}</div>
      </div>
    </Link>
  );
}

export function AgencyPulse({ loading, projects, openTasks, overdueTasks, clients, team }: PulseProps) {
  const active = projects.filter((p) => !["COMPLETED", "CANCELLED"].includes(String(p.status).toUpperCase()));
  const segments = STATUS_SEGMENTS.map((s) => ({ ...s, count: active.filter((p) => p.status === s.key).length })).filter((s) => s.count > 0);
  const atRisk = active.filter((p) => ["at_risk", "overdue"].includes(projectHealth(p).health)).length;
  const dueThisWeek = openTasks.filter((t) => isTaskDueSoon(t, 7)).length;
  const oldest = overdueTasks.reduce((m, t) => Math.max(m, Math.abs(daysFromToday(t.due_date) || 0)), 0);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Agency pulse" meta="Live from your workspace" />
      {loading ? (
        <div className="space-y-4 px-6 pb-6">
          <SkeletonBlock className="h-16 w-32" />
          <SkeletonBlock className="h-2 w-full" />
          <SkeletonBlock className="h-24 w-full" />
        </div>
      ) : (
        <>
          <Link to="/projects" className="group mx-3 rounded-[18px] bg-gradient-to-br from-[#f2f7ff] to-[#e8f1ff] p-4 transition-shadow hover:shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-semibold text-[#004fcc]">Active projects</span>
              <ArrowUpRight className="h-4 w-4 text-[#7fb0ff] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
            <div className="mt-1 flex items-end gap-2.5">
              <span className="figure text-[52px] leading-none font-extrabold tracking-[-0.04em] text-foreground">{active.length}</span>
              {atRisk > 0 && <span className="mb-1.5 rounded-full bg-white px-2 py-0.5 text-[11.5px] font-bold text-caution shadow-xs">{atRisk} need attention</span>}
            </div>
            {segments.length > 0 && (
              <>
                <div className="mt-3 flex h-2 w-full gap-1 overflow-hidden rounded-full">
                  {segments.map((s) => (
                    <span key={s.key} className={cn("h-full rounded-full", s.className)} style={{ flexGrow: s.count }} />
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {segments.map((s) => (
                    <span key={s.key} className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
                      <span className={cn("h-2 w-2 rounded-full", s.className)} />
                      {s.label} <b className="font-bold text-foreground">{s.count}</b>
                    </span>
                  ))}
                </div>
              </>
            )}
          </Link>
          <div className="grid grid-cols-2 gap-1 p-3">
            <PulseStat to="/tasks" icon={ListChecks} tone="blue" label="Open tasks" value={openTasks.length} note={dueThisWeek ? `${dueThisWeek} this week` : "None this week"} />
            <PulseStat
              to="/tasks"
              icon={AlarmClock}
              tone="rose"
              label="Overdue"
              value={overdueTasks.length}
              alert={overdueTasks.length > 0}
              note={overdueTasks.length ? `${plural(oldest, "day")} late` : "On schedule"}
            />
            <PulseStat to="/clients" icon={Building2} tone="sky" label="Active clients" value={clients.active} note={`${clients.total} in total`} />
            <PulseStat to="/employees" icon={UsersRound} tone="mint" label="Team" value={team.active} note={team.onLeave ? `${team.onLeave} on leave` : "All available"} />
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Needs attention (assignment stack) ────────────────────────────────── */

export function AttentionStack({ loading, tasks }: { loading: boolean; tasks: TaskBackend[] }) {
  const queue = useMemo(() => {
    const weight: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    return tasks
      .filter((t) => isTaskOverdue(t) || isTaskDueSoon(t, 3))
      .sort(
        (a, b) =>
          Number(isTaskOverdue(b)) - Number(isTaskOverdue(a)) ||
          (weight[String(b.priority)] || 0) - (weight[String(a.priority)] || 0) ||
          a.due_date.localeCompare(b.due_date),
      );
  }, [tasks]);
  const [lead, ...rest] = queue;

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Needs attention" meta={queue.length ? `${queue.length} within 3 days` : undefined} action={<ViewAllLink to="/tasks">Tasks</ViewAllLink>} />
      <div className="flex flex-1 flex-col gap-2.5 px-4 pb-4 sm:px-5">
        {loading ? (
          <SkeletonBlock className="h-36 w-full rounded-[18px]" />
        ) : !lead ? (
          <EmptyState compact title="You're all clear" description="Nothing is overdue or due in the next three days." />
        ) : (
          <>
            <Link to={`/tasks/${lead.id}`} className="surface surface-hover block rounded-[18px] p-4 ring-1 ring-[#e7ecf4]">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11.5px] font-bold text-primary">{lead.project_name || "No project"}</span>
                <PriorityPill priority={lead.priority} />
              </div>
              <div className="mt-2 line-clamp-2 text-[15px] leading-snug font-bold text-foreground">{lead.title}</div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-bold", isTaskOverdue(lead) ? "bg-rose text-negative" : "bg-mint text-[#1f8a60]")}>
                  {isTaskOverdue(lead) ? dueLabel(lead.due_date) : `Due ${dueLabel(lead.due_date).toLowerCase()}`}
                </span>
                <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
                  <span className="truncate">{lead.assigned_to_name || "Unassigned"}</span>
                  <Avatar name={lead.assigned_to_name} size={24} />
                </span>
              </div>
            </Link>
            {rest.slice(0, 2).map((t) => (
              <Link key={String(t.id)} to={`/tasks/${t.id}`} className="flex items-center gap-3 rounded-[14px] bg-[#f5f8fd] px-3.5 py-2.5 transition-colors hover:bg-[#edf3ff]">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", isTaskOverdue(t) ? "bg-negative" : "bg-[#a8c8ff]")} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">{t.title}</span>
                <span className={cn("shrink-0 text-[11.5px] font-semibold", isTaskOverdue(t) ? "text-negative" : "text-muted-foreground")}>{dueLabel(t.due_date)}</span>
              </Link>
            ))}
          </>
        )}
        <Link
          to="/tasks/new"
          className="mt-auto flex items-center justify-center gap-2 rounded-[14px] border border-dashed border-[#bbd3ff] bg-[#f8faff] py-2.5 text-[13px] font-semibold text-primary transition-colors hover:bg-brand-soft"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-[6px] bg-primary text-white">
            <Plus className="h-3.5 w-3.5" />
          </span>
          Add new task
        </Link>
      </div>
    </div>
  );
}

/* ─── Week calendar of real deadlines ───────────────────────────────────── */

export interface DeadlineEvent {
  id: string;
  date: string;
  title: string;
  meta: string;
  kind: "task" | "project" | "invoice";
  to: string;
}

const KIND_TILE: Record<DeadlineEvent["kind"], { icon: LucideIcon; tone: Pastel; label: string }> = {
  task: { icon: ListChecks, tone: "blue", label: "Task due" },
  project: { icon: FolderKanban, tone: "sky", label: "Project deadline" },
  invoice: { icon: Receipt, tone: "peach", label: "Invoice due" },
};

function isoOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function WeekCalendar({ loading, events }: { loading: boolean; events: DeadlineEvent[] }) {
  const today = todayISO();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState(today);

  const days = useMemo(() => {
    const base = new Date(`${today}T00:00:00`);
    const monday = new Date(base);
    monday.setDate(base.getDate() - ((base.getDay() + 6) % 7) + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [today, weekOffset]);

  const byDay = useMemo(() => {
    const m = new Map<string, DeadlineEvent[]>();
    events.forEach((e) => m.set(e.date, [...(m.get(e.date) || []), e]));
    return m;
  }, [events]);

  const dayEvents = byDay.get(selected) || [];
  const next = events.filter((e) => e.date > selected).sort((a, b) => a.date.localeCompare(b.date))[0];
  const monthLabel = days[3].toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title={monthLabel}
        action={
          <div className="flex items-center gap-1">
            {weekOffset !== 0 && (
              <button
                type="button"
                onClick={() => {
                  setWeekOffset(0);
                  setSelected(today);
                }}
                className="mr-1 rounded-full px-2 py-1 text-[11.5px] font-semibold text-primary hover:bg-brand-soft"
              >
                Today
              </button>
            )}
            {[-1, 1].map((dir) => (
              <button
                key={dir}
                type="button"
                aria-label={dir < 0 ? "Previous week" : "Next week"}
                onClick={() => setWeekOffset((w) => w + dir)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-brand-soft hover:text-primary"
              >
                {dir < 0 ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ))}
          </div>
        }
      />
      <div className="grid grid-cols-7 gap-1 px-4 sm:px-5">
        {days.map((d) => {
          const iso = isoOf(d);
          const isSel = iso === selected;
          const has = byDay.has(iso);
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setSelected(iso)}
              aria-pressed={isSel}
              aria-label={d.toDateString()}
              className="flex flex-col items-center gap-1.5 rounded-[12px] py-1.5 transition-colors hover:bg-[#f5f8fd]"
            >
              <span className="text-[10.5px] font-bold tracking-wide text-subtle uppercase">{d.toLocaleDateString("en-IN", { weekday: "short" }).slice(0, 2)}</span>
              <span
                className={cn(
                  "figure flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold transition-colors",
                  isSel ? "bg-primary text-white shadow-[0_6px_14px_-6px_rgba(0,98,255,0.8)]" : iso === today ? "text-primary ring-1 ring-[#a8c8ff]" : "text-foreground",
                )}
              >
                {d.getDate()}
              </span>
              <span className={cn("h-1 w-1 rounded-full", has ? (isSel ? "bg-primary" : "bg-[#a8c8ff]") : "bg-transparent")} />
            </button>
          );
        })}
      </div>
      <div className="mx-5 my-3 h-px bg-hairline sm:mx-6" />
      <div className="flex-1 px-3 pb-4 sm:px-4">
        {loading ? (
          <SkeletonBlock className="mx-2 h-14" />
        ) : dayEvents.length === 0 ? (
          <div className="px-3 py-2 text-[12.5px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Nothing due {selected === today ? "today" : `on ${formatShortDate(selected)}`}.</span>
            {next && (
              <>
                {" "}
                Next up:{" "}
                <Link to={next.to} className="font-semibold text-primary hover:underline">
                  {next.title}
                </Link>{" "}
                · {formatShortDate(next.date)}
              </>
            )}
          </div>
        ) : (
          <ul className="space-y-1">
            {dayEvents.slice(0, 4).map((e) => {
              const k = KIND_TILE[e.kind];
              return (
                <li key={e.id}>
                  <Link to={e.to} className="flex items-center gap-3 rounded-[14px] px-2.5 py-2 transition-colors hover:bg-[#f5f8fd]">
                    <IconTile icon={k.icon} tone={k.tone} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-foreground">{e.title}</div>
                      <div className="truncate text-[11.5px] text-subtle">
                        {k.label} · {e.meta}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
            {dayEvents.length > 4 && <li className="px-3 text-[11.5px] font-semibold text-subtle">+{dayEvents.length - 4} more</li>}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ─── Project progress rings ────────────────────────────────────────────── */

const RING_COLORS = ["var(--primary)", "var(--accent-2)"];
const RING_CHIPS = ["bg-brand-soft text-[#004fcc]", "bg-accent-2-soft text-accent-2-deep"];

export function ProjectRings({ projects, clientNames }: { projects: ProjectBackend[]; clientNames: Map<string, string> }) {
  const picks = projects
    .filter((p) => !["COMPLETED", "CANCELLED"].includes(String(p.status).toUpperCase()) && p.deadline)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 2);
  if (!picks.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3">
      {picks.map((p, i) => (
        <Link key={String(p.id)} to={`/projects/${p.id}`} className="surface surface-hover flex flex-col gap-3 p-4">
          <ProgressRing value={Number(p.progress) || 0} size={54} stroke={5} color={RING_COLORS[i]}>
            <span className="figure text-[12px] font-extrabold">{Math.round(Number(p.progress) || 0)}%</span>
          </ProgressRing>
          <div className="min-w-0">
            <span className={cn("inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[10.5px] font-bold", RING_CHIPS[i])}>{projectClientName(p, clientNames)}</span>
            <div className="mt-1.5 line-clamp-2 text-[13px] leading-snug font-bold text-foreground">{p.project_name}</div>
            <div className="mt-1 text-[11.5px] font-medium text-subtle">Deadline {dueLabel(p.deadline).toLowerCase()}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

/* ─── Outstanding invoices highlight ────────────────────────────────────── */

export function OutstandingHighlight({ amount, invoiceCount, overdue, loading }: { amount: string; invoiceCount: number; overdue: number; loading: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#3384ff] via-[#0062ff] to-[#004fcc] p-5 text-white shadow-[0_18px_40px_-18px_rgba(0,79,204,0.75)]">
      <svg aria-hidden viewBox="0 0 200 120" className="pointer-events-none absolute -top-6 -right-10 h-40 w-64 opacity-25">
        <circle cx="150" cy="40" r="60" fill="none" stroke="#fff" strokeWidth="1.2" />
        <circle cx="150" cy="40" r="38" fill="none" stroke="#fff" strokeWidth="1.2" />
        <path d="M30 100c40-30 80-30 120-60" stroke="#fff" strokeWidth="1.2" fill="none" />
      </svg>
      <div className="relative">
        <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/20 ring-1 ring-white/25">
          <FileText className="h-5 w-5" />
        </span>
        <div className="mt-4 text-[12.5px] font-semibold text-white/75">Awaiting payment</div>
        {loading ? <span className="mt-2 block h-8 w-36 rounded-lg bg-white/25" /> : <div className="figure mt-1 text-[30px] leading-none font-extrabold tracking-[-0.03em]">{amount}</div>}
        <p className="mt-2 text-[12.5px] text-white/80">
          Across {plural(invoiceCount, "open invoice")}
          {overdue > 0 && <span className="font-bold text-white"> · {overdue} overdue</span>}
        </p>
        <Link to="/finance/invoices" className="mt-4 inline-flex items-center gap-1.5 rounded-[12px] bg-[#202b3c] px-4 py-2.5 text-[13px] font-bold text-white shadow-lg transition-transform hover:-translate-y-px">
          Review invoices <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

/* ─── Task workspace (today / overdue / upcoming / done) ────────────────── */

type TaskTab = "today" | "overdue" | "upcoming" | "done";

export function TaskWorkspace({ loading, tasks }: { loading: boolean; tasks: TaskBackend[] }) {
  const today = todayISO();
  const lists = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    const open = (t: TaskBackend) => !["COMPLETED", "CANCELLED"].includes(String(t.status).toUpperCase());
    return {
      today: tasks.filter((t) => open(t) && t.due_date === today),
      overdue: tasks.filter(isTaskOverdue).sort((a, b) => a.due_date.localeCompare(b.due_date)),
      upcoming: tasks.filter((t) => open(t) && t.due_date > today && isTaskDueSoon(t, 14)).sort((a, b) => a.due_date.localeCompare(b.due_date)),
      done: tasks
        .filter((t) => String(t.status).toUpperCase() === "COMPLETED" && new Date(t.completed_at || t.updated_at || 0).getTime() >= weekAgo)
        .sort((a, b) => String(b.completed_at || b.updated_at).localeCompare(String(a.completed_at || a.updated_at))),
    } satisfies Record<TaskTab, TaskBackend[]>;
  }, [tasks, today]);

  const [tab, setTab] = useState<TaskTab>(() => (lists.today.length ? "today" : lists.overdue.length ? "overdue" : "upcoming"));
  const rows = lists[tab].slice(0, 6);
  const people = [...new Set(tasks.filter((t) => t.assigned_to_name && !["COMPLETED", "CANCELLED"].includes(String(t.status))).map((t) => t.assigned_to_name as string))];

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Today's tasks"
        meta={
          people.length > 0 ? (
            <span className="ml-1 inline-flex -space-x-1.5 align-middle">
              {people.slice(0, 4).map((n) => (
                <Avatar key={n} name={n} size={22} />
              ))}
              {people.length > 4 && <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white ring-2 ring-white">+{people.length - 4}</span>}
            </span>
          ) : undefined
        }
        action={
          <SegmentedControl<TaskTab>
            aria-label="Task lists"
            value={tab}
            onChange={setTab}
            options={[
              { value: "today", label: "Today", count: lists.today.length },
              { value: "overdue", label: "Overdue", count: lists.overdue.length },
              { value: "upcoming", label: "Upcoming", count: lists.upcoming.length },
              { value: "done", label: "Done", count: lists.done.length },
            ]}
          />
        }
      />
      {loading ? (
        <div className="space-y-3 px-6 pb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          compact
          title={tab === "done" ? "No completions this week" : tab === "overdue" ? "Nothing overdue" : tab === "today" ? "Nothing due today" : "No upcoming deadlines"}
          description={tab === "done" ? "Tasks completed in the last 7 days appear here." : "Enjoy the breathing room."}
        />
      ) : (
        <ul className="space-y-1 px-3 pb-4 sm:px-4">
          {rows.map((t) => {
            const late = isTaskOverdue(t);
            const progress = Number(t.progress) || 0;
            const hours = Number(t.estimated_hours) || 0;
            return (
              <li key={String(t.id)}>
                <Link
                  to={`/tasks/${t.id}`}
                  className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-[16px] px-3 py-3 transition-[background-color,box-shadow] hover:bg-card hover:shadow-md sm:grid-cols-[minmax(0,1fr)_72px_150px_32px]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-bold text-foreground group-hover:text-primary-deep">{t.title}</div>
                    <div className={cn("truncate text-[11.5px] font-medium", late ? "text-negative" : "text-subtle")}>
                      {tab === "done" ? `Completed ${relativeTime(t.completed_at || t.updated_at)}` : `${dueLabel(t.due_date)} · ${t.project_name || "No project"}`}
                    </div>
                  </div>
                  <div className="hidden sm:block">
                    <div className="text-[10.5px] font-semibold text-subtle">Estimate</div>
                    <div className="figure text-[12.5px] font-bold text-foreground">{hours ? `${hours}h` : "—"}</div>
                  </div>
                  <div className="col-span-2 flex items-center gap-2.5 sm:col-span-1">
                    <span className="figure w-9 text-[12px] font-bold text-foreground">{progress}%</span>
                    <Meter value={progress} tone={tab === "done" ? "positive" : late ? "negative" : "primary"} label={`${t.title} progress`} />
                  </div>
                  <span className="col-start-2 row-start-1 sm:col-auto sm:row-auto">
                    <Avatar name={t.assigned_to_name || "Unassigned"} size={28} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ─── Projects in motion ────────────────────────────────────────────────── */

const HEALTH: Record<ProjectHealth, { label: string; className: string; bar: "primary" | "caution" | "negative" | "positive" }> = {
  on_track: { label: "On track", className: "bg-mint text-[#1f8a60]", bar: "primary" },
  at_risk: { label: "At risk", className: "bg-caution-soft text-caution", bar: "caution" },
  overdue: { label: "Overdue", className: "bg-rose text-negative", bar: "negative" },
  done: { label: "Completed", className: "bg-secondary text-muted-foreground", bar: "positive" },
};

type ProjectFilter = "active" | "attention" | "all";
const PROJECT_TONES: Pastel[] = ["blue", "peach", "mint", "sky", "butter"];

export function ProjectsInMotion({ loading, projects, clientNames }: { loading: boolean; projects: ProjectBackend[]; clientNames: Map<string, string> }) {
  const [filter, setFilter] = useState<ProjectFilter>("active");
  const enriched = useMemo(
    () => projects.filter((p) => String(p.status).toUpperCase() !== "CANCELLED").map((p) => ({ project: p, ...projectHealth(p), daysLeft: daysFromToday(p.deadline) })),
    [projects],
  );
  const sets = {
    active: enriched.filter((e) => e.health !== "done"),
    attention: enriched.filter((e) => e.health === "at_risk" || e.health === "overdue"),
    all: enriched,
  };
  const rank: Record<ProjectHealth, number> = { overdue: 0, at_risk: 1, on_track: 2, done: 3 };
  const rows = [...sets[filter]].sort((a, b) => rank[a.health] - rank[b.health] || (a.daysLeft ?? 9e9) - (b.daysLeft ?? 9e9)).slice(0, 5);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Projects in motion"
        action={
          <SegmentedControl<ProjectFilter>
            aria-label="Filter projects"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "active", label: "Active", count: sets.active.length },
              { value: "attention", label: "At risk", count: sets.attention.length },
              { value: "all", label: "All", count: sets.all.length },
            ]}
          />
        }
      />
      {loading ? (
        <div className="space-y-3 px-6 pb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          compact
          title={filter === "attention" ? "Every project is on schedule" : "No projects yet"}
          description={filter === "attention" ? "Nothing is overdue or trailing its timeline." : "Create a project to start tracking delivery."}
        />
      ) : (
        <ul className="space-y-1 px-3 pb-2 sm:px-4">
          {rows.map(({ project: p, health, reason }, i) => {
            const h = HEALTH[health];
            const progress = Number(p.progress) || 0;
            return (
              <li key={String(p.id)}>
                <Link
                  to={`/projects/${p.id}`}
                  className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-2 rounded-[16px] px-3 py-3 transition-[background-color,box-shadow] hover:bg-card hover:shadow-md md:grid-cols-[auto_minmax(0,1fr)_160px_84px_92px]"
                >
                  <IconTile icon={FolderKanban} tone={PROJECT_TONES[i % PROJECT_TONES.length]} />
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-bold text-foreground group-hover:text-primary-deep">{p.project_name}</div>
                    <div className="truncate text-[11.5px] font-medium text-subtle">
                      {projectClientName(p, clientNames)} · {PROJECT_STATUS_LABEL[String(p.status)] || p.status}
                    </div>
                  </div>
                  <div className="col-span-3 flex items-center gap-2.5 md:col-span-1">
                    <Meter value={progress} tone={h.bar} label={`${p.project_name} progress`} />
                    <span className="figure w-9 text-right text-[12px] font-bold text-foreground">{progress}%</span>
                  </div>
                  <span className="col-start-3 row-start-1 text-right text-[12px] font-semibold text-muted-foreground md:col-auto md:row-auto md:text-left">
                    {p.deadline ? dueLabel(p.deadline) : "—"}
                  </span>
                  <span title={reason} className={cn("hidden justify-self-start rounded-full px-2.5 py-1 text-[11px] font-bold md:inline-block", h.className)}>
                    {h.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-auto px-6 pt-1 pb-5">
        <ViewAllLink to="/projects">All projects</ViewAllLink>
      </div>
    </div>
  );
}

/* ─── Activity timeline ─────────────────────────────────────────────────── */

export interface ActivityEvent {
  id: string;
  actor: string;
  verb: string;
  target: string;
  when: string;
  sortKey: number;
  kind: "project" | "task" | "client" | "invoice" | "payment" | "expense" | "income" | "other";
  to?: string;
}

const KIND_ICON: Record<ActivityEvent["kind"], { icon: LucideIcon; tone: Pastel }> = {
  project: { icon: FolderKanban, tone: "sky" },
  task: { icon: CircleCheck, tone: "blue" },
  client: { icon: Building2, tone: "butter" },
  invoice: { icon: FileText, tone: "blue" },
  payment: { icon: Wallet, tone: "mint" },
  income: { icon: Wallet, tone: "mint" },
  expense: { icon: Receipt, tone: "peach" },
  other: { icon: CircleCheck, tone: "blue" },
};

export function ActivityTimeline({ loading, events }: { loading: boolean; events: ActivityEvent[] }) {
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Recent activity" />
      {loading ? (
        <div className="space-y-4 px-6 pb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState compact title="No activity yet" description="Changes to projects, tasks, clients and finance records appear here." />
      ) : (
        <ol className="relative px-4 pb-5 sm:px-5">
          <span className="absolute top-4 bottom-8 left-[31px] w-px bg-gradient-to-b from-[#dbe6f7] to-transparent sm:left-[35px]" aria-hidden />
          {events.map((ev) => {
            const k = KIND_ICON[ev.kind];
            const body = (
              <>
                <IconTile icon={k.icon} tone={k.tone} size="sm" className="relative z-10 ring-4 ring-card" />
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[12.5px] leading-snug text-muted-foreground">
                    <span className="font-bold text-foreground">{ev.actor}</span> {ev.verb} <span className="font-semibold text-foreground">{ev.target}</span>
                  </p>
                  <span className="text-[11px] font-medium text-subtle">{ev.when}</span>
                </div>
              </>
            );
            return (
              <li key={ev.id}>
                {ev.to ? (
                  <Link to={ev.to} className="flex items-start gap-3 rounded-[14px] px-2 py-2 transition-colors hover:bg-[#f5f8fd]">
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 px-2 py-2">{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
