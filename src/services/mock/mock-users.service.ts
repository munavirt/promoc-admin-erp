import type { CreateUserPayload, UserBackend } from "@/api/users.api";
import { appendErpActivity, getErpDatabase, updateErpDatabase } from "@/mocks/persistence";
import { MockValidationError } from "@/mocks/types";

export const mockUsersService = {
  async list(search?: string): Promise<UserBackend[]> {
    const { users } = getErpDatabase();
    const query = search?.trim().toLowerCase();
    if (!query) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        u.role.toLowerCase().includes(query),
    );
  },

  async getById(id: string | number): Promise<UserBackend> {
    const user = getErpDatabase().users.find((u) => String(u.id) === String(id));
    if (!user) {
      throw new MockValidationError("User not found.", {}, 404);
    }
    return user;
  },

  async create(payload: CreateUserPayload): Promise<UserBackend> {
    return updateErpDatabase((db) => {
      const normalizedEmail = payload.email.trim().toLowerCase();
      if (db.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
        throw new MockValidationError("A user with this email already exists.", {
          email: ["A user with this email already exists."],
        });
      }

      const now = new Date().toISOString();
      const created: UserBackend = {
        id: db.counters.user++,
        name: payload.name.trim(),
        email: payload.email.trim(),
        phone: payload.phone || null,
        role: payload.role || "EMPLOYEE",
        is_active: payload.is_active ?? true,
        is_staff: payload.is_staff ?? (payload.role === "ADMIN" || payload.role === "MANAGER"),
        is_verified: payload.is_verified ?? true,
        date_joined: now,
        created_at: now,
        updated_at: now,
      };
      db.users = [created, ...db.users];
      appendErpActivity(db, {
        user: "Alex Morgan",
        userInitials: "AM",
        action: "created user account",
        target: created.name,
      });
      return created;
    });
  },

  async update(id: string | number, payload: Partial<CreateUserPayload>): Promise<UserBackend> {
    return updateErpDatabase((db) => {
      const idx = db.users.findIndex((u) => String(u.id) === String(id));
      if (idx === -1) {
        throw new MockValidationError("User not found.", {}, 404);
      }

      if (payload.email) {
        const dup = db.users.some(
          (u) => String(u.id) !== String(id) && u.email.toLowerCase() === payload.email!.toLowerCase(),
        );
        if (dup) {
          throw new MockValidationError("Another user already uses this email.", {
            email: ["Another user already uses this email."],
          });
        }
      }

      const updated: UserBackend = {
        ...db.users[idx],
        ...payload,
        updated_at: new Date().toISOString(),
      };
      db.users[idx] = updated;
      return updated;
    });
  },

  async delete(id: string | number): Promise<void> {
    updateErpDatabase((db) => {
      const target = db.users.find((u) => String(u.id) === String(id));
      if (!target) {
        throw new MockValidationError("User not found.", {}, 404);
      }
      db.users = db.users.filter((u) => String(u.id) !== String(id));
      appendErpActivity(db, {
        user: "Alex Morgan",
        userInitials: "AM",
        action: "deleted user",
        target: target.name,
      });
    });
  },
};
