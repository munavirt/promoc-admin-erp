import { clientsAdapter } from "@/adapters/erp.adapters";
import type { Paginated } from "@/infrastructure/apiClient";

/** clients.models.ClientStatus */
export type ClientStatus = "ACTIVE" | "INACTIVE";

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

/** clients.api.serializers.ClientSerializer */
export interface ClientBackend {
  /** Integer PK (string kept for legacy mock fixtures used by other modules). */
  id: number | string;
  company_name: string;
  contact_person: string;
  email: string;
  phone?: string;
  website?: string;
  address?: string;
  notes?: string;
  status: ClientStatus | string;
  /** User UUID, read-only (set to request.user on create). */
  created_by?: string | null;
  created_by_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Writable fields (ClientCreateSerializer / ClientSerializer).
 * Model limits: company_name 255 (required, unique case-insensitive on create), contact_person 150 (required),
 * email (EmailField, optional), phone 20 (digits only — create only), website (URLField, 200, optional),
 * address/notes (text, optional), status ACTIVE|INACTIVE (default ACTIVE).
 */
export interface ClientWritePayload {
  company_name: string;
  contact_person: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  notes?: string;
  status?: ClientStatus;
}

/** Legacy alias. */
export type CreateClientPayload = ClientWritePayload;

/** ClientViewSet: search_fields, filterset_fields = [status], ordering_fields = [company_name, created_at]. */
export interface ClientListParams {
  page?: number;
  search?: string;
  status?: ClientStatus | string;
  ordering?: "company_name" | "-company_name" | "created_at" | "-created_at" | string;
}

/** One page (PAGE_SIZE 10). */
export const listClients = (params: ClientListParams = {}, signal?: AbortSignal): Promise<Paginated<ClientBackend>> =>
  clientsAdapter.list(params, signal);

/** Every client matching the filters (walks all pages). Used by pickers, export and dashboard. */
export const listAllClients = (params: Omit<ClientListParams, "page"> = {}, signal?: AbortSignal): Promise<ClientBackend[]> =>
  clientsAdapter.listAll(params, signal);

/** Legacy signature used by the dashboard and project forms. */
export const getClients = (search?: string, signal?: AbortSignal): Promise<ClientBackend[]> =>
  clientsAdapter.listAll(search ? { search } : {}, signal);

export const countClients = async (
  params: Omit<ClientListParams, "page" | "ordering"> = {},
  signal?: AbortSignal,
): Promise<number> => (await clientsAdapter.list(params, signal)).count;

/**
 * Clients created since `since` (inclusive), counted by walking `ordering=-created_at` pages until an
 * older record appears. Exact (ordered, complete), and stops early.
 */
export const countClientsCreatedSince = async (since: Date, signal?: AbortSignal): Promise<number> => {
  let page = 1;
  let total = 0;
  for (;;) {
    const res = await clientsAdapter.list({ page, ordering: "-created_at" }, signal);
    for (const c of res.results) {
      if (!c.created_at || new Date(c.created_at) < since) return total;
      total += 1;
    }
    if (!res.next || page >= 100) return total;
    page += 1;
  }
};

export const getClient = (id: string | number, signal?: AbortSignal): Promise<ClientBackend> =>
  clientsAdapter.getById(id, signal);

export const createClient = (data: ClientWritePayload) => clientsAdapter.create(data);

export const updateClient = ({ id, data }: { id: string | number; data: Partial<ClientWritePayload> }): Promise<ClientBackend> =>
  clientsAdapter.update(id, data);

/** DELETE /api/clients/{id}/ — soft delete (status INACTIVE); the record is kept but hidden by the API. */
export const deactivateClient = (id: string | number): Promise<{ message: string }> => clientsAdapter.deactivate(id);

/** Legacy name kept for callers; performs the same soft deactivation. */
export const deleteClient = deactivateClient;
