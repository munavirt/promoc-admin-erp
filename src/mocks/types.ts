import type { UserProfile } from "@/api/accounts.api";
import type { ClientBackend } from "@/api/clients.api";
import type { EmployeeBackend } from "@/api/employees.api";
import type { NotificationBackend } from "@/api/notifications.api";
import type { ProjectBackend, ProjectMember } from "@/api/projects.api";
import type { TaskBackend } from "@/api/tasks.api";
import type { UserBackend } from "@/api/users.api";

export type DemoRole = "ADMIN" | "MANAGER" | "EMPLOYEE";

/**
 * Employee fixture inside the mock ERP DB. Only consumed by modules still on mock data
 * (projects, tasks, employee portal); the Employees module itself reads the real backend.
 */
export type MockEmployeeRecord = Omit<EmployeeBackend, "id"> & { id: string };

export interface StoredProjectMember extends ProjectMember {
  employee_id: string;
  employee_name?: string;
  role_in_project?: string;
}

export interface StoredProjectRecord extends Omit<ProjectBackend, "client" | "members"> {
  clientId: string;
  members: StoredProjectMember[];
}

export interface MockMeetingRecord {
  id: string;
  title: string;
  date: string;
  time: string;
  attendees: number;
  type: "Internal" | "Client" | "Review";
  projectId?: string | number;
}

export interface MockFileRecord {
  id: string;
  name: string;
  size: string;
  project: string;
  uploaded: string;
  kind: "doc" | "image" | "zip";
}

export interface MockActivityRecord {
  id: string;
  user: string;
  userInitials: string;
  action: string;
  target: string;
  timestamp: string;
  createdAtIso?: string;
  projectId?: string | number;
}

export interface MockWorkspaceSettings {
  agencyName: string;
  workspaceSlug: string;
  defaultTimezone: string;
}

export interface DemoSessionRecord {
  token: string;
  email: string;
  roleOverride?: DemoRole;
  loggedInAt: string;
}

export interface ErpMockDatabase {
  version: number;
  users: UserBackend[];
  clients: ClientBackend[];
  employees: MockEmployeeRecord[];
  projects: StoredProjectRecord[];
  tasks: TaskBackend[];
  notifications: NotificationBackend[];
  meetings: MockMeetingRecord[];
  files: MockFileRecord[];
  activities: MockActivityRecord[];
  workspace: MockWorkspaceSettings;
  userProfileOverrides: Record<string, Partial<UserProfile & { phone?: string; timezone?: string }>>;
  counters: {
    user: number;
    client: number;
    employee: number;
    project: number;
    task: number;
    notification: number;
    member: number;
  };
}

export class MockValidationError extends Error {
  fieldErrors: Record<string, string[]>;
  status: number;

  constructor(message: string, fieldErrors: Record<string, string[]> = {}, status = 400) {
    super(message);
    this.name = "MockValidationError";
    this.fieldErrors = fieldErrors;
    this.status = status;
  }
}
