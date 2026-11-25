import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  className?: string;
  size?: "sm" | "md";
  "aria-label"?: string;
}

export function SegmentedControl<T extends string>({ value, onChange, options, className, size = "sm", ...rest }: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={rest["aria-label"]}
      className={cn("hide-scrollbar inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-secondary p-1", className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] duration-200",
              size === "sm" ? "h-7 px-3 text-[12.5px]" : "h-8 px-3.5 text-[13px]",
              active ? "bg-card text-primary-deep shadow-[0_1px_2px_rgba(32,43,60,0.06),0_4px_10px_-4px_rgba(16,50,110,0.25)]" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
            {typeof opt.count === "number" && (
              <span
                className={cn(
                  "figure rounded-full px-1.5 text-[10.5px] leading-[16px]",
                  active ? "bg-accent text-primary-deep" : "bg-card/70 text-subtle",
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
