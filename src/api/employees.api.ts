import { employeesAdapter } from "@/adapters/erp.adapters";
import type { Paginated } from "@/infrastructure/apiClient";

export type EmploymentType = "FULL_TIME" | "PART_TIME" | "INTERN" | "FREELANCER";
export type EmployeeStatus = "ACTIVE" | "ON_LEAVE" | "RESIGNED" | "TERMINATED";

/**
 * employees.api.serializers.EmployeeSerializer
 * `id` is an integer primary key on the backend; `user` is the linked User UUID.
 * (The union with string keeps legacy mock fixtures used by other modules type-compatible.)
 */
export interface EmployeeBackend {
  id: number | string;
  user?: string;
  employee_id: string;
  name: string;
  email: string;
  phone?: string | null;
  role?: string;
  designation: string;
  department: string;
  employment_type: EmploymentType | string;
  joining_date: string;
  /** DecimalField serialized as a string, e.g. "45000.00", or null. */
  salary?: string | number | null;
  status: EmployeeStatus | string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  address?: string;
  created_at?: string;
  updated_at?: string;
}

/** employees.api.serializers.EmployeeCreateSerializer (write fields). */
export interface CreateEmployeePayload {
  name: string;
  email: string;
  /** Backend validation: digits only. */
  phone?: string;
  role: "ADMIN" | "EMPLOYEE" | "CLIENT";
  employee_id: string;
  designation: string;
  department: string;
  employment_type: EmploymentType;
  joining_date: string;
  salary?: number | string | null;
  status: EmployeeStatus;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  address?: string;
}

export interface CreateEmployeeResponse extends EmployeeBackend {
  /** Returned once, only on create. */
  temporary_password?: string | null;
}

/** Fields writable through PATCH /api/employees/{id}/. */
export type EmployeeUpdatePayload = Partial<
  Pick<
    EmployeeBackend,
    | "employee_id"
    | "designation"
    | "department"
    | "employment_type"
    | "joining_date"
    | "salary"
    | "status"
    | "emergency_contact_name"
    | "emergency_contact_phone"
    | "address"
  >
>;

/** Query params supported by EmployeeViewSet (filterset_fields, search_fields, ordering_fields). */
export interface EmployeeListParams {
  page?: number;
  search?: string;
  department?: string;
  designation?: string;
  status?: string;
  employment_type?: string;
  /** employee_id | joining_date | created_at, prefixed with "-" for descending. */
  ordering?: string;
}

/** accounts.api.serializers.UserSerializer for the employee's login account. */
export interface EmployeeAccount {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  is_active: boolean;
  is_staff: boolean;
  is_verified: boolean;
  date_joined?: string;
  created_at?: string;
  updated_at?: string;
}

/** One page of employees (backend PageNumberPagination, PAGE_SIZE = 10). */
export const listEmployees = async (
  params: EmployeeListParams = {},
  signal?: AbortSignal,
): Promise<Paginated<EmployeeBackend>> => {
  return employeesAdapter.list(params, signal);
};

/** Every employee across all pages — used by pickers and dashboard counts in other modules. */
export const getEmployees = async (search?: string, signal?: AbortSignal): Promise<EmployeeBackend[]> => {
  return employeesAdapter.listAll(search ? { search } : {}, signal);
};

/** Every employee matching the given filters/ordering (walks all pages) — used by CSV export. */
export const listAllEmployees = async (
  params: Omit<EmployeeListParams, "page"> = {},
  signal?: AbortSignal,
): Promise<EmployeeBackend[]> => {
  return employeesAdapter.listAll(params, signal);
};

/** Total matching a filter, read from the paginated `count` (one request, no full download). */
export const countEmployees = async (
  params: Omit<EmployeeListParams, "page" | "ordering"> = {},
  signal?: AbortSignal,
): Promise<number> => {
  const page = await employeesAdapter.list(params, signal);
  return page.count;
};

export const getEmployee = async (id: string | number, signal?: AbortSignal): Promise<EmployeeBackend> => {
  return employeesAdapter.getById(id, signal);
};

export const createEmployee = async (data: CreateEmployeePayload): Promise<CreateEmployeeResponse> => {
  return employeesAdapter.create(data);
};

export const updateEmployee = async ({
  id,
  data,
}: {
  id: string | number;
  data: EmployeeUpdatePayload;
}): Promise<EmployeeBackend> => {
  return employeesAdapter.update(id, data);
};

/** DELETE /api/employees/{id}/ — soft delete (status TERMINATED + login account deactivated). */
export const terminateEmployee = async (id: string | number): Promise<{ message: string }> => {
  return employeesAdapter.terminate(id);
};

export const getEmployeeAccount = async (userId: string, signal?: AbortSignal): Promise<EmployeeAccount> => {
  return employeesAdapter.getAccount(userId, signal);
};

export const updateEmployeeAccount = async (
  userId: string,
  patch: { name?: string; phone?: string; is_active?: boolean },
): Promise<EmployeeAccount> => {
  return employeesAdapter.updateAccount(userId, patch);
};

/**
 * Reactivation = PATCH employee status back to ACTIVE, then re-enable the login account.
 * Two real backend calls (no single endpoint exists); not atomic.
 */
export const reactivateEmployee = async (employee: EmployeeBackend): Promise<EmployeeBackend> => {
  // Only leave-the-company statuses are reset; e.g. ON_LEAVE is preserved.
  const updated =
    employee.status === "TERMINATED" || employee.status === "RESIGNED"
      ? await employeesAdapter.update(employee.id, { status: "ACTIVE" })
      : employee;
  if (employee.user) {
    await employeesAdapter.updateAccount(employee.user, { is_active: true });
  }
  return updated;
};
