import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import {
  ArrowLeft, Globe, Mail, Phone, MapPin, Building2, Pencil, Ban,
  FolderKanban, CalendarDays, History, NotebookPen, ExternalLink,
  AlertTriangle, BadgeCheck, User, RefreshCcw, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getClient, deactivateClient } from "@/api/clients.api";
import { getClientProjects, labelFor, PROJECT_STATUS_LABELS } from "@/api/projects.api";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataSourceNotice } from "@/components/shared/data-source-notice";
import { toast } from "sonner";

/* ─── Helpers ─────────────────────────────────────────── */
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
  const dim = size === "sm" ? "h-9 w-9 text-[11px]" : size === "lg" ? "h-20 w-20 text-2xl" : "h-14 w-14 text-[15px]";
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br font-bold text-white shadow-sm", dim, gradient)}>
      {initials}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const active = status?.toUpperCase() === "ACTIVE";
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold",
      active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-emerald-500" : "bg-slate-400")} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }); }
  catch { return iso; }
}

function InfoRow({ icon, label, value, href }: { icon: React.ReactNode; label: string; value?: string | null; href?: string }) {
  return (
    <div className="flex items-start gap-3 py-3.5 border-b border-border/40 last:border-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/60 text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{label}</p>
        {href && value && value !== "—" ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="mt-0.5 flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
            {value} <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <p className="mt-0.5 text-[13px] font-medium text-foreground">{value || "—"}</p>
        )}
      </div>
    </div>
  );
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border/50">
        <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
      </div>
      <div className="px-5">{children}</div>
    </div>
  );
}

/* ─── Tabs ───────────────────────────────────────────── */
const TABS = ["Overview", "Projects", "Meetings", "Notes", "Activity"] as const;
type Tab = typeof TABS[number];

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  Overview:  <BadgeCheck className="h-3.5 w-3.5" />,
  Projects:  <FolderKanban className="h-3.5 w-3.5" />,
  Meetings:  <CalendarDays className="h-3.5 w-3.5" />,
  Notes:     <NotebookPen className="h-3.5 w-3.5" />,
  Activity:  <History className="h-3.5 w-3.5" />,
};

/* ─── Main ───────────────────────────────────────────── */
export default function ClientDetailPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: client, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['client', String(clientId)],
    queryFn: ({ signal }) => getClient(clientId as string, signal),
    enabled: !!clientId
  });

  // No ?client= filter exists: search by company name, then keep exact client-id matches.
  const projectsQuery = useQuery({
    queryKey: ['client', String(clientId), 'projects', client?.company_name],
    queryFn: ({ signal }) => getClientProjects(client!, signal),
    enabled: Boolean(client),
  });
  const clientProjects = projectsQuery.data ?? [];

  // DELETE is a soft delete (status INACTIVE) — the client then 404s everywhere.
  const deactivateMutation = useMutation({
    mutationFn: (id: string | number) => deactivateClient(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.removeQueries({ queryKey: ['client', String(clientId)] });
      toast.success(res?.message || "Client deactivated successfully.");
      navigate("/clients");
    },
    onError: (err) => {
      setConfirmDelete(false);
      toast.error(extractApiErrorMessage(err, "Failed to deactivate client.").message);
    },
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-4 w-24 rounded bg-secondary/60" />
          <div className="h-48 rounded-2xl bg-secondary/60" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64 rounded-2xl bg-secondary/60" />
            <div className="h-64 rounded-2xl bg-secondary/60" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (isError || !client) {
    const notFound = (error as { status?: number | null } | null)?.status === 404 || !isError;
    return (
      <AppLayout>
        <div className="flex h-[400px] flex-col items-center justify-center gap-3 text-center">
          <AlertTriangle className="h-10 w-10 text-muted-foreground/40" />
          <h2 className="text-[18px] font-semibold text-foreground">{notFound ? "Client not found" : "Unable to load client"}</h2>
          <p className="max-w-sm text-[13px] text-muted-foreground">
            {notFound
              ? "It may not exist, or it was deactivated (the API hides inactive clients)."
              : extractApiErrorMessage(error, "Please try again.").message}
          </p>
          {!notFound && (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Retry
            </Button>
          )}
          <Link to="/clients" className="text-sm text-primary hover:underline">Return to Clients</Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Back */}
      <Link to="/clients" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Clients
      </Link>

      {/* Hero Card */}
      <div className="mb-6 rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
        {/* Cover */}
        <div className="h-24 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-500" />

        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10">
            {/* Logo + Info */}
            <div className="flex items-end gap-4">
              <div className="ring-4 ring-white rounded-2xl">
                <CompanyAvatar name={client.company_name} size="lg" />
              </div>
              <div className="mb-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl font-bold text-foreground">{client.company_name}</h1>
                  <StatusPill status={client.status} />
                </div>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {client.website ? (
                    <a href={client.website.startsWith("http") ? client.website : `https://${client.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                      {client.website?.replace(/^https?:\/\//, "")} <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : "—"}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mb-1">
              <Button variant="outline" size="sm" className="h-9 gap-2 rounded-xl text-[13px]" onClick={() => navigate(`/clients/${client.id}/edit`)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button variant="outline" size="sm" className="h-9 gap-2 rounded-xl text-[13px] text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300" onClick={() => setConfirmDelete(true)} disabled={deactivateMutation.isPending}>
                {deactivateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />} Deactivate
              </Button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="mt-5 flex flex-wrap gap-6">
            {[
              { label: "Projects", value: projectsQuery.isLoading ? "…" : projectsQuery.isError ? "—" : clientProjects.length },
              { label: "Status", value: client.status?.toUpperCase() === "ACTIVE" ? "Active" : "Inactive" },
              { label: "Client Since", value: formatDate(client.created_at) },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{stat.label}</p>
                <p className="mt-0.5 text-[13px] font-semibold text-foreground">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 flex gap-1 rounded-xl border border-border/70 bg-white p-1 shadow-sm w-fit flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium transition-all",
              activeTab === tab
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            )}
          >
            {TAB_ICONS[tab]}
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "Overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <DetailCard title="Basic Information">
            <InfoRow icon={<Building2 className="h-4 w-4" />} label="Company Name"    value={client.company_name} />
            <InfoRow icon={<User className="h-4 w-4" />}      label="Contact Person"  value={client.contact_person} />
            <InfoRow icon={<BadgeCheck className="h-4 w-4" />} label="Status"         value={client.status?.toUpperCase() === "ACTIVE" ? "Active" : "Inactive"} />
            <InfoRow icon={<CalendarDays className="h-4 w-4" />} label="Created" value={formatDate(client.created_at)} />
            <InfoRow icon={<History className="h-4 w-4" />} label="Last Updated" value={formatDate(client.updated_at)} />
          </DetailCard>

          <DetailCard title="Contact Details">
            <InfoRow icon={<Mail className="h-4 w-4" />}  label="Email"    value={client.email}   href={client.email ? `mailto:${client.email}` : undefined} />
            <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone"    value={client.phone}   href={client.phone ? `tel:${client.phone}` : undefined} />
            <InfoRow icon={<Globe className="h-4 w-4" />} label="Website"  value={client.website?.replace(/^https?:\/\//, "")} href={client.website ? (client.website.startsWith("http") ? client.website : `https://${client.website}`) : undefined} />
            <InfoRow icon={<User className="h-4 w-4" />} label="Created By" value={client.created_by_name} />
          </DetailCard>

          {client.address && (
            <DetailCard title="Address">
              <div className="py-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/60 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <p className="text-[13px] font-medium text-foreground leading-relaxed">{client.address}</p>
                </div>
              </div>
            </DetailCard>
          )}

          {client.notes && (
            <DetailCard title="Internal Notes">
              <div className="py-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <NotebookPen className="h-4 w-4" />
                  </div>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">{client.notes}</p>
                </div>
              </div>
            </DetailCard>
          )}
        </div>
      )}

      {activeTab === "Projects" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {projectsQuery.isLoading ? "Loading projects…" : `${clientProjects.length} project${clientProjects.length !== 1 ? "s" : ""}`}
              <span className="ml-1 text-muted-foreground/70">(archived projects are not shown)</span>
            </p>
            <Button size="sm" onClick={() => navigate("/projects/new")} className="h-9 gap-1.5 rounded-xl text-[13px]">
              <FolderKanban className="h-3.5 w-3.5" /> New Project
            </Button>
          </div>
          {projectsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-[72px] rounded-2xl bg-secondary/60 animate-pulse" />)}
            </div>
          ) : projectsQuery.isError ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-white text-center">
              <AlertTriangle className="h-7 w-7 text-red-400" />
              <p className="text-sm font-medium text-foreground">Unable to load projects</p>
              <p className="text-xs text-muted-foreground">{extractApiErrorMessage(projectsQuery.error).message}</p>
              <Button variant="outline" size="sm" className="mt-1 h-8 text-xs" onClick={() => void projectsQuery.refetch()}>
                <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          ) : clientProjects.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white text-center">
              <FolderKanban className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">No projects yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Create the first project for {client.company_name}.</p>
            </div>
          ) : (
            clientProjects.map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`} className="flex items-center justify-between rounded-2xl border border-border/70 bg-white px-5 py-4 shadow-sm hover:shadow-md transition-shadow group">
                <div>
                  <p className="text-[14px] font-semibold text-foreground group-hover:text-primary transition-colors">{p.project_name}</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">Due: {p.deadline}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden sm:block w-24">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-semibold">{p.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${p.progress}%` }} />
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1">{labelFor(PROJECT_STATUS_LABELS, p.status)}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {activeTab === "Notes" && (
        <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-border/50 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold">Internal Notes</h3>
            <span className="text-[11px] text-amber-600 bg-amber-50 rounded-full px-2.5 py-1 font-medium">Not visible to client</span>
          </div>
          <div className="px-6 py-6">
            {client.notes ? (
              <p className="text-[14px] text-foreground leading-relaxed whitespace-pre-wrap">{client.notes}</p>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <NotebookPen className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">No notes yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {(activeTab === "Meetings" || activeTab === "Activity") && (
        // Previously filled from the local demo store (not linked to real clients). No backend source exists yet.
        <div className="space-y-4">
          <DataSourceNotice kind="pending">
            {activeTab === "Meetings"
              ? "The backend has no meetings endpoint, so no meetings are recorded for clients yet."
              : "The backend does not expose a client activity history yet. Created and updated times are on the Overview tab."}
          </DataSourceNotice>
          <div className="flex h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white text-center">
            {activeTab === "Meetings" ? <CalendarDays className="h-8 w-8 text-muted-foreground/30 mb-2" /> : <History className="h-8 w-8 text-muted-foreground/30 mb-2" />}
            <p className="text-sm font-medium text-muted-foreground">Not connected yet</p>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={`Deactivate ${client.company_name}?`}
        description={
          <>
            <p>The client is not permanently deleted. Its status is set to <strong>Inactive</strong>, and the API then hides it everywhere: the client list, this page and the project client picker.</p>
            <p>
              {clientProjects.length > 0
                ? `Its ${clientProjects.length} project${clientProjects.length === 1 ? "" : "s"} stay in place, but no project can be reassigned to this client.`
                : "Existing projects, if any, are kept."}{" "}
              This app cannot reactivate the client afterwards.
            </p>
          </>
        }
        confirmLabel="Deactivate"
        pendingLabel="Deactivating..."
        pending={deactivateMutation.isPending}
        onConfirm={() => deactivateMutation.mutate(client.id)}
        onCancel={() => setConfirmDelete(false)}
      />
    </AppLayout>
  );
}
