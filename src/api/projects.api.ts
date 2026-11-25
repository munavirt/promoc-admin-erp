import { projectsAdapter } from "@/adapters/erp.adapters";
import type { Paginated } from "@/infrastructure/apiClient";

/** projects.models.ProjectStatus (CANCELLED = archived; hidden by the API). */
export type ProjectStatus = "PLANNING" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
export type ProjectPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type ProjectRole =
  | "PROJECT_MANAGER" | "FRONTEND" | "BACKEND" | "UI_UX" | "MOBILE"
  | "QA" | "SEO" | "CONTENT" | "DEVOPS" | "OTHER";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
/** Statuses that can be chosen in forms (CANCELLED is reached only via the archive action). */
export const SELECTABLE_PROJECT_STATUSES: ProjectStatus[] = ["PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED"];

export const PROJECT_PRIORITY_LABELS: Record<ProjectPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  PROJECT_MANAGER: "Project Manager",
  FRONTEND: "Frontend Developer",
  BACKEND: "Backend Developer",
  UI_UX: "UI/UX Designer",
  MOBILE: "Mobile Developer",
  QA: "QA Engineer",
  SEO: "SEO Specialist",
  CONTENT: "Content Writer",
  DEVOPS: "DevOps Engineer",
  OTHER: "Other",
};

export const labelFor = <K extends string>(labels: Record<K, string>, value?: string | null): string =>
  (value && (labels as Record<string, string>)[value]) || value || "—";

/** projects.api.serializers.ProjectMemberSerializer */
export interface ProjectMemberBackend {
  /** ProjectMember PK (used for DELETE). */
  id: number | string;
  /** Employee PK. */
  employee: number | string;
  employee_name?: string;
  employee_designation?: string;
  role_in_project?: ProjectRole | string;
  joined_at?: string;
}

/** Member type including legacy fields still used by mock-backed modules (tasks, employee portal). */
export interface ProjectMember extends Partial<ProjectMemberBackend> {
  id: number | string;
  name?: string;
  employee_id?: string;
  avatar?: string | null;
  role?: string;
}

/** Legacy client shape used by mock fixtures. */
export interface ClientSummary {
  id: string | number;
  name: string;
}

/** projects.api.serializers.ProjectSerializer */
export interface ProjectBackend {
  id: number | string;
  project_name: string;
  /** Client PK on the backend (object/string forms only in legacy mock data). */
  client: number | string | ClientSummary;
  client_name?: string;
  description?: string;
  status: ProjectStatus | string;
  priority: ProjectPriority | string;
  /** DecimalField(12,2) serialized as string, or null. */
  budget: string | number | null;
  start_date: string;
  deadline: string;
  progress: number;
  created_by?: string | null;
  created_by_name?: string | null;
  project_manager?: { id: number | string; name: string; designation: string } | null;
  members?: ProjectMember[];
  member_count?: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Writable ProjectSerializer fields. Required: project_name (255), client (ACTIVE client PK), start_date, deadline (YYYY-MM-DD).
 * Optional: description, status (default PLANNING), priority (default MEDIUM), budget (decimal ≥ 0, 12 digits / 2 dp, nullable),
 * progress (0–100, default 0). Rule: deadline ≥ start_date.
 */
export interface ProjectWritePayload {
  project_name: string;
  client: number | string;
  description?: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  budget?: string | null;
  start_date: string;
  deadline: string;
  progress?: number;
}

export type CreateProjectPayload = ProjectWritePayload;
export type UpdateProjectPayload = Partial<ProjectWritePayload>;

/** POST /api/projects/{id}/members/ (ProjectMemberCreateSerializer). */
export interface AssignMemberPayload {
  employee: number | string;
  role_in_project?: ProjectRole | string;
}

export interface ProjectListParams {
  page?: number;
  search?: string;
  status?: string;
  priority?: string;
  /** created_at | deadline | start_date | progress, "-" prefix for descending. */
  ordering?: string;
}

/** Subset of work_item.api.serializers.WorkItemSerializer shown on the project detail page. */
export interface ProjectWorkItem {
  id: number | string;
  project: number | string;
  title: string;
  status: string;
  priority: string;
  progress?: number;
  due_date?: string | null;
  assigned_to?: number | string | null;
  assigned_to_name?: string | null;
}

/** Client PK of a project, regardless of legacy shape. */
export const projectClientId = (p: Pick<ProjectBackend, "client">): string =>
  typeof p.client === "object" && p.client !== null ? String(p.client.id) : String(p.client);

/** Client display name of a project. */
export const projectClientName = (p: Pick<ProjectBackend, "client" | "client_name">): string =>
  p.client_name || (typeof p.client === "object" && p.client !== null ? p.client.name : "") || "—";

export const listProjects = (params: ProjectListParams = {}, signal?: AbortSignal): Promise<Paginated<ProjectBackend>> =>
  projectsAdapter.list(params, signal);

export const listAllProjects = (params: Omit<ProjectListParams, "page"> = {}, signal?: AbortSignal): Promise<ProjectBackend[]> =>
  projectsAdapter.listAll(params, signal);

/** Every visible project (legacy signature used by dashboard, reports and task forms). */
export const getProjects = (signal?: AbortSignal): Promise<ProjectBackend[]> => projectsAdapter.listAll({}, signal);

export const countProjects = async (
  params: Omit<ProjectListParams, "page" | "ordering"> = {},
  signal?: AbortSignal,
): Promise<number> => (await projectsAdapter.list(params, signal)).count;

/**
 * Projects of one client. There is no `?client=` filter, so this searches by the client's company name
 * (search covers client__company_name — a superset of the client's projects) and keeps exact client-id matches.
 */
export const getClientProjects = async (
  client: { id: number | string; company_name: string },
  signal?: AbortSignal,
): Promise<ProjectBackend[]> => {
  const candidates = await projectsAdapter.listAll({ search: client.company_name }, signal);
  return candidates.filter((p) => projectClientId(p) === String(client.id));
};

export const getProject = (id: string | number, signal?: AbortSignal): Promise<ProjectBackend> =>
  projectsAdapter.getById(id, signal);

export const createProject = (data: ProjectWritePayload): Promise<ProjectBackend> => projectsAdapter.create(data);

export const updateProject = (id: string | number, data: UpdateProjectPayload): Promise<ProjectBackend> =>
  projectsAdapter.update(id, data);

/** DELETE /api/projects/{id}/ — soft delete (status CANCELLED, hidden by the API). */
export const archiveProject = (id: string | number): Promise<{ message: string }> => projectsAdapter.archive(id);
export const deleteProject = archiveProject;

export const getProjectMembers = (id: string | number, signal?: AbortSignal): Promise<ProjectMemberBackend[]> =>
  projectsAdapter.getMembers(id, signal);

export const assignMember = (projectId: string | number, data: AssignMemberPayload): Promise<ProjectMemberBackend> =>
  projectsAdapter.assignMember(projectId, data);

export const removeMember = (projectId: string | number, memberId: string | number): Promise<{ message: string }> =>
  projectsAdapter.removeMember(projectId, memberId);

export const getProjectWorkItems = (projectId: string | number, signal?: AbortSignal): Promise<ProjectWorkItem[]> =>
  projectsAdapter.listWorkItems(projectId, signal);
