import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Calendar as CalendarIcon, Search, X, AlertCircle, RefreshCcw, Archive, ChevronLeft, ChevronRight } from "lucide-react";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ActionDropdown } from "@/components/shared/action-dropdown";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import {
  countProjects,
  listProjects,
  labelFor,
  projectClientName,
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  SELECTABLE_PROJECT_STATUSES,
  type ProjectBackend,
  type ProjectListParams,
} from "@/api/projects.api";
import { useArchiveProject } from "../hooks/use-projects";

/** REST_FRAMEWORK PAGE_SIZE (no page_size param). */
const PAGE_SIZE = 10;

/** ProjectViewSet.ordering_fields = created_at, deadline, start_date, progress */
const SORT_OPTIONS = [
  { value: "newest", label: "Newest", ordering: "-created_at" },
  { value: "oldest", label: "Oldest", ordering: "created_at" },
  { value: "deadline", label: "Deadline (soonest)", ordering: "deadline" },
  { value: "deadline_desc", label: "Deadline (latest)", ordering: "-deadline" },
  { value: "start", label: "Start date", ordering: "start_date" },
  { value: "progress", label: "Progress (highest)", ordering: "-progress" },
] as const;

const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";

function getInitials(name?: string) {
  if (!name) return "U";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2);
}

/** Parses YYYY-MM-DD as a local calendar date (new Date("YYYY-MM-DD") is UTC). */
function parseLocalDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const archiveMutation = useArchiveProject();
  const [projectToArchive, setProjectToArchive] = useState<ProjectBackend | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm.trim(), 300);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  const filterKey = JSON.stringify([debouncedSearch, statusFilter, priorityFilter, sortBy]);
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (p: number) => setPageState({ key: filterKey, page: p });

  const params: ProjectListParams = {
    page,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    ordering: SORT_OPTIONS.find((o) => o.value === sortBy)?.ordering,
  };

  const listQuery = useQuery({
    queryKey: ["projects", "list", params],
    queryFn: ({ signal }) => listProjects(params, signal),
    placeholderData: keepPreviousData,
  });
  const projects = listQuery.data?.results ?? [];
  const totalCount = listQuery.data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const listErrorStatus = (listQuery.error as { status?: number | null } | null)?.status;
  useEffect(() => {
    if (listErrorStatus === 404 && page > 1) setPageState({ key: filterKey, page: page - 1 });
  }, [listErrorStatus, page, filterKey]);

  // Summary: exact counts. The API never returns CANCELLED (archived), so
  // in flight = all visible − COMPLETED (i.e. PLANNING + IN_PROGRESS + ON_HOLD).
  const statsQuery = useQuery({
    queryKey: ["projects", "stats"],
    queryFn: async ({ signal }) => {
      const [total, completed] = await Promise.all([
        countProjects({}, signal),
        countProjects({ status: "COMPLETED" }, signal),
      ]);
      return { total, inFlight: total - completed };
    },
  });

  const columns: ColumnDef<ProjectBackend>[] = [
    {
      id: "name",
      header: "Project",
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="min-w-[180px]">
            <Link to={`/projects/${p.id}`} className="font-medium text-foreground hover:underline">
              {p.project_name}
            </Link>
            <div className="text-xs text-muted-foreground mt-0.5">{projectClientName(p)}</div>
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={labelFor(PROJECT_STATUS_LABELS, row.original.status)} />,
    },
    {
      id: "progress",
      header: "Progress",
      cell: ({ row }) => {
        const progress = Math.max(0, Math.min(100, Number(row.original.progress) || 0));
        return (
          <div className="w-[100px]">
            <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground mb-1.5">
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      id: "deadline",
      header: "Due Date",
      cell: ({ row }) => {
        const d = row.original.deadline;
        const dateObj = d ? parseLocalDate(d) : null;
        if (!dateObj) return <span className="text-muted-foreground">—</span>;
        let display = dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        let colorClass = "text-muted-foreground";
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isClosed = ["COMPLETED", "CANCELLED"].includes(String(row.original.status).toUpperCase());
        if (dateObj < today && !isClosed) {
          display = "Overdue";
          colorClass = "text-red-600 font-semibold";
        } else if (dateObj.getTime() === today.getTime()) {
          display = "Today";
          colorClass = "text-orange-500 font-semibold";
        }
        return (
          <div className={`flex items-center gap-1.5 text-xs whitespace-nowrap ${colorClass}`} title={d}>
            <CalendarIcon className="h-3.5 w-3.5" /> {display}
          </div>
        );
      },
    },
    {
      id: "budget",
      header: "Budget",
      cell: ({ row }) => {
        const raw = row.original.budget;
        if (raw === null || raw === undefined || raw === "") return <span className="text-xs text-muted-foreground">—</span>;
        const formatted = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 }).format(Number(raw));
        return <div className="figure text-xs font-semibold text-foreground" title={`₹${raw}`}>{formatted}</div>;
      },
    },
    {
      id: "team",
      header: "Team",
      cell: ({ row }) => {
        const members = row.original.members || [];
        const nameOf = (m: (typeof members)[number]) => m.employee_name || m.name || "Member";
        const displayMembers = members.slice(0, 3);
        const remaining = members.length - 3;
        return (
          <div className="flex items-center -space-x-2 group relative">
            {displayMembers.map((m, i) => (
              <div key={m.id || i} title={`${nameOf(m)}${m.role_in_project ? ` · ${m.role_in_project}` : ""}`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-card bg-secondary text-[9px] font-bold text-foreground shadow-sm">
                {getInitials(nameOf(m))}
              </div>
            ))}
            {remaining > 0 && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-card bg-secondary/80 text-[9px] font-bold text-foreground shadow-sm relative cursor-pointer">
                +{remaining}
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center whitespace-pre-wrap">
                  {members.slice(3).map(nameOf).join("\n")}
                </div>
              </div>
            )}
            {members.length === 0 && <span className="text-xs text-muted-foreground ml-2">Unassigned</span>}
          </div>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const p = row.original;
        return (
          <ActionDropdown
            onView={() => navigate(`/projects/${p.id}`)}
            onEdit={() => navigate(`/projects/${p.id}/edit`)}
            onDelete={() => setProjectToArchive(p)}
            deleteLabel="Archive"
            deleteIcon={<Archive className="mr-2 h-4 w-4" />}
          />
        );
      },
    },
  ];

  const table = useReactTable({ data: projects, columns, getCoreRowModel: getCoreRowModel(), manualPagination: true, pageCount });
  const hasFilters = Boolean(debouncedSearch || statusFilter || priorityFilter);
  const stats = statsQuery.data;
  const description = statsQuery.isLoading
    ? "Loading projects..."
    : stats
      ? `${stats.total} projects · ${stats.inFlight} in flight`
      : "Project counts unavailable";

  return (
    <AppLayout>
      <PageHeader title="Projects" description={description}>
        <Button size="sm" onClick={() => navigate("/projects/new")} className="h-9 gap-1.5 px-3 font-medium shadow-sm">
          <Plus className="h-4 w-4" /> New Project
        </Button>
      </PageHeader>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by project or client..."
              aria-label="Search projects"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-8"
            />
            {searchTerm && (
              <button type="button" aria-label="Clear search" onClick={() => setSearchTerm("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
            <option value="">All statuses</option>
            {SELECTABLE_PROJECT_STATUSES.map((s) => <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>)}
          </select>
          <select aria-label="Filter by priority" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className={selectClass}>
            <option value="">All priorities</option>
            {Object.entries(PROJECT_PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select aria-label="Sort projects" value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={selectClass}>
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {listQuery.isLoading ? (
          <div className="space-y-4 border rounded-md p-4 bg-card">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="h-10 w-10 bg-secondary/60 rounded-full animate-pulse" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-[250px] max-w-full bg-secondary/60 rounded animate-pulse" />
                  <div className="h-3 w-[200px] max-w-full bg-secondary/60 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : listQuery.isError ? (
          <div className="flex flex-col items-center justify-center gap-2 p-12 border border-dashed rounded-lg bg-white text-center">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="font-medium text-foreground">Failed to load projects.</p>
            <p className="max-w-sm text-sm text-muted-foreground">{extractApiErrorMessage(listQuery.error, "Please try again.").message}</p>
            <Button variant="outline" className="mt-2 gap-2" onClick={() => listQuery.refetch()}>
              <RefreshCcw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        ) : projects.length === 0 && !hasFilters ? (
          <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-lg bg-white">
            <p className="text-muted-foreground mb-4">No projects found.</p>
            <Button onClick={() => navigate("/projects/new")}>Create your first project to get started.</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={cn("surface overflow-x-auto transition-opacity", listQuery.isFetching && "opacity-70")}>
              <Table>
                <TableHeader className="bg-secondary/30">
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id} className="hover:bg-transparent">
                      {hg.headers.map((h) => (
                        <TableHead key={h.id} className="h-10 py-2 font-medium whitespace-nowrap">
                          {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id} className="hover:bg-secondary/40 transition-colors">
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="py-3">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                        No projects match the current search or filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Server-side pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-2">
              <div className="text-sm text-muted-foreground">
                {totalCount === 0 ? "0 projects" : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalCount)} of ${totalCount}`}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm font-medium">Page {page} of {pageCount}</div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPage(Math.max(1, page - 1))} disabled={!listQuery.data?.previous || listQuery.isFetching}>
                    <span className="sr-only">Go to previous page</span>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" className="h-8 w-8 p-0" onClick={() => setPage(page + 1)} disabled={!listQuery.data?.next || listQuery.isFetching}>
                    <span className="sr-only">Go to next page</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!projectToArchive}
        title={`Archive ${projectToArchive?.project_name ?? "project"}?`}
        description={
          <>
            <p>The project is not permanently deleted. Its status is set to <strong>Cancelled</strong>, and the API then hides it from project lists, the project page and the employee portal.</p>
            <p>Its team memberships and work items stay in the database. This app cannot restore archived projects.</p>
          </>
        }
        confirmLabel="Archive"
        pendingLabel="Archiving..."
        pending={archiveMutation.isPending}
        onConfirm={() =>
          projectToArchive &&
          archiveMutation.mutate(projectToArchive.id, { onSettled: () => setProjectToArchive(null) })
        }
        onCancel={() => setProjectToArchive(null)}
      />
    </AppLayout>
  );
}
