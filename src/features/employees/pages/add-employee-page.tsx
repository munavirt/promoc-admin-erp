import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  User, Mail, Phone, Briefcase, Building2,
  Calendar, IndianRupee, AlertCircle, ArrowLeft, UserPlus,
  MapPin, PhoneCall, ChevronDown, Check, Copy, Hash
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createEmployee, CreateEmployeePayload } from "@/api/employees.api";
import { toast } from "sonner";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { todayLocalISO } from "@/features/employees/lib/dates";

/* ─── Schema ─────────────────────────────────────────── */
// Limits mirror the Django models (accounts.User, employees.Employee) and EmployeeCreateSerializer.
// Backend-required: name, email, role, employee_id, designation, department, joining_date.
// Optional on the backend: phone, salary, emergency contact fields, address.
const schema = z.object({
  name:             z.string().trim().min(2, "Full name is required").max(255, "Max 255 characters"),
  email:            z.string().trim().email("Enter a valid email address"),
  phone:            z.string().trim().max(20, "Max 20 digits")
                      .refine((v) => v === "" || /^\d+$/.test(v), "Digits only — no spaces, dashes or +")
                      .optional(),
  employeeId:       z.string().trim().min(1, "Employee ID is required").max(20, "Max 20 characters"),
  department:       z.string().min(1, "Department is required").max(100, "Max 100 characters"),
  designation:      z.string().trim().min(2, "Designation is required").max(100, "Max 100 characters"),
  employmentType:   z.enum(["FULL_TIME", "PART_TIME", "INTERN", "FREELANCER"]),
  joinDate:         z.string().min(1, "Joining date is required")
                      .refine((v) => !v || v <= todayLocalISO(), "Joining date cannot be in the future"),
  salary:           z.string().optional().refine(
                      (v) => !v || (/^\d{1,8}(\.\d{1,2})?$/.test(v)),
                      "Enter a non-negative amount (max 8 digits, 2 decimals)",
                    ),
  // TERMINATED is not offered on create: termination goes through DELETE, which also disables the login.
  employeeStatus:   z.enum(["ACTIVE", "ON_LEAVE", "RESIGNED"]),
  emergencyName:    z.string().trim().max(150, "Max 150 characters").optional(),
  emergencyPhone:   z.string().trim().max(20, "Max 20 characters").optional(),
  address:          z.string().optional(),
});

/** Suggested unique-looking ID; the backend enforces uniqueness. */
function suggestEmployeeId() {
  return `EMP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/** Backend field name → form field name. */
const FIELD_MAP: Record<string, keyof FormData> = {
  name: "name",
  email: "email",
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
        <p className="flex items-center gap-1 text-[11px] text-red-500 mt-0.5">
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
export function AddEmployeePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [successData, setSuccessData] = useState<{ tempPassword?: string | null; name: string; id: string | number } | null>(null);
  const [copied, setCopied] = useState(false);

  const { register, handleSubmit, formState: { errors }, setError } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: suggestEmployeeId(),
      employmentType: "FULL_TIME",
      employeeStatus: "ACTIVE",
    }
  });

  // POST /api/employees/ — creates the User account (role EMPLOYEE, generated password) and the Employee record atomically.
  const createMutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success("Employee created successfully.");
      setSuccessData({ tempPassword: data.temporary_password, name: data.name, id: data.id });
    },
    onError: (err: unknown) => {
      const { message, fieldErrors } = extractApiErrorMessage(err, "Failed to add employee.");
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
    const payload: CreateEmployeePayload = {
      name: data.name,
      email: data.email,
      phone: data.phone?.trim() || undefined,
      // EmployeeCreateSerializer requires a role for the new User; this form creates staff employees.
      role: "EMPLOYEE",
      employee_id: data.employeeId,
      designation: data.designation,
      department: data.department,
      employment_type: data.employmentType,
      joining_date: data.joinDate,
      salary: data.salary ? data.salary : null,
      status: data.employeeStatus,
      emergency_contact_name: data.emergencyName?.trim() || "",
      emergency_contact_phone: data.emergencyPhone?.trim() || "",
      address: data.address?.trim() || "",
    };

    if (createMutation.isPending) return;
    createMutation.mutate(payload);
  };

  const DEPARTMENTS = ["Creative", "Accounts", "Production", "Marketing", "Engineering", "HR", "Finance", "Operations"];

  const handleCopyPassword = async () => {
    if (successData?.tempPassword) {
      try {
        await navigator.clipboard.writeText(successData.tempPassword);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("Password copied to clipboard!");
      } catch {
        toast.error("Could not access the clipboard — copy the password manually.");
      }
    }
  };

  const handleCloseSuccess = () => {
    const id = successData?.id;
    setSuccessData(null);
    navigate(id !== undefined ? `/employees/${id}` : "/employees");
  };

  return (
    <AppLayout>
      {/* Back nav */}
      <Link to="/employees" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to Employees
      </Link>

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Add Employee</h1>
        <p className="mt-1 text-sm text-muted-foreground">Fill in the details to create a new employee account.</p>
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

            <Field label="Email Address" error={errors.email?.message} required>
              <div className="relative">
                <LeadIcon><Mail className="h-4 w-4" /></LeadIcon>
                <input {...register("email")} type="email" placeholder="employee@company.com" className={cn(inputClass(errors.email?.message), withIcon)} />
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
            <Field label="Employee ID" error={errors.employeeId?.message} required hint="Must be unique. A suggestion is pre-filled.">
              <div className="relative">
                <LeadIcon><Hash className="h-4 w-4" /></LeadIcon>
                <input {...register("employeeId")} placeholder="EMP-2026-0001" className={cn(inputClass(errors.employeeId?.message), withIcon, "font-mono")} />
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

            <Field label="Status" error={errors.employeeStatus?.message} required>
              <div className="relative">
                <select {...register("employeeStatus")} className={cn(inputClass(errors.employeeStatus?.message), "appearance-none pr-10")}>
                  <option value="ACTIVE">Active</option>
                  <option value="ON_LEAVE">On Leave</option>
                  <option value="RESIGNED">Resigned</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </Field>

            <Field label="Joining Date" error={errors.joinDate?.message} required>
              <div className="relative">
                <LeadIcon><Calendar className="h-4 w-4" /></LeadIcon>
                <input {...register("joinDate")} type="date" max={todayLocalISO()} className={cn(inputClass(errors.joinDate?.message), withIcon)} />
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
            <Button type="button" variant="outline" onClick={() => navigate("/employees")} className="h-11 px-6 rounded-xl text-[13px]">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="h-11 min-w-[160px] gap-2 rounded-xl text-[13px] shadow-sm"
            >
              {createMutation.isPending ? (
                <>
                  <svg className="h-4 w-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  Create Employee
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      {/* Success Dialog */}
      {successData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-[24px] bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
              <Check className="h-8 w-8" />
            </div>
            <h2 className="text-center text-xl font-bold text-foreground mb-2">Employee Created</h2>
            <p className="text-center text-[13px] text-muted-foreground mb-6 leading-relaxed">
              {successData.tempPassword
                ? <>The login account for {successData.name} has been created. This temporary password is shown only once — share it securely.</>
                : <>The employee record was created, but the server did not return a temporary password.</>}
            </p>

            {successData.tempPassword && (
            <div className="mb-8 overflow-hidden rounded-2xl border border-border/70 bg-secondary/30">
              <div className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground border-b border-border/70 bg-secondary/50">
                Temporary Password
              </div>
              <div className="flex items-center justify-between p-2 pl-4">
                <span className="font-mono text-lg font-bold tracking-widest text-foreground">
                  {successData.tempPassword}
                </span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleCopyPassword}
                  className={cn("h-10 w-10 shrink-0 rounded-xl", copied ? "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50" : "text-muted-foreground hover:text-foreground")}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            )}

            <Button onClick={handleCloseSuccess} className="w-full h-12 rounded-xl text-[14px]">
              Done & Return
            </Button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
