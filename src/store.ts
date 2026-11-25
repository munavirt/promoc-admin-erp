import { create } from "zustand";
import {
  getProfileApi,
  logoutApi,
  updateProfileApi,
  type UserProfile,
} from "@/api/accounts.api";
import { onSessionExpired, toApiError } from "@/infrastructure/apiClient";
import { tokenStorage } from "@/infrastructure/tokenStorage";
import { mockWorkspaceService } from "@/services/mock/mock-workspace.service";

export type MeetingType = "Internal" | "Client" | "Review";

export interface StoreState {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  isHydrating: boolean;
  /**
   * Set when a stored session could not be verified for a reason other than an
   * invalid token (server unreachable, timeout, 5xx). Tokens are kept so the user can retry.
   */
  authError: string | null;
  /** True after the backend rejected the refresh token (session expired). */
  sessionExpired: boolean;

  setAuth: (user: UserProfile | null, token?: string | null) => void;
  setHydrating: (isHydrating: boolean) => void;
  initAuth: () => Promise<void>;
  updateCurrentUser: (patch: {
    name?: string;
    email?: string;
    phone?: string;
    timezone?: string;
  }) => Promise<UserProfile>;
  logout: () => Promise<void>;

  meetings: ReturnType<typeof mockWorkspaceService.getMeetings>;
  files: ReturnType<typeof mockWorkspaceService.getFiles>;
  activities: ReturnType<typeof mockWorkspaceService.getActivities>;

  refreshWorkspace: () => void;
  addMeeting: (meeting: any) => void;
  removeMeeting: (id: string) => void;
  addFiles: (items: any[]) => void;
  removeFile: (id: string) => void;
  resetAllDemoData: () => Promise<void>;
}

function deriveInitials(name?: string): string {
  if (!name || typeof name !== "string") return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  return parts
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

function normalizeUser(user: UserProfile | null): UserProfile | null {
  if (!user) return null;
  const fullName =
    user.name ||
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
    user.email ||
    "User";
  return {
    ...user,
    name: fullName,
    initials: deriveInitials(fullName),
  };
}

const SIGNED_OUT = {
  currentUser: null,
  isAuthenticated: false,
  isHydrating: false,
  authError: null,
} as const;

export const useStore = create<StoreState>((set, get) => ({
  currentUser: null,
  isAuthenticated: false,
  isHydrating: true,
  authError: null,
  sessionExpired: false,

  setAuth: (user, _token) => {
    set({
      currentUser: normalizeUser(user),
      isAuthenticated: Boolean(user),
      isHydrating: false,
      authError: null,
      sessionExpired: false,
    });
  },

  setHydrating: (isHydrating) => {
    set({ isHydrating });
  },

  /** Restores a persisted JWT session by loading GET /api/accounts/profile/. */
  initAuth: async () => {
    if (!tokenStorage.hasSession()) {
      set({ ...SIGNED_OUT });
      return;
    }
    set({ isHydrating: true, authError: null });
    try {
      // A stale access token is refreshed transparently by the API client.
      const profile = await getProfileApi();
      set({
        currentUser: normalizeUser(profile),
        isAuthenticated: true,
        isHydrating: false,
        authError: null,
        sessionExpired: false,
      });
    } catch (error) {
      const apiErr = toApiError(error);
      if (apiErr.kind === "unauthorized" || apiErr.kind === "forbidden" || apiErr.kind === "not_found") {
        tokenStorage.clear();
        set({ ...SIGNED_OUT });
        return;
      }
      // Network / timeout / server error: keep tokens, let the user retry.
      set({
        currentUser: null,
        isAuthenticated: false,
        isHydrating: false,
        authError: apiErr.message,
      });
    }
  },

  updateCurrentUser: async (patch) => {
    const updated = await updateProfileApi(patch);
    // `timezone` is not stored by the backend; keep the in-memory value for this session only.
    const timezone = patch.timezone ?? get().currentUser?.timezone;
    set({ currentUser: normalizeUser({ ...updated, timezone }) });
    return updated;
  },

  logout: async () => {
    // logoutApi() reads the stored tokens synchronously before its first await,
    // so the UI can switch to signed-out immediately (callers navigate to /login right away).
    const pending = logoutApi();
    set({ ...SIGNED_OUT, sessionExpired: false });
    try {
      await pending;
    } catch {
      // Local tokens are cleared regardless.
    }
  },

  // Workspace collections persisted in centralized mock DB (promocraft_erp_mock_db_v1)
  meetings: mockWorkspaceService.getMeetings(),
  files: mockWorkspaceService.getFiles(),
  activities: mockWorkspaceService.getActivities(),

  refreshWorkspace: () => {
    set({
      meetings: mockWorkspaceService.getMeetings(),
      files: mockWorkspaceService.getFiles(),
      activities: mockWorkspaceService.getActivities(),
    });
  },

  addMeeting: (meeting) => {
    mockWorkspaceService.addMeeting(meeting);
    set({ meetings: mockWorkspaceService.getMeetings() });
  },

  removeMeeting: (id) => {
    mockWorkspaceService.removeMeeting(id);
    set({ meetings: mockWorkspaceService.getMeetings() });
  },

  addFiles: (items) => {
    mockWorkspaceService.addFiles(items);
    set({ files: mockWorkspaceService.getFiles() });
  },

  removeFile: (id) => {
    mockWorkspaceService.removeFile(id);
    set({ files: mockWorkspaceService.getFiles() });
  },

  resetAllDemoData: async () => {
    // Resets only the mock workspace data of modules not yet on the backend.
    mockWorkspaceService.resetAllDemoData();
    set({
      meetings: mockWorkspaceService.getMeetings(),
      files: mockWorkspaceService.getFiles(),
      activities: mockWorkspaceService.getActivities(),
    });
  },
}));

// Refresh token rejected by the backend → drop to signed-out state.
onSessionExpired(() => {
  useStore.setState({ ...SIGNED_OUT, sessionExpired: true });
});
