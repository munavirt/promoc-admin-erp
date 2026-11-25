import { removeLegacyFinanceStorage } from "@/modules/finance/utils/legacy-storage";
import { INITIAL_MOCK_CLIENTS } from "./data/clients";
import { INITIAL_MOCK_EMPLOYEES } from "./data/employees";
import { INITIAL_MOCK_NOTIFICATIONS } from "./data/notifications";
import { INITIAL_MOCK_PROJECTS } from "./data/projects";
import { createInitialMockTasks } from "./data/tasks";
import { INITIAL_MOCK_USERS } from "./data/users";
import {
  INITIAL_MOCK_ACTIVITIES,
  INITIAL_MOCK_FILES,
  INITIAL_MOCK_MEETINGS,
  INITIAL_WORKSPACE_SETTINGS,
} from "./data/workspace";
import type { DemoSessionRecord, ErpMockDatabase, MockActivityRecord } from "./types";

const ERP_DB_STORAGE_KEY = "promocraft_erp_mock_db_v1";
const DEMO_SESSION_STORAGE_KEY = "promocraft_demo_session_v1";
const CURRENT_DB_VERSION = 1;

/**
 * Memory fallback used in non-browser environments (e.g., Node/Vite SSR tests).
 */
const memoryStorage = new Map<string, string>();
let memoryDbCache: ErpMockDatabase | null = null;

function getStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Ignore storage access errors in restricted frames/tests
  }
  return null;
}

function readRaw(key: string): string | null {
  const storage = getStorage();
  if (storage) {
    try {
      return storage.getItem(key);
    } catch {
      return memoryStorage.get(key) ?? null;
    }
  }
  return memoryStorage.get(key) ?? null;
}

function writeRaw(key: string, value: string): void {
  memoryStorage.set(key, value);
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(key, value);
    } catch {
      // Ignore quota errors in local demo mode
    }
  }
}

function removeRaw(key: string): void {
  memoryStorage.delete(key);
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(key);
    } catch {
      // Ignore storage errors
    }
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createInitialErpDatabase(): ErpMockDatabase {
  return {
    version: CURRENT_DB_VERSION,
    users: clone(INITIAL_MOCK_USERS),
    clients: clone(INITIAL_MOCK_CLIENTS),
    employees: clone(INITIAL_MOCK_EMPLOYEES),
    projects: clone(INITIAL_MOCK_PROJECTS),
    tasks: clone(createInitialMockTasks()),
    notifications: clone(INITIAL_MOCK_NOTIFICATIONS),
    meetings: clone(INITIAL_MOCK_MEETINGS),
    files: clone(INITIAL_MOCK_FILES),
    activities: clone(INITIAL_MOCK_ACTIVITIES),
    workspace: clone(INITIAL_WORKSPACE_SETTINGS),
    userProfileOverrides: {},
    counters: {
      user: 6,
      client: 6,
      employee: 6,
      project: 6,
      task: 109,
      notification: 5,
      member: 13,
    },
  };
}

export function getErpDatabase(): ErpMockDatabase {
  const raw = readRaw(ERP_DB_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as ErpMockDatabase;
      if (parsed && parsed.version === CURRENT_DB_VERSION && Array.isArray(parsed.projects)) {
        memoryDbCache = parsed;
        return parsed;
      }
    } catch {
      // Corrupted payload falls back cleanly to initial seed
    }
  }

  if (memoryDbCache && memoryDbCache.version === CURRENT_DB_VERSION) {
    return memoryDbCache;
  }

  const seeded = createInitialErpDatabase();
  return saveErpDatabase(seeded);
}

export function saveErpDatabase(nextDb: ErpMockDatabase): ErpMockDatabase {
  const snapshot = clone(nextDb);
  memoryDbCache = snapshot;
  writeRaw(ERP_DB_STORAGE_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export function updateErpDatabase<T>(updater: (db: ErpMockDatabase) => T): T {
  const current = clone(getErpDatabase());
  const result = updater(current);
  saveErpDatabase(current);
  return result;
}

export function appendErpActivity(
  db: ErpMockDatabase,
  entry: Omit<MockActivityRecord, "id" | "timestamp" | "createdAtIso">,
): void {
  const nowIso = new Date().toISOString();
  const next: MockActivityRecord = {
    ...entry,
    id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: "Just now",
    createdAtIso: nowIso,
  };
  db.activities = [next, ...db.activities].slice(0, 40);
}

export function resetErpDatabase(): ErpMockDatabase {
  const fresh = createInitialErpDatabase();
  return saveErpDatabase(fresh);
}

export function resetAllDemoData(): { erp: ErpMockDatabase } {
  const erp = resetErpDatabase();
  removeLegacyFinanceStorage();
  return { erp };
}

export function getDemoSession(): DemoSessionRecord | null {
  const raw = readRaw(DEMO_SESSION_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DemoSessionRecord;
      if (parsed && typeof parsed.token === "string" && typeof parsed.email === "string") {
        return parsed;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function saveDemoSession(session: DemoSessionRecord): DemoSessionRecord {
  writeRaw(DEMO_SESSION_STORAGE_KEY, JSON.stringify(session));
  // Keep legacy key synced for any read checks during migration, never trusting it without DEMO_SESSION
  writeRaw("auth_token", session.token);
  return session;
}

export function clearDemoSession(): void {
  removeRaw(DEMO_SESSION_STORAGE_KEY);
  removeRaw("auth_token");
}
