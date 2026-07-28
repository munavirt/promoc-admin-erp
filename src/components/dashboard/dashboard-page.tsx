import { Link } from "react-router-dom";
import { useStore, ProjectStatus } from "@/store";
import { cn } from "@/lib/utils";
import {
  FolderKanban, Users, CheckSquare, Clock,
  MessageSquare, Upload, CheckCircle2, AlertCircle, Calendar, Plus
} from "lucide-react";

export function DashboardPage() {
  const { projects, tasks, employees, activities, meetings } = useStore();

  const activeProjects = projects.filter(p => p.status !== "Completed");
  const urgentTasks = tasks.filter(t => !t.done && (t.priority === "High" || t.due === "Today"));
  const pendingApprovals = tasks.filter(t => !t.done && t.labels?.includes("Review"));

  return (
    <div className="space-y-8 max-w-[1200px] mx-auto">
      {/* Header and Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-foreground">Good morning, Alex.</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Here is what's happening across PromoCraft today.</p>
        </div>

      </div>

      {/* Metrics Row - Compact */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Active Projects" value={activeProjects.length} target="/projects" />
        <MetricCard label="Open Tasks" value={tasks.filter(t => !t.done).length} target="/tasks" />
        <MetricCard label="Team" value={employees.filter(e => e.status === "Online").length} target="/employees" />
        <MetricCard label="Meetings Today" value={meetings.filter(m => m.date.includes("Jul 22")).length} target="/meetings" />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Left Column - 2 spans */}
        <div className="xl:col-span-2 space-y-6">
          {/* Priorities */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] font-semibold text-foreground">Today's Priorities</h2>
              <Link to="/tasks" className="text-[12px] font-medium text-primary hover:underline">View all tasks</Link>
            </div>
            <div className="rounded-xl border border-border bg-card shadow-sm divide-y divide-border/50">
              {urgentTasks.slice(0, 4).map(t => (
                <div key={t.id} className="flex items-start gap-3 p-4 hover:bg-secondary/40 transition-colors">
                  <div className="mt-0.5 flex shrink-0">
                    <input type="checkbox" className="h-4 w-4 rounded-[4px] border-border text-primary focus:ring-primary shadow-sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground">{t.title}</p>
                    <div className="mt-1 flex items-center gap-2 text-[12px] text-muted-foreground">
                      <span className="truncate">{t.project}</span>
                      <span className="text-border">•</span>
                      <span>{t.estimatedTime}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {t.priority === "High" && <span className="flex items-center gap-1 text-[11px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100"><AlertCircle className="w-3 h-3" /> High</span>}
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-foreground ring-1 ring-border">{t.assignee}</div>
                  </div>
                </div>
              ))}
              {urgentTasks.length === 0 && <div className="p-6 text-center text-[13px] text-muted-foreground">All caught up for today.</div>}
            </div>
          </section>

          {/* Active Projects Overview */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] font-semibold text-foreground">Project Health</h2>
              <Link to="/projects" className="text-[12px] font-medium text-primary hover:underline">View all projects</Link>
            </div>
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px] min-w-[500px]">
                  <thead>
                    <tr className="bg-secondary/30 text-[12px] text-muted-foreground [&>th:first-child]:rounded-tl-[8px] [&>th:last-child]:rounded-tr-[8px] border-b border-border/60">
                      <th className="px-5 py-3.5 font-medium">Project</th>
                      <th className="px-5 py-3.5 font-medium">Progress</th>
                      <th className="px-5 py-3.5 font-medium">Status</th>
                      <th className="px-5 py-3.5 font-medium text-right">Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {activeProjects.slice(0, 4).map(p => (
                      <tr key={p.id} className="hover:bg-secondary/40 transition-colors">
                        <td className="px-5 py-3">
                          <Link to="/projects" className="font-medium text-foreground hover:underline">{p.name}</Link>
                          <div className="text-[12px] text-muted-foreground">{p.client}</div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2 max-w-[120px]">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${p.progress}%` }} />
                            </div>
                            <span className="text-[12px] tabular-nums text-muted-foreground w-8">{p.progress}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                        <td className="px-5 py-3 text-right text-muted-foreground text-[12px]">{p.due}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column - 1 span */}
        <div className="space-y-6">
          {/* Employee Availability */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] font-semibold text-foreground">Team Availability</h2>
            </div>
            <div className="rounded-xl border border-border bg-card shadow-sm p-2 divide-y divide-border/50">
              {employees.slice(0, 4).map(e => (
                <div key={e.id} className="flex items-center justify-between p-3 hover:bg-secondary/40 transition-colors rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-foreground border border-border/50 shadow-sm">
                      {e.initials}
                      <span className={cn(
                        "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-[2px] border-card",
                        e.status === "Online" ? "bg-emerald-500" : e.status === "In a meeting" ? "bg-amber-500" : "bg-muted-foreground"
                      )} />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-foreground leading-none">{e.name}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground leading-none">{e.role}</p>
                    </div>
                  </div>
                  <span className="text-[12px] font-medium text-muted-foreground tabular-nums">{e.workload}%</span>
                </div>
              ))}
            </div>
          </section>

          {/* Activity Feed */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] font-semibold text-foreground">Activity Log</h2>
            </div>
            <div className="rounded-xl border border-border bg-card shadow-sm p-5">
              <div className="space-y-5">
                {activities.slice(0, 5).map((a, i) => (
                  <div key={a.id} className="relative flex gap-3.5">
                    {i !== activities.length - 1 && <span className="absolute left-[13px] top-7 bottom-[-20px] w-[1px] bg-border/60" />}
                    <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-foreground ring-1 ring-border shadow-sm">
                      {a.userInitials}
                    </div>
                    <div className="flex-1 pb-1">
                      <p className="text-[13px] text-muted-foreground leading-snug">
                        <span className="font-medium text-foreground">{a.user}</span> {a.action} <span className="font-medium text-foreground">{a.target}</span>
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground/80 font-medium">{a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, target }: { label: string, value: number | string, target: string }) {
  return (
    <Link to={target} className="block p-4 rounded-xl border border-border bg-card shadow-sm hover:border-primary/30 transition-colors group">
      <p className="text-[13px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">{label}</p>
      <p className="mt-2 text-[28px] font-semibold tracking-tight text-foreground">{value}</p>
    </Link>
  );
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  const map: Record<ProjectStatus, { text: string; bg: string }> = {
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