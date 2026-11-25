import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { financeTextareaClass } from "./finance-form-shell";

/**
 * Confirmation for permanent finance actions (issue, cancel, delete draft, void, reverse allocation).
 * The confirm button stays disabled while the request is pending, preventing duplicate submissions.
 * The dialog closes only after the caller's promise resolves (i.e. the backend confirmed the action).
 */
export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  consequences,
  confirmLabel,
  destructive = false,
  reason,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  consequences?: string[];
  confirmLabel: string;
  destructive?: boolean;
  /** Ask for a reason; `required` blocks confirm until one is typed (e.g. payment void). */
  reason?: { label: string; required: boolean; maxLength?: number; placeholder?: string };
  onConfirm: (reason: string) => Promise<unknown>;
}) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setText("");
      setError(null);
    }
  }, [open]);

  const blocked = Boolean(reason?.required && !text.trim());

  const confirm = async () => {
    if (pending || blocked) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm(text.trim());
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "The request failed. Nothing was changed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="text-[13px] text-muted-foreground">{description}</div>
          </DialogDescription>
        </DialogHeader>
        {consequences && consequences.length > 0 && (
          <ul className="list-disc space-y-1 rounded-xl border border-amber-200 bg-amber-50/60 py-3 pl-8 pr-4 text-[12.5px] text-amber-900">
            {consequences.map((c) => <li key={c}>{c}</li>)}
          </ul>
        )}
        {reason && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-foreground">
              {reason.label}
              {reason.required && <span className="ml-0.5 text-red-500">*</span>}
            </label>
            <textarea
              rows={3}
              value={text}
              maxLength={reason.maxLength ?? 500}
              onChange={(e) => setText(e.target.value)}
              placeholder={reason.placeholder}
              aria-label={reason.label}
              className={financeTextareaClass()}
            />
          </div>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-xl" disabled={pending} onClick={() => onOpenChange(false)}>Keep as is</Button>
          <Button type="button" variant={destructive ? "destructive" : "default"} className="rounded-xl gap-2" disabled={pending || blocked} onClick={() => void confirm()}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {pending ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
