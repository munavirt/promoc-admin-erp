import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, AlertCircle, Clock, CheckCircle2, DollarSign, Calendar as CalendarIcon, Users, MoreHorizontal } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { useStore, ProjectStatus } from "@/store";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { cn } from "@/lib/utils";

const projectSchema = z.object({
  name: z.string().min(2, "Name is required"),
  client: z.string().min(2, "Client is required"),
  status: z.enum(["Planning", "In Progress", "Review", "Completed"]),
  progress: z.coerce.number().min(0).max(100),
  due: z.string().min(2, "Due date is required"),
  lead: z.string().min(2, "Lead initials required"),
  budget: z.coerce.number().min(0),
});

const projectForm = projectSchema;

const statuses = ["All", "Planning", "In Progress", "Review", "Completed"];

export default function ProjectsPage() {
  const [filter, setFilter] = useState("All");
  const { projects, currentUser, addProject, updateProjectStatus, removeProject } = useStore();
  const [open, setOpen] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(projectSchema),
    defaultValues: { status: "Planning", progress: 0, budget: 0 }
  });

  const visible = projects.filter((p) => {
    if (currentUser?.role === "Employee" && !p.team.includes(currentUser.initials)) {
      return false;
    }
    return filter === "All" ? true : p.status === filter;
  });

  const onSubmit = (data) => {
    addProject({
      id: crypto.randomUUID(),
      ...data,
      spent: 0,
      milestones: [],
      team: [data.lead],
      progress: data.status === "Completed" ? 100 : data.progress,
    });
    setOpen(false);
    reset();
  };


  return (
    <PageShell
      title="Projects"
      description={`${projects.length} projects · ${projects.filter((p) => p.status !== "Completed").length} in flight`}
      actions={<Button size="sm" className="h-[34px] gap-1.5 px-3 text-[13px] shadow-sm" onClick={() => setOpen((v) => !v)}><Plus className="h-4 w-4" /> New Project</Button>}
    >
      <div className="max-w-[1200px] mx-auto">
        {open && (
          <form onSubmit={handleSubmit(onSubmit)} className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-[14px] font-semibold text-foreground">Create New Project</h3>
              <p className="text-[13px] text-muted-foreground">Set up the initial parameters for the project.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
              <div className="md:col-span-2">
                <label className="text-[12px] font-medium text-foreground mb-1.5 block">Project Name</label>
                <input {...register("name")} placeholder="e.g. Website Redesign" className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
                {errors.name && <span className="text-[11px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.name.message}</span>}
              </div>
              <div className="md:col-span-2">
                <label className="text-[12px] font-medium text-foreground mb-1.5 block">Client</label>
                <input {...register("client")} placeholder="e.g. Acme Corp" className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
                {errors.client && <span className="text-[11px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.client.message}</span>}
              </div>
              <div>
                <label className="text-[12px] font-medium text-foreground mb-1.5 block">Due Date</label>
                <input {...register("due")} placeholder="e.g. Aug 14" className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
                {errors.due && <span className="text-[11px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.due.message}</span>}
              </div>
              <div>
                <label className="text-[12px] font-medium text-foreground mb-1.5 block">Budget ($)</label>
                <input {...register("budget")} type="number" placeholder="0" className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
              </div>
              <div>
                <label className="text-[12px] font-medium text-foreground mb-1.5 block">Project Lead</label>
                <input {...register("lead")} placeholder="Initials (e.g. AM)" maxLength={3} className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] uppercase focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
                {errors.lead && <span className="text-[11px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.lead.message}</span>}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3 pt-4 border-t border-border/50">
              <Button type="button" size="sm" variant="ghost" className="h-[34px]" onClick={() => {setOpen(false); reset();}}>Cancel</Button>
              <Button type="submit" size="sm" className="h-[34px] shadow-sm">Create project</Button>
            </div>
          </form>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-sm w-fit">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                filter === s ? "bg-secondary text-foreground shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {visible.map((p) => (
            <Link to={`/projects/${p.id}`} key={p.id} className="group flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm hover:border-primary/40 hover:shadow transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-[15px] font-semibold text-foreground group-hover:text-primary transition-colors">{p.name}</h3>
                  <p className="text-[13px] text-muted-foreground mt-0.5">{p.client}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>
              
              <div className="mb-5 flex items-center gap-4 text-[12px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" /> {p.due}
                </div>
                <div className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" /> ${(p.budget / 1000).toFixed(1)}k
                </div>
              </div>

              <div className="mb-5">
                <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground mb-1.5">
                  <span>Progress</span>
                  <span className="text-foreground">{p.progress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${p.progress}%` }} />
                </div>
              </div>
              
              <div className="mt-auto pt-4 border-t border-border/50 flex items-center justify-between">
                <div className="flex items-center -space-x-2">
                  {p.team.map((initials, i) => (
                    <div key={i} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-card bg-secondary text-[9px] font-bold text-foreground shadow-sm">
                      {initials}
                    </div>
                  ))}
                  {p.team.length === 0 && <div className="h-7 w-7 rounded-full border-2 border-card bg-secondary" />}
                </div>
                <button
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    // Open a context menu in a real app, here we just show it's interactive
                  }}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            </Link>
          ))}
        </div>
        {visible.length === 0 && (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border bg-card/50">
            <div className="text-center">
              <p className="text-[14px] font-medium text-foreground">No projects found</p>
              <p className="mt-1 text-[13px] text-muted-foreground">Adjust filters or create a new project.</p>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function StatusBadge({ status }) {
  const map = {
    "Planning": { text: "text-blue-700", bg: "bg-blue-50 ring-blue-500/20" },
    "In Progress": { text: "text-emerald-700", bg: "bg-emerald-50 ring-emerald-500/20" },
    "Review": { text: "text-amber-700", bg: "bg-amber-50 ring-amber-500/20" },
    "Completed": { text: "text-muted-foreground", bg: "bg-secondary ring-border/50" },
  };
  const s = map[status];
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", s.bg, s.text)}>
      {status}
    </span>
  );
}