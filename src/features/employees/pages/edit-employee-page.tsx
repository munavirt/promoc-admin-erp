import { useEffect } from "react";
import { useNavigate, Link, useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  User, Mail, Phone, Briefcase, Building2,
  Calendar, IndianRupee, AlertCircle, ArrowLeft, UserPlus,
  MapPin, PhoneCall, ChevronDown, Loader2, Hash
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getEmployee,
  updateEmployee,
  updateEmployeeAccount,
  type EmployeeBackend,
  type EmployeeUpdatePayload,
} from "@/api/employees.api";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { toast } from "sonner";

/* ─── Schema ─────────────────────────────────────────── */
// Email is not editable by admins on the backend (EmployeeSerializer marks it read-only and
// PATCH /api/accounts/users/{id}/ ignores it), so it is displayed read-only.
// Password changes for another user have no backend endpoint, so that section was removed.
const schema = z.object({
  name:             z.string().trim().min(2, "Full name is required").max(255, "Max 255 characters"),
  // Same rule as EmployeeCreateSerializer.validate_phone (the users PATCH endpoint itself does not validate).
  phone:            z.string().trim().max(20, "Max 20 digits")
                      .refine((v) => v === "" || /^\d+$/.test(v), "Digits only — no spaces, dashes or +")
                      .optional(),
  employeeId:       z.string().trim().min(1, "Employee ID is required").max(20, "Max 20 characters"),
  department:       z.string().min(1, "Department is required").max(100, "Max 100 characters"),
  designation:      z.string().trim().min(2, "Designation is required").max(100, "Max 100 characters"),
  employmentType:   z.enum(["FULL_TIME", "PART_TIME", "INTERN", "FREELANCER"]),
  joinDate:         z.string().min(1, "Joining date is required"),
  salary:           z.string().optional().refine(
                      (v) => !v || (/^\d{1,8}(\.\d{1,2})?$/.test(v)),
                      "Enter a non-negative amount (max 8 digits, 2 decimals)",
                    ),
  employeeStatus:   z.enum(["ACTIVE", "ON_LEAVE", "RESIGNED", "TERMINATED"]),
  emergencyName:    z.string().trim().max(150, "Max 150 characters").optional(),
  emergencyPhone:   z.string().trim().max(20, "Max 20 characters").optional(),
  address:          z.string().optional(),
});

/** Backend field name → form field name. */
const FIELD_MAP: Record<string, keyof FormData> = {
  name: "name",
  phone: "phone",
  employee_id: "employeeId",
  department: "department",
  designation: "designation",
  employment_type: "employmentType",
  joining_date: "joinDate",
  salary: "salary",
  status: "employeeStatus",
  emergency_contact_name: "emergencyName",
  emergency_contact_phone: "emergencyPhone",
  address: "address",
};

type FormData = z.infer<typeof schema>;

/* ─── Sub-components ─────────────────────────────────── */
function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-border/50">
        <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="px-6 py-6">{children}</div>
    </div>
  );
}

interface FieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}

function Field({ label, error, required, children, hint }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && (
        <p className="flex items-center gap-1 text-[11px] text-red-500">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass = (error?: string) => cn(
  "h-11 w-full rounded-xl border bg-white px-4 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none transition-all",
  "focus:border-primary/60 focus:ring-2 focus:ring-primary/10",
  error ? "border-red-400 focus:border-red-400 focus:ring-red-500/10" : "border-border/70 hover:border-border"
);

const withIcon = "pl-10";

function LeadIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
      {children}
    </span>
  );
}

/* ─── Main Page ──────────────────────────────────────── */
export function EditEmployeePage() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: employee, isLoading, isError, error } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: ({ signal }) => getEmployee(employeeId as string, signal),
    enabled: !!employeeId
  });

  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (employee) {
      reset({
        name: employee.name || "",
        phone: employee.phone || "",
        employeeId: employee.employee_id || "",
        department: employee.department || "",
        designation: employee.designation || "",
        employmentType: (employee.employment_type as FormData["employmentType"]) || "FULL_TIME",
        joinDate: employee.joining_date || "",
        salary: employee.salary !== null && employee.salary !== undefined ? String(employee.salary) : "",
        employeeStatus: (employee.status as FormData["employeeStatus"]) || "ACTIVE",
        emergencyName: employee.emergency_contact_name || "",
        emergencyPhone: employee.emergency_contact_phone || "",
        address: employee.address || "",
      });
    }
  }, [employee, reset]);

  /**
   * 1. PATCH /api/employees/{id}/            — employment fields (validated by EmployeeSerializer)
   * 2. PATCH /api/accounts/users/{user_uuid}/ — name / phone, only when changed
   */
  const updateMutation = useMutation({
    mutationFn: async ({ current, data }: { current: EmployeeBackend; data: FormData }) => {
      const employeePatch: EmployeeUpdatePayload = {
        employee_id: data.employeeId,
        department: data.department,
        designation: data.designation,
        employment_type: data.employmentType,
        joining_date: data.joinDate,
        salary: data.salary ? data.salary : null,
        status: data.employeeStatus,
        emergency_contact_name: data.emergencyName ?? "",
        emergency_contact_phone: data.emergencyPhone ?? "",
        address: data.address ?? "",
      };
      const updated = await updateEmployee({ id: current.id, data: employeePatch });

      const accountPatch: { name?: string; phone?: string } = {};
      if (data.name.trim() !== (current.name || "")) accountPatch.name = data.name.trim();
      if ((data.phone ?? "").trim() !== (current.phone || "")) accountPatch.phone = (data.phone ?? "").trim();
      if (Object.keys(accountPatch).length > 0) {
        if (!current.user) {
          throw Object.assign(new Error("Employment details saved, but the linked login account is unknown so name/phone were not updated."), { partial: true });
        }
        try {
          await updateEmployeeAccount(current.user, accountPatch);
        } catch (err) {
          const { message } = extractApiErrorMessage(err, "Account update failed.");
          throw Object.assign(new Error(`Employment details saved, but name/phone could not be updated: ${message}`), { partial: true });
        }
      }
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      toast.success("Employee updated successfully.");
      navigate(`/employees/${employeeId}`);
    },
    onError: (err: unknown) => {
      if ((err as { partial?: boolean })?.partial) {
        queryClient.invalidateQueries({ queryKey: ['employees'] });
        queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
        toast.error((err as Error).message);
        return;
      }
      const { message, fieldErrors } = extractApiErrorMessage(err, "Failed to update employee.");
      let mapped = false;
      const unmapped: string[] = [];
      for (const [backendField, messages] of Object.entries(fieldErrors ?? {})) {
        const formField = FIELD_MAP[backendField];
        if (formField && messages.length > 0) {
          setError(formField, { type: "server", message: messages[0] });
          mapped = true;
        } else if (messages.length > 0) {
          unmapped.push(`${backendField}: ${messages[0]}`);
        }
      }
      if (unmapped.length) toast.error(unmapped.join(" · "));
      else if (!mapped) toast.error(message);
      else toast.error("Please correct the highlighted fields.");
    }
  });

  const onSubmit = (data: FormData) => {
    if (!employee || updateMutation.isPending) return;
    updateMutation.mutate({ current: employee, data });
  };

  const BASE_DEPARTMENTS = ["Creative", "Accounts", "Production", "Marketing", "Engineering", "HR", "Finance", "Operations"];
  // Keep the record's stored department selectable even if it is not in the preset list.
  const DEPARTMENTS =
    employee?.department && !BASE_DEPARTMENTS.includes(employee.department)
      ? [...BASE_DEPARTMENTS, employee.department]
      : BASE_DEPARTMENTS;

  // Terminated employees can only be restored via "Reactivate" on the profile (which also re-enables the login),
  // and termination itself must go through DELETE (which disables the login). A plain status PATCH would do neither.
  const isTerminated = employee?.status === "TERMINATED";
  const STATUS_OPTIONS: { value: FormData["employeeStatus"]; label: string }[] = isTerminated
    ? [{ value: "TERMINATED", label: "Terminated" }]
    : [
        { value: "ACTIVE", label: "Active" },
        { value: "ON_LEAVE", label: "On Leave" },
        { value: "RESIGNED", label: "Resigned" },
      ];

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
          <AlertCircle className="h-10 w-10 text-muted-foreground/40" />
          <h2 className="text-[18px] font-semibold text-foreground">{notFound || !isError ? "Employee not found" : "Unable to load employee"}</h2>
          {isError && !notFound && (
            <p className="text-[13px] text-muted-foreground">{extractApiErrorMessage(error, "Please try again.").message}</p>
          )}
          <Link to="/employees" className="text-sm text-primary hover:underline">Return to Employees</Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Back nav */}
      <Link to={`/employees/${employeeId}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to Profile
      </Link>

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Edit Employee</h1>
        <p className="mt-1 text-sm text-muted-foreground">Update the details for {employee.name}.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-24">

        {/* Section 1 — Personal Information */}
        <SectionCard title="Personal Information" subtitle="Basic account details for the employee.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            <Field label="Full Name" error={errors.name?.message} required>
              <div className="relative">
                <LeadIcon><User className="h-4 w-4" /></LeadIcon>
                <input {...register("name")} placeholder="Enter employee name" className={cn(inputClass(errors.name?.message), withIcon)} />
              </div>
            </Field>

            <Field label="Email Address" hint="Login email can't be changed from here.">
              <div className="relative">
                <LeadIcon><Mail className="h-4 w-4" /></LeadIcon>
                <input value={employee.email || ""} type="email" readOnly disabled className={cn(inputClass(), withIcon, "bg-secondary/40 text-muted-foreground cursor-not-allowed")} />
              </div>
            </Field>

            <Field label="Phone Number" error={errors.phone?.message}>
              <div className="relative">
                <LeadIcon><Phone className="h-4 w-4" /></LeadIcon>
                <input {...register("phone")} type="tel" inputMode="numeric" placeholder="9876543210" className={cn(inputClass(errors.phone?.message), withIcon)} />
              </div>
            </Field>

          </div>
        </SectionCard>

        {/* Section 2 — Employment Details */}
        <SectionCard title="Employment Details" subtitle="Role, department, and salary information.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Employee ID" error={errors.employeeId?.message} required hint="Must be unique.">
              <div className="relative">
                <LeadIcon><Hash className="h-4 w-4" /></LeadIcon>
                <input {...register("employeeId")} className={cn(inputClass(errors.employeeId?.message), withIcon, "font-mono")} />
              </div>
            </Field>

            <div className="hidden md:block" />

            <Field label="Department" error={errors.department?.message} required>
              <div className="relative">
                <LeadIcon><Building2 className="h-4 w-4" /></LeadIcon>
                <select {...register("department")} className={cn(inputClass(errors.department?.message), withIcon, "appearance-none pr-10")}>
                  <option value="">Select department</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </Field>

            <Field label="Designation" error={errors.designation?.message} required>
              <div className="relative">
                <LeadIcon><Briefcase className="h-4 w-4" /></LeadIcon>
                <input {...register("designation")} placeholder="e.g. Senior Frontend Developer" className={cn(inputClass(errors.designation?.message), withIcon)} />
              </div>
            </Field>

            <Field label="Employment Type" error={errors.employmentType?.message} required>
              <div className="relative">
                <LeadIcon><UserPlus className="h-4 w-4" /></LeadIcon>
                <select {...register("employmentType")} className={cn(inputClass(errors.employmentType?.message), withIcon, "appearance-none pr-10")}>
                  <option value="FULL_TIME">Full Time</option>
                  <option value="PART_TIME">Part Time</option>
                  <option value="INTERN">Intern</option>
                  <option value="FREELANCER">Freelancer</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </Field>

            <Field
              label="Status"
              error={errors.employeeStatus?.message}
              required
              hint={isTerminated ? "Use Reactivate on the employee profile to restore access." : "To terminate, use Terminate on the employee profile."}
            >
              <div className="relative">
                <select {...register("employeeStatus")} className={cn(inputClass(errors.employeeStatus?.message), "appearance-none pr-10")}>
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </Field>

            <Field label="Joining Date" error={errors.joinDate?.message} required>
              <div className="relative">
                <LeadIcon><Calendar className="h-4 w-4" /></LeadIcon>
                <input {...register("joinDate")} type="date" className={cn(inputClass(errors.joinDate?.message), withIcon)} />
              </div>
            </Field>

            <Field label="Salary (Monthly)" error={errors.salary?.message}>
              <div className="relative">
                <LeadIcon><IndianRupee className="h-4 w-4" /></LeadIcon>
                <input {...register("salary")} type="number" min="0" step="0.01" placeholder="0.00" className={cn(inputClass(errors.salary?.message), withIcon)} />
              </div>
            </Field>
          </div>
        </SectionCard>

        {/* Section 3 — Emergency & Additional */}
        <SectionCard title="Additional Information" subtitle="Emergency contacts and addresses.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Emergency Contact Name" error={errors.emergencyName?.message}>
              <div className="relative">
                <LeadIcon><User className="h-4 w-4" /></LeadIcon>
                <input {...register("emergencyName")} placeholder="Contact name" className={cn(inputClass(errors.emergencyName?.message), withIcon)} />
              </div>
            </Field>

            <Field label="Emergency Contact Phone" error={errors.emergencyPhone?.message}>
              <div className="relative">
                <LeadIcon><PhoneCall className="h-4 w-4" /></LeadIcon>
                <input {...register("emergencyPhone")} type="tel" placeholder="+91 98765 43210" className={cn(inputClass(errors.emergencyPhone?.message), withIcon)} />
              </div>
            </Field>

            <div className="md:col-span-2">
              <Field label="Residential Address" error={errors.address?.message}>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <textarea
                    {...register("address")}
                    rows={3}
                    placeholder="Enter complete residential address"
                    className="w-full rounded-xl border border-border/70 bg-white pl-10 pr-4 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none resize-none transition-all focus:border-primary/60 focus:ring-2 focus:ring-primary/10 hover:border-border"
                  />
                </div>
              </Field>
            </div>
          </div>
        </SectionCard>

        {/* Sticky Footer */}
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-white/95 backdrop-blur-sm px-6 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
            <Button type="button" variant="outline" onClick={() => navigate(`/employees/${employeeId}`)} className="h-11 px-6 rounded-xl text-[13px]">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="h-11 min-w-[160px] gap-2 rounded-xl text-[13px] shadow-sm"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </AppLayout>
  );
}
