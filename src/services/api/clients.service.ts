/**
 * Real Client service — Django `clients` app (ClientViewSet, IsAuthenticated + IsAdmin).
 *
 *   GET    /api/clients/          ?page, search (company_name, contact_person, email, phone), status, ordering (company_name, created_at)
 *   POST   /api/clients/          ClientCreateSerializer — response has NO `id` (see `create`)
 *   GET    /api/clients/{id}/
 *   PATCH  /api/clients/{id}/     ClientSerializer (created_by/created_at/updated_at read-only)
 *   DELETE /api/clients/{id}/     soft delete: status=INACTIVE → { message }
 *
 * NOTE: get_queryset() excludes status=INACTIVE for every action, so inactive clients are never
 * listed and their detail/edit/delete answer 404. There is no API to reactivate them.
 */
import type {
  ClientBackend,
  ClientListParams,
  ClientWritePayload,
} from "@/api/clients.api";
import { apiClient, cleanParams, isPaginated, type Paginated } from "@/infrastructure/apiClient";

const BASE = "/clients/";
const detailUrl = (id: string | number) => `${BASE}${encodeURIComponent(String(id))}/`;
const MAX_PAGES = 100;

const WRITABLE_FIELDS = [
  "company_name",
  "contact_person",
  "email",
  "phone",
  "website",
  "address",
  "notes",
  "status",
] as const;

function pickWritable(payload: Partial<ClientWritePayload>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const key of WRITABLE_FIELDS) {
    if (payload[key] !== undefined) body[key] = payload[key];
  }
  return body;
}

export const clientsService = {
  async list(params: ClientListParams = {}, signal?: AbortSignal): Promise<Paginated<ClientBackend>> {
    const { data } = await apiClient.get<Paginated<ClientBackend> | ClientBackend[]>(BASE, {
      params: cleanParams({ ...params }),
      signal,
    });
    if (isPaginated<ClientBackend>(data)) return data;
    const list = Array.isArray(data) ? data : [];
    return { count: list.length, next: null, previous: null, results: list };
  },

  /** Follows DRF `next` links and returns every matching client. */
  async listAll(params: Omit<ClientListParams, "page"> = {}, signal?: AbortSignal): Promise<ClientBackend[]> {
    const first = await clientsService.list(params, signal);
    const all = [...first.results];
    let next = first.next;
    let pages = 1;
    while (next && pages < MAX_PAGES) {
      const { data } = await apiClient.get<Paginated<ClientBackend>>(next, { signal });
      all.push(...data.results);
      next = data.next;
      pages += 1;
    }
    return all;
  },

  async getById(id: string | number, signal?: AbortSignal): Promise<ClientBackend> {
    const { data } = await apiClient.get<ClientBackend>(detailUrl(id), { signal });
    return data;
  },

  /**
   * POST returns ClientCreateSerializer data, which does not include `id`. company_name is unique
   * (case-insensitive, enforced by the serializer), so the created record is resolved by an exact
   * name match via the documented search filter. Returns null for `client` if it cannot be resolved.
   */
  async create(payload: ClientWritePayload): Promise<{ created: Partial<ClientBackend>; client: ClientBackend | null }> {
    const { data } = await apiClient.post<Partial<ClientBackend>>(BASE, pickWritable(payload));
    if (data && data.id !== undefined && data.id !== null) {
      return { created: data, client: data as ClientBackend };
    }
    const name = String(data?.company_name ?? payload.company_name).trim().toLowerCase();
    try {
      const matches = await clientsService.listAll({ search: String(data?.company_name ?? payload.company_name).trim() });
      const client = matches.find((c) => c.company_name.trim().toLowerCase() === name) ?? null;
      return { created: data, client };
    } catch {
      return { created: data, client: null };
    }
  },

  async update(id: string | number, payload: Partial<ClientWritePayload>): Promise<ClientBackend> {
    const { data } = await apiClient.patch<ClientBackend>(detailUrl(id), pickWritable(payload));
    return data;
  },

  /** Soft delete — backend sets status=INACTIVE; the client then disappears from every API response. */
  async deactivate(id: string | number): Promise<{ message: string }> {
    const { data } = await apiClient.delete<{ message: string }>(detailUrl(id));
    return data;
  },
};
