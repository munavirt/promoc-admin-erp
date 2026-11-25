/**
 * Real Project service — Django `projects` app (ProjectViewSet, IsAuthenticated + IsProjectMemberOrAdmin).
 *
 *   GET    /api/projects/                 ?page, search (project_name, client__company_name, description),
 *                                          status, priority, ordering (created_at, deadline, start_date, progress)
 *   POST   /api/projects/                 ProjectSerializer (client must be an ACTIVE client id)
 *   GET    /api/projects/{id}/
 *   PATCH  /api/projects/{id}/
 *   DELETE /api/projects/{id}/            soft delete: status=CANCELLED ("archived") → { message }
 *   GET    /api/projects/{id}/members/
 *   POST   /api/projects/{id}/members/    { employee, role_in_project } (admin only)
 *   DELETE /api/projects/{id}/members/{member_id}/  (admin only; hard delete of the membership row)
 *
 * NOTE: get_queryset() excludes status=CANCELLED, so archived projects are never listed and
 * their detail answers 404. There is no `client` filter (search by client name is supported).
 *
 * Related work items (read-only here): GET /api/work-items/?project={id}
 */
import type {
  AssignMemberPayload,
  ProjectBackend,
  ProjectListParams,
  ProjectMemberBackend,
  ProjectWorkItem,
  ProjectWritePayload,
} from "@/api/projects.api";
import { apiClient, cleanParams, isPaginated, type Paginated } from "@/infrastructure/apiClient";

const BASE = "/projects/";
const detailUrl = (id: string | number) => `${BASE}${encodeURIComponent(String(id))}/`;
const membersUrl = (id: string | number) => `${detailUrl(id)}members/`;
const MAX_PAGES = 100;

const WRITABLE_FIELDS = [
  "project_name",
  "client",
  "description",
  "status",
  "priority",
  "budget",
  "start_date",
  "deadline",
  "progress",
] as const;

function pickWritable(payload: Partial<ProjectWritePayload>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const key of WRITABLE_FIELDS) {
    if (payload[key] !== undefined) body[key] = payload[key];
  }
  if (body.budget === "") body.budget = null;
  return body;
}

async function walk<T>(firstUrl: string, params: Record<string, unknown>, signal?: AbortSignal): Promise<T[]> {
  const { data } = await apiClient.get<Paginated<T> | T[]>(firstUrl, { params: cleanParams(params), signal });
  if (!isPaginated<T>(data)) return Array.isArray(data) ? data : [];
  const all = [...data.results];
  let next = data.next;
  let pages = 1;
  while (next && pages < MAX_PAGES) {
    const res = await apiClient.get<Paginated<T>>(next, { signal });
    all.push(...res.data.results);
    next = res.data.next;
    pages += 1;
  }
  return all;
}

export const projectsService = {
  async list(params: ProjectListParams = {}, signal?: AbortSignal): Promise<Paginated<ProjectBackend>> {
    const { data } = await apiClient.get<Paginated<ProjectBackend> | ProjectBackend[]>(BASE, {
      params: cleanParams({ ...params }),
      signal,
    });
    if (isPaginated<ProjectBackend>(data)) return data;
    const list = Array.isArray(data) ? data : [];
    return { count: list.length, next: null, previous: null, results: list };
  },

  listAll(params: Omit<ProjectListParams, "page"> = {}, signal?: AbortSignal): Promise<ProjectBackend[]> {
    return walk<ProjectBackend>(BASE, { ...params }, signal);
  },

  async getById(id: string | number, signal?: AbortSignal): Promise<ProjectBackend> {
    const { data } = await apiClient.get<ProjectBackend>(detailUrl(id), { signal });
    return data;
  },

  async create(payload: ProjectWritePayload): Promise<ProjectBackend> {
    const { data } = await apiClient.post<ProjectBackend>(BASE, pickWritable(payload));
    return data;
  },

  async update(id: string | number, payload: Partial<ProjectWritePayload>): Promise<ProjectBackend> {
    const { data } = await apiClient.patch<ProjectBackend>(detailUrl(id), pickWritable(payload));
    return data;
  },

  /** Soft delete — backend sets status=CANCELLED and the project disappears from the API. */
  async archive(id: string | number): Promise<{ message: string }> {
    const { data } = await apiClient.delete<{ message: string }>(detailUrl(id));
    return data;
  },

  async getMembers(id: string | number, signal?: AbortSignal): Promise<ProjectMemberBackend[]> {
    const { data } = await apiClient.get<ProjectMemberBackend[] | Paginated<ProjectMemberBackend>>(membersUrl(id), { signal });
    return isPaginated<ProjectMemberBackend>(data) ? data.results : Array.isArray(data) ? data : [];
  },

  async assignMember(projectId: string | number, payload: AssignMemberPayload): Promise<ProjectMemberBackend> {
    const body: Record<string, unknown> = { employee: payload.employee };
    if (payload.role_in_project) body.role_in_project = payload.role_in_project;
    const { data } = await apiClient.post<ProjectMemberBackend>(membersUrl(projectId), body);
    return data;
  },

  async removeMember(projectId: string | number, memberId: string | number): Promise<{ message: string }> {
    const { data } = await apiClient.delete<{ message: string }>(
      `${membersUrl(projectId)}${encodeURIComponent(String(memberId))}/`,
    );
    return data;
  },

  /** Work items of a project (excludes CANCELLED, per backend default). Read-only use. */
  listWorkItems(projectId: string | number, signal?: AbortSignal): Promise<ProjectWorkItem[]> {
    return walk<ProjectWorkItem>("/work-items/", { project: projectId }, signal);
  },
};
