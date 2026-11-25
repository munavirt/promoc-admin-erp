import { meAdapter } from "@/adapters/erp.adapters";
import type { ProjectBackend } from "./projects.api";
import type { TaskBackend } from "./tasks.api";

/** GET /api/me/projects/ (all pages) — the signed-in employee's projects. */
export const getMeProjects = (signal?: AbortSignal): Promise<ProjectBackend[]> => meAdapter.getMyProjects(signal);

/** GET /api/me/tasks/ (all pages) — work items assigned to the signed-in employee. */
export const getMeTasks = (signal?: AbortSignal): Promise<TaskBackend[]> => meAdapter.getMyTasks(signal);
