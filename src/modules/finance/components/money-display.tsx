import { cn } from "@/lib/utils";
import { formatINR } from "../utils/money";

interface MoneyDisplayProps {
  amount: number;
  className?: string;
  compact?: boolean;
  showDecimals?: boolean;
  signed?: boolean;
}

export function MoneyDisplay({
  amount,
  className,
  compact = false,
  showDecimals,
  signed = false,
}: MoneyDisplayProps) {
  const formatted = formatINR(Math.abs(amount), { compact, showDecimals });
  const prefix = signed ? (amount > 0 ? "+" : amount < 0 ? "-" : "") : amount < 0 ? "-" : "";

  return (
    <span className={cn("tabular-nums font-medium", className)}>
      {prefix}
      {formatted}
    </span>
  );
}
