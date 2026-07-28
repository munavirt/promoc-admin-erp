import { Link, useParams, useNavigate } from "react-router-dom";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { useStore } from "@/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Calendar, CheckCircle2, CircleDashed, Paperclip, MessageSquare, Plus, FileText, Image as ImageIcon, Send, Activity, User, FolderKanban, Flag, Play } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TaskDetailsPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { tasks, currentUser, updateTaskStatus } = useStore();
  const task = tasks.find(t => t.id === taskId);

  if (!task) {
    return (
      <DashboardShell>
        <div className="flex h-[400px] flex-col items-center justify-center">
          <h2 className="text-[18px] font-semibold text-foreground">Task not found</h2>
          <Link to="/tasks" className="mt-4 text-[13px] text-primary hover:underline">Return to tasks</Link>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="animate-in fade-in duration-500 max-w-5xl mx-auto space-y-6">
        
        {/* Header Breadcrumb */}
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <button onClick={() => navigate(-1)} className="hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span>/</span>
          <Link to="/projects" className="hover:text-foreground transition-colors">
             {task.project}
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium truncate max-w-[200px]">{task.title}</span>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column - Core Task Data */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Title & Status */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className={cn("px-2.5 py-1 text-[11px] font-semibold rounded-full uppercase tracking-wider", 
                  task.done ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600"
                )}>
                  {task.done ? "Ready For Review" : "In Progress"}
                </div>
                {task.priority === "High" && (
                  <div className="px-2.5 py-1 text-[11px] font-semibold rounded-full uppercase tracking-wider bg-red-500/10 text-red-600">
                    High Priority
                  </div>
                )}
              </div>
              <h1 className="text-[28px] font-bold text-foreground leading-tight">
                {task.title}
              </h1>
            </div>

            {/* Description */}
            <div className="space-y-3">
              <h2 className="text-[15px] font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" /> Description
              </h2>
              <div className="text-[14px] text-muted-foreground leading-relaxed prose prose-sm dark:prose-invert">
                <p>This task involves creating the core UI for the requested feature. Ensure all padding aligns with the design system and responsiveness is handled for mobile and tablet views.</p>
              </div>
            </div>

            {/* Acceptance Criteria */}
            <div className="space-y-3">
              <h2 className="text-[15px] font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-muted-foreground" /> Acceptance Criteria
              </h2>
              <Card className="p-4 rounded-[12px] bg-secondary/30 border-border/50">
                <ul className="space-y-2 text-[14px] text-foreground">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    Header should stick to the top on mobile.
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    Form validation must show inline error messages.
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    Hover states match the Figma prototype exact timing.
                  </li>
                </ul>
              </Card>
            </div>

            {/* Reference Images */}
            <div className="space-y-3">
              <h2 className="text-[15px] font-semibold flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-muted-foreground" /> Reference Images
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="aspect-video bg-secondary/50 rounded-[8px] border border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                  <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <div className="aspect-video bg-secondary/50 rounded-[8px] border border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                  <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
                </div>
              </div>
            </div>

            {/* Comments */}
            <div className="space-y-4 pt-6 border-t border-border/50">
              <h2 className="text-[15px] font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-muted-foreground" /> Comments
              </h2>
              
              <div className="space-y-4">
                {/* Mock Comment */}
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[12px] font-medium text-primary shrink-0">
                    SM
                  </div>
                  <div className="flex-1 bg-secondary/30 rounded-[12px] p-4 border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-semibold">Sarah Manager</span>
                      <span className="text-[11px] text-muted-foreground">Yesterday at 2:30 PM</span>
                    </div>
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      Make sure to check the latest Figma file, I updated the padding on the cards.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                 <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-[12px] font-medium text-foreground shrink-0">
                    {currentUser?.initials}
                 </div>
                 <div className="flex-1 relative">
                   <textarea 
                     className="w-full min-h-[80px] bg-background border border-border rounded-[12px] p-3 text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                     placeholder="Add a comment..."
                   />
                   <Button size="sm" className="absolute bottom-2 right-2 h-7 rounded-[6px] gap-1.5 px-3">
                     <Send className="w-3 h-3" /> Post
                   </Button>
                 </div>
              </div>
            </div>

          </div>

          {/* Right Column - Meta & Actions */}
          <div className="space-y-6">
            
            {/* Quick Actions */}
            <Card className="p-5 rounded-[16px] shadow-sm flex flex-col gap-3">
               <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Quick Actions</h3>
               {!task.done ? (
                 <Button 
                   onClick={() => updateTaskStatus(task.id, true)} 
                   className="w-full justify-start gap-2 h-9 rounded-[8px]"
                 >
                   <CheckCircle2 className="w-4 h-4" /> Mark Ready For Review
                 </Button>
               ) : (
                 <Button 
                   onClick={() => updateTaskStatus(task.id, false)} 
                   variant="outline"
                   className="w-full justify-start gap-2 h-9 rounded-[8px]"
                 >
                   <CircleDashed className="w-4 h-4" /> Move back to In Progress
                 </Button>
               )}
               <Button variant="secondary" className="w-full justify-start gap-2 h-9 rounded-[8px]">
                 <Paperclip className="w-4 h-4" /> Upload Files
               </Button>
               <Button variant="secondary" className="w-full justify-start gap-2 h-9 rounded-[8px]">
                 <MessageSquare className="w-4 h-4" /> Add Comment
               </Button>
            </Card>

            {/* Project Info */}
            <Card className="p-5 rounded-[16px] shadow-sm space-y-4">
               <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">Project Context</h3>
               <div className="space-y-3 text-[13px]">
                 <div className="flex items-center justify-between">
                   <span className="flex items-center gap-2 text-muted-foreground">
                     <FolderKanban className="w-4 h-4" /> Project
                   </span>
                   <Link to={`/projects`} className="font-medium hover:underline">
                     {task.project}
                   </Link>
                 </div>
                 <div className="flex items-center justify-between">
                   <span className="flex items-center gap-2 text-muted-foreground">
                     <Flag className="w-4 h-4" /> Milestone
                   </span>
                   <span className="font-medium">Phase 2: Core UI</span>
                 </div>
                 <div className="flex items-center justify-between">
                   <span className="flex items-center gap-2 text-muted-foreground">
                     <Calendar className="w-4 h-4" /> Deadline
                   </span>
                   <span className="font-medium">{task.due}</span>
                 </div>
               </div>
            </Card>

            {/* Time Tracking */}
            <Card className="p-5 rounded-[16px] shadow-sm space-y-4">
               <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                 Time Tracking
                 <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
                   <Play className="w-3 h-3" />
                 </Button>
               </h3>
               <div className="space-y-3">
                 <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                   <div className="h-full bg-primary rounded-full" style={{ width: "45%" }}></div>
                 </div>
                 <div className="flex justify-between text-[12px]">
                   <span className="text-foreground font-medium">2h 15m spent</span>
                   <span className="text-muted-foreground">Est. {task.estimatedTime}</span>
                 </div>
               </div>
            </Card>

            {/* Activity Timeline */}
            <Card className="p-5 rounded-[16px] shadow-sm space-y-4">
               <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">Activity Timeline</h3>
               <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-[11px] before:w-px before:bg-border pl-1">
                 <div className="flex gap-3 relative">
                   <div className="w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center shrink-0 z-10">
                     <Plus className="w-3 h-3 text-muted-foreground" />
                   </div>
                   <div className="pt-1">
                     <p className="text-[12px] text-foreground font-medium">Task created</p>
                     <p className="text-[11px] text-muted-foreground">Yesterday at 9:00 AM</p>
                   </div>
                 </div>
                 <div className="flex gap-3 relative">
                   <div className="w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center shrink-0 z-10">
                     <User className="w-3 h-3 text-muted-foreground" />
                   </div>
                   <div className="pt-1">
                     <p className="text-[12px] text-foreground font-medium">Assigned to you</p>
                     <p className="text-[11px] text-muted-foreground">Yesterday at 9:05 AM</p>
                   </div>
                 </div>
                 <div className="flex gap-3 relative">
                   <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 z-10">
                     <Activity className="w-3 h-3 text-primary" />
                   </div>
                   <div className="pt-1">
                     <p className="text-[12px] text-foreground font-medium">Moved to In Progress</p>
                     <p className="text-[11px] text-muted-foreground">Today at 10:30 AM</p>
                   </div>
                 </div>
               </div>
            </Card>

          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
