import type { ReactNode } from "react";
import { FlaskConical, PlugZap } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataSourceNoticeProps {
  /**
   * "demo": the page works against the local demo dataset; the backend endpoint exists.
   * "pending": no backend model or endpoint exists yet, so data is not persisted server-side.
   */
  kind: "demo" | "pending";
  children?: ReactNode;
  endpoint?: string;
  className?: string;
}

/** Makes it explicit where a page's data comes from, so demo data is never mistaken for real records. */
export function DataSourceNotice({ kind, children, endpoint, className }: DataSourceNoticeProps) {
  const Icon = kind === "demo" ? FlaskConical : PlugZap;
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-3 rounded-[14px] px-4 py-3 text-[12.5px] leading-relaxed",
        kind === "demo" ? "bg-brand-soft text-[#004fcc]" : "bg-caution-soft text-[#7a4a00]",
        className,
      )}
    >
      <span className={cn("mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/70")}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 pt-0.5">
        <span className="font-bold">{kind === "demo" ? "Demo data. " : "Backend integration pending. "}</span>
        {children}
        {endpoint && <code className="ml-1 rounded-md bg-white/70 px-1.5 py-px font-mono text-[11px] break-all">{endpoint}</code>}
      </div>
    </div>
  );
}
