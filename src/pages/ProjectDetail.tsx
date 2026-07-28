import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useStore, ProjectStatus } from "@/store";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ArrowLeft, Clock, Calendar, CheckCircle2, DollarSign, FolderKanban, Users, FileText, Activity, CircleDashed, MoreHorizontal, MessageSquare, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

export default function ProjectDetailsPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { projects, clients, tasks, employees, files, activities, currentUser } = useStore();
  const project = projects.find(p => p.id === projectId);
  
  useEffect(() => {
    if (currentUser?.role === "Employee") {
      if (!project || !project.team.includes(currentUser.initials)) {
        navigate("/projects");
      }
    }
  }, [currentUser, project, navigate]);
  
  const [activeTab, setActiveTab] = useState("Overview");

  if (!project) {
    return (
      <DashboardShell>
        <div className="flex h-[400px] flex-col items-center justify-center">
          <h2 className="text-[18px] font-semibold text-foreground">Project not found</h2>
          <Link to="/projects" className="mt-4 text-[13px] text-primary hover:underline">Return to projects</Link>
        </div>
      </DashboardShell>
    );
  }

  const client = clients.find(c => c.name === project.client);
  const projectTasks = tasks.filter(t => t.project === project.name);
  const projectFiles = files.filter(f => f.project === project.name);
  const projectActivities = activities.filter(a => a.project === project.name);
  
  const isEmployee = currentUser?.role === "Employee";
  const tabs = isEmployee 
    ? ["Overview", "Milestones", "Tasks", "Files", "Meetings", "Activity"]
    : ["Overview", "Milestones", "Task Board", "Team Members", "Files", "Activity Log"];
  

  return (
    <DashboardShell>
      <div className="mb-8 max-w-[1200px] mx-auto">
        <Link to="/projects" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Projects
        </Link>
        
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <h1 className="text-[28px] font-semibold tracking-tight text-foreground leading-none">{project.name}</h1>
              <StatusBadge status={project.status} />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
              {client ? (
                <Link to="/clients/$clientId" params={{clientId: client.id}} className="flex items-center gap-1.5 hover:text-foreground transition-colors font-medium">
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-secondary text-[9px] font-bold text-foreground border border-border/50">
                    {client.logo}
                  </div>
                  {client.company}
                </Link>
              ) : (
                <span className="font-medium text-foreground">{project.client}</span>
              )}
              <span className="text-border">•</span>
              <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Due {project.due}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isEmployee && (
              <>
                <Button size="sm" variant="ghost" className="h-[34px] text-[13px]">Edit Details</Button>
                <Button size="sm" className="h-[34px] shadow-sm">Complete Project</Button>
              </>
            )}
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
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {!isEmployee && (
                  <Card className="p-5 rounded-[16px] border border-border/60 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Activity className="w-4 h-4 text-primary" />
                      </div>
                      <h3 className="text-[14px] font-semibold text-foreground">Budget Spent</h3>
                    </div>
                    <p className="text-[24px] font-semibold text-foreground mt-2">
                      ${project.spent.toLocaleString()} <span className="text-[13px] font-normal text-muted-foreground">/ ${project.budget.toLocaleString()}</span>
                    </p>
                  </Card>
                )}
                {isEmployee && (
                  <Card className="p-5 rounded-[16px] border border-border/60 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      <h3 className="text-[14px] font-semibold text-foreground">My Tasks</h3>
                    </div>
                    <p className="text-[24px] font-semibold text-foreground mt-2">
                      {projectTasks.filter(t => t.assignee === currentUser?.initials).length}
                    </p>
                  </Card>
                )}
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-[12px] font-medium text-muted-foreground mb-1">Progress</p>
                  <p className="text-[20px] font-semibold text-foreground">{project.progress}%</p>
                  <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${project.progress}%` }} />
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-[12px] font-medium text-muted-foreground mb-1">Open Tasks</p>
                  <p className="text-[20px] font-semibold text-foreground">{projectTasks.filter(t => !t.done).length}</p>
                </div>
              </div>

              <section className="rounded-xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between p-5 border-b border-border/50">
                  <h3 className="text-[14px] font-semibold text-foreground">Recent Tasks</h3>
                  <Link to="/tasks" className="text-[12px] font-medium text-primary hover:underline">View all</Link>
                </div>
                <div className="divide-y divide-border/50">
                  {projectTasks.slice(0, 5).map(t => (
                    <div key={t.id} className="flex items-center justify-between p-4 hover:bg-secondary/40 transition-colors">
                      <div className="flex items-center gap-3">
                        {t.done ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <CircleDashed className="h-4 w-4 text-muted-foreground" />}
                        <span className={cn("text-[13px] font-medium", t.done ? "text-muted-foreground line-through" : "text-foreground")}>{t.title}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
                        <span className="hidden sm:inline-block">{t.due}</span>
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-foreground ring-1 ring-border">{t.assignee}</div>
                      </div>
                    </div>
                  ))}
                  {projectTasks.length === 0 && <div className="p-6 text-center text-[13px] text-muted-foreground">No tasks assigned to this project yet.</div>}
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <h3 className="text-[14px] font-semibold text-foreground mb-4">Team</h3>
                <div className="space-y-3 text-[13px]">
                  {project.team.map((initials) => {
                    const emp = employees.find(e => e.initials === initials);
                    return (
                      <div key={initials} className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-[10px] font-bold text-foreground shadow-sm">
                          {initials}
                        </div>
                        <div>
                          <p className="font-medium text-foreground leading-none">{emp?.name || initials}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground leading-none">{emp?.role || "Team Member"}{project.lead === initials && " • Lead"}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
              
              <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <h3 className="text-[14px] font-semibold text-foreground mb-4">Milestones</h3>
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border/60 before:to-transparent">
                  {project.milestones.map((m, i) => (
                    <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-card bg-secondary text-muted-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                        {m.status === "completed" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <div className="w-2 h-2 rounded-full bg-border" />}
                      </div>
                      <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-lg border border-border/50 bg-card shadow-sm">
                        <p className={cn("text-[13px] font-medium", m.status === "completed" ? "text-muted-foreground" : "text-foreground")}>{m.title}</p>
                      </div>
                    </div>
                  ))}
                  {project.milestones.length === 0 && <p className="text-[13px] text-muted-foreground pl-8">No milestones set.</p>}
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

function StatusBadge({ status }) {
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
