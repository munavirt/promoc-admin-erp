import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  DEMO_ADMIN_EMAIL,
  DEMO_ADMIN_PASSWORD,
  DEMO_MANAGER_EMAIL,
  DEMO_EMPLOYEE_EMAIL,
  mockAuthService,
} from "../../mock/mock-auth.service";
import { clearDemoSession } from "../../../mocks/persistence";
import { useStore } from "../../../store";

describe("Demo Authentication & Role Simulation", () => {
  beforeEach(() => {
    clearDemoSession();
    useStore.getState().logout();
  });

  describe("1. Demo Authentication", () => {
    it("authenticates admin@promocraft.co / 1234 without network calls", async () => {
      const res = await mockAuthService.login(DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD);
      assert.ok(res.token);
      assert.equal(res.user?.email, DEMO_ADMIN_EMAIL);
      assert.equal(res.user?.role, "ADMIN");
      assert.equal(mockAuthService.hasSession(), true);
    });

    it("authenticates manager rachel@promocraft.co / 1234", async () => {
      const res = await mockAuthService.login(DEMO_MANAGER_EMAIL, DEMO_ADMIN_PASSWORD);
      assert.ok(res.token);
      assert.equal(res.user?.role, "MANAGER");
      assert.equal(res.user?.linkedEmployeeId, "emp-2");
    });

    it("authenticates employee kai@promocraft.co / 1234", async () => {
      const res = await mockAuthService.login(DEMO_EMPLOYEE_EMAIL, DEMO_ADMIN_PASSWORD);
      assert.ok(res.token);
      assert.equal(res.user?.role, "EMPLOYEE");
      assert.equal(res.user?.linkedEmployeeId, "emp-3");
    });

    it("rejects invalid credentials", async () => {
      await assert.rejects(
        () => mockAuthService.login("invalid@promocraft.co", "wrongpass"),
        (err: any) => err.status === 401,
      );
    });
  });

  describe("2. Demo Role Simulation", () => {
    it("allows switching demo roles during active demo session", async () => {
      await mockAuthService.login(DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD);
      const manager = await mockAuthService.simulateRole("MANAGER");
      assert.equal(manager.role, "MANAGER");

      const employee = await mockAuthService.simulateRole("EMPLOYEE");
      assert.equal(employee.role, "EMPLOYEE");
      assert.equal(employee.linkedEmployeeId, "emp-3");
    });

    it("blocks demo role switching when no demo session exists", async () => {
      clearDemoSession();
      await assert.rejects(
        () => mockAuthService.simulateRole("MANAGER"),
        (err: any) => err.message.includes("Please sign in before switching demo roles"),
      );
    });
  });

  describe("3. Session Persistence & Logout", () => {
    it("persists demo session in localStorage and restores it", async () => {
      await mockAuthService.login(DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD);
      assert.equal(mockAuthService.hasSession(), true);
      const profile = await mockAuthService.getProfile();
      assert.equal(profile.email, DEMO_ADMIN_EMAIL);
    });

    it("clears demo session on logout", async () => {
      await mockAuthService.login(DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD);
      assert.equal(mockAuthService.hasSession(), true);
      await mockAuthService.logout();
      assert.equal(mockAuthService.hasSession(), false);
    });
  });
});
