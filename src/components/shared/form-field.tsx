import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Label + control + hint/error, with consistent spacing. */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
  optional,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  optional?: boolean;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline gap-1.5 text-[12.5px] font-semibold text-foreground">
        {label}
        {optional && <span className="text-[11.5px] font-normal text-subtle">Optional</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-[12px] text-negative">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[12px] text-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "h-10 w-full rounded-[12px] border border-input bg-card px-3.5 text-[13.5px] text-foreground shadow-[0_1px_1px_rgba(16,24,40,0.03)] outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-primary/60 focus:ring-4 focus:ring-primary/12 aria-[invalid=true]:border-negative/60 aria-[invalid=true]:ring-negative/10 disabled:bg-secondary disabled:text-muted-foreground";

export const textareaClass = `${inputClass} h-auto min-h-[84px] py-2 leading-relaxed`;
