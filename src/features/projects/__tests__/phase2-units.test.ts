/**
 * Phase 2 unit tests (no network): real client/project services over a fake axios transport.
 * Shapes follow the Django serializers read in clients/api and projects/api.
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";

process.env.VITE_API_BASE_URL ||= "http://127.0.0.1:8000/api";
const g = globalThis as unknown as { window?: { localStorage?: Storage } };
g.window ??= {};
if (!g.window.localStorage) {
  const mem = new Map<string, string>();
  g.window.localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

const { apiClient } = await import("../../../infrastructure/apiClient");
const { tokenStorage } = await import("../../../infrastructure/tokenStorage");
const clientsApi = await import("../../../api/clients.api");
const projectsApi = await import("../../../api/projects.api");
const { assignMembersSequentially, describeFailures } = await import("../lib/assign-members");

interface Call { method: string; url: string; params?: Record<string, unknown>; body?: unknown }
type Handler = (c: Call) => { status: number; data: unknown };

function fakeServer(handler: Handler): Call[] {
  const calls: Call[] = [];
  apiClient.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
    const call: Call = {
      method: String(config.method).toUpperCase(),
      url: String(config.url),
      params: config.params,
      body: typeof config.data === "string" ? JSON.parse(config.data) : config.data,
    };
    calls.push(call);
    const { status, data } = handler(call);
    const response = { data, status, statusText: String(status), headers: {}, config, request: {} };
    if (status < 300) return response;
    throw new AxiosError(`HTTP ${status}`, String(status), config, {}, response);
  }) as AxiosAdapter;
  return calls;
}

const page = <T,>(results: T[], next: string | null = null) => ({ count: results.length, next, previous: null, results });

beforeEach(() => tokenStorage.setTokens({ access: "A", refresh: "R" }));

describe("Clients service", () => {
  it("create: response has no id → resolves the new client by exact (case-insensitive) company name", async () => {
    const calls = fakeServer((c) => {
      if (c.method === "POST") return { status: 201, data: { company_name: "QA Acme", contact_person: "Q", status: "ACTIVE" } };
      return {
        status: 200,
        data: page([
          { id: 7, company_name: "QA Acme Labs", contact_person: "x", email: "", status: "ACTIVE" },
          { id: 9, company_name: "qa acme", contact_person: "Q", email: "", status: "ACTIVE" },
        ]),
      };
    });
    const { client } = await clientsApi.createClient({ company_name: "QA Acme", contact_person: "Q", status: "ACTIVE" });
    assert.equal(client?.id, 9, "must not pick the substring match");
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[1].params?.search, "QA Acme");
  });

  it("create: sends only writable fields (never created_by)", async () => {
    const calls = fakeServer(() => ({ status: 201, data: { id: 1, company_name: "A", contact_person: "B", status: "ACTIVE" } }));
    await clientsApi.createClient({ company_name: "A", contact_person: "B", created_by: "x" } as never);
    assert.deepEqual(Object.keys(calls[0].body as object).sort(), ["company_name", "contact_person"]);
  });

  it("deactivate calls DELETE /clients/{id}/ and returns the backend message", async () => {
    const calls = fakeServer(() => ({ status: 200, data: { message: "Client deactivated successfully." } }));
    const res = await clientsApi.deactivateClient(5);
    assert.equal(calls[0].method, "DELETE");
    assert.equal(calls[0].url, "/clients/5/");
    assert.equal(res.message, "Client deactivated successfully.");
  });

  it("countClientsCreatedSince walks -created_at pages and stops at the first older record", async () => {
    const since = new Date("2026-11-01T00:00:00Z");
    const calls = fakeServer((c) => {
      const p = Number(c.params?.page ?? 1);
      if (p === 1) return { status: 200, data: page([{ id: 1, created_at: "2026-11-14T00:00:00Z" }, { id: 2, created_at: "2026-11-02T00:00:00Z" }], "next") };
      return { status: 200, data: page([{ id: 3, created_at: "2026-11-01T05:00:00Z" }, { id: 4, created_at: "2026-10-30T00:00:00Z" }], "next") };
    });
    assert.equal(await clientsApi.countClientsCreatedSince(since), 3);
    assert.equal(calls.length, 2, "stops without fetching page 3");
    assert.equal(calls[0].params?.ordering, "-created_at");
  });

  it("list passes server-side filters and drops empty ones", async () => {
    const calls = fakeServer(() => ({ status: 200, data: page([]) }));
    await clientsApi.listClients({ page: 2, search: "", status: "ACTIVE", ordering: "-created_at" });
    assert.deepEqual(calls[0].params, { page: 2, status: "ACTIVE", ordering: "-created_at" });
  });
});

describe("Projects service", () => {
  it("getClientProjects keeps only exact client-id matches from the client-name search", async () => {
    const calls = fakeServer(() => ({
      status: 200,
      data: page([
        { id: 1, project_name: "A", client: 3, client_name: "Acme" },
        { id: 2, project_name: "B", client: 4, client_name: "Acme Labs" },
      ]),
    }));
    const res = await projectsApi.getClientProjects({ id: 3, company_name: "Acme" });
    assert.deepEqual(res.map((p) => p.id), [1]);
    assert.equal(calls[0].params?.search, "Acme");
  });

  it("update sends only writable fields and maps an empty budget to null", async () => {
    const calls = fakeServer(() => ({ status: 200, data: { id: 1 } }));
    await projectsApi.updateProject(1, { budget: "" as unknown as null, progress: 40, members: [], created_by: "x" } as never);
    assert.equal(calls[0].method, "PATCH");
    assert.deepEqual(calls[0].body, { budget: null, progress: 40 });
  });

  it("archive is DELETE /projects/{id}/; member routes match the backend", async () => {
    const calls = fakeServer(() => ({ status: 200, data: { message: "ok" } }));
    await projectsApi.archiveProject(8);
    await projectsApi.removeMember(8, 12);
    assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), ["DELETE /projects/8/", "DELETE /projects/8/members/12/"]);
  });

  it("work items are fetched with ?project=", async () => {
    const calls = fakeServer(() => ({ status: 200, data: page([{ id: 1, project: 8, title: "T", status: "TODO", priority: "LOW" }]) }));
    const items = await projectsApi.getProjectWorkItems(8);
    assert.equal(items.length, 1);
    assert.equal(calls[0].url, "/work-items/");
    assert.equal(calls[0].params?.project, 8);
  });

  it("assignMembersSequentially posts each member and reports failures without stopping", async () => {
    const calls = fakeServer((c) => {
      const body = c.body as { employee: number };
      if (body.employee === 2) return { status: 400, data: { non_field_errors: ["Project already has a project manager."] } };
      return { status: 201, data: { id: 100 + body.employee, employee: body.employee, role_in_project: "QA" } };
    });
    const res = await assignMembersSequentially(5, [
      { employee: "1", role_in_project: "QA", label: "Asha" },
      { employee: "2", role_in_project: "PROJECT_MANAGER", label: "Ben" },
      { employee: "3", role_in_project: "QA", label: "Chen" },
    ]);
    assert.equal(calls.length, 3);
    assert.deepEqual(calls[0].body, { employee: 1, role_in_project: "QA" });
    assert.equal(res.added.length, 2);
    assert.equal(res.failed.length, 1);
    assert.equal(describeFailures(res.failed), "Ben: Project already has a project manager.");
  });

  it("label helpers map enums and fall back to the raw value", () => {
    assert.equal(projectsApi.labelFor(projectsApi.PROJECT_STATUS_LABELS, "IN_PROGRESS"), "In Progress");
    assert.equal(projectsApi.labelFor(projectsApi.PROJECT_STATUS_LABELS, "WEIRD"), "WEIRD");
    assert.equal(projectsApi.projectClientName({ client: 3, client_name: "Acme" }), "Acme");
    assert.equal(projectsApi.projectClientId({ client: { id: 4, name: "x" } }), "4");
  });
});
