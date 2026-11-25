import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import type { TaskBackend, UpdateTaskPayload } from "@/api/tasks.api";
import { useTask, useUpdateTask } from "../hooks/use-tasks";
import { TaskForm, applyTaskFieldErrors, toAssigneeField, toTaskPayload, type TaskFormValues } from "../components/task-form";

function toFormValues(t: TaskBackend): TaskFormValues {
  return {
    title: t.title || "",
    project: String(t.project ?? ""),
    priority: (t.priority as TaskFormValues["priority"]) || "MEDIUM",
    taskStatus: (t.status as TaskFormValues["taskStatus"]) || "TODO",
    assignee: toAssigneeField(t.assigned_to),
    estimatedHours: t.estimated_hours === null || t.estimated_hours === undefined ? "" : String(Number(t.estimated_hours)),
    due: t.due_date || "",
    progress: Math.max(0, Math.min(100, Number(t.progress) || 0)),
    description: t.description || "",
  };
}

export function EditTaskPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { data: task, isLoading, isError, error, refetch, isFetching } = useTask(taskId);
  const updateTaskMutation = useUpdateTask();

  // Snapshot so background refetches don't reset unsaved edits.
  const [snapshot, setSnapshot] = useState<TaskBackend | null>(null);
  useEffect(() => {
    if (task && (!snapshot || String(snapshot.id) !== String(task.id))) setSnapshot(task);
  }, [task, snapshot]);
  const defaults = useMemo(() => (snapshot ? toFormValues(snapshot) : null), [snapshot]);

  const handleSubmit: React.ComponentProps<typeof TaskForm>["onSubmit"] = async (values, { setError }) => {
    if (!snapshot || !defaults) return;
    const next = toTaskPayload(values);
    const prev = toTaskPayload(defaults);
    // PATCH only changed fields. project / assigned_to are sent only when changed: the serializer
    // re-validates assigned_to (ACTIVE only), so re-sending a now-inactive assignee would fail.
    const payload: UpdateTaskPayload = {};
    (Object.keys(next) as (keyof typeof next)[]).forEach((key) => {
      if (String(next[key] ?? "") !== String(prev[key] ?? "")) (payload as Record<string, unknown>)[key] = next[key];
    });
    // The backend validates status/progress together — send both if either changed.
    if (payload.status !== undefined || payload.progress !== undefined) {
      payload.status = next.status;
      payload.progress = next.progress;
    }
    if (Object.keys(payload).length === 0) {
      toast.info("No changes to save.");
      navigate(`/tasks/${snapshot.id}`);
      return;
    }
    try {
      await updateTaskMutation.mutateAsync({ id: snapshot.id, data: payload });
    } catch (err) {
      applyTaskFieldErrors(err, setError);
      return;
    }
    toast.success("Task updated successfully.");
    navigate(`/tasks/${snapshot.id}`);
  };

  if (isLoading || (task && !defaults)) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-4 w-24 rounded bg-secondary/60" />
          <div className="h-10 w-64 rounded bg-secondary/60" />
          <div className="h-64 rounded-2xl bg-secondary/60" />
        </div>
      </AppLayout>
    );
  }

  if (isError || !task || !defaults || !snapshot) {
    const status = (error as { status?: number | null } | null)?.status;
    const notFound = status === 404 || !isError;
    return (
      <AppLayout>
        <div className="flex h-[400px] flex-col items-center justify-center gap-3 text-center">
          <AlertTriangle className="h-10 w-10 text-muted-foreground/40" />
          <h2 className="text-[18px] font-semibold text-foreground">{notFound ? "Task not found" : status === 403 ? "Access denied" : "Unable to load task"}</h2>
          {!notFound && <p className="max-w-sm text-[13px] text-muted-foreground">{extractApiErrorMessage(error, "Please try again.").message}</p>}
          {!notFound && status !== 403 && (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCcw className="mr-2 h-3.5 w-3.5" /> Retry
            </Button>
          )}
          <Link to="/tasks" className="text-sm text-primary hover:underline">Return to Tasks</Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Link to={`/tasks/${snapshot.id}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Task
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Edit Task</h1>
        <p className="mt-1 text-sm text-muted-foreground">Update details for {snapshot.title}.</p>
      </div>

      <TaskForm
        mode="edit"
        defaultValues={defaults}
        current={{
          projectId: String(snapshot.project),
          projectName: snapshot.project_name || `Project #${snapshot.project}`,
          assigneeId: snapshot.assigned_to === null || snapshot.assigned_to === undefined ? null : String(snapshot.assigned_to),
          assigneeName: snapshot.assigned_to_name,
        }}
        submitLabel="Save Changes"
        pendingLabel="Saving..."
        isPending={updateTaskMutation.isPending}
        onCancel={() => navigate(`/tasks/${snapshot.id}`)}
        onSubmit={handleSubmit}
      />
    </AppLayout>
  );
}
