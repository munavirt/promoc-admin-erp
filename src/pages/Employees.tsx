import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { useStore, Employee } from "@/store";
import { Plus, Search, Mail, MapPin, MoreHorizontal, Calendar, Activity, CheckCircle2, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

const employeeSchema = z.object({
  name: z.string().min(2, "Name is required"),
  role: z.string().min(2, "Role is required"),
  email: z.string().email("Invalid email"),
  department: z.string().min(2, "Department is required"),
  location: z.string().min(2, "Location is required"),
});

const employeeForm = employeeSchema;

export default function EmployeesPage() {
  const navigate = useNavigate();
  const { currentUser, employees, addEmployee, removeEmployee, tasks } = useStore();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  
  useEffect(() => {
    if (currentUser?.role === "Employee") {
      navigate("/");
    }
  }, [currentUser, navigate]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(employeeSchema),
  });

  const filtered = employees.filter((e) =>
    [e.name, e.role, e.department].some((v) => v.toLowerCase().includes(query.toLowerCase())),
  );

  const onSubmit = (data) => {
    const initials = data.name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
    addEmployee({
      id: crypto.randomUUID(),
      ...data,
      initials,
      workload: 0,
      joinDate: "Just now",
      status: "Online",
    });
    setOpen(false);
    reset();
  };

  return (
    <PageShell
      title="Team"
      description={`Manage your agency's ${employees.length} team members.`}
      actions={
        <Button size="sm" className="h-[34px] gap-1.5 px-3 text-[13px] shadow-sm" onClick={() => setOpen((v) => !v)}>
          <Plus className="h-4 w-4" /> Add Member
        </Button>
      }
    >
      <div className="max-w-[1200px] mx-auto">
        {open && (
          <form onSubmit={handleSubmit(onSubmit)} className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-[14px] font-semibold text-foreground">Add Team Member</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
              <div className="md:col-span-2">
                <input {...register("name")} placeholder="Full Name" className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
                {errors.name && <span className="text-[11px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.name.message}</span>}
              </div>
              <div className="md:col-span-2">
                <input {...register("email")} placeholder="Email Address" className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
                {errors.email && <span className="text-[11px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.email.message}</span>}
              </div>
              <div>
                <input {...register("role")} placeholder="Role" className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
                {errors.role && <span className="text-[11px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.role.message}</span>}
              </div>
              <div className="md:col-span-2">
                <input {...register("department")} placeholder="Department" className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
                {errors.department && <span className="text-[11px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.department.message}</span>}
              </div>
              <div className="md:col-span-2">
                <input {...register("location")} placeholder="Location" className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
                {errors.location && <span className="text-[11px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.location.message}</span>}
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm" className="h-[34px] w-full shadow-sm">Invite</Button>
              </div>
            </div>
          </form>
        )}

        <div className="mb-6 flex items-center gap-2">
          <div className="relative w-full max-w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search team members…" className="h-[34px] w-full rounded-md border border-border bg-card pl-9 pr-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors shadow-sm" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(e => {
            const memberTasks = tasks.filter(t => t.assignee === e.initials);
            const openTasks = memberTasks.filter(t => !t.done).length;
            
            return (
              <Link to={`/employees/${e.id}`} key={e.id} className="group relative flex flex-col rounded-xl border border-border bg-card shadow-sm hover:border-primary/40 hover:shadow transition-all overflow-hidden">
                <div className="p-5 flex flex-col items-center text-center">
                  <div className="relative mb-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border/50 bg-secondary text-[20px] font-bold text-foreground shadow-sm">
                      {e.initials}
                    </div>
                    <span className={cn(
                      "absolute bottom-0 right-0 h-4 w-4 rounded-full border-[3px] border-card",
                      e.status === "Online" ? "bg-emerald-500" : e.status === "In a meeting" ? "bg-amber-500" : "bg-muted-foreground"
                    )} />
                  </div>
                  <h3 className="text-[15px] font-semibold text-foreground group-hover:text-primary transition-colors leading-none mb-1">{e.name}</h3>
                  <p className="text-[12px] text-muted-foreground">{e.role}</p>
                  
                  <div className="mt-4 w-full flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {e.location}</span>
                    <span className="flex items-center gap-1 border border-border/50 px-1.5 py-0.5 rounded-md bg-secondary/30">{e.department}</span>
                  </div>
                </div>

                <div className="border-t border-border/50 bg-secondary/20 p-4 mt-auto">
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground mb-1.5">
                      <span>Workload</span>
                      <span className={cn(e.workload > 80 ? "text-amber-600 font-bold" : "text-foreground")}>{e.workload}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/50">
                      <div className={cn("h-full rounded-full transition-all", e.workload > 80 ? "bg-amber-500" : "bg-primary")} style={{ width: `${e.workload}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                    <span>{openTasks} open tasks</span>
                    <span className="text-primary hover:underline">View profile &rarr;</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </PageShell>
  );
}