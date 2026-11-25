import { authAdapter } from "@/adapters/erp.adapters";

/** Backend user roles (accounts.models.UserRole). */
export type BackendUserRole = "ADMIN" | "EMPLOYEE" | "CLIENT";

/** POST /api/accounts/login/ response (accounts.api.views.LoginView). */
export interface LoginResponse {
  access: string;
  refresh: string;
  user: UserProfile;
}

export interface ManagerPermissions {
  can_create_invoices: boolean;
  can_record_payments: boolean;
  can_manage_income_expenses: boolean;
  can_delete_or_reverse: boolean;
  can_view_audit_history: boolean;
}

/**
 * Current user — accounts.api.serializers.UserSerializer
 * (id, name, email, phone, role, is_active, is_staff, is_verified, date_joined, created_at, updated_at).
 * Remaining optional fields are frontend-only (derived or used by modules still on mock data).
 */
export interface UserProfile {
  id: string;
  name?: string;
  email: string;
  phone?: string | null;
  role?: BackendUserRole | string;
  is_active?: boolean;
  is_staff?: boolean;
  is_verified?: boolean;
  date_joined?: string;
  created_at?: string;
  updated_at?: string;

  // Frontend-only / legacy
  first_name?: string;
  last_name?: string;
  avatar?: string;
  avatar_url?: string;
  timezone?: string;
  initials?: string;
  isDemoRoleOverride?: boolean;
  linkedEmployeeId?: string;
  manager_permissions?: ManagerPermissions;
  managerPermissions?: {
    canCreateInvoices: boolean;
    canRecordPayments: boolean;
    canManageIncomeExpenses: boolean;
    canDeleteOrReverse: boolean;
    canViewAuditHistory: boolean;
  };
}

export const loginApi = async (email: string, password: string): Promise<LoginResponse> => {
  return authAdapter.login(email, password);
};

export const getProfileApi = async (signal?: AbortSignal): Promise<UserProfile> => {
  return authAdapter.getProfile(signal);
};

export const logoutApi = async (): Promise<void> => {
  return authAdapter.logout();
};

/** PATCH /api/accounts/profile/ — only name, email and phone are writable on the backend. */
export const updateProfileApi = async (patch: {
  name?: string;
  email?: string;
  phone?: string;
  timezone?: string;
}): Promise<UserProfile> => {
  const { timezone: _unsupported, ...supported } = patch;
  return authAdapter.updateProfile(supported);
};
