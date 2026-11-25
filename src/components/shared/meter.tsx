import { cn } from "@/lib/utils";

type Tone = "neutral" | "primary" | "positive" | "caution" | "negative";

const TONE_BAR: Record<Tone, string> = {
  neutral: "bg-[#929db0]",
  primary: "bg-gradient-to-r from-[#3384ff] to-primary",
  positive: "bg-gradient-to-r from-[#6fcfa7] to-positive",
  caution: "bg-gradient-to-r from-[#fcc560] to-[#e8900c]",
  negative: "bg-gradient-to-r from-[#f87171] to-[#dc2626]",
};

/** Thin rounded progress bar. */
export function Meter({ value, tone = "primary", className, label }: { value: number; tone?: Tone; className?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-[#e7ecf4]", className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", TONE_BAR[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Circular progress, as used for project completion. */
export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  color = "var(--primary)",
  track = "#e7ecf4",
  children,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }} role="img" aria-label={`${Math.round(pct)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.2,0.7,0.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children ?? <span className="figure text-[13px] font-bold">{Math.round(pct)}%</span>}</div>
    </div>
  );
}
