import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "@/store";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ArrowLeft, MapPin, Mail, Calendar, CheckCircle2, CircleDashed, Award, Clock, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function EmployeeProfilePage() {
  const { employeeId } = useParams();
  const { employees, tasks, projects, activities } = useStore();
  const employee = employees.find(e => e.id === employeeId);
  
  const [activeTab, setActiveTab] = useState("Overview");

  if (!employee) {
    return (
      <DashboardShell>
        <div className="flex h-[400px] flex-col items-center justify-center">
          <h2 className="text-[18px] font-semibold text-foreground">Employee not found</h2>
          <Link to="/employees" className="mt-4 text-[13px] text-primary hover:underline">Return to team</Link>
        </div>
      </DashboardShell>
    );
  }

  const employeeTasks = tasks.filter(t => t.assignee === employee.initials);
  const employeeProjects = projects.filter(p => p.team.includes(employee.initials));
  const employeeActivities = activities.filter(a => a.userInitials === employee.initials);
  
  const tabs = ["Overview", "Projects", "Tasks", "Activity", "Performance"];
  
  return (
    <DashboardShell>
      <div className="mb-8 max-w-[1200px] mx-auto">
        <Link to="/employees" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Team
        </Link>
        
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-secondary text-[24px] font-bold text-foreground border-2 border-border/50 shadow-sm">
              {employee.initials}
              <span className={cn(
                "absolute bottom-0 right-0 h-5 w-5 rounded-full border-[3px] border-background",
                employee.status === "Online" ? "bg-emerald-500" : employee.status === "In a meeting" ? "bg-amber-500" : "bg-muted-foreground"
              )} />
            </div>
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight text-foreground leading-none mb-1.5">{employee.name}</h1>
              <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
                <span className="font-medium text-foreground">{employee.role}</span>
                <span className="text-border">•</span>
                <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {employee.location}</span>
                <span className="text-border">•</span>
                <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Joined {employee.joinDate}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-[34px] text-[13px]">Message</Button>
            <Button size="sm" className="h-[34px] shadow-sm">Assign Task</Button>
          </div>
        </div>
      </div>

      <div className="mb-6 border-b border-border/50 max-w-[1200px] mx-auto overflow-x-auto hide-scrollbar">
        <nav className="-mb-px flex space-x-6 min-w-max">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "whitespace-nowrap border-b-2 py-3 text-[13px] font-medium transition-colors",
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="max-w-[1200px] mx-auto pb-12">
        {activeTab === "Overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-[12px] font-medium text-muted-foreground mb-1">Workload</p>
                  <p className="text-[20px] font-semibold text-foreground">{employee.workload}%</p>
                  <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${employee.workload}%` }} />
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-[12px] font-medium text-muted-foreground mb-1">Active Projects</p>
                  <p className="text-[20px] font-semibold text-foreground">{employeeProjects.filter(p => p.status !== "Completed").length}</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-[12px] font-medium text-muted-foreground mb-1">Tasks Completed</p>
                  <p className="text-[20px] font-semibold text-foreground">{employeeTasks.filter(t => t.done).length}</p>
                </div>
              </div>

              <section className="rounded-xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between p-5 border-b border-border/50">
                  <h3 className="text-[14px] font-semibold text-foreground">Current Tasks</h3>
                </div>
                <div className="divide-y divide-border/50">
                  {employeeTasks.filter(t => !t.done).map(t => (
                    <div key={t.id} className="flex items-center justify-between p-4 hover:bg-secondary/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <CircleDashed className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-[13px] font-medium text-foreground leading-snug">{t.title}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{t.project}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
                        <span className={cn("hidden sm:inline-block", t.due === "Today" ? "text-amber-600 font-medium" : "")}>{t.due}</span>
                      </div>
                    </div>
                  ))}
                  {employeeTasks.filter(t => !t.done).length === 0 && <div className="p-6 text-center text-[13px] text-muted-foreground">No pending tasks.</div>}
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <h3 className="text-[14px] font-semibold text-foreground mb-4">Contact Info</h3>
                <div className="space-y-4 text-[13px]">
                  <div className="flex items-center gap-3 text-foreground">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-muted-foreground ring-1 ring-border"><Mail className="h-4 w-4" /></div>
                    <span className="font-medium">{employee.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary ring-1 ring-border"><MapPin className="h-4 w-4" /></div>
                    {employee.location}
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <h3 className="text-[14px] font-semibold text-foreground mb-4">Recent Activity</h3>
                <div className="space-y-5">
                  {employeeActivities.slice(0, 4).map((a, i) => (
                    <div key={a.id} className="relative flex gap-3.5">
                      {i !== Math.min(employeeActivities.length, 4) - 1 && <span className="absolute left-[13px] top-7 bottom-[-20px] w-[1px] bg-border/60" />}
                      <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-foreground ring-1 ring-border shadow-sm">
                        {a.userInitials}
                      </div>
                      <div className="flex-1 pb-1">
                        <p className="text-[13px] text-muted-foreground leading-snug">
                          {a.action} <span className="font-medium text-foreground">{a.target}</span>
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground/80 font-medium">{a.time}</p>
                      </div>
                    </div>
                  ))}
                  {employeeActivities.length === 0 && <p className="text-[13px] text-muted-foreground">No recent activity.</p>}
                </div>
              </section>
            </div>
            
          </div>
        )}

        {activeTab !== "Overview" && (
          <div className="flex h-[300px] items-center justify-center rounded-xl border border-dashed border-border bg-card/50">
            <div className="text-center">
              <h3 className="text-[14px] font-medium text-foreground">Coming Soon</h3>
              <p className="mt-1 text-[13px] text-muted-foreground">The {activeTab.toLowerCase()} tab is currently under development.</p>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
