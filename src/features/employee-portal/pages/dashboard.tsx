import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/store";
import { getMeTasks, getMeProjects } from "@/api/me.api";
import { getAllNotifications } from "@/api/notifications.api";
import { CheckCircle2, Clock, CalendarIcon, AlertCircle, LayoutDashboard, ChevronRight, Bell, FolderKanban, Activity, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { format, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/shared/status-badge";

function getInitials(name?: string) {
  if (!name) return "U";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
}

export function EmployeeDashboard() {
  const { currentUser } = useStore();

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["me-tasks"],
    queryFn: ({ signal }) => getMeTasks(signal),
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["me-projects"],
    queryFn: ({ signal }) => getMeProjects(signal),
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: ({ signal }) => getAllNotifications(signal),
  });

  const pendingTasks = tasks.filter(t => t.status !== "COMPLETED" && t.status !== "CANCELLED");
  const completedTasks = tasks.filter(t => t.status === "COMPLETED");
  
  const dueTodayTasks = pendingTasks.filter(t => {
    if (!t.due_date) return false;
    const [y, m, d] = String(t.due_date).split("-").map(Number);
    return Boolean(y && m && d) && isToday(new Date(y, m - 1, d));
  });

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  // Recent activity from the employee's real task timestamps (no activity-log endpoint exists).
  const timeline = tasks
    .flatMap((t) => [
      t.created_at ? { id: `${t.id}-c`, at: t.created_at, title: "Task assigned", desc: t.title, icon: Bell } : null,
      t.started_at ? { id: `${t.id}-s`, at: t.started_at, title: "Task started", desc: t.title, icon: AlertCircle } : null,
      t.completed_at ? { id: `${t.id}-d`, at: t.completed_at, title: "Task completed", desc: t.title, icon: CheckCircle2 } : null,
    ])
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 4)
    .map((e) => ({ ...e, time: format(new Date(e.at), "MMM d, h:mm a") }));

  return (
    <div className="flex flex-col min-h-full w-full bg-[#F8F9FA] pb-10">
      <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto w-full space-y-8">
        
        {/* Welcome Card */}
        <div className="rounded-2xl border border-border/70 bg-white p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none">
            <LayoutDashboard className="w-48 h-48" />
          </div>
          <Avatar className="h-16 w-16 border-2 border-white shadow-sm ring-1 ring-border/50">
            <AvatarImage src="" />
            <AvatarFallback className="bg-blue-600 text-lg font-bold text-white">
              {getInitials(currentUser?.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1.5 z-10">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              {greeting()}, {currentUser?.name?.split(' ')[0]} <span className="animate-wave inline-block origin-[70%_70%]">👋</span>
            </h1>
            <p className="text-muted-foreground text-sm font-medium">
              Welcome back. You have <strong className="text-foreground">{pendingTasks.length} pending tasks</strong> today. {dueTodayTasks.length > 0 && <span className="text-red-500 font-semibold">{dueTodayTasks.length} tasks are due today.</span>}
            </p>
          </div>
          <div className="sm:ml-auto z-10 flex flex-col items-start sm:items-end gap-1 text-sm font-medium text-muted-foreground">
            <CalendarIcon className="w-4 h-4 mb-0.5" />
            {format(new Date(), "EEEE, MMMM do")}
          </div>
        </div>

        {/* Quick Statistics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Assigned Tasks" 
            value={tasks.length.toString()} 
            icon={LayoutDashboard}
            color="blue"
          />
          <StatCard 
            title="Pending Tasks" 
            value={pendingTasks.length.toString()} 
            icon={Clock}
            color="amber"
          />
          <StatCard 
            title="Completed Tasks" 
            value={completedTasks.length.toString()} 
            icon={CheckCircle2}
            color="emerald"
          />
          <StatCard 
            title="Assigned Projects" 
            value={projects.length.toString()} 
            icon={FolderKanban}
            color="rose"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Main Column */}
          <div className="xl:col-span-2 space-y-6">
            
            {/* Today's Tasks */}
            <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-6 py-5 border-b border-border/50">
                <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  Today's Tasks
                </h2>
                <Link to="/tasks" className="text-[13px] font-medium text-blue-600 hover:underline">View All</Link>
              </div>
              <div className="divide-y divide-border/50">
                {dueTodayTasks.map((task) => (
                  <div key={task.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 px-6 hover:bg-secondary/20 transition-colors gap-4">
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <span className="text-[14px] font-semibold text-foreground truncate">{task.title}</span>
                      <div className="flex items-center gap-2 text-[12px] text-muted-foreground font-medium">
                        <FolderKanban className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[150px]">{task.project_name || `Project #${task.project}`}</span>
                        <span>•</span>
                        <span className={cn(
                          "px-1.5 py-0.5 rounded-[4px] uppercase text-[10px] tracking-wide font-bold",
                          task.priority === "HIGH" || task.priority === "URGENT" ? "bg-red-50 text-red-600" :
                          task.priority === "MEDIUM" ? "bg-amber-50 text-amber-600" :
                          "bg-blue-50 text-blue-600"
                        )}>
                          {task.priority}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <StatusBadge status={task.status} />
                      <Link to={`/tasks?task=${task.id}`} className="flex items-center justify-center p-2 rounded-lg border border-border/50 hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))}
                {dueTodayTasks.length === 0 && (
                  <div className="p-10 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    </div>
                    <span className="text-[14px] font-semibold text-foreground">No tasks due today</span>
                    <span className="text-[13px] text-muted-foreground mt-1">You're all caught up for the day!</span>
                  </div>
                )}
              </div>
            </div>

            {/* Active Projects */}
            <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-6 py-5 border-b border-border/50">
                <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-blue-500" />
                  Active Projects
                </h2>
                <Link to="/projects" className="text-[13px] font-medium text-blue-600 hover:underline">View All</Link>
              </div>
              <div className="divide-y divide-border/50">
                {projects.slice(0, 3).map((project) => (
                  <div key={project.id} className="p-4 px-6 hover:bg-secondary/20 transition-colors flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-[14px] font-semibold text-foreground truncate">{project.project_name}</span>
                        <span className="text-[12px] text-muted-foreground font-medium">Due {format(new Date(project.deadline), "MMM d, yyyy")}</span>
                      </div>
                      <Link to={`/projects/${project.id}`} className="flex items-center gap-1.5 text-[12px] font-medium text-blue-600 hover:underline">
                        View <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                        <span>Progress</span>
                        <span>{project.progress}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-blue-500 transition-all duration-1000 ease-out" 
                          style={{ width: `${project.progress}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {projects.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground text-[14px]">
                    No active projects found.
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Sidebar Column */}
          <div className="space-y-6">
            
            {/* Recent Notifications */}
            <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden flex flex-col">
              <div className="px-6 py-5 border-b border-border/50">
                <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
                  <Bell className="w-4 h-4 text-blue-500" />
                  Recent Notifications
                </h2>
              </div>
              <div className="divide-y divide-border/50">
                {notifications.slice(0, 4).map((notif) => (
                  <div key={notif.id} className="p-5 flex gap-3 hover:bg-secondary/10 transition-colors">
                    <div className="mt-0.5">
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full mt-1 border-2 border-white ring-1 ring-border/50",
                        notif.is_read ? "bg-muted" : "bg-blue-500"
                      )} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className={cn("text-[13px]", notif.is_read ? "text-foreground font-medium" : "text-foreground font-semibold")}>
                        {notif.title}
                      </span>
                      <span className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {notif.message}
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground/80 mt-1">
                        {format(new Date(notif.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                  </div>
                ))}
                {notifications.length === 0 && (
                  <div className="p-6 text-center text-muted-foreground text-[13px]">
                    No recent notifications.
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden flex flex-col">
              <div className="px-6 py-5 border-b border-border/50">
                <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  Recent Activity
                </h2>
              </div>
              <div className="p-6 space-y-6">
                {timeline.length === 0 && (
                  <p className="text-center text-[13px] text-muted-foreground">No task activity yet.</p>
                )}
                {timeline.map((item, i) => (
                  <div key={item.id} className="flex gap-4 relative">
                    {i !== timeline.length - 1 && (
                      <div className="absolute left-[15px] top-[30px] bottom-[-24px] w-[1px] bg-border/80" />
                    )}
                    <div className="relative z-10 w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 text-muted-foreground">
                      <item.icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex flex-col pt-1">
                      <span className="text-[13px] font-semibold text-foreground">{item.title}</span>
                      <span className="text-[12px] text-muted-foreground mt-0.5">{item.desc}</span>
                      <span className="text-[11px] font-medium text-muted-foreground/60 mt-1">{item.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: { title: string, value: string, icon: any, color: "blue" | "amber" | "emerald" | "rose" }) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-white p-5 sm:p-6 shadow-sm flex flex-col gap-4 relative overflow-hidden group hover:border-border hover:shadow-md transition-all duration-300">
      <div className="flex items-center justify-between z-10">
        <span className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
        <div className={cn("p-2 rounded-[10px] border shadow-sm", colorMap[color])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="z-10 mt-1">
        <span className="text-3xl font-bold tracking-tight text-foreground">{value}</span>
      </div>
      <div className={cn("absolute -bottom-6 -right-6 w-32 h-32 rounded-full opacity-[0.03] transition-transform duration-700 group-hover:scale-[1.2]", colorMap[color].split(" ")[0])} />
    </div>
  );
}
