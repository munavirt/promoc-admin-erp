import { getErpDatabase, resetAllDemoData, updateErpDatabase } from "@/mocks/persistence";
import type {
  MockActivityRecord,
  MockFileRecord,
  MockMeetingRecord,
  MockWorkspaceSettings,
} from "@/mocks/types";

export const mockWorkspaceService = {
  getMeetings(): MockMeetingRecord[] {
    return getErpDatabase().meetings;
  },

  addMeeting(meeting: Omit<MockMeetingRecord, "id"> & { id?: string }): MockMeetingRecord {
    return updateErpDatabase((db) => {
      const record: MockMeetingRecord = {
        id: meeting.id || `mtg-${Date.now()}`,
        title: meeting.title,
        date: meeting.date,
        time: meeting.time,
        attendees: meeting.attendees,
        type: meeting.type,
        projectId: meeting.projectId,
      };
      db.meetings = [record, ...db.meetings];
      return record;
    });
  },

  removeMeeting(id: string): void {
    updateErpDatabase((db) => {
      db.meetings = db.meetings.filter((m) => m.id !== id);
    });
  },

  getFiles(): MockFileRecord[] {
    return getErpDatabase().files;
  },

  addFiles(items: MockFileRecord[]): MockFileRecord[] {
    return updateErpDatabase((db) => {
      db.files = [...items, ...db.files];
      return db.files;
    });
  },

  removeFile(id: string): void {
    updateErpDatabase((db) => {
      db.files = db.files.filter((f) => f.id !== id);
    });
  },

  getActivities(): MockActivityRecord[] {
    return getErpDatabase().activities;
  },

  getWorkspaceSettings(): MockWorkspaceSettings {
    return getErpDatabase().workspace;
  },

  updateWorkspaceSettings(patch: Partial<MockWorkspaceSettings>): MockWorkspaceSettings {
    return updateErpDatabase((db) => {
      db.workspace = {
        ...db.workspace,
        ...patch,
      };
      return db.workspace;
    });
  },

  resetAllDemoData() {
    return resetAllDemoData();
  },
};
