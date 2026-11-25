import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { ActionDropdown } from "@/components/shared/action-dropdown";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserPlus, Search, X, Users, UserCheck, Plane, UserMinus, Briefcase,
  TrendingUp, TrendingDown, Calendar, ChevronDown, Download, AlertCircle, RefreshCcw, UserX, Loader2
} from "lucide-react";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  countEmployees,
  getEmployees,
  listAllEmployees,
  listEmployees,
  terminateEmployee,
  type EmployeeBackend,
  type EmployeeListParams,
} from "@/api/employees.api";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { EmployeeLifecycleDialog } from "@/features/employees/components/employee-lifecycle-dialog";
import { downloadEmployeesCsv } from "@/features/employees/lib/export-employees";
import { toast } from "sonner";

/* ─── Helpers ────────────────────────────────────────── */
const STATUS_STYLES: Record<string, { dot: string; label: string; bg: string; text: string }> = {
  ACTIVE:      { dot: "bg-emerald-500", label: "Active",     bg: "bg-emerald-50",  text: "text-emerald-700" },
  ON_LEAVE:    { dot: "bg-amber-500",   label: "On Leave",   bg: "bg-amber-50",    text: "text-amber-700" },
  RESIGNED:    { dot: "bg-slate-400",   label: "Resigned",   bg: "bg-slate-100",   text: "text-slate-600" },
  TERMINATED:  { dot: "bg-red-500",     label: "Terminated", bg: "bg-red-50",      text: "text-red-700" },
};

const TYPE_STYLES: Record<string, { label: string, cls: string }> = {
  FULL_TIME:  { label: "Full Time",  cls: "bg-blue-50 text-blue-700 ring-blue-500/20" },
  PART_TIME:  { label: "Part Time",  cls: "bg-purple-50 text-purple-700 ring-purple-500/20" },
  INTERN:     { label: "Intern",     cls: "bg-orange-50 text-orange-700 ring-orange-500/20" },
  FREELANCER: { label: "Freelancer", cls: "bg-teal-50 text-teal-700 ring-teal-500/20" },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES["ACTIVE"];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", s.bg, s.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const config = TYPE_STYLES[type] || { label: type, cls: "bg-secondary text-foreground ring-border/50" };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset", config.cls)}>
      {config.label}
    </span>
  );
}

function formatDate(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function getInitials(name: string) {
  if (!name) return "U";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
}

// Debounce Hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
    return () => { clearTimeout(handler); };
  }, [value, delay]);
  return debouncedValue;
}

/* ─── Stat Card ──────────────────────────────────────── */
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  /** null = not available (loading or failed) — never shown as a fabricated 0. */
  count: number | null;
  loading?: boolean;
  trend?: number;
  iconBg: string;
}

function StatCard({ icon, label, count, loading, trend, iconBg }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border/70 bg-white px-5 py-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", iconBg)}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
        <div className="flex items-baseline gap-2 mt-0.5">
          {loading ? (
            <Skeleton className="h-8 w-10 rounded-md" />
          ) : (
            <span className="text-2xl font-bold text-foreground" title={count === null ? "Unavailable — could not load from the server" : undefined}>
              {count === null ? "—" : count}
            </span>
          )}
          {trend !== undefined && (
            <span className={cn("flex items-center text-[11px] font-semibold", trend >= 0 ? "text-emerald-600" : "text-red-500")}>
              {trend >= 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Filter Select ──────────────────────────────────── */
function FilterSelect({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-10 appearance-none rounded-xl border border-border/70 bg-white pl-3 pr-8 text-[13px] font-medium text-foreground shadow-sm outline-none transition-colors hover:border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/10",
          value === "" ? "text-muted-foreground" : ""
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

/* ─── Backend mapping ────────────────────────────────── */
/** Backend PAGE_SIZE (REST_FRAMEWORK settings) — the API does not accept a page_size param. */
const PAGE_SIZE = 10;

/** EmployeeViewSet.ordering_fields = employee_id, joining_date, created_at */
const SORT_OPTIONS = [
  { value: "newest", label: "Newest", ordering: "-joining_date" },
  { value: "oldest", label: "Oldest", ordering: "joining_date" },
  { value: "employeeId", label: "Employee ID", ordering: "employee_id" },
  { value: "recentlyAdded", label: "Recently Added", ordering: "-created_at" },
] as const;

/* ─── Main Page ──────────────────────────────────────── */
export function EmployeesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  /* Filters (all applied server-side) */
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput.trim(), 300);

  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [pendingTerminate, setPendingTerminate] = useState<EmployeeBackend | null>(null);

  // Page is tied to the active filter set: any filter change returns to page 1 in the same render.
  const filterKey = JSON.stringify([debouncedSearch, deptFilter, statusFilter, typeFilter, sortBy]);
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (update: (p: number) => number) =>
    setPageState({ key: filterKey, page: update(page) });

  const params: EmployeeListParams = {
    page,
    search: debouncedSearch || undefined,
    department: deptFilter || undefined,
    status: statusFilter || undefined,
    employment_type: typeFilter || undefined,
    ordering: SORT_OPTIONS.find((o) => o.value === sortBy)?.ordering,
  };

  /* Queries and Mutations */
  const listQuery = useQuery({
    queryKey: ["employees", "list", params],
    queryFn: ({ signal }) => listEmployees(params, signal),
    placeholderData: keepPreviousData,
  });
  const employees = listQuery.data?.results ?? [];
  const totalCount = listQuery.data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // If the current page disappears (e.g. records changed and DRF answers 404 "Invalid page"), step back.
  const listErrorStatus = (listQuery.error as { status?: number | null } | null)?.status;
  useEffect(() => {
    if (listErrorStatus === 404 && page > 1) {
      setPageState({ key: filterKey, page: page - 1 });
    }
  }, [listErrorStatus, page, filterKey]);

  /* Stats — exact totals from the paginated `count` of filtered requests */
  const statsQuery = useQuery({
    queryKey: ["employees", "stats"],
    queryFn: async ({ signal }) => {
      const [total, active, onLeave, resigned, freelancers] = await Promise.all([
        countEmployees({}, signal),
        countEmployees({ status: "ACTIVE" }, signal),
        countEmployees({ status: "ON_LEAVE" }, signal),
        countEmployees({ status: "RESIGNED" }, signal),
        countEmployees({ employment_type: "FREELANCER" }, signal),
      ]);
      return { total, active, onLeave, resigned, freelancers };
    },
  });
  const stats = statsQuery.data;
  const statsLoading = statsQuery.isLoading;

  /* Department options — distinct values from all employee records */
  const allEmployeesQuery = useQuery({
    queryKey: ["employees"],
    queryFn: ({ signal }) => getEmployees(undefined, signal),
  });
  const departments = useMemo(() => {
    const depts = [...new Set((allEmployeesQuery.data ?? []).map((e) => e.department))].filter(Boolean).sort();
    return depts.map((d) => ({ value: d, label: d }));
  }, [allEmployeesQuery.data]);

  const terminateMutation = useMutation({
    mutationFn: (employee: EmployeeBackend) => terminateEmployee(employee.id),
    onSuccess: (res, employee) => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["employee", String(employee.id)] });
      toast.success(res?.message || "Employee terminated successfully.");
    },
    onError: (err) => {
      toast.error(extractApiErrorMessage(err, "Failed to terminate employee.").message);
    },
    onSettled: () => setPendingTerminate(null),
  });

  /* Export — no export endpoint exists, so the CSV is built from GET /api/employees/ (all pages, current filters). */
  const [isExporting, setIsExporting] = useState(false);
  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const { page: _page, ...filters } = params;
      const rows = await listAllEmployees(filters);
      if (rows.length === 0) {
        toast.info("No employees to export for the current filters.");
        return;
      }
      downloadEmployeesCsv(rows);
      toast.success(`Exported ${rows.length} employee${rows.length === 1 ? "" : "s"}.`);
    } catch (err) {
      toast.error(extractApiErrorMessage(err, "Export failed.").message);
    } finally {
      setIsExporting(false);
    }
  };

  /* Table columns */
  const columns: ColumnDef<EmployeeBackend>[] = [
    {
      id: "employee",
      header: "Employee",
      cell: ({ row }) => {
        const e = row.original;
        const name = e.name || "Unknown";
        return (
          <div className="flex items-center gap-3 py-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[13px] font-bold text-white shadow-sm ring-2 ring-white">
              {getInitials(name)}
            </div>
            <div>
              <Link to={`/employees/${e.id}`} className="text-[13px] font-semibold text-foreground hover:text-primary transition-colors">
                {name}
              </Link>
              <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{e.employee_id}</div>
              <div className="text-[11px] text-muted-foreground">{e.email}</div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "department",
      header: "Department",
      cell: ({ row }) => (
        <span className="text-[13px] font-medium text-foreground">{row.original.department}</span>
      ),
    },
    {
      accessorKey: "designation",
      header: "Designation",
      cell: ({ row }) => (
        <span className="text-[13px] text-muted-foreground">{row.original.designation}</span>
      ),
    },
    {
      accessorKey: "employment_type",
      header: "Type",
      cell: ({ row }) => <TypeBadge type={row.original.employment_type} />,
    },
    {
      accessorKey: "joining_date",
      header: "Joining Date",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          {formatDate(row.original.joining_date)}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusPill status={row.original.status} />,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const e = row.original;
        return (
          <ActionDropdown
            onView={() => navigate(`/employees/${e.id}`)}
            onEdit={() => navigate(`/employees/${e.id}/edit`)}
            // Backend DELETE is a soft delete (terminate). Hidden once already terminated.
            onDelete={e.status !== "TERMINATED" ? () => setPendingTerminate(e) : undefined}
            deleteLabel="Terminate"
            deleteIcon={<UserX className="mr-2 h-4 w-4" />}
          />
        );
      },
    },
  ];

  const table = useReactTable({
    data: employees,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
  });

  const hasFilters = Boolean(debouncedSearch || deptFilter || statusFilter || typeFilter);
  const listErrorMessage = listQuery.isError
    ? extractApiErrorMessage(listQuery.error, "Unable to load employees.").message
    : "";
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Employees</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage all company employees.</p>
        </div>
        <Button onClick={() => navigate("/employees/new")} className="h-10 gap-2 px-4 shadow-sm">
          <UserPlus className="h-4 w-4" />
          Add Employee
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        <StatCard icon={<Users className="h-5 w-5 text-blue-600" />}      label="Total Employees"  count={stats?.total ?? null} loading={statsLoading}      iconBg="bg-blue-100" />
        <StatCard icon={<UserCheck className="h-5 w-5 text-emerald-600" />} label="Active"          count={stats?.active ?? null} loading={statsLoading}     iconBg="bg-emerald-100" />
        <StatCard icon={<Plane className="h-5 w-5 text-amber-600" />}      label="On Leave"        count={stats?.onLeave ?? null} loading={statsLoading}    iconBg="bg-amber-100" />
        <StatCard icon={<UserMinus className="h-5 w-5 text-slate-500" />}  label="Resigned"        count={stats?.resigned ?? null} loading={statsLoading}   iconBg="bg-slate-100" />
        <StatCard icon={<Briefcase className="h-5 w-5 text-teal-600" />}   label="Freelancers"     count={stats?.freelancers ?? null} loading={statsLoading} iconBg="bg-teal-100" />
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6 rounded-2xl border border-border/70 bg-white px-5 py-3.5 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, ID, email..."
            className="h-10 w-full rounded-xl border border-border/70 bg-transparent pl-9 pr-8 text-[13px] text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
          />
          {searchInput && (
            <button type="button" aria-label="Clear search" onClick={() => setSearchInput("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="h-5 w-px bg-border hidden sm:block" />

        <FilterSelect value={deptFilter}   onChange={setDeptFilter}   placeholder="Department"       options={departments} />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} placeholder="Status"           options={[
          { value: "ACTIVE", label: "● Active" },
          { value: "ON_LEAVE", label: "● On Leave" },
          { value: "RESIGNED", label: "● Resigned" },
          { value: "TERMINATED", label: "● Terminated" },
        ]} />
        <FilterSelect value={typeFilter}   onChange={setTypeFilter}   placeholder="Employment Type"  options={[
          { value: "FULL_TIME", label: "Full Time" },
          { value: "PART_TIME", label: "Part Time" },
          { value: "INTERN", label: "Intern" },
          { value: "FREELANCER", label: "Freelancer" },
        ]} />
        <FilterSelect value={sortBy}       onChange={(v) => setSortBy(v || "newest")} placeholder="Sort" options={SORT_OPTIONS.map(({ value, label }) => ({ value, label }))} />

        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="h-10 gap-2 rounded-xl text-[13px]"
            onClick={() => void handleExport()}
            disabled={isExporting || listQuery.isError}
            title="Download the employees matching the current filters as CSV"
          >
            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {isExporting ? "Exporting..." : "Export"}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
        <div className={cn("relative overflow-x-auto transition-opacity", listQuery.isFetching && !listQuery.isLoading && "opacity-70")}>
          <table className="w-full">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-border/60 bg-slate-50/80">
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="h-11 px-5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {listQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/40">
                    <td className="px-5 py-3"><Skeleton className="h-10 w-[200px] rounded-lg" /></td>
                    <td className="px-5 py-3"><Skeleton className="h-5 w-[100px] rounded-md" /></td>
                    <td className="px-5 py-3"><Skeleton className="h-5 w-[120px] rounded-md" /></td>
                    <td className="px-5 py-3"><Skeleton className="h-6 w-[80px] rounded-full" /></td>
                    <td className="px-5 py-3"><Skeleton className="h-5 w-[90px] rounded-md" /></td>
                    <td className="px-5 py-3"><Skeleton className="h-6 w-[70px] rounded-full" /></td>
                    <td className="px-5 py-3"><Skeleton className="h-8 w-8 rounded-md" /></td>
                  </tr>
                ))
              ) : listQuery.isError ? (
                <tr>
                  <td colSpan={columns.length} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="h-8 w-8 text-red-400" />
                      <p className="text-sm font-medium text-foreground">Unable to load employees</p>
                      <p className="text-xs text-muted-foreground/80 max-w-sm">{listErrorMessage}</p>
                      <Button onClick={() => listQuery.refetch()} variant="outline" size="sm" className="mt-2 h-8 text-xs">
                        <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Retry
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row, i) => (
                  <tr key={row.id} className={cn("border-b border-border/40 transition-colors hover:bg-slate-50/60", i === table.getRowModel().rows.length - 1 && "border-b-0")}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-5 py-2">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="h-8 w-8 text-muted-foreground/40" />
                      <p className="text-sm font-medium text-foreground">No Employees Found</p>
                      {hasFilters ? (
                        <p className="text-xs text-muted-foreground/70">No employees match the current search or filters.</p>
                      ) : (
                        <>
                          <p className="text-xs text-muted-foreground/70">Add your first employee.</p>
                          <Button onClick={() => navigate("/employees/new")} variant="outline" size="sm" className="mt-2 h-8 text-xs">
                            <UserPlus className="mr-2 h-3.5 w-3.5" /> Add Employee
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination (server-side) */}
        {!listQuery.isLoading && !listQuery.isError && pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-border/60 px-5 py-3">
            <p className="text-xs text-muted-foreground">
              Showing {rangeStart}–{rangeEnd} of {totalCount}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!listQuery.data?.previous || listQuery.isFetching} className="h-8 px-3 text-xs rounded-lg">Previous</Button>
              <span className="text-xs text-muted-foreground">Page {page} of {pageCount}</span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={!listQuery.data?.next || listQuery.isFetching} className="h-8 px-3 text-xs rounded-lg">Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* Terminate confirmation (DELETE is a soft termination on the backend) */}
      <EmployeeLifecycleDialog
        action="terminate"
        employeeName={pendingTerminate?.name}
        open={Boolean(pendingTerminate)}
        pending={terminateMutation.isPending}
        onConfirm={() => pendingTerminate && terminateMutation.mutate(pendingTerminate)}
        onCancel={() => setPendingTerminate(null)}
      />
    </AppLayout>
  );
}
