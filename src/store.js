import { create } from 'zustand';

const initialClients = [
  { id: "1", name: "Sarah Chen", company: "Northwind Labs", logo: "NL", email: "sarah@northwind.co", phone: "+1 415 555 0132", website: "northwind.co", industry: "Technology", projects: 4, status: "Active", about: "Northwind Labs is a leading provider of cloud infrastructure and DevOps automation tools." },
  { id: "2", name: "Marcus Reid", company: "Halcyon Media", logo: "HM", email: "marcus@halcyon.io", phone: "+1 212 555 0187", website: "halcyon.io", industry: "Entertainment", projects: 2, status: "Active", about: "Halcyon Media produces award-winning original podcasts and digital video series." },
  { id: "3", name: "Priya Natarajan", company: "Fielder & Co.", logo: "FC", email: "priya@fielder.com", phone: "+44 20 7946 0021", website: "fielder.com", industry: "Finance", projects: 1, status: "Prospect", about: "Boutique investment firm specializing in sustainable and ethical ventures." },
  { id: "4", name: "Tom Ibarra", company: "Vertex Retail", logo: "VR", email: "tom@vertex.com", phone: "+1 646 555 0119", website: "vertex.com", industry: "E-Commerce", projects: 3, status: "Paused", about: "Vertex is a rapidly growing D2C athletic wear brand." },
];

const initialProjects = [
  { id: "1", name: "Q3 Product Launch", client: "Northwind Labs", status: "In Progress", progress: 68, due: "Aug 14", lead: "AM", budget: 45000, spent: 31500, milestones: [{ title: "Strategy", status: "completed" }, { title: "Design", status: "completed" }, { title: "Development", status: "pending" }], team: ["AM", "RS", "KL"] },
  { id: "2", name: "Brand Refresh 2026", client: "Halcyon Media", status: "Review", progress: 92, due: "Jul 30", lead: "RS", budget: 85000, spent: 78000, milestones: [{ title: "Discovery", status: "completed" }, { title: "Visual Identity", status: "completed" }, { title: "Guidelines", status: "pending" }], team: ["RS", "JT", "AM"] },
  { id: "3", name: "Retail Campaign", client: "Vertex Retail", status: "Planning", progress: 18, due: "Sep 05", lead: "KL", budget: 120000, spent: 15000, milestones: [{ title: "Ideation", status: "completed" }, { title: "Production", status: "pending" }], team: ["KL", "DP"] },
  { id: "4", name: "Website Rebuild", client: "Fielder & Co.", status: "In Progress", progress: 44, due: "Oct 12", lead: "JT", budget: 65000, spent: 28000, milestones: [{ title: "Wireframes", status: "completed" }, { title: "UI Design", status: "pending" }], team: ["JT", "KL", "RS"] },
];

const initialTasks = [
  { id: "1", title: "Approve homepage hero copy", project: "Website Rebuild", assignee: "AM", priority: "High", due: "Today", done: false, estimatedTime: "1h", labels: ["Copywriting"], commentsCount: 2, attachmentsCount: 0 },
  { id: "2", title: "Send Q3 launch assets to client", project: "Q3 Product Launch", assignee: "RS", priority: "High", due: "Today", done: false, estimatedTime: "30m", labels: ["Delivery"], commentsCount: 0, attachmentsCount: 4 },
  { id: "3", title: "Book podcast studio", project: "Podcast Series", assignee: "KL", priority: "Medium", due: "Tomorrow", done: true, estimatedTime: "1h", labels: ["Logistics"], commentsCount: 1, attachmentsCount: 0 },
  { id: "4", title: "Draft social calendar", project: "Retail Campaign", assignee: "JT", priority: "Medium", due: "Fri", done: false, estimatedTime: "4h", labels: ["Social"], commentsCount: 0, attachmentsCount: 1 },
  { id: "5", title: "Compress product photos", project: "Brand Refresh 2026", assignee: "AM", priority: "Low", due: "Mon", done: false, estimatedTime: "2h", labels: ["Design"], commentsCount: 0, attachmentsCount: 0 },
];

const initialEmployees = [
  { id: "1", name: "Alex Morgan", role: "Creative Director", email: "alex@promocraft.co", department: "Creative", workload: 82, initials: "AM", location: "New York", joinDate: "Jan 2022", status: "Online" },
  { id: "2", name: "Rachel Singh", role: "Account Manager", email: "rachel@promocraft.co", department: "Accounts", workload: 65, initials: "RS", location: "London", joinDate: "Mar 2023", status: "In a meeting" },
  { id: "3", name: "Kai Lombardi", role: "Senior Designer", email: "kai@promocraft.co", department: "Creative", workload: 74, initials: "KL", location: "Remote", joinDate: "Nov 2024", status: "Online" },
  { id: "4", name: "Jules Tran", role: "Producer", email: "jules@promocraft.co", department: "Production", workload: 58, initials: "JT", location: "Los Angeles", joinDate: "Aug 2023", status: "Offline" },
  { id: "5", name: "Diego Peña", role: "Copywriter", email: "diego@promocraft.co", department: "Creative", workload: 40, initials: "DP", location: "Madrid", joinDate: "Feb 2025", status: "Online" },
];

const initialMeetings = [
  { id: "1", title: "Northwind — Weekly Sync", date: "Wed, Jul 22", time: "10:00 – 10:30", attendees: 5, type: "Client" },
  { id: "2", title: "Design Critique", date: "Wed, Jul 22", time: "14:00 – 15:00", attendees: 8, type: "Internal" },
  { id: "3", title: "Halcyon — Brand Review", date: "Thu, Jul 23", time: "11:00 – 12:00", attendees: 6, type: "Review" },
];

const initialFiles = [
  { id: "1", name: "Brand-Guidelines-v3.pdf", size: "4.2 MB", project: "Brand Refresh 2026", uploaded: "2h ago", kind: "doc" },
  { id: "2", name: "hero-shot-final.jpg", size: "1.8 MB", project: "Q3 Product Launch", uploaded: "Yesterday", kind: "image" },
  { id: "3", name: "launch-assets.zip", size: "38 MB", project: "Q3 Product Launch", uploaded: "2 days ago", kind: "zip" },
];

const initialActivities = [
  { id: "1", user: "Alex Morgan", userInitials: "AM", action: "approved", target: "Homepage Wireframes", project: "Website Rebuild", time: "12m ago" },
  { id: "2", user: "Rachel Singh", userInitials: "RS", action: "uploaded", target: "Q3-Brief.pdf", project: "Q3 Product Launch", time: "1h ago" },
  { id: "3", user: "Kai Lombardi", userInitials: "KL", action: "completed", target: "Logo explorations", project: "Brand Refresh 2026", time: "3h ago" },
  { id: "4", user: "Jules Tran", userInitials: "JT", action: "commented on", target: "Social Media Strategy", project: "Retail Campaign", time: "5h ago" },
];

export const useStore = create((set) => ({
  currentUser: null,
  isAuthenticated: false,
  login: (email) => {
    const role = email.includes("admin") ? "Admin" : email.includes("manager") ? "Manager" : "Employee";
    const permissions = role === "Admin" ? ["*"] : role === "Manager" ? ["view:projects", "edit:projects", "view:employees"] : ["view:projects"];
    const name = email.split("@")[0].replace(".", " ").replace(/\b\w/g, l => l.toUpperCase());
    const initials = name.split(" ").map(n => n[0]).join("").toUpperCase() || "U";
    
    set({ 
      currentUser: { id: crypto.randomUUID(), name, email, role, permissions, initials },
      isAuthenticated: true 
    });
  },
  logout: () => set({ currentUser: null, isAuthenticated: false }),

  clients: initialClients,
  addClient: (c) => set((state) => ({ clients: [c, ...state.clients] })),
  removeClient: (id) => set((state) => ({ clients: state.clients.filter((x) => x.id !== id) })),

  projects: initialProjects,
  addProject: (p) => set((state) => ({ projects: [p, ...state.projects] })),
  updateProjectStatus: (id, status) => set((state) => ({
    projects: state.projects.map((p) => p.id === id ? { ...p, status, progress: status === "Completed" ? 100 : p.progress } : p)
  })),
  removeProject: (id) => set((state) => ({ projects: state.projects.filter((x) => x.id !== id) })),

  tasks: initialTasks,
  addTask: (t) => set((state) => ({ tasks: [t, ...state.tasks] })),
  toggleTask: (id) => set((state) => ({
    tasks: state.tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t)
  })),
  updateTaskStatus: (id, done) => set((state) => ({
    tasks: state.tasks.map((t) => t.id === id ? { ...t, done } : t)
  })),
  removeTask: (id) => set((state) => ({ tasks: state.tasks.filter((x) => x.id !== id) })),

  employees: initialEmployees,
  addEmployee: (e) => set((state) => ({ employees: [e, ...state.employees] })),
  removeEmployee: (id) => set((state) => ({ employees: state.employees.filter((x) => x.id !== id) })),

  meetings: initialMeetings,
  addMeeting: (m) => set((state) => ({ meetings: [m, ...state.meetings] })),
  removeMeeting: (id) => set((state) => ({ meetings: state.meetings.filter((x) => x.id !== id) })),

  files: initialFiles,
  addFiles: (f) => set((state) => ({ files: [...f, ...state.files] })),
  removeFile: (id) => set((state) => ({ files: state.files.filter((x) => x.id !== id) })),

  activities: initialActivities,
  addActivity: (a) => set((state) => ({ activities: [a, ...state.activities] })),
}));
