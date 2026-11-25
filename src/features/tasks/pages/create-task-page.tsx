import { useMemo } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/app-layout";
import { uploadTaskAttachment } from "@/api/tasks.api";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { invalidateTaskData, useCreateTask } from "../hooks/use-tasks";
import { TaskForm, EMPTY_TASK_FORM, applyTaskFieldErrors, toTaskPayload } from "../components/task-form";

export function CreateTaskPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const createTaskMutation = useCreateTask();
  // Optional ?project=<id> preselects the project (e.g. from a project page).
  const defaults = useMemo(() => ({ ...EMPTY_TASK_FORM, project: params.get("project") || "" }), [params]);

  const handleSubmit: React.ComponentProps<typeof TaskForm>["onSubmit"] = async (values, { setError, files }) => {
    // 1. POST /api/work-items/ (assignment notification is created by the backend signal)
    let result;
    try {
      result = await createTaskMutation.mutateAsync(toTaskPayload(values));
    } catch (err) {
      applyTaskFieldErrors(err, setError);
      return;
    }
    const task = result.task;
    if (!task) {
      // POST response has no id; the record could not be matched unambiguously.
      toast.success("Task created.");
      if (files.length) toast.warning("The new task could not be located to upload its files. Open it from the task list and upload them there.", { duration: 10000 });
      navigate("/tasks");
      return;
    }

    // 2. Upload queued files to the real task (multipart, one request per file).
    const failed: string[] = [];
    for (const file of files) {
      try {
        await uploadTaskAttachment(task.id, file);
      } catch (err) {
        const { message, fieldErrors } = extractApiErrorMessage(err, "Upload failed.");
        failed.push(`${file.name}: ${fieldErrors?.file?.join(" ") || message}`);
      }
    }
    invalidateTaskData(queryClient, task.id);
    if (failed.length) {
      toast.warning(`Task created, but ${failed.length} of ${files.length} file${files.length === 1 ? "" : "s"} could not be uploaded. ${failed.join(" · ")}`, { duration: 12000 });
    } else {
      toast.success(files.length ? `Task created with ${files.length} attachment${files.length === 1 ? "" : "s"}.` : "Task created successfully.");
    }
    navigate(`/tasks/${task.id}`);
  };

  return (
    <AppLayout>
      <Link to="/tasks" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to Tasks
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Create Task</h1>
        <p className="mt-1 text-sm text-muted-foreground">Add a new task and assign it to a team member.</p>
      </div>

      <TaskForm
        mode="create"
        defaultValues={defaults}
        submitLabel="Create Task"
        pendingLabel="Creating..."
        isPending={createTaskMutation.isPending}
        onCancel={() => navigate("/tasks")}
        onSubmit={handleSubmit}
      />
    </AppLayout>
  );
}
