import { useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { useStore, Priority, Task } from "@/store";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Search, CheckCircle2, CircleDashed, AlertCircle, Clock, Paperclip, MessageSquare, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const taskSchema = z.object({
  title: z.string().min(2, "Title is required"),
  project: z.string().min(2, "Project is required"),
  assignee: z.string().min(2, "Assignee initials required"),
  priority: z.enum(["Low", "Medium", "High"]),
  due: z.string().min(2, "Due date is required"),
});

const taskForm = taskSchema;

export default function TasksPage() {
  const { tasks, projects, employees, addTask, updateTaskStatus, currentUser } = useStore();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(taskSchema),
    defaultValues: { priority: "Medium" }
  });

  const filtered = tasks.filter((t) => {
    if (currentUser?.role === "Employee" && t.assignee !== currentUser.initials) {
      return false;
    }
    return [t.title, t.project].some((v) => v.toLowerCase().includes(query.toLowerCase()));
  });

  const todoTasks = filtered.filter(t => !t.done);
  const doneTasks = filtered.filter(t => t.done);

  const onSubmit = (data) => {
    addTask({
      id: crypto.randomUUID(),
      ...data,
      done: false,
      estimatedTime: "1h",
      labels: [],
      commentsCount: 0,
      attachmentsCount: 0,
    });
    setOpen(false);
    reset();
  };


  return (
    <PageShell
      title="Tasks"
      description={`Track your open action items · ${todoTasks.length} pending`}
      actions={
        <Button size="sm" className="h-[34px] gap-1.5 px-3 text-[13px] shadow-sm" onClick={() => setOpen((v) => !v)}>
          <Plus className="h-4 w-4" /> New Task
        </Button>
      }
    >
      <div className="max-w-[1400px] mx-auto h-[calc(100vh-160px)] flex flex-col">
        {open && (
          <form onSubmit={handleSubmit(onSubmit)} className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm shrink-0">
            <div className="mb-4">
              <h3 className="text-[14px] font-semibold text-foreground">Create New Task</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
              <div className="md:col-span-2">
                <input {...register("title")} placeholder="Task title..." className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
                {errors.title && <span className="text-[11px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.title.message}</span>}
              </div>
              <div>
                <input {...register("project")} placeholder="Project name" className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
                {errors.project && <span className="text-[11px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.project.message}</span>}
              </div>
              <div>
                <select {...register("priority")} className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors">
                  <option value="Low">Low Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="High">High Priority</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input {...register("assignee")} placeholder="Assignee (e.g. AM)" maxLength={3} className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] uppercase focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
                <Button type="submit" size="sm" className="h-[34px] shadow-sm shrink-0">Add</Button>
              </div>
            </div>
          </form>
        )}

        <div className="mb-6 flex items-center gap-2 shrink-0">
          <div className="relative w-full max-w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks by name or project…" className="h-[34px] w-full rounded-md border border-border bg-card pl-9 pr-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors shadow-sm" />
          </div>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-hidden hide-scrollbar">
          <div className="flex gap-6 h-full min-w-max pb-4">
            
            {/* To Do Column */}
            <div className="flex flex-col w-[350px] shrink-0 bg-secondary/30 rounded-xl border border-border/50">
              <div className="p-3.5 border-b border-border/50 flex items-center justify-between sticky top-0 bg-secondary/30 backdrop-blur rounded-t-xl z-10">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <h3 className="text-[13px] font-semibold text-foreground">To Do</h3>
                  <span className="flex h-5 items-center justify-center rounded-full bg-background border border-border/50 px-2 text-[11px] font-medium text-muted-foreground">
                    {todoTasks.length}
                  </span>
                </div>
                <button className="text-muted-foreground hover:text-foreground transition-colors"><Plus className="w-4 h-4" /></button>
              </div>
              <div className="p-3 flex-1 overflow-y-auto space-y-3">
                {todoTasks.map(t => (
                  <TaskCard key={t.id} task={t} />
                ))}
              </div>
            </div>

            {/* Completed Column */}
            <div className="flex flex-col w-[350px] shrink-0 bg-secondary/30 rounded-xl border border-border/50 opacity-80 hover:opacity-100 transition-opacity">
              <div className="p-3.5 border-b border-border/50 flex items-center justify-between sticky top-0 bg-secondary/30 backdrop-blur rounded-t-xl z-10">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <h3 className="text-[13px] font-semibold text-foreground">Completed</h3>
                  <span className="flex h-5 items-center justify-center rounded-full bg-background border border-border/50 px-2 text-[11px] font-medium text-muted-foreground">
                    {doneTasks.length}
                  </span>
                </div>
              </div>
              <div className="p-3 flex-1 overflow-y-auto space-y-3">
                {doneTasks.map(t => (
                  <TaskCard key={t.id} task={t} />
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </PageShell>
  );
}

function TaskCard({ task }) {
  const { updateTaskStatus } = useStore();
  return (
    <div className={cn(
      "group relative flex flex-col gap-3 rounded-lg border bg-card p-3.5 shadow-sm transition-all hover:shadow hover:border-primary/40",
      task.done && "opacity-60 grayscale-[0.5] bg-secondary/20"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button onClick={() => updateTaskStatus(task.id, !task.done)} className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors">
            {task.done ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <CircleDashed className="h-4 w-4" />}
          </button>
          <div>
            <Link to={`/tasks/${task.id}`} className={cn("text-[13px] font-medium leading-snug hover:underline", task.done ? "text-muted-foreground line-through" : "text-foreground")}>{task.title}</Link>
            <p className="mt-1 text-[11px] font-medium text-muted-foreground">{task.project}</p>
          </div>
        </div>
        <button className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-all">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center flex-wrap gap-2">
        {task.priority === "High" && <span className="inline-flex items-center rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600 ring-1 ring-inset ring-red-500/20">High Priority</span>}
        {task.priority === "Medium" && <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 ring-1 ring-inset ring-amber-500/20">Medium</span>}
        {task.labels?.map(l => (
          <span key={l} className="inline-flex items-center rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-inset ring-border">{l}</span>
        ))}
      </div>

      <div className="mt-1 flex items-center justify-between pt-3 border-t border-border/50">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {task.due && (
             <div className={cn("flex items-center gap-1", task.due === "Today" && !task.done ? "text-amber-600 font-medium" : "")}>
              <Clock className="h-3 w-3" /> {task.due}
            </div>
          )}
          {(task.commentsCount > 0 || task.attachmentsCount > 0) && (
            <div className="flex items-center gap-2">
              {task.commentsCount > 0 && <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {task.commentsCount}</span>}
              {task.attachmentsCount > 0 && <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" /> {task.attachmentsCount}</span>}
            </div>
          )}
        </div>
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-[9px] font-bold text-foreground shadow-sm" title={task.assignee}>
          {task.assignee}
        </div>
      </div>
    </div>
  );
}