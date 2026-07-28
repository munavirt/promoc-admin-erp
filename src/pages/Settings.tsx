import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "@/components/dashboard/page-shell";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { cn } from "@/lib/utils";
import { Bell, User, Building2, CreditCard, Link as LinkIcon, Shield, Monitor, Mail, Save } from "lucide-react";
import { useEffect } from "react";

const profileSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email"),
  role: z.string(),
  timezone: z.string(),
});

const profileForm = profileSchema;

export default function SettingsPage() {
  const navigate = useNavigate();
  const { currentUser } = useStore();
  const [activeTab, setActiveTab] = useState("Profile");
  const [saved, setSaved] = useState(false);
  
  useEffect(() => {
    if (currentUser?.role === "Employee") {
      navigate("/");
    }
  }, [currentUser, navigate]);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "Alex Morgan",
      email: "alex@promocraft.co",
      role: "Creative Director",
      timezone: "America/New_York (EST)",
    }
  });

  const onSubmit = (data) => {
    // mock save
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const navItems = [
    { label: "Profile", icon: User },
    { label: "Workspace", icon: Building2 },
    { label: "Notifications", icon: Bell },
    { label: "Integrations", icon: LinkIcon },
    { label: "Billing", icon: CreditCard },
    { label: "Security", icon: Shield },
  ];

  return (
    <PageShell
      title="Settings"
      description="Manage your account settings and preferences."
    >
      <div className="flex flex-col md:flex-row gap-8 max-w-[1200px] mx-auto">
        <aside className="w-full md:w-[220px] shrink-0">
          <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => setActiveTab(item.label)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors whitespace-nowrap",
                    activeTab === item.label
                      ? "bg-secondary text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.02)] border border-border/50"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="flex-1 max-w-[700px]">
          {activeTab === "Profile" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-[16px] font-semibold text-foreground">Profile Information</h3>
                <p className="text-[13px] text-muted-foreground mt-1">Update your personal details and how you appear to others.</p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-5 pb-6 border-b border-border/50 mb-6">
                  <div className="relative">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border border-border/50 bg-secondary text-[24px] font-bold text-foreground">
                      AM
                    </div>
                    <button className="absolute bottom-0 right-0 rounded-full bg-secondary border border-border/50 p-1.5 shadow-sm text-foreground hover:bg-border/50 transition-colors">
                      <User className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div>
                    <h4 className="text-[14px] font-medium text-foreground">Profile Picture</h4>
                    <p className="text-[12px] text-muted-foreground mt-1 mb-3">JPG, GIF or PNG. 1MB max.</p>
                    <Button size="sm" variant="secondary" className="h-[30px] text-[12px]">Change picture</Button>
                  </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="text-[12px] font-medium text-foreground mb-1.5 block">Full Name</label>
                      <input {...register("name")} className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-foreground mb-1.5 block">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input {...register("email")} className="h-[34px] w-full rounded-md border border-border bg-background pl-9 pr-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="text-[12px] font-medium text-foreground mb-1.5 block">Role / Title</label>
                      <input {...register("role")} className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-foreground mb-1.5 block">Timezone</label>
                      <select {...register("timezone")} className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors">
                        <option value="America/New_York (EST)">America/New_York (EST)</option>
                        <option value="America/Los_Angeles (PST)">America/Los_Angeles (PST)</option>
                        <option value="Europe/London (GMT)">Europe/London (GMT)</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end gap-3">
                    {saved && <span className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-600"><Save className="w-3.5 h-3.5" /> Saved</span>}
                    <Button type="submit" size="sm" className="h-[34px] shadow-sm">Save Changes</Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {activeTab === "Workspace" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-[16px] font-semibold text-foreground">Workspace Settings</h3>
                <p className="text-[13px] text-muted-foreground mt-1">Manage your agency details and global preferences.</p>
              </div>

              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="space-y-5">
                  <div>
                    <label className="text-[12px] font-medium text-foreground mb-1.5 block">Agency Name</label>
                    <input defaultValue="PromoCraft" className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="text-[12px] font-medium text-foreground mb-1.5 block">Workspace URL</label>
                    <div className="flex rounded-md shadow-sm">
                      <span className="inline-flex items-center rounded-l-md border border-r-0 border-border bg-secondary px-3 text-[13px] text-muted-foreground sm:text-[13px]">
                        app.promocraft.co/
                      </span>
                      <input type="text" defaultValue="hq" className="h-[34px] w-full flex-1 rounded-none rounded-r-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-border/50">
                    <Button size="sm" className="h-[34px] shadow-sm">Save Workspace</Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Placeholder for other tabs */}
          {activeTab !== "Profile" && activeTab !== "Workspace" && (
            <div className="flex h-[300px] items-center justify-center rounded-xl border border-dashed border-border bg-card/50">
              <div className="text-center">
                <h3 className="text-[14px] font-medium text-foreground">{activeTab}</h3>
                <p className="mt-1 text-[13px] text-muted-foreground">Settings for {activeTab.toLowerCase()} will appear here.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}