import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/store";
import { getMeTasks, getMeProjects } from "@/api/me.api";
import { useNotificationCount } from "@/features/notifications/hooks/use-notifications";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  User, Mail, Phone, Briefcase, Building2, Calendar, Shield, 
  MapPin, HeartPulse, CheckSquare, FolderKanban, Activity, 
  Bell, Clock, CheckCircle2 
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export function EmployeeProfilePage() {
  const { currentUser } = useStore();

  const { data: tasks = [] } = useQuery({ queryKey: ["me-tasks"], queryFn: ({ signal }) => getMeTasks(signal) });
  const { data: projects = [] } = useQuery({ queryKey: ["me-projects"], queryFn: ({ signal }) => getMeProjects(signal) });
  // Exact unread total from /api/notifications/unread-count/.
  const { data: unreadNotificationsCount = 0 } = useNotificationCount();

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
  };

  const completedTasksCount = tasks.filter(t => t.status === "COMPLETED").length;
  const pendingTasksCount = tasks.filter(t => t.status !== "COMPLETED" && t.status !== "CANCELLED").length;
  const projectsCount = projects.length;
  // HR fields (department, employee ID, joining date, address, emergency contact) live on the Employee
  // record, which only admins can read (GET /api/employees/{id}/ is IsAdmin). No self-service endpoint exists.
  const HR_UNAVAILABLE = "Not available";
  const designation = tasks.find((t) => t.assigned_to_designation)?.assigned_to_designation || HR_UNAVAILABLE;

  // Recent activity from real task timestamps (no activity-log endpoint exists).
  const activity = tasks
    .flatMap((t) => [
      t.completed_at ? { key: `${t.id}-d`, at: t.completed_at, icon: CheckCircle2, title: "Completed Task", desc: t.title, color: "emerald" as const } : null,
      t.started_at ? { key: `${t.id}-s`, at: t.started_at, icon: Clock, title: "Started Task", desc: t.title, color: "amber" as const } : null,
      t.created_at ? { key: `${t.id}-c`, at: t.created_at, icon: CheckSquare, title: "Task Assigned", desc: t.title, color: "blue" as const } : null,
    ])
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 3);

  return (
    <div className="flex flex-col min-h-full w-full bg-[#F8F9FA] pb-10">
      <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1200px] mx-auto w-full space-y-8">
        
        <h1 className="text-2xl font-bold tracking-tight text-foreground mb-6">My Profile</h1>

        {/* Top Header Card */}
        <div className="rounded-2xl border border-border/70 bg-white p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-center md:items-start gap-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none">
            <User className="w-48 h-48" />
          </div>
          
          <Avatar className="h-28 w-28 border-4 border-white shadow-md ring-1 ring-border/50">
            <AvatarImage src="" />
            <AvatarFallback className="bg-blue-600 text-3xl font-bold text-white">
              {getInitials(currentUser?.name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex flex-col items-center md:items-start text-center md:text-left flex-1 z-10 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full justify-between">
              <div>
                <h2 className="text-2xl font-bold text-foreground">{currentUser?.name}</h2>
                <p className="text-[15px] font-medium text-blue-600 mt-0.5">Software Engineer</p>
              </div>
              <div className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-3 py-1 rounded-full text-[12px] font-bold uppercase tracking-wide self-center sm:self-start">
                Active Employee
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-4 gap-x-8 mt-8 w-full">
              <HeaderItem icon={Building2} label="Designation" value={designation} />
              <HeaderItem icon={Briefcase} label="Role" value={currentUser?.role === 'EMPLOYEE' ? 'Employee' : String(currentUser?.role || "—")} />
              <HeaderItem icon={Mail} label="Email" value={currentUser?.email || "N/A"} />
              <HeaderItem icon={Phone} label="Phone" value={currentUser?.phone || "N/A"} />
              <HeaderItem icon={Calendar} label="Account Created" value={currentUser?.date_joined ? format(new Date(currentUser.date_joined), "MMM d, yyyy") : "—"} />
            </div>
          </div>
        </div>

        {/* Info & Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-8">
            
            {/* Personal Information */}
            <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-border/50">
                <h3 className="text-[15px] font-bold text-foreground">Personal Information</h3>
                <p className="mt-0.5 text-[12px] text-muted-foreground">HR details are kept on your employee record, which only administrators can view.</p>
              </div>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-8">
                <InfoGroup label="Full Name" value={currentUser?.name} />
                <InfoGroup label="Email Address" value={currentUser?.email} />
                <InfoGroup label="Phone Number" value={currentUser?.phone || "—"} />
                <InfoGroup label="Address" value={HR_UNAVAILABLE} />
                <InfoGroup label="Emergency Contact" value={HR_UNAVAILABLE} />
              </div>
            </div>

            {/* Work Information */}
            <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-border/50">
                <h3 className="text-[15px] font-bold text-foreground">Work Information</h3>
              </div>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-8">
                <InfoGroup label="Role" value={currentUser?.role === 'EMPLOYEE' ? 'Employee' : currentUser?.role} />
                <InfoGroup label="Designation" value={designation} />
                <InfoGroup label="Department" value={HR_UNAVAILABLE} />
                <InfoGroup label="Joining Date" value={HR_UNAVAILABLE} />
                <InfoGroup label="Projects Assigned" value={projectsCount.toString()} />
                <InfoGroup label="Tasks Completed" value={completedTasksCount.toString()} />
              </div>
            </div>

            {/* Recent Activity */}
            <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-border/50">
                <h3 className="text-[15px] font-bold text-foreground">Recent Activity</h3>
              </div>
              <div className="p-6 space-y-6">
                {activity.length === 0 && <p className="text-[13px] text-muted-foreground">No task activity yet.</p>}
                {activity.map((e, i) => (
                  <ActivityTimelineItem key={e.key} icon={e.icon} title={e.title} desc={e.desc} time={formatDistanceToNow(new Date(e.at), { addSuffix: true })} color={e.color} isLast={i === activity.length - 1} />
                ))}
              </div>
            </div>

          </div>

          <div className="space-y-8">
            {/* Performance Summary */}
            <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-border/50">
                <h3 className="text-[15px] font-bold text-foreground">Performance Summary</h3>
              </div>
              <div className="p-6 space-y-4">
                <StatRow icon={CheckCircle2} label="Completed Tasks" value={completedTasksCount.toString()} color="emerald" />
                <StatRow icon={Clock} label="Pending Tasks" value={pendingTasksCount.toString()} color="amber" />
                <StatRow icon={FolderKanban} label="Projects" value={projectsCount.toString()} color="blue" />
                <StatRow icon={Bell} label="Notifications" value={unreadNotificationsCount.toString()} color="rose" />
              </div>
            </div>
            
          </div>
        </div>

      </div>
    </div>
  );
}

function HeaderItem({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-secondary/50 text-muted-foreground shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="text-[13px] font-semibold text-foreground truncate">{value}</span>
      </div>
    </div>
  );
}

function InfoGroup({ label, value }: { label: string, value?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-[14px] font-medium text-foreground">{value || "—"}</span>
    </div>
  );
}

function StatRow({ icon: Icon, label, value, color }: { icon: any, label: string, value: string, color: "blue" | "emerald" | "amber" | "rose" }) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
  };
  
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-border/70 hover:shadow-sm transition-all group">
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-lg border", colorMap[color])}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-[13px] font-semibold text-foreground">{label}</span>
      </div>
      <span className="text-[16px] font-bold text-foreground">{value}</span>
    </div>
  );
}

function ActivityTimelineItem({ icon: Icon, title, desc, time, color, isLast }: { icon: any, title: string, desc: string, time: string, color: "emerald" | "blue" | "amber", isLast?: boolean }) {
  const colorMap = {
    blue: "bg-blue-50 border-blue-200 text-blue-600",
    amber: "bg-amber-50 border-amber-200 text-amber-600",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-600",
  };
  
  return (
    <div className="flex gap-4 relative">
      {!isLast && (
        <div className="absolute left-[15px] top-[32px] bottom-[-24px] w-[2px] bg-border/50" />
      )}
      <div className={cn("relative z-10 w-8 h-8 rounded-full border flex items-center justify-center shrink-0", colorMap[color])}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex flex-col pt-1.5">
        <span className="text-[14px] font-semibold text-foreground">{title}</span>
        <span className="text-[13px] text-muted-foreground mt-0.5">{desc}</span>
        <span className="text-[12px] font-medium text-muted-foreground/60 mt-1.5">{time}</span>
      </div>
    </div>
  );
}
