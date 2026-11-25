import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { createUser } from "@/api/users.api";
import { clearDemoSession, getErpDatabase, resetAllDemoData } from "@/mocks/persistence";
import { MockValidationError } from "@/mocks/types";
import { mockAuthService } from "@/services/mock/mock-auth.service";

/**
 * Remaining mock-backed modules (Users, workspace/meetings) and the legacy demo-auth service.
 * Auth & Employees (Phase 1), Clients & Projects (Phase 2) and Tasks, Comments, Attachments,
 * Notifications & the employee portal (Phase 3) run against Django; their mock services and cases were removed.
 */
describe("PromoCraft ERP Mock Data & Demo Auth Architecture", () => {
  beforeEach(async () => {
    clearDemoSession();
    resetAllDemoData();
  });

  it("supports legacy demo role simulation", async () => {
    await mockAuthService.login("admin@promocraft.co", "1234");
    const employeeProfile = await mockAuthService.simulateRole("EMPLOYEE");
    assert.equal(employeeProfile.role, "EMPLOYEE");
    const backToAdmin = await mockAuthService.simulateRole("ADMIN");
    assert.equal(backToAdmin.role, "ADMIN");
  });

  it("enforces duplicate email validation on Users", async () => {
    await assert.rejects(
      () =>
        createUser({
          name: "Duplicate Admin",
          email: "admin@promocraft.co",
          role: "ADMIN",
          is_active: true,
          is_staff: true,
          is_verified: true,
        }),
      (err: unknown) => err instanceof MockValidationError && Boolean(err.fieldErrors.email),
    );
  });

  // mockProjectsService still backs the mock Employee Portal (`/api/me`) and the mock Tasks cascade.

  it("resets the ERP mock DB (Finance no longer has a mock store — Phase 4)", async () => {
    resetAllDemoData();
    assert.equal(getErpDatabase().clients.length, 5);
  });
});
