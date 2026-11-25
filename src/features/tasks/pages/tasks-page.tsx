import { StatStrip } from "@/components/shared/stat-strip";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Plus, ListTodo, CheckCircle2, AlertCircle, Clock3, Search, X, Download,
  ChevronDown, Columns3, List, MoreVertical, Eye, Pencil,
  Archive, FolderKanban, CalendarDays, Loader2, RefreshCcw,
} from "lucide-react";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { downloadCsv, toCsv } from "@/lib/csv";
import { listAllProjects } from "@/api/projects.api";
import { listAllEmployees } from "@/api/employees.api";
import {
  countTasks, getOverdueTasks, listAllTasks, listTasks,
  type TaskBackend, type TaskListParams,
} from "@/api/tasks.api";
import { useUpdateTaskStatus, useArchiveTask } from "../hooks/use-tasks";

/* ─── Config ─────────────────────────────────────────── */
const PRIORITY_CONFIG = {
  URGENT: { cls: "bg-red-50 text-red-700 ring-red-500/20",    dot: "bg-red-500",    label: "Urgent" },
  HIGH:   { cls: "bg-orange-50 text-orange-700 ring-orange-500/20", dot: "bg-orange-500", label: "High" },
  MEDIUM: { cls: "bg-amber-50 text-amber-700 ring-amber-500/20", dot: "bg-amber-500", label: "Medium" },
  LOW:    { cls: "bg-blue-50 text-blue-700 ring-blue-500/20",  dot: "bg-blue-400",  label: "Low" },
} as Record<string, { cls: string; dot: string; label: string }>;

const STATUS_CONFIG = {
  "TODO":        { cls: "bg-slate-100 text-slate-600",      dot: "bg-slate-400",    label: "To Do" },
  "IN_PROGRESS": { cls: "bg-blue-50 text-blue-700",         dot: "bg-blue-500",     label: "In Progress" },
  "IN_REVIEW":   { cls: "bg-amber-50 text-amber-700",       dot: "bg-amber-500",    label: "In Review" },
  "COMPLETED":   { cls: "bg-emerald-50 text-emerald-700",   dot: "bg-emerald-500",  label: "Completed" },
  "BLOCKED":     { cls: "bg-red-50 text-red-700",           dot: "bg-red-500",      label: "Blocked" },
  "CANCELLED":   { cls: "bg-slate-100 text-slate-500",      dot: "bg-slate-300",    label: "Cancelled" },
} as Record<string, { cls: string; dot: string; label: string }>;

/* ─── Helpers ────────────────────────────────────────── */
function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority] || { cls: "bg-secondary text-foreground ring-border", dot: "bg-slate-400", label: priority };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset", cfg.cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { cls: "bg-secondary text-foreground", dot: "bg-slate-400", label: status };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", cfg.cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

function formatDue(due?: string, closed = false): { label: string; color: string; overdue: boolean } {
  const m = due ? /^(\d{4})-(\d{2})-(\d{2})/.exec(due) : null;
  if (!m) return { label: "No due date", color: "text-muted-foreground", overdue: false };
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - now.getTime()) / 86400000);
  const short = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  if (closed) return { label: short, color: "text-muted-foreground", overdue: false };
  if (diff < 0)  return { label: `${Math.abs(diff)}d overdue`, color: "text-red-600 font-semibold", overdue: true };
  if (diff === 0) return { label: "Today",                      color: "text-amber-600 font-semibold", overdue: false };
  if (diff === 1) return { label: "Tomorrow",                   color: "text-amber-500",              overdue: false };
  return { label: short, color: "text-muted-foreground", overdue: false };
}

/* ─── Filter Select ──────────────────────────────────── */
function FilterSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder: string;
}) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="h-10 appearance-none rounded-xl border border-border/70 bg-white pl-3 pr-8 text-[13px] font-medium text-foreground shadow-sm outline-none transition-colors hover:border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/10">
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

/* ─── Kanban Board ───────────────────────────────────── */
const KANBAN_COLS = ["TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "BLOCKED"] as const;

function KanbanCard({ task, navigate }: { task: TaskBackend; navigate: (path: string) => void }) {
  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.LOW;
  const due = formatDue(task.due_date, task.status === "COMPLETED");
  const assigneeName = task.assigned_to_name || "Unassigned";
  const assigneeInitials = task.assigned_to ? assigneeName.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase() : "—";

  return (
    <div
      onClick={() => navigate(`/tasks/${task.id}`)}
      className="group cursor-pointer rounded-xl border border-border/60 bg-white p-3.5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-150"
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <p className="text-[13px] font-semibold text-foreground leading-snug">{task.title}</p>
        <span className={cn("shrink-0 inline-flex h-1.5 w-1.5 mt-1.5 rounded-full", priority.dot)} title={priority.label} />
      </div>
      <p className="text-[11px] text-muted-foreground mb-3 flex items-center gap-1">
        <FolderKanban className="h-3 w-3" /> {task.project_name || `Project #${task.project}`}
      </p>
      {task.progress > 0 && (
        <div className="mb-3">
          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${task.progress}%` }} />
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className={cn("text-[11px] flex items-center gap-1", due.color)}>
          <CalendarDays className="h-3 w-3" /> {due.label}
        </span>
        <div title={assigneeName} className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[9px] font-bold text-white">
          {assigneeInitials}
        </div>
      </div>
    </div>
  );
}

/* ─── Backend mapping ────────────────────────────────── */
const PAGE_SIZE = 10;

/** WorkItemViewSet.ordering_fields = due_date, priority, created_at, progress (priority sorts alphabetically, so it is not offered). */
const SORT_OPTIONS = [
  { value: "due", label: "Due date (soonest)", ordering: "due_date" },
  { value: "due_desc", label: "Due date (latest)", ordering: "-due_date" },
  { value: "newest", label: "Recently created", ordering: "-created_at" },
  { value: "progress", label: "Progress (highest)", ordering: "-progress" },
] as const;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const EXPORT_COLUMNS = [
  { header: "Title", value: (t: TaskBackend) => t.title },
  { header: "Project", value: (t: TaskBackend) => t.project_name },
  { header: "Assignee", value: (t: TaskBackend) => t.assigned_to_name },
  { header: "Status", value: (t: TaskBackend) => t.status },
  { header: "Priority", value: (t: TaskBackend) => t.priority },
  { header: "Progress (%)", value: (t: TaskBackend) => t.progress },
  { header: "Estimated Hours", value: (t: TaskBackend) => t.estimated_hours },
  { header: "Due Date", value: (t: TaskBackend) => t.due_date },
  { header: "Created By", value: (t: TaskBackend) => t.created_by_name },
  { header: "Created At", value: (t: TaskBackend) => t.created_at },
  { header: "Completed At", value: (t: TaskBackend) => t.completed_at },
];

/* ─── Main Page ──────────────────────────────────────── */
type ViewMode = "list" | "kanban";

export function TasksPage() {
  const navigate = useNavigate();
  const updateStatusMutation = useUpdateTaskStatus();
  const archiveMutation = useArchiveTask();
  const [taskToArchive, setTaskToArchive] = useState<TaskBackend | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const [view, setView] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [projectFilter, setProjectFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("due");

  const filterKey = JSON.stringify([debouncedSearch, projectFilter, assigneeFilter, priorityFilter, statusFilter, sortBy]);
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (p: number) => setPageState({ key: filterKey, page: p });

  /** Filters shared by list, board and export (all server-side). */
  const filters: Omit<TaskListParams, "page"> = {
    search: debouncedSearch || undefined,
    project: projectFilter || undefined,
    assigned_to: assigneeFilter || undefined,
    priority: priorityFilter || undefined,
    ordering: SORT_OPTIONS.find((o) => o.value === sortBy)?.ordering,
  };
  const params: TaskListParams = { ...filters, page, status: statusFilter || undefined };

  const listQuery = useQuery({
    queryKey: ["tasks", "list", params],
    queryFn: ({ signal }) => listTasks(params, signal),
    placeholderData: keepPreviousData,
    enabled: view === "list",
  });
  const tasks = listQuery.data?.results ?? [];
  const totalCount = listQuery.data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const listErrorStatus = (listQuery.error as { status?: number | null } | null)?.status;
  useEffect(() => {
    if (listErrorStatus === 404 && page > 1) setPageState({ key: filterKey, page: page - 1 });
  }, [listErrorStatus, page, filterKey]);

  // Board: one server query per status column (first page + exact count).
  const boardCols = statusFilter ? KANBAN_COLS.filter((c) => c === statusFilter) : KANBAN_COLS;
  const boardQueries = useQueries({
    queries: boardCols.map((col) => ({
      queryKey: ["tasks", "board", col, filters],
      queryFn: ({ signal }: { signal: AbortSignal }) => listTasks({ ...filters, status: col }, signal),
      enabled: view === "kanban",
    })),
  });

  // Stats: exact global counts (CANCELLED is never listed by the API).
  const statsQuery = useQuery({
    queryKey: ["tasks", "stats"],
    queryFn: async ({ signal }) => {
      const [total, completed, overdue] = await Promise.all([
        countTasks({}, signal),
        countTasks({ status: "COMPLETED" }, signal),
        getOverdueTasks(signal),
      ]);
      return { total, completed, open: total - completed, overdue: overdue.length };
    },
  });
  const stats = statsQuery.data;

  const projectsQuery = useQuery({ queryKey: ["projects", "all", "picker"], queryFn: ({ signal }) => listAllProjects({ ordering: "-created_at" }, signal) });
  const employeesQuery = useQuery({ queryKey: ["employees", "all", "picker"], queryFn: ({ signal }) => listAllEmployees({}, signal) });

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const rows = await listAllTasks({ ...filters, status: statusFilter || undefined });
      if (!rows.length) {
        toast.info("No tasks to export for the current filters.");
        return;
      }
      downloadCsv("tasks", toCsv(EXPORT_COLUMNS, rows));
      toast.success(`Exported ${rows.length} task${rows.length === 1 ? "" : "s"}.`);
    } catch (err) {
      toast.error(extractApiErrorMessage(err, "Export failed.").message);
    } finally {
      setIsExporting(false);
    }
  };

  /* Columns */
  const columns: ColumnDef<TaskBackend>[] = [
    {
      id: "title",
      header: "Task",
      cell: ({ row }) => {
        const t = row.original;
        const isCompleted = t.status === "COMPLETED";
        const pending = updateStatusMutation.isPending && updateStatusMutation.variables?.id === t.id;
        return (
          <div className="flex items-start gap-3 py-0.5 min-w-[200px]">
            <button
              type="button"
              aria-label={isCompleted ? `Reopen ${t.title}` : `Mark ${t.title} complete`}
              title={isCompleted ? "Reopen (set In Progress)" : "Mark complete"}
              onClick={() => updateStatusMutation.mutate({ id: t.id, status: isCompleted ? "IN_PROGRESS" : "COMPLETED" })}
              className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
              disabled={updateStatusMutation.isPending}
            >
              {pending ? <Loader2 className="h-5 w-5 animate-spin" />
                : isCompleted ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                : <div className="h-5 w-5 rounded-full border-2 border-border" />}
            </button>
            <div>
              <Link to={`/tasks/${t.id}`} className={cn("text-[13px] font-semibold hover:text-primary transition-colors", isCompleted ? "line-through text-muted-foreground" : "text-foreground")}>
                {t.title}
              </Link>
              <div className="flex items-center gap-1.5 mt-0.5">
                <FolderKanban className="h-3 w-3 text-muted-foreground/60" />
                <span className="text-[11px] text-muted-foreground">{t.project_name || `Project #${t.project}`}</span>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: "assignee",
      header: "Assignee",
      cell: ({ row }) => {
        const t = row.original;
        if (!t.assigned_to) return <span className="text-[11px] text-muted-foreground">Unassigned</span>;
        const name = t.assigned_to_name || `Employee #${t.assigned_to}`;
        const initials = name.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
        return (
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[10px] font-bold text-white shadow-sm">
              {initials}
            </div>
            <span className="text-[12px] font-medium text-foreground hidden md:inline-block">{name}</span>
          </div>
        );
      },
    },
    {
      id: "priority",
      header: "Priority",
      cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
    },
    {
      id: "due_date",
      header: "Due Date",
      cell: ({ row }) => {
        const t = row.original;
        const d = formatDue(t.due_date, t.status === "COMPLETED");
        return (
          <div className={cn("flex items-center gap-1.5 text-[13px] whitespace-nowrap", d.color)} title={t.due_date}>
            <CalendarDays className="h-3.5 w-3.5" />
            {d.label}
          </div>
        );
      },
    },
    {
      id: "progress",
      header: "Progress",
      cell: ({ row }) => {
        const progress = Math.max(0, Math.min(100, Number(row.original.progress) || 0));
        return (
          <div className="w-[90px]">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-medium text-muted-foreground">{progress}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", progress === 100 ? "bg-emerald-500" : "bg-primary")} style={{ width: `${progress}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const t = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground">
                <span className="sr-only">Actions for {t.title}</span>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => navigate(`/tasks/${t.id}`)} className="gap-2 cursor-pointer text-[13px]">
                <Eye className="h-3.5 w-3.5 text-muted-foreground" /> View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/tasks/${t.id}/edit`)} className="gap-2 cursor-pointer text-[13px]">
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setTaskToArchive(t)} className="gap-2 cursor-pointer text-[13px] text-red-600 focus:text-red-600 focus:bg-red-50">
                <Archive className="h-3.5 w-3.5" /> Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({ data: tasks, columns, getCoreRowModel: getCoreRowModel(), manualPagination: true, pageCount });
  const hasFilters = Boolean(debouncedSearch || projectFilter || assigneeFilter || priorityFilter || statusFilter);
  const dash = (v?: number) => (v === undefined ? "—" : v);

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track, assign and monitor team tasks.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-xl border border-border/70 bg-white p-1 shadow-sm">
            <button type="button" aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")} className={cn("flex h-8 w-8 items-center justify-center rounded-lg transition-colors", view === "list" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              <List className="h-4 w-4" />
            </button>
            <button type="button" aria-label="Board view" aria-pressed={view === "kanban"} onClick={() => setView("kanban")} className={cn("flex h-8 w-8 items-center justify-center rounded-lg transition-colors", view === "kanban" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              <Columns3 className="h-4 w-4" />
            </button>
          </div>
          <Button onClick={() => navigate("/tasks/new")} className="h-10 gap-2 px-4 shadow-sm">
            <Plus className="h-4 w-4" /> New Task
          </Button>
        </div>
      </div>

      {/* Stats — exact server counts ("—" when unavailable) */}
      <StatStrip
        loading={statsQuery.isLoading}
        items={[
          { label: "Open tasks", value: dash(stats?.open), hint: stats ? `${stats.total} in total` : statsQuery.isError ? "Counts unavailable" : undefined, icon: ListTodo, tone: "blue", onClick: () => setStatusFilter("") },
          { label: "Overdue", value: dash(stats?.overdue), icon: AlertCircle, tone: "rose", alert: (stats?.overdue ?? 0) > 0 },
          { label: "Completed", value: dash(stats?.completed), icon: CheckCircle2, tone: "mint", onClick: () => setStatusFilter("COMPLETED") },
          { label: "Total", value: dash(stats?.total), icon: Clock3, tone: "sky" },
        ]}
      />

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6 rounded-2xl border border-border/70 bg-white px-5 py-3.5 shadow-sm">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title, project or assignee..." aria-label="Search tasks"
            className="h-10 w-full rounded-xl border border-border/70 bg-transparent pl-9 pr-8 text-[13px] text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/10" />
          {search && (
            <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="h-5 w-px bg-border hidden sm:block" />
        <FilterSelect value={projectFilter}  onChange={setProjectFilter}  placeholder="Project"  options={(projectsQuery.data ?? []).map((p) => ({ value: String(p.id), label: p.project_name }))} />
        <FilterSelect value={assigneeFilter} onChange={setAssigneeFilter} placeholder="Assignee" options={(employeesQuery.data ?? []).map((e) => ({ value: String(e.id), label: e.status === "ACTIVE" ? e.name : `${e.name} (${e.status.toLowerCase().replace("_", " ")})` }))} />
        <FilterSelect value={priorityFilter} onChange={setPriorityFilter} placeholder="Priority" options={Object.keys(PRIORITY_CONFIG).map((p) => ({ value: p, label: PRIORITY_CONFIG[p].label }))} />
        <FilterSelect value={statusFilter}   onChange={setStatusFilter}   placeholder="Status"   options={KANBAN_COLS.map((s) => ({ value: s, label: STATUS_CONFIG[s].label }))} />
        <FilterSelect value={sortBy} onChange={(v) => setSortBy(v || "due")} placeholder="Sort" options={SORT_OPTIONS.map(({ value, label }) => ({ value, label }))} />
        <div className="ml-auto">
          <Button variant="outline" size="sm" className="h-10 gap-2 rounded-xl text-[13px]" onClick={() => void handleExport()} disabled={isExporting}>
            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {isExporting ? "Exporting..." : "Export"}
          </Button>
        </div>
      </div>

      {/* Content */}
      {view === "list" ? (
        listQuery.isLoading ? (
          <div className="rounded-2xl border border-border/70 bg-white shadow-sm p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-5 w-5 rounded-full bg-secondary/60 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 rounded bg-secondary/60 animate-pulse" />
                  <div className="h-3 w-1/5 rounded bg-secondary/60 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : listQuery.isError ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-white py-16 text-center">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="text-sm font-semibold text-foreground">Unable to load tasks</p>
            <p className="max-w-sm text-[13px] text-muted-foreground">{extractApiErrorMessage(listQuery.error, "Please try again.").message}</p>
            <Button variant="outline" size="sm" className="mt-2 gap-2" onClick={() => void listQuery.refetch()}><RefreshCcw className="h-3.5 w-3.5" /> Retry</Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
            <div className={cn("overflow-x-auto transition-opacity", listQuery.isFetching && "opacity-70")}>
              <table className="w-full">
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id} className="border-b border-border/60 bg-slate-50/80">
                      {hg.headers.map((h) => (
                        <th key={h.id} className="h-11 px-5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                          {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row, i) => (
                      <tr key={row.id} className={cn("border-b border-border/40 transition-all hover:bg-slate-50/60 group", i === table.getRowModel().rows.length - 1 && "border-b-0")}>
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-5 py-2.5">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={columns.length} className="h-40 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <ListTodo className="h-8 w-8 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">{hasFilters ? "No tasks match your filters" : "No tasks yet"}</p>
                        {!hasFilters && (
                          <Button size="sm" variant="outline" className="mt-1 h-8 gap-1.5 text-xs" onClick={() => navigate("/tasks/new")}><Plus className="h-3.5 w-3.5" /> New Task</Button>
                        )}
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {pageCount > 1 && (
              <div className="flex items-center justify-between border-t border-border/60 px-5 py-3">
                <p className="text-xs text-muted-foreground">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={!listQuery.data?.previous || listQuery.isFetching} className="h-8 px-3 text-xs rounded-lg">Previous</Button>
                  <span className="text-xs text-muted-foreground">Page {page} of {pageCount}</span>
                  <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={!listQuery.data?.next || listQuery.isFetching} className="h-8 px-3 text-xs rounded-lg">Next</Button>
                </div>
              </div>
            )}
          </div>
        )
      ) : (
        /* Kanban Board — first page of each status column, with the exact column count */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {boardCols.map((col, idx) => {
            const q = boardQueries[idx];
            const colTasks = q?.data?.results ?? [];
            const count = q?.data?.count;
            const cfg = STATUS_CONFIG[col];
            return (
              <div key={col} className="flex flex-col w-[300px] shrink-0">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className={cn("h-2.5 w-2.5 rounded-full", cfg.dot)} />
                  <h3 className="text-[13px] font-semibold text-foreground">{cfg.label}</h3>
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary border border-border/50 px-1.5 text-[11px] font-semibold text-muted-foreground">{count ?? "—"}</span>
                </div>
                <div className="flex flex-col gap-2 min-h-[100px] rounded-2xl border border-border/50 bg-slate-50/60 p-3">
                  {q?.isLoading ? (
                    Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-white/80 animate-pulse" />)
                  ) : q?.isError ? (
                    <div className="flex flex-col items-center gap-1 py-4 text-center text-[12px] text-red-600">
                      {extractApiErrorMessage(q.error).message}
                      <button type="button" className="font-medium underline" onClick={() => void q.refetch()}>Retry</button>
                    </div>
                  ) : (
                    <>
                      {colTasks.map((t) => <KanbanCard key={t.id} task={t} navigate={navigate} />)}
                      {colTasks.length === 0 && (
                        <div className="flex h-20 items-center justify-center text-[12px] text-muted-foreground/50">No tasks</div>
                      )}
                      {count !== undefined && count > colTasks.length && (
                        <button type="button" onClick={() => { setStatusFilter(col); setView("list"); }} className="rounded-lg py-1.5 text-[12px] font-medium text-primary hover:bg-white">
                          Showing {colTasks.length} of {count} — view all in list
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!taskToArchive}
        title={`Archive "${taskToArchive?.title ?? "task"}"?`}
        description={
          <>
            <p>The task is not permanently deleted. Its status is set to <strong>Cancelled</strong>, and it disappears from task lists, the project's task tab and the assignee's portal.</p>
            <p>Its comments and attachments are kept. This app cannot restore archived tasks.</p>
          </>
        }
        confirmLabel="Archive"
        pendingLabel="Archiving..."
        pending={archiveMutation.isPending}
        onConfirm={() => taskToArchive && archiveMutation.mutate(taskToArchive.id, { onSettled: () => setTaskToArchive(null) })}
        onCancel={() => setTaskToArchive(null)}
      />
    </AppLayout>
  );
}
