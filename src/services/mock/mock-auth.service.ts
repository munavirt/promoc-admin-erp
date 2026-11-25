import type { LoginResponse, UserProfile } from "@/api/accounts.api";
import {
  clearDemoSession,
  getDemoSession,
  getErpDatabase,
  saveDemoSession,
  updateErpDatabase,
} from "@/mocks/persistence";
import { MockValidationError, type DemoRole } from "@/mocks/types";

/**
 * DEMO AUTHENTICATION SERVICE (LOCAL / DEVELOPMENT MOCK).
 *
 * NOT used for application sign-in since Phase 1 — real JWT auth lives in
 * `src/services/api/auth.service.ts`. Retained only because the mock Employee Portal
 * services (mock-me / mock-tasks) still read the demo session until their own integration.
 *
 * Provides standalone mock authentication for frontend development and demonstrations.
 * Supports demo login credentials for:
 * - Admin: admin@promocraft.co / 1234
 * - Manager: rachel@promocraft.co / 1234
 * - Employee: kai@promocraft.co / 1234
 */
export const DEMO_ADMIN_EMAIL = "admin@promocraft.co";
export const DEMO_ADMIN_PASSWORD = "1234";
export const DEMO_MANAGER_EMAIL = "rachel@promocraft.co";
export const DEMO_EMPLOYEE_EMAIL = "kai@promocraft.co";

function getInitials(name?: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  return parts
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

function buildDemoProfile(roleOverride?: DemoRole): UserProfile & {
  initials: string;
  phone?: string;
  timezone?: string;
  isDemoRoleOverride?: boolean;
  linkedEmployeeId?: string;
} {
  const db = getErpDatabase();
  const effectiveRole: DemoRole = roleOverride || "ADMIN";

  // When simulating EMPLOYEE preview, bind to Kai Lombardi (emp-3) so Employee Portal shows real assigned work.
  if (effectiveRole === "EMPLOYEE") {
    const employeeUser = db.employees.find((e) => e.id === "emp-3") ?? db.employees[2];
    const override = db.userProfileOverrides["EMPLOYEE"] ?? {};
    const name = override.name ?? employeeUser?.name ?? "Kai Lombardi";
    return {
      id: "3",
      name,
      first_name: name.split(" ")[0],
      last_name: name.split(" ").slice(1).join(" "),
      email: override.email ?? employeeUser?.email ?? "kai@promocraft.co",
      role: "EMPLOYEE",
      phone: override.phone ?? employeeUser?.phone ?? "+91 98200 33440",
      timezone: override.timezone ?? db.workspace.defaultTimezone,
      initials: getInitials(name),
      isDemoRoleOverride: Boolean(roleOverride),
      linkedEmployeeId: employeeUser?.id ?? "emp-3",
    };
  }

  // ADMIN or MANAGER demo profile anchored to Alex Morgan / admin@promocraft.co (unless manager Rachel preview)
  if (effectiveRole === "MANAGER") {
    const managerUser = db.employees.find((e) => e.id === "emp-2") ?? db.employees[1];
    const override = db.userProfileOverrides["MANAGER"] ?? {};
    const name = override.name ?? managerUser?.name ?? "Rachel Singh";
    return {
      id: "2",
      name,
      first_name: name.split(" ")[0],
      last_name: name.split(" ").slice(1).join(" "),
      email: override.email ?? managerUser?.email ?? "rachel@promocraft.co",
      role: "MANAGER",
      phone: override.phone ?? managerUser?.phone ?? "+91 98200 22330",
      timezone: override.timezone ?? db.workspace.defaultTimezone,
      initials: getInitials(name),
      isDemoRoleOverride: Boolean(roleOverride),
      linkedEmployeeId: managerUser?.id ?? "emp-2",
    };
  }

  const adminUser = db.users.find((u) => u.email.toLowerCase() === DEMO_ADMIN_EMAIL);
  const adminEmp = db.employees.find((e) => e.email.toLowerCase() === DEMO_ADMIN_EMAIL);
  const override = db.userProfileOverrides[DEMO_ADMIN_EMAIL] ?? {};
  const name = override.name ?? adminUser?.name ?? "Alex Morgan";

  return {
    id: String(adminUser?.id ?? "1"),
    name,
    first_name: name.split(" ")[0],
    last_name: name.split(" ").slice(1).join(" "),
    email: override.email ?? adminUser?.email ?? DEMO_ADMIN_EMAIL,
    role: "ADMIN",
    phone: override.phone ?? adminUser?.phone ?? adminEmp?.phone ?? "+91 98200 11220",
    timezone: override.timezone ?? db.workspace.defaultTimezone,
    initials: getInitials(name),
    isDemoRoleOverride: false,
    linkedEmployeeId: adminEmp?.id ?? "emp-1",
  };
}

export const mockAuthService = {
  hasSession(): boolean {
    return getDemoSession() !== null;
  },

  async login(email: string, password: string): Promise<LoginResponse & { token: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    let role: DemoRole = "ADMIN";

    if (normalizedEmail === DEMO_ADMIN_EMAIL.toLowerCase() && password === DEMO_ADMIN_PASSWORD) {
      role = "ADMIN";
    } else if (normalizedEmail === DEMO_MANAGER_EMAIL.toLowerCase() && password === DEMO_ADMIN_PASSWORD) {
      role = "MANAGER";
    } else if (normalizedEmail === DEMO_EMPLOYEE_EMAIL.toLowerCase() && password === DEMO_ADMIN_PASSWORD) {
      role = "EMPLOYEE";
    } else {
      throw new MockValidationError(
        "Invalid email or password. Use demo credentials: admin@promocraft.co / 1234.",
        {
          credentials: ["Invalid email or password."],
        },
        401,
      );
    }

    const token = `demo_session_${Date.now()}`;
    saveDemoSession({
      token,
      email: normalizedEmail,
      roleOverride: role === "ADMIN" ? undefined : role,
      loggedInAt: new Date().toISOString(),
    });

    const user = buildDemoProfile(role === "ADMIN" ? undefined : role);
    return {
      token,
      access: token,
      refresh: token,
      user,
    };
  },

  async getProfile(): Promise<UserProfile> {
    const session = getDemoSession();
    if (!session) {
      throw new MockValidationError("Not authenticated. Please sign in.", {}, 401);
    }
    return buildDemoProfile(session.roleOverride);
  },

  async simulateRole(role: DemoRole): Promise<UserProfile> {
    const session = getDemoSession();
    if (!session) {
      throw new MockValidationError("Please sign in before switching demo roles.", {}, 401);
    }
    saveDemoSession({
      ...session,
      roleOverride: role === "ADMIN" ? undefined : role,
    });
    return buildDemoProfile(role);
  },

  async updateProfile(patch: {
    name?: string;
    email?: string;
    phone?: string;
    timezone?: string;
  }): Promise<UserProfile> {
    const session = getDemoSession();
    if (!session) {
      throw new MockValidationError("Not authenticated.", {}, 401);
    }
    const roleKey = session.roleOverride || DEMO_ADMIN_EMAIL;
    updateErpDatabase((db) => {
      db.userProfileOverrides[roleKey] = {
        ...db.userProfileOverrides[roleKey],
        ...patch,
      };
      if (!session.roleOverride && patch.name) {
        const admin = db.users.find((u) => u.email.toLowerCase() === DEMO_ADMIN_EMAIL);
        if (admin) {
          admin.name = patch.name;
          admin.updated_at = new Date().toISOString();
        }
      }
    });
    return buildDemoProfile(session.roleOverride);
  },

  async logout(): Promise<void> {
    clearDemoSession();
  },
};
