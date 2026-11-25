import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Building2, BadgeCheck, CircleOff, UserPlus, FolderKanban,
  IndianRupee, Search, X, Download, Globe, Mail, Phone,
  Calendar, ChevronDown, Eye, Pencil, Ban, MoreVertical,
  TrendingUp, AlertCircle, RefreshCcw, Loader2,
} from "lucide-react";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  countClients,
  countClientsCreatedSince,
  deactivateClient,
  listAllClients,
  listClients,
  type ClientBackend,
  type ClientListParams,
} from "@/api/clients.api";
import { countProjects } from "@/api/projects.api";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { downloadCsv, toCsv } from "@/lib/csv";
import { toast } from "sonner";

/* ─── Helpers ────────────────────────────────────────── */
const LOGO_COLORS = [
  "from-blue-500 to-blue-700",
  "from-violet-500 to-purple-700",
  "from-emerald-500 to-teal-700",
  "from-orange-500 to-red-600",
  "from-pink-500 to-rose-600",
  "from-cyan-500 to-blue-600"
];

function getInitials(name?: string) {
  if (!name) return "U";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
}

function getAvatarColor(name: string) {
  if (!name) return LOGO_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % LOGO_COLORS.length;
  return LOGO_COLORS[index];
}

function CompanyAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const gradient = getAvatarColor(name);
  const initials = getInitials(name);
  const dim = size === "sm" ? "h-9 w-9 text-[11px]" : size === "lg" ? "h-16 w-16 text-xl" : "h-11 w-11 text-[13px]";
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br font-bold text-white shadow-sm", dim, gradient)}>
      {initials}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const active = status?.toUpperCase() === "ACTIVE";
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
      active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-emerald-500" : "bg-slate-400")} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
}

function cleanUrl(url?: string) {
  if (!url) return "—";
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/* ─── Stat Card ──────────────────────────────────────── */
function StatCard({ icon, label, value, iconBg, trend, sub, loading, title }: {
  icon: React.ReactNode; label: string; value: string | number | null;
  iconBg: string; trend?: number; sub?: string; loading?: boolean; title?: string;
}) {
  return (
    <div title={title} className="flex items-center gap-4 rounded-2xl border border-border/70 bg-white px-5 py-4 shadow-sm hover:shadow-md transition-all duration-150">
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", iconBg)}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
        <div className="flex items-baseline gap-2 mt-0.5">
          {loading ? (
            <span className="h-8 w-10 rounded-md bg-secondary/60 animate-pulse" />
          ) : (
            <span className="text-2xl font-bold text-foreground">{value === null ? "—" : value}</span>
          )}
          {trend !== undefined && (
            <span className={cn("flex items-center text-[11px] font-semibold", trend >= 0 ? "text-emerald-600" : "text-red-500")}>
              <TrendingUp className="h-3 w-3 mr-0.5" />
              {Math.abs(trend)}%
            </span>
          )}
        </div>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Filter Select ──────────────────────────────────── */
function FilterSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 appearance-none rounded-xl border border-border/70 bg-white pl-3 pr-8 text-[13px] font-medium text-foreground shadow-sm outline-none transition-colors hover:border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

/* ─── Backend mapping ────────────────────────────────── */
/** REST_FRAMEWORK PAGE_SIZE — the API does not accept page_size. */
const PAGE_SIZE = 10;

/** ClientViewSet.ordering_fields = company_name, created_at */
const SORT_OPTIONS = [
  { value: "newest", label: "Recently Added", ordering: "-created_at" },
  { value: "oldest", label: "Oldest", ordering: "created_at" },
  { value: "az", label: "Company A–Z", ordering: "company_name" },
  { value: "za", label: "Company Z–A", ordering: "-company_name" },
] as const;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function startOfMonth(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

const EXPORT_COLUMNS = [
  { header: "Company", value: (c: ClientBackend) => c.company_name },
  { header: "Contact Person", value: (c: ClientBackend) => c.contact_person },
  { header: "Email", value: (c: ClientBackend) => c.email },
  { header: "Phone", value: (c: ClientBackend) => c.phone },
  { header: "Website", value: (c: ClientBackend) => c.website },
  { header: "Status", value: (c: ClientBackend) => c.status },
  { header: "Address", value: (c: ClientBackend) => c.address },
  { header: "Created By", value: (c: ClientBackend) => c.created_by_name },
  { header: "Created At", value: (c: ClientBackend) => c.created_at },
];

/* ─── Main Page ──────────────────────────────────────── */
export function ClientsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [clientToDelete, setClientToDelete] = useState<ClientBackend | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Any filter change resets to page 1 in the same render.
  const filterKey = JSON.stringify([debouncedSearch, statusFilter, sortBy]);
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (p: number) => setPageState({ key: filterKey, page: p });

  const params: ClientListParams = {
    page,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    ordering: SORT_OPTIONS.find((o) => o.value === sortBy)?.ordering,
  };

  const listQuery = useQuery({
    queryKey: ["clients", "list", params],
    queryFn: ({ signal }) => listClients(params, signal),
    placeholderData: keepPreviousData,
  });
  const clients = listQuery.data?.results ?? [];
  const totalCount = listQuery.data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // DRF answers 404 "Invalid page" if the current page disappeared (e.g. after a deactivation).
  const listErrorStatus = (listQuery.error as { status?: number | null } | null)?.status;
  useEffect(() => {
    if (listErrorStatus === 404 && page > 1) setPageState({ key: filterKey, page: page - 1 });
  }, [listErrorStatus, page, filterKey]);

  /* Stats — exact counts from server-side filters; nothing derived from the loaded page. */
  const statsQuery = useQuery({
    queryKey: ["clients", "stats"],
    queryFn: async ({ signal }) => {
      const [total, active, newThisMonth, projectsRunning] = await Promise.all([
        countClients({}, signal),
        countClients({ status: "ACTIVE" }, signal),
        countClientsCreatedSince(startOfMonth(), signal),
        countProjects({ status: "IN_PROGRESS" }, signal),
      ]);
      return { total, active, newThisMonth, projectsRunning };
    },
  });
  const stats = statsQuery.data;

  // DELETE /api/clients/{id}/ is a soft delete: status → INACTIVE, hidden from every API response.
  const deactivateMutation = useMutation({
    mutationFn: (c: ClientBackend) => deactivateClient(c.id),
    onSuccess: (res, c) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.removeQueries({ queryKey: ["client", String(c.id)] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(res?.message || "Client deactivated successfully.");
      setClientToDelete(null);
    },
    onError: (err) => {
      toast.error(extractApiErrorMessage(err, "Failed to deactivate client.").message);
      setClientToDelete(null);
    },
  });

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const { page: _p, ...filters } = params;
      const rows = await listAllClients(filters);
      if (!rows.length) {
        toast.info("No clients to export for the current filters.");
        return;
      }
      downloadCsv("clients", toCsv(EXPORT_COLUMNS, rows));
      toast.success(`Exported ${rows.length} client${rows.length === 1 ? "" : "s"}.`);
    } catch (err) {
      toast.error(extractApiErrorMessage(err, "Export failed.").message);
    } finally {
      setIsExporting(false);
    }
  };

  /* Columns */
  const columns: ColumnDef<ClientBackend>[] = [
    {
      accessorKey: "company_name",
      header: "Company",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex items-center gap-3 py-1">
            <CompanyAvatar name={c.company_name} size="sm" />
            <div>
              <Link to={`/clients/${c.id}`} className="text-[13px] font-semibold text-foreground hover:text-primary transition-colors">
                {c.company_name}
              </Link>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "contact_person",
      header: "Contact Person",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div>
            <p className="text-[13px] font-medium text-foreground">{c.contact_person}</p>
            {c.email ? (
              <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
                <Mail className="h-3 w-3" />
                {c.email}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => {
        const p = row.original.phone;
        if (!p) return <span className="text-[13px] text-muted-foreground">—</span>;
        return (
          <a href={`tel:${p}`} className="flex items-center gap-1.5 text-[13px] text-foreground hover:text-primary transition-colors">
            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            {p}
          </a>
        );
      }
    },
    {
      accessorKey: "website",
      header: "Website",
      cell: ({ row }) => {
        const url = row.original.website;
        if (!url) return <span className="text-[13px] text-muted-foreground">—</span>;
        return (
          <a href={url.startsWith("http") ? url : `https://${url}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[13px] text-primary hover:underline"
          >
            <Globe className="h-3.5 w-3.5" />
            {cleanUrl(url)}
          </a>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusPill status={row.original.status} />,
    },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground whitespace-nowrap">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          {formatDate(row.original.created_at)}
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:bg-secondary">
                <span className="sr-only">Open actions for {c.company_name}</span>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => navigate(`/clients/${c.id}`)} className="gap-2 cursor-pointer text-[13px]">
                <Eye className="h-3.5 w-3.5 text-muted-foreground" /> View Client
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/clients/${c.id}/edit`)} className="gap-2 cursor-pointer text-[13px]">
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Edit Client
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setClientToDelete(c)} className="gap-2 cursor-pointer text-[13px] text-red-600 focus:text-red-600 focus:bg-red-50">
                <Ban className="h-3.5 w-3.5" /> Deactivate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: clients,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
  });

  const hasFilters = Boolean(debouncedSearch || statusFilter);
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage all company clients and business relationships.</p>
        </div>
        <Button onClick={() => navigate("/clients/new")} className="h-10 gap-2 px-4 shadow-sm">
          <Building2 className="h-4 w-4" />
          Add Client
        </Button>
      </div>

      {/* Stats — "—" means not available, never a fabricated number */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <StatCard icon={<Building2 className="h-5 w-5 text-blue-600" />} label="Total Clients" value={stats?.total ?? null} loading={statsQuery.isLoading} iconBg="bg-blue-100"
          sub="Excludes inactive" title="The API hides inactive clients, so this counts visible (active) clients." />
        <StatCard icon={<BadgeCheck className="h-5 w-5 text-emerald-600" />} label="Active Clients" value={stats?.active ?? null} loading={statsQuery.isLoading} iconBg="bg-emerald-100" />
        <StatCard icon={<CircleOff className="h-5 w-5 text-slate-500" />} label="Inactive Clients" value={null} iconBg="bg-slate-100"
          sub="Not available" title="The clients API excludes inactive clients from every response, so they cannot be counted." />
        <StatCard icon={<UserPlus className="h-5 w-5 text-purple-600" />} label="New This Month" value={stats?.newThisMonth ?? null} loading={statsQuery.isLoading} iconBg="bg-purple-100" />
        <StatCard icon={<FolderKanban className="h-5 w-5 text-orange-600" />} label="Projects Running" value={stats?.projectsRunning ?? null} loading={statsQuery.isLoading} iconBg="bg-orange-100"
          sub="In progress" />
        <StatCard icon={<IndianRupee className="h-5 w-5 text-teal-600" />} label="Total Revenue" value={null} iconBg="bg-teal-100" sub="Coming Soon"
          title="Revenue comes from the Finance module, which is not connected yet." />
      </div>
      {statsQuery.isError && (
        <p className="-mt-5 mb-6 flex items-center gap-1.5 text-[12px] text-red-600">
          <AlertCircle className="h-3.5 w-3.5" /> Summary counts could not be loaded: {extractApiErrorMessage(statsQuery.error).message}
        </p>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6 rounded-2xl border border-border/70 bg-white px-5 py-3.5 shadow-sm">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company, contact, email..."
            aria-label="Search clients"
            className="h-10 w-full rounded-xl border border-border/70 bg-transparent pl-9 pr-8 text-[13px] text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
          />
          {search && (
            <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="h-5 w-px bg-border hidden sm:block" />

        <FilterSelect
          value={statusFilter} onChange={setStatusFilter} placeholder="All Status"
          options={[{ value: "ACTIVE", label: "● Active" }, { value: "INACTIVE", label: "● Inactive" }]}
        />
        <FilterSelect
          value={sortBy} onChange={(v) => setSortBy(v || "newest")} placeholder="Sort"
          options={SORT_OPTIONS.map(({ value, label }) => ({ value, label }))}
        />

        <div className="ml-auto">
          <Button variant="outline" size="sm" className="h-10 gap-2 rounded-xl text-[13px]" onClick={() => void handleExport()} disabled={isExporting || listQuery.isError}>
            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {isExporting ? "Exporting..." : "Export"}
          </Button>
        </div>
      </div>

      {/* Table */}
      {listQuery.isLoading ? (
        <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden p-6">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-secondary/60 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 rounded bg-secondary/60 animate-pulse" />
                  <div className="h-3 w-1/4 rounded bg-secondary/60 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : listQuery.isError ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white py-20 text-center shadow-sm">
          <AlertCircle className="h-8 w-8 text-red-400 mb-3" />
          <h3 className="text-base font-semibold text-foreground">Unable to load clients</h3>
          <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{extractApiErrorMessage(listQuery.error, "Please try again.").message}</p>
          <Button onClick={() => listQuery.refetch()} variant="outline" className="mt-4 gap-2">
            <RefreshCcw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : clients.length === 0 && !hasFilters ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white py-20 text-center shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-4">
            <Building2 className="h-8 w-8" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No Clients Found</h3>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-xs">Start by creating your first client.</p>
          <Button onClick={() => navigate("/clients/new")} className="mt-6 gap-2">
            <Building2 className="h-4 w-4" /> Add Client
          </Button>
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
                    <tr
                      key={row.id}
                      className={cn(
                        "group border-b border-border/40 transition-all duration-150 hover:bg-slate-50/60 hover:border-l-2 hover:border-l-primary/40",
                        i === table.getRowModel().rows.length - 1 && "border-b-0"
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-5 py-2">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length} className="h-32 text-center">
                      <p className="text-sm text-muted-foreground">
                        {statusFilter === "INACTIVE"
                          ? "Inactive clients are hidden by the backend API and cannot be listed."
                          : "No clients match your search."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {pageCount > 1 && (
            <div className="flex items-center justify-between border-t border-border/60 px-5 py-3">
              <p className="text-xs text-muted-foreground">
                Showing {rangeStart}–{rangeEnd} of {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={!listQuery.data?.previous || listQuery.isFetching} className="h-8 px-3 text-xs rounded-lg">Previous</Button>
                <span className="text-xs text-muted-foreground">Page {page} of {pageCount}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={!listQuery.data?.next || listQuery.isFetching} className="h-8 px-3 text-xs rounded-lg">Next</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Deactivate confirmation — DELETE is a soft delete on the backend */}
      <ConfirmDialog
        open={!!clientToDelete}
        title={`Deactivate ${clientToDelete?.company_name ?? "client"}?`}
        description={
          <>
            <p>The client is not permanently deleted. Its status is set to <strong>Inactive</strong>, and the API then hides it everywhere: the client list, its detail page and the project client picker.</p>
            <p>Existing projects for this client are kept, but they can no longer be reassigned to it. This app cannot reactivate the client afterwards.</p>
          </>
        }
        confirmLabel="Deactivate"
        pendingLabel="Deactivating..."
        pending={deactivateMutation.isPending}
        onConfirm={() => clientToDelete && deactivateMutation.mutate(clientToDelete)}
        onCancel={() => setClientToDelete(null)}
      />
    </AppLayout>
  );
}
