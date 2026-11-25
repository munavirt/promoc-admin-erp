import { useStore } from "@/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Calendar, Video, Bell, ArrowRight, Play, AlertCircle, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getMeTasks } from "@/api/me.api";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export function EmployeeDashboardPage() {
  const { currentUser, meetings, activities } = useStore();

  const { data: realTasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ["me-tasks"],
    queryFn: ({ signal }) => getMeTasks(signal),
  });

  // Filter assigned entities
  const myTasks = realTasks;
  const myMeetings = meetings;
  const myActivities = activities.filter((a) => a.userInitials === currentUser?.initials).slice(0, 5);

  // Find an "in progress" task for Section 1
  const activeTask = myTasks.find(t => t.status === "IN_PROGRESS") || myTasks.find(t => t.status === "TODO");

  if (isLoadingTasks) {
    return <div className="p-12 flex justify-center text-muted-foreground animate-pulse">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground">
          Good morning, {currentUser?.name?.split(" ")[0] || "User"}
        </h1>
        <p className="text-muted-foreground text-[15px]">
          Here's what you need to focus on today.
        </p>
      </div>

      {/* Section 1: Continue Working */}
      {activeTask && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Continue Working</h2>
          <Card className="p-8 rounded-[16px] shadow-sm border border-primary/20 bg-primary/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
            {/* Decorative background element */}
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl"></div>
            
            <div className="flex flex-col gap-3 relative z-10">
              <div className="flex items-center gap-2 text-[13px] font-medium text-primary">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                {activeTask.status === "IN_PROGRESS" ? "In Progress" : "Pending"}
              </div>
              <div>
                <h3 className="text-2xl font-bold text-foreground">{activeTask.title}</h3>
                <p className="text-[15px] text-muted-foreground mt-1">{typeof activeTask.project === 'object' ? (activeTask.project as any).name : activeTask.project_name || activeTask.project}</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-4 mt-2 text-[13px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  Est. Time Remaining: <span className="font-medium text-foreground">{activeTask.estimated_hours ? `${activeTask.estimated_hours} Hours` : "--"}</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-border"></div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  Deadline: <span className="font-medium text-foreground">{activeTask.due_date ? format(new Date(activeTask.due_date), "MMM d, yyyy") : "No date"}</span>
                </div>
              </div>
            </div>

            <div className="relative z-10 w-full md:w-auto">
              <Link to={`/tasks/${activeTask.id}`}>
                <Button size="lg" className="w-full md:w-auto rounded-[10px] gap-2 shadow-md shadow-primary/20">
                  <Play className="w-4 h-4" /> Continue Working
                </Button>
              </Link>
            </div>
          </Card>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-10">
          {/* Section 2: Today's Tasks */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Today's Tasks</h2>
            </div>
            <div className="space-y-3">
              {myTasks.slice(0, 4).map((task) => (
                <Card key={task.id} className="p-4 rounded-[12px] shadow-sm flex items-center justify-between group hover:border-primary/40 transition-colors cursor-pointer">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[15px] font-semibold text-foreground">
                      {task.title}
                    </span>
                    <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <div className={cn("w-2 h-2 rounded-full", task.status === "COMPLETED" ? "bg-emerald-500" : task.status === "IN_PROGRESS" ? "bg-amber-500" : "bg-blue-500")}></div>
                        {typeof task.project === 'object' ? (task.project as any).name : task.project_name || task.project}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {task.estimated_hours ? `${task.estimated_hours}h` : "--"}
                      </span>
                      {(task.priority === "HIGH" || task.priority === "URGENT") && (
                        <>
                          <span>•</span>
                          <span className="text-red-600 font-medium">{task.priority} Priority</span>
                        </>
                      )}
                      <span>•</span>
                      <span className="text-muted-foreground">{task.due_date ? format(new Date(task.due_date), "MMM d, yyyy") : "No date"}</span>
                    </div>
                  </div>
                  <Link to={`/tasks/${task.id}`}>
                     <Button variant="secondary" size="sm" className="h-8 rounded-[8px] opacity-0 group-hover:opacity-100 transition-opacity">
                       Open Task
                     </Button>
                  </Link>
                </Card>
              ))}
            </div>
          </section>

          {/* Section 3: Needs Your Attention */}
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Needs Your Attention</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="p-4 rounded-[12px] shadow-sm flex items-start gap-3 hover:border-orange-500/30 transition-colors cursor-pointer">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 shrink-0 mt-0.5">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-[14px] font-semibold text-foreground">Changes Requested</h4>
                  <p className="text-[13px] text-muted-foreground mt-0.5 line-clamp-1">Homepage Hero Section</p>
                  <p className="text-[11px] font-medium text-orange-600 mt-2">2 hours ago</p>
                </div>
              </Card>
              <Card className="p-4 rounded-[12px] shadow-sm flex items-start gap-3 hover:border-blue-500/30 transition-colors cursor-pointer">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 mt-0.5">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-[14px] font-semibold text-foreground">Unread Comment</h4>
                  <p className="text-[13px] text-muted-foreground mt-0.5 line-clamp-1">Rachel left a note on "Onboarding Flow"</p>
                  <p className="text-[11px] font-medium text-blue-600 mt-2">Just now</p>
                </div>
              </Card>
            </div>
          </section>
        </div>

        <div className="space-y-10">
          {/* Section 4: Upcoming Meetings */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Upcoming Meetings</h2>
              <Link to="/meetings" className="text-[12px] text-primary hover:underline font-medium">
                View Calendar
              </Link>
            </div>
            <Card className="rounded-[12px] shadow-sm divide-y divide-border">
              {myMeetings.map((meeting) => (
                <div key={meeting.id} className="p-4 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-[14px]">{meeting.title}</h4>
                      <p className="text-[12px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                         <Clock className="w-3 h-3" /> {meeting.time}
                      </p>
                    </div>
                  </div>
                  <Button className="w-full h-8 text-[13px] rounded-[8px] gap-2" variant="secondary">
                    <Video className="w-3.5 h-3.5" /> Join Meeting
                  </Button>
                </div>
              ))}
            </Card>
          </section>

          {/* Section 5: Recent Activity */}
          <section>
             <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Recent Activity</h2>
             <Card className="rounded-[12px] shadow-sm p-4 space-y-4">
                <div className="flex gap-3 relative">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 z-10">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="absolute left-4 top-8 bottom-[-16px] w-px bg-border"></div>
                  <div className="pb-4">
                    <p className="text-[13px] font-medium text-foreground">Manager approved Homepage</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5">Ready for development handoff.</p>
                    <p className="text-[11px] font-medium text-muted-foreground mt-1.5">10m ago</p>
                  </div>
                </div>
                <div className="flex gap-3 relative">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 z-10">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="absolute left-4 top-8 bottom-[-16px] w-px bg-border"></div>
                  <div className="pb-4">
                    <p className="text-[13px] font-medium text-foreground">Client uploaded Logo</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5">"brand-assets-final.zip"</p>
                    <p className="text-[11px] font-medium text-muted-foreground mt-1.5">1h ago</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shrink-0 z-10">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-foreground">Task moved to Review</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5">You moved "Contact Page UI" to Review.</p>
                    <p className="text-[11px] font-medium text-muted-foreground mt-1.5">2h ago</p>
                  </div>
                </div>
             </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
