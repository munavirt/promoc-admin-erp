import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown } from "lucide-react";
import { PageShell } from "@/components/dashboard/page-shell";
import { useStore } from "@/store";
import { useEffect } from "react";

export default function ReportsPage() {
  const navigate = useNavigate();
  const { currentUser } = useStore();
  const [range, setRange] = useState("30d");
  
  useEffect(() => {
    if (currentUser?.role === "Employee") {
      navigate("/");
    }
  }, [currentUser, navigate]);

  const data = useMemo(() => {
    const points = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    let seed = points * 3;
    return Array.from({ length: points }, () => {
      seed = (seed * 9301 + 49297) % 233280;
      return 40 + Math.round((seed / 233280) * 60);
    });
  }, [range]);

  const max = Math.max(...data);
  const revenue = data.reduce((a, b) => a + b, 0) * 120;

  const kpis = [
    { label: "Revenue", value: `$${(revenue / 1000).toFixed(1)}k`, delta: 12.4, up: true },
    { label: "Utilization", value: "78%", delta: 3.1, up: true },
    { label: "On-time delivery", value: "94%", delta: 1.2, up: true },
    { label: "Pipeline", value: "$248k", delta: -4.6, up: false },
  ];

  return (
    <PageShell
      title="Reports"
      description="Performance across projects, revenue and delivery"
      actions={
        <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1">
          {["7d", "30d", "90d"].map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`rounded px-2.5 py-1 text-[12px] font-medium ${range === r ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{r}</button>
          ))}
        </div>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border border-border bg-card p-4">
            <div className="text-[12px] text-muted-foreground">{k.label}</div>
            <div className="mt-1 text-[22px] font-semibold tracking-tight text-foreground">{k.value}</div>
            <div className={`mt-1 flex items-center gap-1 text-[12px] ${k.up ? "text-emerald-600" : "text-red-600"}`}>
              {k.up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {k.delta > 0 ? "+" : ""}{k.delta}%
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[14px] font-medium text-foreground">Revenue trend</div>
            <div className="text-[12px] text-muted-foreground">Last {range}</div>
          </div>
        </div>
        <div className="flex h-48 items-end gap-1">
          {data.map((v, i) => (
            <div key={i} className="flex-1 rounded-t bg-primary/80" style={{ height: `${(v / max) * 100}%` }} title={`Day ${i + 1}: ${v}`} />
          ))}
        </div>
      </div>
    </PageShell>
  );
}