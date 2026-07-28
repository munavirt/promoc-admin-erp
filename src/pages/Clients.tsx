import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, Trash2, Mail, Phone, AlertCircle, Building2, Globe, MoreHorizontal } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { useStore, ClientStatus } from "@/store";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

const clientSchema = z.object({
  name: z.string().min(2, "Name is required"),
  company: z.string().min(2, "Company is required"),
  logo: z.string().min(1, "Initials are required").max(3),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(5, "Phone is required"),
  website: z.string().min(3, "Website is required"),
  industry: z.string().min(2, "Industry is required"),
  status: z.enum(["Active", "Prospect", "Paused"]),
  about: z.string().optional(),
});

const clientForm = clientSchema;

export default function ClientsPage() {
  const navigate = useNavigate();
  const { currentUser, clients, addClient, removeClient } = useStore();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  
  useEffect(() => {
    if (currentUser?.role === "Employee") {
      navigate("/");
    }
  }, [currentUser, navigate]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      status: "Active",
    }
  });

  const filtered = clients.filter((c) =>
    [c.name, c.company, c.email].some((v) => v.toLowerCase().includes(query.toLowerCase())),
  );

  const onSubmit = (data) => {
    addClient({
      id: crypto.randomUUID(),
      projects: 0,
      about: data.about || "",
      ...data,
    });
    setOpen(false);
    reset();
  };

  return (
    <PageShell
      title="Clients"
      description={`Manage your ${clients.length} accounts · ${clients.filter((c) => c.status === "Active").length} active`}
      actions={
        <Button size="sm" className="h-[34px] gap-1.5 px-3 text-[13px] font-medium shadow-sm" onClick={() => setOpen((v) => !v)}>
          <Plus className="h-4 w-4" /> New Client
        </Button>
      }
    >
      {open && (
        <form onSubmit={handleSubmit(onSubmit)} className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-[14px] font-semibold text-foreground">Add New Client</h3>
            <p className="text-[13px] text-muted-foreground">Enter the primary contact and company details.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="text-[12px] font-medium text-foreground mb-1.5 block">Company Name</label>
              <input {...register("company")} placeholder="e.g. Acme Corp" className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
              {errors.company && <span className="text-[11px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.company.message}</span>}
            </div>
            <div>
              <label className="text-[12px] font-medium text-foreground mb-1.5 block">Logo Initials</label>
              <input {...register("logo")} placeholder="e.g. AC" maxLength={3} className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors uppercase" />
              {errors.logo && <span className="text-[11px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.logo.message}</span>}
            </div>
            <div>
              <label className="text-[12px] font-medium text-foreground mb-1.5 block">Status</label>
              <select {...register("status")} className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors">
                <option value="Active">Active</option>
                <option value="Prospect">Prospect</option>
                <option value="Paused">Paused</option>
              </select>
            </div>
            
            <div className="md:col-span-2">
              <label className="text-[12px] font-medium text-foreground mb-1.5 block">Contact Name</label>
              <input {...register("name")} placeholder="Full Name" className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
              {errors.name && <span className="text-[11px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.name.message}</span>}
            </div>
            <div>
              <label className="text-[12px] font-medium text-foreground mb-1.5 block">Email</label>
              <input {...register("email")} placeholder="name@company.com" className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
              {errors.email && <span className="text-[11px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.email.message}</span>}
            </div>
            <div>
              <label className="text-[12px] font-medium text-foreground mb-1.5 block">Phone</label>
              <input {...register("phone")} placeholder="+1..." className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
              {errors.phone && <span className="text-[11px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.phone.message}</span>}
            </div>

            <div className="md:col-span-2">
              <label className="text-[12px] font-medium text-foreground mb-1.5 block">Website</label>
              <input {...register("website")} placeholder="company.com" className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
              {errors.website && <span className="text-[11px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.website.message}</span>}
            </div>
            <div className="md:col-span-2">
              <label className="text-[12px] font-medium text-foreground mb-1.5 block">Industry</label>
              <input {...register("industry")} placeholder="e.g. Technology" className="h-[34px] w-full rounded-md border border-border bg-background px-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors" />
              {errors.industry && <span className="text-[11px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{errors.industry.message}</span>}
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-3 pt-4 border-t border-border/50">
            <Button type="button" size="sm" variant="ghost" className="h-[34px]" onClick={() => {setOpen(false); reset();}}>Cancel</Button>
            <Button type="submit" size="sm" className="h-[34px] shadow-sm">Add Client</Button>
          </div>
        </form>
      )}

      <div className="mb-4 flex items-center gap-2">
        <div className="relative w-full max-w-[320px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients…" className="h-[34px] w-full rounded-md border border-border bg-card pl-9 pr-3 text-[13px] focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none transition-colors shadow-sm" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] min-w-[700px]">
          <thead>
            <tr className="bg-secondary/30 text-[12px] font-medium text-muted-foreground [&>th:first-child]:rounded-tl-[8px] [&>th:last-child]:rounded-tr-[8px] border-b border-border/60">
              <th className="px-5 py-3.5">Company</th>
              <th className="px-5 py-3.5">Primary Contact</th>
              <th className="px-5 py-3.5 hidden md:table-cell">Industry</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="w-12 px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filtered.map((c) => (
              <tr key={c.id} className="group hover:bg-secondary/40 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background text-[11px] font-bold text-foreground shadow-sm">
                      {c.logo}
                    </div>
                    <div>
                      <Link to={`/clients/${c.id}`} className="font-medium text-foreground hover:underline">
                        {c.company}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                        <Globe className="h-3 w-3" />
                        {c.website}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="font-medium text-foreground">{c.name}</div>
                  <div className="mt-0.5 text-[12px] text-muted-foreground flex items-center gap-1.5">
                    <Mail className="h-3 w-3" /> {c.email}
                  </div>
                </td>
                <td className="px-5 py-3 hidden md:table-cell text-muted-foreground">
                  {c.industry}
                </td>
                <td className="px-5 py-3">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link to={`/clients/${c.id}`} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors" aria-label="View details">
                      <MoreHorizontal className="h-4 w-4" />
                    </Link>
                    <button onClick={() => removeClient(c.id)} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors" aria-label="Delete client">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground mb-3">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <p className="text-[14px] font-medium text-foreground">No clients found</p>
                  <p className="mt-1 text-[13px] text-muted-foreground">Get started by adding a new client.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </PageShell>
  );
}

function StatusBadge({ status }) {
  const map = {
    Active: "bg-emerald-50 text-emerald-700 ring-emerald-500/20",
    Prospect: "bg-blue-50 text-blue-700 ring-blue-500/20",
    Paused: "bg-amber-50 text-amber-700 ring-amber-500/20",
  };
  return <span className={cn("inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", map[status])}>{status}</span>;
}