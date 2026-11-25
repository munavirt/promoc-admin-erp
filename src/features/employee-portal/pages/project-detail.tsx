import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getMeProjects, getMeTasks } from "@/api/me.api";
import { labelFor, projectClientName, PROJECT_ROLE_LABELS } from "@/api/projects.api";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { 
  FolderKanban, 
  ArrowLeft, 
  CalendarIcon, 
  CheckSquare, 
  Users, 
  Activity, 
  Building2,
  Clock,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

function getInitials(name?: string) {
  if (!name) return "U";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
}

export function EmployeeProjectDetailPage() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState<"overview" | "tasks" | "members" | "activity">("overview");

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["me-projects"],
    queryFn: ({ signal }) => getMeProjects(signal),
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["me-tasks"],
    queryFn: ({ signal }) => getMeTasks(signal),
  });

  const project = projects.find((p: any) => String(p.id) === String(id));
  const projectTasks = tasks.filter((t: any) => {
    const pId = typeof t.project === 'object' ? t.project.id : t.project;
    return String(pId) === String(id);
  });

  if (projectsLoading) {
    return <div className="p-12 text-center text-muted-foreground">Loading project...</div>;
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <FolderKanban className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
        <h2 className="text-xl font-bold text-foreground">Project Not Found</h2>
        <p className="text-muted-foreground mt-2 mb-6">The project you are looking for does not exist or you don't have access to it.</p>
        <Button asChild>
          <Link to="/projects">Back to Projects</Link>
        </Button>
      </div>
    );
  }

  const clientName = projectClientName(project);

  const tabs = [
    { id: "overview", label: "Overview", icon: FolderKanban },
    { id: "tasks", label: "Tasks", icon: CheckSquare },
    { id: "members", label: "Members", icon: Users },
    { id: "activity", label: "Activity", icon: Activity },
  ];

  return (
    <div className="flex flex-col min-h-full w-full bg-[#F8F9FA] pb-10">
      
      {/* Top Header Navigation */}
      <div className="bg-white border-b border-border/70 sticky top-0 z-10">
        <div className="px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto w-full">
          
          <div className="py-4 flex items-center gap-4">
            <Link to="/projects" className="p-2 -ml-2 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
                <Building2 className="w-3.5 h-3.5" />
                <span className="truncate">{clientName}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                {project.project_name}
              </h1>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <StatusBadge status={project.status} />
            </div>
          </div>

          <div className="flex gap-6 overflow-x-auto custom-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 pb-4 text-[13px] font-semibold whitespace-nowrap transition-colors relative",
                  activeTab === tab.id 
                    ? "text-blue-600" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-blue-600" : "text-muted-foreground/70")} />
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
                )}
              </button>
            ))}
          </div>

        </div>
      </div>

      <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
        
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-border/70 shadow-sm">
                <h3 className="text-[14px] font-bold text-foreground mb-4 uppercase tracking-wider">Project Description</h3>
                <p className="text-[14px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {project.description || "No description provided."}
                </p>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-border/70 shadow-sm flex flex-col gap-5">
                <h3 className="text-[14px] font-bold text-foreground uppercase tracking-wider">Project Details</h3>
                
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                    <CalendarIcon className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Deadline</span>
                    <span className="text-[14px] font-semibold text-foreground">
                      {project.deadline ? format(new Date(project.deadline), "MMMM d, yyyy") : "No deadline"}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col gap-0.5 w-full">
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Completion</span>
                      <span className="text-[11px] font-bold text-foreground">{project.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden mt-1.5">
                      <div 
                        className="h-full rounded-full bg-emerald-500 transition-all duration-1000 ease-out" 
                        style={{ width: `${project.progress}%` }} 
                      />
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}

        {/* TASKS TAB */}
        {activeTab === "tasks" && (
          <div className="space-y-4">
            {tasksLoading ? (
              <div className="p-12 text-center text-muted-foreground">Loading tasks...</div>
            ) : projectTasks.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-border/70 flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <CheckSquare className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="text-[15px] font-semibold text-foreground">No tasks assigned</h3>
                <p className="text-[13px] text-muted-foreground mt-1">You don't have any tasks assigned to you in this project.</p>
                <Button asChild className="mt-6" variant="outline">
                  <Link to="/tasks">View All My Tasks</Link>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {projectTasks.map((task: any) => (
                  <div key={task.id} className="bg-white border border-border/70 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col">
                    <div className="p-5 flex flex-col gap-4 border-b border-border/50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-col gap-1 min-w-0">
                          <h3 className="text-[15px] font-semibold text-foreground line-clamp-2">{task.title}</h3>
                          <span className={cn(
                            "inline-flex w-fit mt-1 px-1.5 py-0.5 rounded-[4px] uppercase text-[10px] tracking-wide font-bold",
                            task.priority === "HIGH" || task.priority === "URGENT" ? "bg-red-50 text-red-600" :
                            task.priority === "MEDIUM" ? "bg-amber-50 text-amber-600" :
                            "bg-blue-50 text-blue-600"
                          )}>
                            {task.priority}
                          </span>
                        </div>
                        <StatusBadge status={task.status} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-secondary/10 mt-auto">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><CalendarIcon className="w-3 h-3"/> Due</span>
                        <span className="text-[12px] font-semibold text-foreground">{task.due_date ? format(new Date(task.due_date), "MMM d, yyyy") : "No date"}</span>
                      </div>
                      <Button asChild size="sm" variant="outline" className="h-8 rounded-lg text-[12px] font-semibold bg-white shadow-sm hover:bg-secondary">
                        <Link to={`/tasks?task=${task.id}`}>View Details</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MEMBERS TAB */}
        {activeTab === "members" && (
          <div className="bg-white rounded-2xl border border-border/70 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-border/50">
              <h3 className="text-[15px] font-bold text-foreground">Project Team</h3>
              <p className="text-[13px] text-muted-foreground mt-1">People assigned to this project.</p>
            </div>
            <div className="divide-y divide-border/50">
              {project.members?.map((member: any) => (
                <div key={member.id} className="p-4 px-6 flex items-center gap-4 hover:bg-secondary/20 transition-colors">
                  <Avatar className="h-10 w-10 border border-border/50">
                    <AvatarFallback className="bg-blue-600 text-[12px] font-semibold text-white">
                      {getInitials(member.employee_name || member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[14px] font-semibold text-foreground">{member.employee_name || member.name}</span>
                    <span className="text-[12px] text-muted-foreground">{[labelFor(PROJECT_ROLE_LABELS, member.role_in_project), member.employee_designation].filter((v) => v && v !== "—").join(" · ")}</span>
                  </div>
                </div>
              ))}
              {(!project.members || project.members.length === 0) && (
                <div className="p-8 text-center text-muted-foreground">No members assigned.</div>
              )}
            </div>
          </div>
        )}

        {/* ACTIVITY TAB */}
        {activeTab === "activity" && (
          <div className="bg-white rounded-2xl border border-border/70 shadow-sm p-6 sm:p-8">
            <h3 className="text-[15px] font-bold text-foreground mb-8">Recent Activity</h3>
            
            {/* Real timestamps only: project creation and each member's joined_at (no activity-log endpoint exists). */}
            <div className="space-y-6 max-w-2xl">
              {[
                ...(project.created_at ? [{ key: "created", at: project.created_at, title: "Project Created", desc: project.created_by_name ? `Created by ${project.created_by_name}.` : "The project was created.", icon: FolderKanban, tone: "bg-blue-50 border-blue-200 text-blue-600" }] : []),
                ...((project.members ?? []) as { id: number | string; employee_name?: string; joined_at?: string }[])
                  .filter((m) => m.joined_at)
                  .map((m) => ({ key: `m-${m.id}`, at: m.joined_at as string, title: `${m.employee_name || "A member"} joined`, desc: "Added to the project team.", icon: Users, tone: "bg-emerald-50 border-emerald-200 text-emerald-600" })),
              ]
                .sort((a, b) => b.at.localeCompare(a.at))
                .map((e, i, arr) => (
                  <div key={e.key} className="flex gap-5 relative">
                    {i !== arr.length - 1 && <div className="absolute left-[15px] top-[32px] bottom-[-24px] w-[2px] bg-border/50" />}
                    <div className={cn("relative z-10 w-8 h-8 rounded-full border flex items-center justify-center shrink-0", e.tone)}>
                      <e.icon className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col pt-1.5">
                      <span className="text-[14px] font-semibold text-foreground">{e.title}</span>
                      <span className="text-[13px] text-muted-foreground mt-0.5">{e.desc}</span>
                      <span className="text-[12px] font-medium text-muted-foreground/60 mt-1.5">{format(new Date(e.at), "MMM d, yyyy")}</span>
                    </div>
                  </div>
                ))}
            </div>

            <div className="mt-8 pt-8 border-t border-border/50 text-center">
              <p className="text-[13px] text-muted-foreground">End of activity timeline.</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
