/**
 * Employee portal — Django `me` app (IsAuthenticated; empty for users without an employee profile).
 *   GET /me/projects/  projects the employee is a member of (excludes CANCELLED), paginated
 *   GET /me/tasks/     work items assigned to the employee (excludes CANCELLED), paginated
 */
import type { ProjectBackend } from "@/api/projects.api";
import type { TaskBackend } from "@/api/tasks.api";
import { apiClient, isPaginated, type Paginated } from "@/infrastructure/apiClient";

async function walk<T>(url: string, signal?: AbortSignal): Promise<T[]> {
  const { data } = await apiClient.get<Paginated<T> | T[]>(url, { signal });
  if (!isPaginated<T>(data)) return Array.isArray(data) ? data : [];
  const all = [...data.results];
  let next = data.next;
  let pages = 1;
  while (next && pages < 100) {
    const res = await apiClient.get<Paginated<T>>(next, { signal });
    all.push(...res.data.results);
    next = res.data.next;
    pages += 1;
  }
  return all;
}

export const meService = {
  getMyProjects: (signal?: AbortSignal) => walk<ProjectBackend>("/me/projects/", signal),
  getMyTasks: (signal?: AbortSignal) => walk<TaskBackend>("/me/tasks/", signal),
};
