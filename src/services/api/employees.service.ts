/**
 * Real Employee service — Django `employees` app (EmployeeViewSet, Admin only).
 *
 *   GET    /api/employees/            ?page, search, department, designation, status, employment_type, ordering
 *   POST   /api/employees/            EmployeeCreateSerializer (also creates the linked User account)
 *   GET    /api/employees/{id}/
 *   PATCH  /api/employees/{id}/       EmployeeSerializer (name/email/phone/role are read-only here)
 *   DELETE /api/employees/{id}/       soft delete: status=TERMINATED and user.is_active=False
 *
 * Linked account fields (name, phone, is_active) are written through the admin-only
 *   GET/PATCH /api/accounts/users/{user_uuid}/
 */
import type {
  CreateEmployeePayload,
  CreateEmployeeResponse,
  EmployeeAccount,
  EmployeeBackend,
  EmployeeListParams,
  EmployeeUpdatePayload,
} from "@/api/employees.api";
import { apiClient, cleanParams, isPaginated, type Paginated } from "@/infrastructure/apiClient";

const BASE = "/employees/";
const detailUrl = (id: string | number) => `${BASE}${encodeURIComponent(String(id))}/`;
const userUrl = (userId: string) => `/accounts/users/${encodeURIComponent(userId)}/`;

/** Fields EmployeeSerializer accepts on update. */
const WRITABLE_FIELDS = [
  "employee_id",
  "designation",
  "department",
  "employment_type",
  "joining_date",
  "salary",
  "status",
  "emergency_contact_name",
  "emergency_contact_phone",
  "address",
] as const;

/** Upper bound when walking every page for pickers / dashboard counts. */
const MAX_PAGES = 100;

export const employeesService = {
  async list(params: EmployeeListParams = {}, signal?: AbortSignal): Promise<Paginated<EmployeeBackend>> {
    const { data } = await apiClient.get<Paginated<EmployeeBackend> | EmployeeBackend[]>(BASE, {
      params: cleanParams({ ...params }),
      signal,
    });
    if (isPaginated<EmployeeBackend>(data)) return data;
    // Defensive: if pagination is ever disabled the endpoint returns a bare list.
    const list = Array.isArray(data) ? data : [];
    return { count: list.length, next: null, previous: null, results: list };
  },

  /** Walks every page (follows DRF `next`) and returns the full list. */
  async listAll(params: Omit<EmployeeListParams, "page"> = {}, signal?: AbortSignal): Promise<EmployeeBackend[]> {
    const first = await employeesService.list(params, signal);
    const all = [...first.results];
    let next = first.next;
    let pages = 1;
    while (next && pages < MAX_PAGES) {
      const { data } = await apiClient.get<Paginated<EmployeeBackend>>(next, { signal });
      all.push(...data.results);
      next = data.next;
      pages += 1;
    }
    return all;
  },

  async getById(id: string | number, signal?: AbortSignal): Promise<EmployeeBackend> {
    const { data } = await apiClient.get<EmployeeBackend>(detailUrl(id), { signal });
    return data;
  },

  async create(payload: CreateEmployeePayload): Promise<CreateEmployeeResponse> {
    const body: Record<string, unknown> = { ...payload };
    // Optional fields: omit when blank so DRF applies model defaults instead of rejecting "".
    if (!payload.phone) delete body.phone;
    if (payload.salary === undefined || payload.salary === null || payload.salary === "") body.salary = null;
    const { data } = await apiClient.post<CreateEmployeeResponse>(BASE, body);
    return data;
  },

  async update(id: string | number, payload: EmployeeUpdatePayload): Promise<EmployeeBackend> {
    const body: Record<string, unknown> = {};
    for (const key of WRITABLE_FIELDS) {
      if (payload[key] !== undefined) body[key] = payload[key];
    }
    if (body.salary === "") body.salary = null;
    const { data } = await apiClient.patch<EmployeeBackend>(detailUrl(id), body);
    return data;
  },

  /** Soft delete — backend sets status=TERMINATED and deactivates the login account. */
  async terminate(id: string | number): Promise<{ message: string }> {
    const { data } = await apiClient.delete<{ message: string }>(detailUrl(id));
    return data;
  },

  async getAccount(userId: string, signal?: AbortSignal): Promise<EmployeeAccount> {
    const { data } = await apiClient.get<EmployeeAccount>(userUrl(userId), { signal });
    return data;
  },

  /** Admin PATCH on the linked user; backend only applies name, phone, is_active, role. */
  async updateAccount(
    userId: string,
    patch: { name?: string; phone?: string; is_active?: boolean },
  ): Promise<EmployeeAccount> {
    const body: Record<string, unknown> = {};
    if (patch.name !== undefined) body.name = patch.name;
    if (patch.phone !== undefined) body.phone = patch.phone;
    if (patch.is_active !== undefined) body.is_active = patch.is_active;
    const { data } = await apiClient.patch<EmployeeAccount>(userUrl(userId), body);
    return data;
  },
};
