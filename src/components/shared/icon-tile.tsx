import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Pastel = "blue" | "sky" | "mint" | "peach" | "rose" | "butter";

const TILE: Record<Pastel, string> = {
  blue: "bg-brand-soft text-[#004fcc]",
  sky: "bg-sky text-accent-2-deep",
  mint: "bg-mint text-[#1f8a60]",
  peach: "bg-accent-2-soft text-accent-2-deep",
  rose: "bg-rose text-negative",
  butter: "bg-butter text-[#a67a00]",
};

/** Pastel icon container used to colour-code categories. */
export function IconTile({ icon: Icon, tone = "blue", size = "md", className }: { icon: LucideIcon; tone?: Pastel; size?: "sm" | "md" | "lg"; className?: string }) {
  const dims = size === "sm" ? "h-8 w-8 rounded-[10px]" : size === "lg" ? "h-12 w-12 rounded-[14px]" : "h-10 w-10 rounded-[12px]";
  const icon = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-5.5 w-5.5" : "h-[18px] w-[18px]";
  return (
    <span className={cn("flex shrink-0 items-center justify-center", dims, TILE[tone], className)}>
      <Icon className={icon} strokeWidth={1.9} />
    </span>
  );
}
