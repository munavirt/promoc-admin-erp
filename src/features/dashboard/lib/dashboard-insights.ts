import type { ProjectBackend } from "@/api/projects.api";
import type { TaskBackend } from "@/api/tasks.api";

/** Derivations used by the operations dashboard. All are computed from record fields — nothing is estimated. */

export const OPEN_TASK_EXCLUDED = new Set(["COMPLETED", "CANCELLED"]);
export const CLOSED_PROJECT = new Set(["COMPLETED", "CANCELLED"]);

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysFromToday(iso?: string | null): number | null {
  if (!iso) return null;
  const target = new Date(`${iso.slice(0, 10)}T00:00:00`).getTime();
  const today = new Date(`${todayISO()}T00:00:00`).getTime();
  if (!Number.isFinite(target)) return null;
  return Math.round((target - today) / 86400000);
}

/** "Today", "Tomorrow", "In 5 days", "Yesterday", "3 days late". */
export function dueLabel(iso?: string | null, { lateWord = "late" } = {}): string {
  const d = daysFromToday(iso);
  if (d === null) return "No date";
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return `1 day ${lateWord}`;
  if (d < 0) return `${Math.abs(d)} days ${lateWord}`;
  if (d < 14) return `In ${d} days`;
  return formatShortDate(iso!);
}

export function formatShortDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function relativeTime(iso?: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function isTaskOpen(t: TaskBackend) {
  return !OPEN_TASK_EXCLUDED.has(String(t.status).toUpperCase());
}

export function isTaskOverdue(t: TaskBackend) {
  return isTaskOpen(t) && Boolean(t.due_date) && t.due_date < todayISO();
}

export function isTaskDueSoon(t: TaskBackend, windowDays = 7) {
  const d = daysFromToday(t.due_date);
  return isTaskOpen(t) && d !== null && d >= 0 && d <= windowDays;
}

export type ProjectHealth = "on_track" | "at_risk" | "overdue" | "done";

/**
 * Schedule health from dates and reported progress:
 *  - overdue  — deadline passed and the project is not completed
 *  - at_risk  — due within 7 days with < 80% progress, or progress trails elapsed time by > 20 points
 *  - on_track — otherwise
 */
export function projectHealth(p: ProjectBackend): { health: ProjectHealth; reason: string } {
  const status = String(p.status).toUpperCase();
  if (status === "COMPLETED") return { health: "done", reason: "Completed" };
  const left = daysFromToday(p.deadline);
  const progress = Number(p.progress) || 0;
  if (left !== null && left < 0) return { health: "overdue", reason: `Deadline passed ${Math.abs(left)}d ago` };
  if (left !== null && left <= 7 && progress < 80) {
    return { health: "at_risk", reason: `${progress}% done with ${left}d left` };
  }
  if (p.start_date && p.deadline) {
    const start = new Date(`${p.start_date}T00:00:00`).getTime();
    const end = new Date(`${p.deadline}T00:00:00`).getTime();
    const now = new Date(`${todayISO()}T00:00:00`).getTime();
    if (end > start && now > start) {
      const elapsed = Math.min(100, Math.round(((now - start) / (end - start)) * 100));
      if (elapsed - progress > 20) return { health: "at_risk", reason: `${elapsed}% of time used, ${progress}% done` };
    }
  }
  return { health: "on_track", reason: "Progressing to schedule" };
}

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  PLANNING: "Planning",
  IN_PROGRESS: "In progress",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const TASK_STATUS_LABEL: Record<string, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  COMPLETED: "Completed",
  BLOCKED: "Blocked",
  CANCELLED: "Cancelled",
};

export function projectClientName(p: ProjectBackend, clientNames: Map<string, string>): string {
  if (p.client_name) return p.client_name; // ProjectSerializer.client_name (real API)
  if (p.client && typeof p.client === "object") return p.client.name;
  return clientNames.get(String(p.client)) || "—";
}

export function greetingFor(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
