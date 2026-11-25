import type {
  MockActivityRecord,
  MockFileRecord,
  MockMeetingRecord,
  MockWorkspaceSettings,
} from "../types";

export const INITIAL_MOCK_MEETINGS: MockMeetingRecord[] = [
  {
    id: "mtg-1",
    title: "Northwind Q3 Launch Readiness Sync",
    date: "Today",
    time: "11:30 - 12:15",
    attendees: 5,
    type: "Client",
    projectId: 1,
  },
  {
    id: "mtg-2",
    title: "Creative Crit & Motion Review",
    date: "Tomorrow",
    time: "15:00 - 16:00",
    attendees: 4,
    type: "Review",
    projectId: 2,
  },
  {
    id: "mtg-3",
    title: "Festive Omnichannel Sprint Standup",
    date: "Fri, Nov 14",
    time: "10:00 - 10:30",
    attendees: 6,
    type: "Internal",
    projectId: 3,
  },
];

export const INITIAL_MOCK_FILES: MockFileRecord[] = [
  {
    id: "file-1",
    name: "Halcyon-Brand-Guidelines-v3.pdf",
    size: "4.2 MB",
    project: "Brand Refresh 2026",
    uploaded: "2h ago",
    kind: "doc",
  },
  {
    id: "file-2",
    name: "northwind-hero-frame-final.jpg",
    size: "1.8 MB",
    project: "Q3 Product Launch Campaign",
    uploaded: "Yesterday",
    kind: "image",
  },
  {
    id: "file-3",
    name: "festive-campaign-key-visuals.zip",
    size: "38.4 MB",
    project: "Festive Retail Omnichannel Sprint",
    uploaded: "2 days ago",
    kind: "zip",
  },
  {
    id: "file-4",
    name: "Fielder-Handover-Audit.pdf",
    size: "640 KB",
    project: "Corporate Website Rebuild",
    uploaded: "Sep 25",
    kind: "doc",
  },
];

export const INITIAL_MOCK_ACTIVITIES: MockActivityRecord[] = [
  {
    id: "act-1",
    user: "Jules Tran",
    userInitials: "JT",
    action: "moved to Review",
    target: "Build interactive product pricing matrix",
    timestamp: "2h ago",
    projectId: 1,
  },
  {
    id: "act-2",
    user: "Kai Lombardi",
    userInitials: "KL",
    action: "uploaded asset revision on",
    target: "Brand Refresh 2026",
    timestamp: "4h ago",
    projectId: 2,
  },
  {
    id: "act-3",
    user: "Rachel Singh",
    userInitials: "RS",
    action: "scheduled sprint check-in for",
    target: "Festive Retail Omnichannel Sprint",
    timestamp: "Yesterday",
    projectId: 3,
  },
  {
    id: "act-4",
    user: "Alex Morgan",
    userInitials: "AM",
    action: "signed off milestone deck on",
    target: "Q3 Product Launch Campaign",
    timestamp: "2 days ago",
    projectId: 1,
  },
];

export const INITIAL_WORKSPACE_SETTINGS: MockWorkspaceSettings = {
  agencyName: "PromoCraft",
  workspaceSlug: "hq",
  defaultTimezone: "Asia/Kolkata (IST)",
};
