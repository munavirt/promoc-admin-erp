import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  getTasks, getTask, getDueTodayTasks, getMyTasks, getOverdueTasks,
  createTask, updateTask, archiveTask, assignEmployee, updateTaskProgress, updateTaskStatus,
  getTaskComments, addTaskComment, getTaskAttachments, uploadTaskAttachment,
  type CreateTaskPayload, type UpdateTaskPayload,
} from "@/api/tasks.api";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { toast } from "sonner";

/**
 * Query keys
 *   ["tasks"]                     all visible tasks (dashboard/reports); ["tasks","list",params]; ["tasks","stats"]; ["tasks","board",…]
 *   ["task", id] (+ "comments" / "attachments")
 *   ["me-tasks"]                  employee portal
 *   ["project", id, "work-items"] project detail Tasks tab
 *   ["dueToday"], ["overdueTasks"], ["myTasks"]
 */
export function invalidateTaskData(queryClient: QueryClient, taskId?: string | number) {
  queryClient.invalidateQueries({ queryKey: ["tasks"] });
  if (taskId !== undefined) queryClient.invalidateQueries({ queryKey: ["task", String(taskId)] });
  queryClient.invalidateQueries({ queryKey: ["me-tasks"] });
  queryClient.invalidateQueries({ queryKey: ["project"] });
  queryClient.invalidateQueries({ queryKey: ["dueToday"] });
  queryClient.invalidateQueries({ queryKey: ["overdueTasks"] });
  queryClient.invalidateQueries({ queryKey: ["myTasks"] });
}

export const useTasks = () =>
  useQuery({ queryKey: ["tasks"], queryFn: ({ signal }) => getTasks(signal) });

export const useTask = (id?: string | number) =>
  useQuery({
    queryKey: ["task", String(id)],
    queryFn: ({ signal }) => getTask(id as string | number, signal),
    enabled: id !== undefined && id !== "",
  });

export const useDueTodayTasks = () => useQuery({ queryKey: ["dueToday"], queryFn: ({ signal }) => getDueTodayTasks(signal) });
export const useMyTasks = () => useQuery({ queryKey: ["myTasks"], queryFn: ({ signal }) => getMyTasks(signal) });
export const useOverdueTasks = () => useQuery({ queryKey: ["overdueTasks"], queryFn: ({ signal }) => getOverdueTasks(signal) });

/** Create/update leave error display (field errors) to the form. */
export const useCreateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTaskPayload) => createTask(data),
    onSuccess: (res) => {
      invalidateTaskData(queryClient, res.task?.id);
      // A new assigned task creates a notification for the assignee (backend signal).
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
};

export const useUpdateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string | number; data: UpdateTaskPayload }) => updateTask(id, data),
    onSuccess: (_d, v) => invalidateTaskData(queryClient, v.id),
  });
};

/** DELETE is a soft archive (status CANCELLED). */
export const useArchiveTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string | number) => archiveTask(id),
    onSuccess: (res, id) => {
      invalidateTaskData(queryClient, id);
      toast.success(res?.message || "Task archived.");
    },
    onError: (err) => toast.error(extractApiErrorMessage(err, "Failed to archive task.").message),
  });
};
export const useDeleteTask = useArchiveTask;

export const useAssignEmployee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, assigned_to }: { id: string | number; assigned_to: string | number }) => assignEmployee(id, assigned_to),
    onSuccess: (_d, v) => invalidateTaskData(queryClient, v.id),
  });
};

export const useUpdateTaskProgress = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, progress }: { id: string | number; progress: number }) => updateTaskProgress(id, progress),
    onSuccess: (_d, v) => {
      invalidateTaskData(queryClient, v.id);
      toast.success("Progress updated.");
    },
    onError: (err) => toast.error(extractApiErrorMessage(err, "Failed to update progress.").message),
  });
};

/** PATCH /work-items/{id}/update_status/ — backend also stamps started_at / completed_at (and progress 100). */
export const useUpdateTaskStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string | number; status: string }) => updateTaskStatus(id, status),
    onSuccess: (_d, v) => {
      invalidateTaskData(queryClient, v.id);
      toast.success("Task status updated.");
    },
    onError: (err) => toast.error(extractApiErrorMessage(err, "Failed to update task status.").message),
  });
};

export const useTaskComments = (id?: string | number) =>
  useQuery({
    queryKey: ["task", String(id), "comments"],
    queryFn: ({ signal }) => getTaskComments(id as string | number, signal),
    enabled: id !== undefined && id !== "",
  });

export const useAddTaskComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string | number; comment: string }) => addTaskComment(id, comment),
    onSuccess: (_d, v) => queryClient.invalidateQueries({ queryKey: ["task", String(v.id)] }),
  });
};

export const useTaskAttachments = (id?: string | number) =>
  useQuery({
    queryKey: ["task", String(id), "attachments"],
    queryFn: ({ signal }) => getTaskAttachments(id as string | number, signal),
    enabled: id !== undefined && id !== "",
  });

export const useUploadTaskAttachment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file, onProgress, signal }: { id: string | number; file: File; onProgress?: (f: number) => void; signal?: AbortSignal }) =>
      uploadTaskAttachment(id, file, { onProgress, signal }),
    onSuccess: (_d, v) => queryClient.invalidateQueries({ queryKey: ["task", String(v.id)] }),
  });
};
