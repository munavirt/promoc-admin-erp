import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "@/store";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Globe, Mail, Phone, MapPin, Building2, ExternalLink, Calendar, FolderKanban, FileText, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ClientDetailsPage() {
  const { clientId } = useParams();
  const { clients, projects, meetings } = useStore();
  const client = clients.find(c => c.id === clientId);
  
  const [activeTab, setActiveTab] = useState("Overview");

  if (!client) {
    return (
      <DashboardShell>
        <div className="flex h-[400px] flex-col items-center justify-center">
          <h2 className="text-[18px] font-semibold text-foreground">Client not found</h2>
          <Link to="/clients" className="mt-4 text-[13px] text-primary hover:underline">Return to clients</Link>
        </div>
      </DashboardShell>
    );
  }
  
  const tabs = ["Overview", "Projects", "Invoices", "Meetings", "Files"];
  const clientProjects = projects.filter(p => p.client === client.company);
  
  return (
    <DashboardShell>
      <div className="mb-6 max-w-[1200px] mx-auto">
        <Link to="/clients" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Clients
        </Link>
        
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background text-[20px] font-bold text-foreground shadow-sm">
              {client.logo}
            </div>
            <div>
              <h1 className="text-[24px] font-semibold tracking-tight text-foreground">{client.company}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> {client.website}</span>
                <span className="text-border">•</span>
                <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> {client.industry}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-[34px] text-[13px]">Edit Client</Button>
            <Button size="sm" className="h-[34px] shadow-sm">New Project</Button>
          </div>
        </div>
      </div>

      <div className="mb-6 border-b border-border/50 max-w-[1200px] mx-auto">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "whitespace-nowrap border-b-2 py-3 text-[13px] font-medium transition-colors",
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="max-w-[1200px] mx-auto">
        {activeTab === "Overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <h3 className="text-[14px] font-semibold text-foreground mb-3">About {client.company}</h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed">{client.about || "No description provided."}</p>
              </section>
              
              <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[14px] font-semibold text-foreground">Active Projects</h3>
                  <Link to="/projects" className="text-[12px] font-medium text-primary hover:underline">View all</Link>
                </div>
                <div className="space-y-3">
                  {clientProjects.length === 0 ? (
                    <p className="text-[13px] text-muted-foreground">No active projects.</p>
                  ) : (
                    clientProjects.map(p => (
                      <Link to="/projects/$projectId" params={{projectId: p.id}} key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-secondary/40 transition-colors group">
                        <div className="flex items-center gap-3">
                          <FolderKanban className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          <span className="text-[13px] font-medium text-foreground">{p.name}</span>
                        </div>
                        <span className="text-[12px] text-muted-foreground tabular-nums">{p.progress}% completed</span>
                      </Link>
                    ))
                  )}
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <h3 className="text-[14px] font-semibold text-foreground mb-4">Contact Details</h3>
                <div className="space-y-4 text-[13px]">
                  <div className="flex items-center gap-3 text-foreground">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-muted-foreground ring-1 ring-border"><Mail className="h-4 w-4" /></div>
                    <span className="font-medium">{client.name}</span>
                    <a href={`mailto:${client.email}`} className="ml-auto text-primary hover:underline">Email</a>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary ring-1 ring-border"><Phone className="h-4 w-4" /></div>
                    {client.phone}
                  </div>
                </div>
              </section>
              
              <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <h3 className="text-[14px] font-semibold text-foreground mb-4">Financial Overview</h3>
                <div className="space-y-5">
                  <div>
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total Lifetime Value</div>
                    <div className="text-[24px] font-semibold tracking-tight text-foreground">$124,500</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Outstanding Invoices</div>
                    <div className="text-[24px] font-semibold tracking-tight text-foreground">$12,000</div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab !== "Overview" && (
          <div className="flex h-[300px] items-center justify-center rounded-xl border border-dashed border-border bg-card/50">
            <div className="text-center">
              <h3 className="text-[14px] font-medium text-foreground">Coming Soon</h3>
              <p className="mt-1 text-[13px] text-muted-foreground">The {activeTab.toLowerCase()} tab is currently under development.</p>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
