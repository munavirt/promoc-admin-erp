/**
 * ERP Data Adapter Layer
 *
 * Connects the frontend API layer to domain services.
 * - Authentication and Employees: real Django REST backend (Phase 1).
 * - Clients and Projects: real Django REST backend (Phase 2).
 * - Tasks (work items), comments, attachments, notifications, employee portal (/api/me): real backend (Phase 3).
 * - All other modules: still backed by mock domain services until their integration phase.
 */
import { authService } from "@/services/api/auth.service";
import { employeesService } from "@/services/api/employees.service";
import { clientsService } from "@/services/api/clients.service";
import { projectsService } from "@/services/api/projects.service";
import { meService } from "@/services/api/me.service";
import { notificationsService } from "@/services/api/notifications.service";
import { tasksService } from "@/services/api/tasks.service";
import { mockUsersService } from "@/services/mock/mock-users.service";
import { mockWorkspaceService } from "@/services/mock/mock-workspace.service";

export const authAdapter = authService;
export const employeesAdapter = employeesService;

export const clientsAdapter = clientsService;
export const usersAdapter = mockUsersService;
export const projectsAdapter = projectsService;
export const tasksAdapter = tasksService;
export const notificationsAdapter = notificationsService;
export const meAdapter = meService;
export const workspaceAdapter = mockWorkspaceService;
