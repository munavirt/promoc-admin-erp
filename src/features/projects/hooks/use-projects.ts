import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  getProjects, getProject, createProject, updateProject, archiveProject,
  getProjectMembers, assignMember, removeMember, getProjectWorkItems,
  type CreateProjectPayload, type UpdateProjectPayload, type AssignMemberPayload,
} from "@/api/projects.api";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { toast } from "sonner";

/**
 * Query keys
 *   ["projects"]                    every visible project (dashboard, reports, pickers)
 *   ["projects", "list", params]    one server page
 *   ["projects", "stats"]           summary counts
 *   ["project", id]                 detail; ["project", id, "members"], ["project", id, "work-items"]
 * Project changes also affect client data: ["client", id, "projects"] and ["clients", "stats"] (Projects Running).
 */
export function invalidateProjectData(queryClient: QueryClient, projectId?: string | number) {
  queryClient.invalidateQueries({ queryKey: ["projects"] });
  if (projectId !== undefined) queryClient.invalidateQueries({ queryKey: ["project", String(projectId)] });
  queryClient.invalidateQueries({ queryKey: ["client"] });
  queryClient.invalidateQueries({ queryKey: ["clients", "stats"] });
}

export const useProjects = () => {
  return useQuery({
    queryKey: ["projects"],
    queryFn: ({ signal }) => getProjects(signal),
  });
};

export const useProject = (id?: string | number) => {
  return useQuery({
    queryKey: ["project", String(id)],
    queryFn: ({ signal }) => getProject(id as string | number, signal),
    enabled: id !== undefined && id !== "",
  });
};

/** Create/update mutations leave error display (field errors) to the form. */
export const useCreateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProjectPayload) => createProject(data),
    onSuccess: (project) => invalidateProjectData(queryClient, project?.id),
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string | number; data: UpdateProjectPayload }) => updateProject(id, data),
    onSuccess: (_data, variables) => invalidateProjectData(queryClient, variables.id),
  });
};

/** DELETE is a soft archive (status CANCELLED) on the backend. */
export const useArchiveProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string | number) => archiveProject(id),
    onSuccess: (res, id) => {
      invalidateProjectData(queryClient, id);
      toast.success(res?.message || "Project archived successfully.");
    },
    onError: (err) => {
      toast.error(extractApiErrorMessage(err, "Failed to archive project.").message);
    },
  });
};
/** Legacy name. */
export const useDeleteProject = useArchiveProject;

export const useProjectMembers = (id?: string | number) => {
  return useQuery({
    queryKey: ["project", String(id), "members"],
    queryFn: ({ signal }) => getProjectMembers(id as string | number, signal),
    enabled: id !== undefined && id !== "",
  });
};

export const useProjectWorkItems = (id?: string | number) => {
  return useQuery({
    queryKey: ["project", String(id), "work-items"],
    queryFn: ({ signal }) => getProjectWorkItems(id as string | number, signal),
    enabled: id !== undefined && id !== "",
  });
};

/** Callers decide on toasts so batch assignment can report partial failure accurately. */
export const useAssignMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string | number; data: AssignMemberPayload }) =>
      assignMember(projectId, data),
    onSettled: (_d, _e, variables) => invalidateProjectData(queryClient, variables.projectId),
  });
};

export const useRemoveMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, memberId }: { projectId: string | number; memberId: string | number }) =>
      removeMember(projectId, memberId),
    onSuccess: (_res, variables) => {
      invalidateProjectData(queryClient, variables.projectId);
      toast.success("Member removed from the project.");
    },
    onError: (err) => {
      toast.error(extractApiErrorMessage(err, "Failed to remove member.").message);
    },
  });
};
