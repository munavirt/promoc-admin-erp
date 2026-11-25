import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getMeTasks } from "@/api/me.api";
import { labelForTaskStatus, type TaskBackend } from "@/api/tasks.api";
import { useTask, useUpdateTaskStatus } from "@/features/tasks/hooks/use-tasks";
import { TaskComments } from "@/features/tasks/components/task-comments";
import { TaskAttachments } from "@/features/tasks/components/task-attachments";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Clock, CheckCircle2, AlertCircle, CalendarIcon, LayoutGrid, List as ListIcon, FolderKanban, X, Loader2, RefreshCcw } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function EmployeeTasksPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [sortFilter, setSortFilter] = useState<string>("DUE_DATE");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  // The open drawer is driven by ?task=<id> so notifications can deep-link to a task.
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTaskId = searchParams.get("task");
  const openTask = (id: string | number | null) => {
    const next = new URLSearchParams(searchParams);
    if (id === null) next.delete("task");
    else next.set("task", String(id));
    setSearchParams(next, { replace: id === null });
  };

  // GET /api/me/tasks/ (all pages) — the complete list of this employee's tasks, so the
  // filters, sorting and counts below are exact.
  const { data: tasks = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["me-tasks"],
    queryFn: ({ signal }) => getMeTasks(signal),
  });

  // PATCH /api/work-items/{id}/update_status/ (allowed for the assignee; stamps started/completed times).
  const updateStatusMutation = useUpdateTaskStatus();

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (statusFilter !== "ALL") {
      result = result.filter(t => t.status === statusFilter);
    }
    if (priorityFilter !== "ALL") {
      result = result.filter(t => t.priority === priorityFilter);
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(lower) || 
        (typeof t.project === 'object' && (t.project as any).name?.toLowerCase().includes(lower)) ||
        (typeof t.project_name === 'string' && t.project_name.toLowerCase().includes(lower))
      );
    }
    
    // Sort
    result = [...result].sort((a, b) => {
      switch (sortFilter) {
        case "DUE_DATE":
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return a.due_date.localeCompare(b.due_date);
        case "PRIORITY":
          const pOrder: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
          return (pOrder[b.priority] || 0) - (pOrder[a.priority] || 0);
        case "RECENTLY_ASSIGNED":
          return new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime();
        case "NEWEST":
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        case "OLDEST":
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [tasks, searchTerm, statusFilter, priorityFilter, sortFilter]);

  // Statistics (complete list → exact)
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const pendingCount = tasks.filter(t => t.status === "TODO").length;
  const inProgressCount = tasks.filter(t => t.status === "IN_PROGRESS").length;
  const completedCount = tasks.filter(t => t.status === "COMPLETED").length;
  const overdueCount = tasks.filter(t => {
    const d = parseLocalDate(t.due_date);
    return t.status !== "COMPLETED" && t.status !== "CANCELLED" && d !== null && d < todayStart;
  }).length;

  const handleStatusChange = (id: number | string, newStatus: string) => {
    updateStatusMutation.mutate({ id, status: newStatus });
  };

  return (
    <div className="flex flex-col min-h-full w-full bg-[#F8F9FA] pb-10">
      <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto w-full space-y-8">
        
        {/* Header & Stats */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-6">Tasks</h1>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard title="Pending" value={pendingCount.toString()} icon={AlertCircle} color="amber" />
            <StatCard title="In Progress" value={inProgressCount.toString()} icon={Clock} color="blue" />
            <StatCard title="Completed" value={completedCount.toString()} icon={CheckCircle2} color="emerald" />
            <StatCard title="Overdue" value={overdueCount.toString()} icon={CalendarIcon} color="rose" />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-border/70 shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search tasks..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 border-none bg-secondary/50 focus-visible:ring-1 focus-visible:bg-white h-10 rounded-lg text-[13px]"
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full sm:w-[140px] bg-secondary/50 border-none focus:ring-1 focus:bg-white h-10 rounded-lg text-[13px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Priorities</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortFilter} onValueChange={setSortFilter}>
              <SelectTrigger className="w-full sm:w-[150px] bg-secondary/50 border-none focus:ring-1 focus:bg-white h-10 rounded-lg text-[13px]">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DUE_DATE">Due Date</SelectItem>
                <SelectItem value="PRIORITY">Priority</SelectItem>
                <SelectItem value="RECENTLY_ASSIGNED">Recently Assigned</SelectItem>
                <SelectItem value="NEWEST">Newest</SelectItem>
                <SelectItem value="OLDEST">Oldest</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px] bg-secondary/50 border-none focus:ring-1 focus:bg-white h-10 rounded-lg text-[13px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="TODO">To Do</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="IN_REVIEW">In Review</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>
            <div className="hidden sm:flex items-center bg-secondary/50 p-1 rounded-lg">
              <button 
                onClick={() => setViewMode("list")}
                className={cn("p-1.5 rounded-md transition-colors", viewMode === "list" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                <ListIcon className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode("grid")}
                className={cn("p-1.5 rounded-md transition-colors", viewMode === "grid" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Task List/Grid */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-white border border-border/70 animate-pulse" />)}
          </div>
        ) : isError ? (
          <div className="p-12 text-center bg-white rounded-xl border border-dashed border-border/70 flex flex-col items-center shadow-sm gap-2">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <h3 className="text-[15px] font-semibold text-foreground">Unable to load your tasks</h3>
            <p className="text-[13px] text-muted-foreground">{extractApiErrorMessage(error, "Please try again.").message}</p>
            <Button size="sm" variant="outline" className="mt-2 gap-1.5" onClick={() => void refetch()}><RefreshCcw className="h-3.5 w-3.5" /> Retry</Button>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-dashed border-border/70 flex flex-col items-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-[15px] font-semibold text-foreground">{tasks.length === 0 ? "No tasks assigned to you" : "No tasks found"}</h3>
            <p className="text-[13px] text-muted-foreground mt-1">{tasks.length === 0 ? "Tasks assigned to you will appear here." : "Try adjusting your filters or search term."}</p>
          </div>
        ) : (
          <div className={cn(
            viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" : "space-y-4"
          )}>
            {filteredTasks.map(task => (
              <TaskCard 
                key={task.id} 
                task={task} 
                viewMode={viewMode}
                onViewDetails={() => openTask(task.id)}
                onStatusChange={(status) => handleStatusChange(task.id, status)}
                pending={updateStatusMutation.isPending && updateStatusMutation.variables?.id === task.id}
              />
            ))}
          </div>
        )}

        {/* Task Detail Drawer */}
        <Sheet open={!!selectedTaskId} onOpenChange={(open) => !open && openTask(null)}>
          <SheetContent className="w-full sm:max-w-[500px] border-l p-0 flex flex-col bg-[#F8F9FA] overflow-y-auto custom-scrollbar">
            <SheetHeader className="sr-only"><SheetTitle>Task details</SheetTitle></SheetHeader>
            {selectedTaskId && (
              <TaskDetailDrawer
                taskId={selectedTaskId}
                fallback={tasks.find((t) => String(t.id) === selectedTaskId)}
                onClose={() => openTask(null)}
                onStatusChange={(status) => handleStatusChange(selectedTaskId, status)}
                statusPending={updateStatusMutation.isPending}
              />
            )}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

// Subcomponents

/** YYYY-MM-DD as a local calendar date. */
function parseLocalDate(value?: string | null) {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
const fmtDate = (value: string | null | undefined, pattern: string, empty: string) => {
  const d = parseLocalDate(value);
  return d ? format(d, pattern) : empty;
};

function StatCard({ title, value, icon: Icon, color }: { title: string, value: string, icon: any, color: "blue" | "amber" | "emerald" | "rose" }) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-white p-5 shadow-sm flex items-center gap-4 relative overflow-hidden group hover:shadow-md transition-all">
      <div className={cn("p-3 rounded-xl border shadow-sm z-10", colorMap[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex flex-col z-10">
        <span className="text-2xl font-bold tracking-tight text-foreground">{value}</span>
        <span className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
      </div>
      <div className={cn("absolute -bottom-6 -right-6 w-24 h-24 rounded-full opacity-[0.03] transition-transform duration-700 group-hover:scale-[1.2]", colorMap[color].split(" ")[0])} />
    </div>
  );
}

function TaskCard({ task, viewMode, onViewDetails, onStatusChange, pending }: { task: TaskBackend, viewMode: "grid" | "list", onViewDetails: () => void, onStatusChange: (status: string) => void, pending?: boolean }) {
  const projectName = task.project_name || `Project #${task.project}`;

  return (
    <div className={cn(
      "bg-white border border-border/70 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group flex",
      viewMode === "grid" ? "flex-col" : "flex-col sm:flex-row sm:items-center p-4 gap-4"
    )}>
      {viewMode === "grid" && (
        <div className="p-5 flex flex-col gap-4 border-b border-border/50">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1 min-w-0">
              <h3 className="text-[15px] font-semibold text-foreground line-clamp-2">{task.title}</h3>
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
                <FolderKanban className="w-3.5 h-3.5" />
                <span className="truncate">{projectName}</span>
              </div>
            </div>
            <StatusBadge status={labelForTaskStatus(task.status)} />
          </div>
        </div>
      )}

      {viewMode === "list" && (
        <>
          <div className="flex flex-col gap-1 min-w-0 flex-1 pl-2">
            <h3 className="text-[15px] font-semibold text-foreground truncate">{task.title}</h3>
            <div className="flex items-center gap-3 text-[12px] font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5"><FolderKanban className="w-3.5 h-3.5" /> {projectName}</span>
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
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 sm:gap-6 mt-4 sm:mt-0">
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground min-w-[100px]">
              <CalendarIcon className="w-3.5 h-3.5" />
              {fmtDate(task.due_date, "MMM d, yyyy", "No date")}
            </div>
            <div className="hidden lg:flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground min-w-[80px]">
              <Clock className="w-3.5 h-3.5" />
              {task.estimated_hours ? `${task.estimated_hours}h` : "--"}
            </div>
            <div className="min-w-[110px]">
              <StatusBadge status={labelForTaskStatus(task.status)} />
            </div>
          </div>
        </>
      )}

      <div className={cn(
        "flex items-center gap-3 bg-secondary/10",
        viewMode === "grid" ? "p-4" : "sm:border-l border-border/50 sm:pl-6 ml-auto"
      )}>
        {viewMode === "grid" && (
          <div className="flex flex-col gap-0.5 flex-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Due Date</span>
            <span className="text-[13px] font-medium text-foreground">{fmtDate(task.due_date, "MMM d, yyyy", "No date set")}</span>
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto sm:ml-0">
          {task.status === "TODO" && (
            <Button size="sm" variant="outline" disabled={pending} className="h-8 rounded-lg text-[12px] font-semibold bg-white text-blue-600 hover:text-blue-700 shadow-sm border-blue-100 hover:bg-blue-50" onClick={() => onStatusChange("IN_PROGRESS")}>
              {pending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Start Task
            </Button>
          )}
          {task.status === "IN_PROGRESS" && (
            <Button size="sm" variant="outline" disabled={pending} className="h-8 rounded-lg text-[12px] font-semibold bg-white text-emerald-600 hover:text-emerald-700 shadow-sm border-emerald-100 hover:bg-emerald-50" onClick={() => onStatusChange("IN_REVIEW")}>
              {pending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Submit for Review
            </Button>
          )}
          {task.status === "IN_REVIEW" && (
            <div className="h-8 flex items-center px-3 rounded-lg text-[12px] font-semibold bg-secondary text-muted-foreground shadow-sm">
              Under Review
            </div>
          )}
          <Button size="sm" className="h-8 rounded-lg text-[12px] font-semibold bg-foreground text-background hover:bg-foreground/90 shadow-sm" onClick={onViewDetails}>
            View Details
          </Button>
        </div>
      </div>
    </div>
  );
}

function TaskDetailDrawer({ taskId, fallback, onClose, onStatusChange, statusPending }: {
  taskId: string;
  fallback?: TaskBackend;
  onClose: () => void;
  onStatusChange?: (status: string) => void;
  statusPending?: boolean;
}) {
  // GET /api/work-items/{id}/ — the employee may only open tasks assigned to them (404 otherwise).
  const taskQuery = useTask(taskId);
  const task = taskQuery.data ?? fallback;

  if (!task) {
    const notFound = (taskQuery.error as { status?: number | null } | null)?.status === 404;
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        {taskQuery.isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <>
            <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-[15px] font-semibold text-foreground">{notFound ? "Task not available" : "Unable to load task"}</p>
            <p className="text-[13px] text-muted-foreground">
              {notFound ? "It may have been archived or reassigned to someone else." : extractApiErrorMessage(taskQuery.error, "Please try again.").message}
            </p>
            <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
          </>
        )}
      </div>
    );
  }

  const projectName = task.project_name || `Project #${task.project}`;

  return (
    <>
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-border/50 px-6 py-4 flex items-center justify-between">
        <StatusBadge status={labelForTaskStatus(task.status)} />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Close" className="h-8 w-8 rounded-full" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-8">
        
        {/* Header Info */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-foreground leading-snug">{task.title}</h2>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground bg-white px-3 py-1.5 rounded-lg border border-border/70 shadow-sm">
              <FolderKanban className="w-4 h-4 text-blue-500" />
              {projectName}
            </div>
            <div className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground bg-white px-3 py-1.5 rounded-lg border border-border/70 shadow-sm">
              <AlertCircle className={cn(
                "w-4 h-4",
                task.priority === "HIGH" || task.priority === "URGENT" ? "text-red-500" :
                task.priority === "MEDIUM" ? "text-amber-500" : "text-blue-500"
              )} />
              {task.priority} Priority
            </div>
          </div>
          {task.description && (
            <div className="bg-white p-5 rounded-xl border border-border/70 shadow-sm mt-2">
              <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Description</h4>
              <p className="text-[14px] text-foreground leading-relaxed whitespace-pre-wrap">{task.description}</p>
            </div>
          )}
        </div>

        {/* Meta Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl border border-border/70 shadow-sm flex flex-col gap-1.5 hover:shadow-md transition-shadow">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><CalendarIcon className="w-3.5 h-3.5" /> Due Date</span>
            <span className="text-[14px] font-semibold text-foreground">{fmtDate(task.due_date, "MMMM d, yyyy", "No date set")}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-border/70 shadow-sm flex flex-col gap-1.5 hover:shadow-md transition-shadow">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Estimated Time</span>
            <span className="text-[14px] font-semibold text-foreground">{task.estimated_hours ? `${task.estimated_hours} Hours` : "Not specified"}</span>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white p-5 rounded-xl border border-border/70 shadow-sm">
          <h4 className="text-[14px] font-bold text-foreground mb-5">Activity Timeline</h4>
          <div className="space-y-5">
            <div className="flex gap-4 relative">
              <div className="absolute left-[11px] top-[24px] bottom-[-20px] w-[2px] bg-border/50" />
              <div className="relative z-10 w-6 h-6 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
              </div>
              <div className="flex flex-col pt-0.5">
                <span className="text-[13px] font-semibold text-foreground">Task Created</span>
                <span className="text-[12px] font-medium text-muted-foreground mt-0.5">
                  {task.created_at ? format(new Date(task.created_at), "MMM d, h:mm a") : "—"}
                  {task.assigned_to_name ? ` • Assigned to ${task.assigned_to_name}` : ""}
                </span>
              </div>
            </div>
            {task.started_at && (
              <div className="flex gap-4 relative">
                <div className="absolute left-[11px] top-[24px] bottom-[-20px] w-[2px] bg-border/50" />
                <div className="relative z-10 w-6 h-6 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                </div>
                <div className="flex flex-col pt-0.5">
                  <span className="text-[13px] font-semibold text-foreground">Started Task</span>
                  <span className="text-[12px] font-medium text-muted-foreground mt-0.5">{format(new Date(task.started_at), "MMM d, h:mm a")}</span>
                </div>
              </div>
            )}
            {task.completed_at && (
              <div className="flex gap-4 relative">
                <div className="relative z-10 w-6 h-6 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <div className="flex flex-col pt-0.5">
                  <span className="text-[13px] font-semibold text-foreground">Marked as Completed</span>
                  <span className="text-[12px] font-medium text-muted-foreground mt-0.5">{format(new Date(task.completed_at), "MMM d, h:mm a")}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Edit Section */}
        <div className="space-y-6 pt-6 border-t border-border/50">
          <h4 className="text-[14px] font-bold text-foreground">Task Updates</h4>
          
          {/* Attachments — GET/POST /api/work-items/{id}/attachments/ */}
          <div className="space-y-3">
            <h5 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">Attachments</h5>
            <TaskAttachments taskId={task.id} compact />
          </div>

          {/* Comments — GET/POST /api/work-items/{id}/comments/ */}
          <div className="space-y-4">
            <h5 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">Comments</h5>
            <TaskComments taskId={task.id} compact />
          </div>

          {/* Action Footer */}
          {task.status === "TODO" && onStatusChange && (
            <div className="pt-4 flex justify-end">
              <Button size="lg" variant="outline" disabled={statusPending} className="w-full sm:w-auto" onClick={() => onStatusChange("IN_PROGRESS")}>
                {statusPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Start Task
              </Button>
            </div>
          )}
          {task.status === "IN_PROGRESS" && onStatusChange && (
            <div className="pt-4 flex justify-end">
              <Button size="lg" disabled={statusPending} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" onClick={() => onStatusChange("IN_REVIEW")}>
                {statusPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit for Review
              </Button>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
