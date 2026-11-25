import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import {
  ArrowLeft, Mail, Phone, MapPin, Calendar, Briefcase, IndianRupee,
  Building2, Pencil, UserX, Clock,
  PhoneCall, User, AlertTriangle, Loader2, RotateCcw, ShieldCheck, ShieldOff, RefreshCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getEmployee,
  getEmployeeAccount,
  reactivateEmployee,
  terminateEmployee,
  type EmployeeBackend,
} from "@/api/employees.api";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { toast } from "sonner";
import { DataSourceNotice } from "@/components/shared/data-source-notice";
import { EmployeeLifecycleDialog } from "@/features/employees/components/employee-lifecycle-dialog";

/* ─── Helpers ─────────────────────────────────────────── */
const STATUS_CONFIG: Record<string, { dot: string; bg: string; text: string }> = {
  ACTIVE:      { dot: "bg-emerald-500", bg: "bg-emerald-50",  text: "text-emerald-700" },
  ON_LEAVE:    { dot: "bg-amber-500",   bg: "bg-amber-50",    text: "text-amber-700" },
  RESIGNED:    { dot: "bg-slate-400",   bg: "bg-slate-100",   text: "text-slate-600" },
  TERMINATED:  { dot: "bg-red-500",     bg: "bg-red-50",      text: "text-red-700" },
};

const TYPE_CONFIG: Record<string, { label: string, cls: string }> = {
  FULL_TIME:  { label: "Full Time",  cls: "bg-blue-50 text-blue-700 ring-blue-500/20" },
  PART_TIME:  { label: "Part Time",  cls: "bg-purple-50 text-purple-700 ring-purple-500/20" },
  INTERN:     { label: "Intern",     cls: "bg-orange-50 text-orange-700 ring-orange-500/20" },
  FREELANCER: { label: "Freelancer", cls: "bg-teal-50 text-teal-700 ring-teal-500/20" },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG["ACTIVE"];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold", s.bg, s.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {status === 'ON_LEAVE' ? 'On Leave' : status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function formatDateTime(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

function formatDate(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return iso; }
}

function formatSalary(n: number | string | null | undefined) {
  if (n === null || n === undefined || n === "") return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n));
}

function getInitials(name: string) {
  if (!name) return "U";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | number | null }) {
  return (
    <div className="flex items-start gap-3 py-3.5 border-b border-border/40 last:border-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/60 text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{label}</p>
        <p className="mt-0.5 text-[13px] font-medium text-foreground">{value || "—"}</p>
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
const TABS = ["Overview", "Projects", "Assigned Work", "Meetings", "Activity"] as const;
type Tab = typeof TABS[number];

const TAB_SOURCES: Record<Exclude<Tab, "Overview">, { message: string; endpoint?: string }> = {
  Projects: { message: "Project membership will appear here once the Projects module is connected.", endpoint: "/api/projects/" },
  "Assigned Work": { message: "Assigned tasks will appear here once the Tasks module is connected.", endpoint: "/api/work-items/" },
  Meetings: { message: "The backend has no meetings endpoint yet, so no meetings are recorded for employees." },
  Activity: { message: "The backend does not expose an employee activity log yet. See Record on the Overview tab for created/updated times." },
};

/* ─── Main ───────────────────────────────────────────── */
export default function EmployeeDetailPage() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [pendingAction, setPendingAction] = useState<"terminate" | "reactivate" | null>(null);

  const { data: employee, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: ({ signal }) => getEmployee(employeeId as string, signal),
    enabled: !!employeeId
  });

  // Linked login account (GET /api/accounts/users/{uuid}/) — source of truth for is_active.
  const accountQuery = useQuery({
    queryKey: ['employee', employeeId, 'account', employee?.user],
    queryFn: ({ signal }) => getEmployeeAccount(employee!.user as string, signal),
    enabled: Boolean(employee?.user),
  });
  const account = accountQuery.data;

  const invalidateEmployee = () => {
    queryClient.invalidateQueries({ queryKey: ['employees'] });
    queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
  };

  // DELETE /api/employees/{id}/ is a soft delete: status TERMINATED + login account deactivated.
  const terminateMutation = useMutation({
    mutationFn: (emp: EmployeeBackend) => terminateEmployee(emp.id),
    onSuccess: (res) => {
      invalidateEmployee();
      setPendingAction(null);
      toast.success(res?.message || "Employee terminated successfully.");
    },
    onError: (err) => {
      setPendingAction(null);
      toast.error(extractApiErrorMessage(err, "Failed to terminate employee.").message);
    }
  });

  const reactivateMutation = useMutation({
    mutationFn: (emp: EmployeeBackend) => reactivateEmployee(emp),
    onSuccess: () => {
      invalidateEmployee();
      setPendingAction(null);
      toast.success("Employee reactivated and login account enabled.");
    },
    onError: (err) => {
      invalidateEmployee();
      setPendingAction(null);
      toast.error(extractApiErrorMessage(err, "Failed to reactivate employee.").message);
    }
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
        </div>
      </AppLayout>
    );
  }

  if (isError || !employee) {
    const notFound = (error as { status?: number | null } | null)?.status === 404;
    return (
      <AppLayout>
        <div className="flex h-[400px] flex-col items-center justify-center gap-3">
          <AlertTriangle className="h-10 w-10 text-muted-foreground/40" />
          <h2 className="text-[18px] font-semibold text-foreground">{notFound || !isError ? "Employee not found" : "Unable to load employee"}</h2>
          {isError && !notFound && (
            <>
              <p className="text-[13px] text-muted-foreground">{extractApiErrorMessage(error, "Please try again.").message}</p>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => void refetch()} disabled={isFetching}>
                <RefreshCcw className={cn("mr-2 h-3.5 w-3.5", isFetching && "animate-spin")} /> Retry
              </Button>
            </>
          )}
          <Link to="/employees" className="text-sm text-primary hover:underline">Return to Employees</Link>
        </div>
      </AppLayout>
    );
  }

  const initials = getInitials(employee.name);
  const isTerminated = employee.status === "TERMINATED";
  const canReactivate = isTerminated || employee.status === "RESIGNED" || account?.is_active === false;

  return (
    <AppLayout>
      {/* Back */}
      <Link to="/employees" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to Employees
      </Link>

      {/* Profile Hero Card */}
      <div className="mb-6 rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
        {/* Cover gradient */}
        <div className="h-24 bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500" />

        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10">
            {/* Avatar */}
            <div className="flex items-end gap-4">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-blue-500 to-indigo-600 text-[22px] font-bold text-white shadow-lg">
                {initials}
                {employee.status === "ACTIVE" && (
                  <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-white bg-emerald-500" />
                )}
              </div>
              <div className="mb-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl font-bold text-foreground">{employee.name}</h1>
                  <StatusPill status={employee.status} />
                  {employee.employment_type && (
                    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset", TYPE_CONFIG[employee.employment_type]?.cls || "bg-secondary text-foreground")}>
                      {TYPE_CONFIG[employee.employment_type]?.label || employee.employment_type}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {employee.designation}
                  {employee.department && <> · <span className="font-medium text-foreground">{employee.department}</span></>}
                </p>
                <p className="mt-0.5 text-[12px] font-mono text-muted-foreground/70">{employee.employee_id}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mb-1">
              <Button variant="outline" size="sm" className="h-9 gap-2 rounded-xl text-[13px]" onClick={() => navigate(`/employees/${employee.id}/edit`)}>
                <Pencil className="h-3.5 w-3.5" /> Edit Profile
              </Button>
              {canReactivate && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 gap-2 rounded-xl text-[13px] text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                  onClick={() => setPendingAction("reactivate")}
                  disabled={reactivateMutation.isPending || terminateMutation.isPending}
                >
                  {reactivateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  Reactivate
                </Button>
              )}
              {!isTerminated && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 gap-2 rounded-xl text-[13px] text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setPendingAction("terminate")}
                  disabled={terminateMutation.isPending || reactivateMutation.isPending}
                >
                  {terminateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />}
                  Terminate
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 flex max-w-full gap-1 overflow-x-auto rounded-full bg-card p-1 shadow-sm w-fit hide-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex items-center rounded-lg px-4 py-2 text-[13px] font-medium transition-all whitespace-nowrap",
              activeTab === tab
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "Overview" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DetailCard title="Contact Information">
                <InfoRow icon={<Mail className="h-4 w-4" />} label="Email Address" value={employee.email} />
                <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone Number" value={employee.phone} />
                <InfoRow icon={<MapPin className="h-4 w-4" />} label="Residential Address" value={employee.address} />
              </DetailCard>

              <DetailCard title="Employment Details">
                <InfoRow icon={<Building2 className="h-4 w-4" />} label="Department" value={employee.department} />
                <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Designation" value={employee.designation} />
                <InfoRow icon={<Calendar className="h-4 w-4" />} label="Joining Date" value={formatDate(employee.joining_date)} />
                <InfoRow icon={<IndianRupee className="h-4 w-4" />} label="Salary (Monthly)" value={formatSalary(employee.salary)} />
              </DetailCard>
            </div>

            <DetailCard title="Emergency Contact">
              <div className="grid grid-cols-1 md:grid-cols-2">
                <InfoRow icon={<User className="h-4 w-4" />} label="Contact Name" value={employee.emergency_contact_name} />
                <InfoRow icon={<PhoneCall className="h-4 w-4" />} label="Phone Number" value={employee.emergency_contact_phone} />
              </div>
            </DetailCard>
          </div>

          <div className="space-y-6">
            <DetailCard title="Login Account">
              <InfoRow
                icon={account?.is_active === false ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                label="Account Status"
                value={
                  accountQuery.isLoading ? "Loading…"
                  : accountQuery.isError ? "Unavailable"
                  : account ? (account.is_active ? "Active — can sign in" : "Disabled — cannot sign in")
                  : "—"
                }
              />
              <InfoRow icon={<User className="h-4 w-4" />} label="Role" value={account?.role || employee.role} />
            </DetailCard>

            <DetailCard title="Record">
              <InfoRow icon={<Calendar className="h-4 w-4" />} label="Created" value={formatDateTime(employee.created_at)} />
              <InfoRow icon={<Clock className="h-4 w-4" />} label="Last Updated" value={formatDateTime(employee.updated_at)} />
            </DetailCard>
          </div>
        </div>
      )}

      {activeTab !== "Overview" && (
        // These tabs previously showed demo-store data that is not linked to real employee records.
        // They stay empty until their modules are connected to Django (Phase 2+); nothing is fabricated here.
        <div className="space-y-4">
          <DataSourceNotice kind="pending" endpoint={TAB_SOURCES[activeTab].endpoint}>
            {TAB_SOURCES[activeTab].message}
          </DataSourceNotice>
          <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border bg-white">
            <p className="text-[13px] text-muted-foreground">No {activeTab.toLowerCase()} to show for {employee.name} yet.</p>
          </div>
        </div>
      )}

      <EmployeeLifecycleDialog
        action={pendingAction ?? "terminate"}
        employeeName={employee.name}
        open={pendingAction !== null}
        pending={terminateMutation.isPending || reactivateMutation.isPending}
        onConfirm={() => {
          if (pendingAction === "terminate") terminateMutation.mutate(employee);
          else if (pendingAction === "reactivate") reactivateMutation.mutate(employee);
        }}
        onCancel={() => setPendingAction(null)}
      />
    </AppLayout>
  );
}

