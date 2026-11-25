import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  tone?: "danger" | "default";
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmation that stays open (and blocks dismissal) while the request runs, so failures are visible. */
export function ConfirmDialog({
  open, title, description, confirmLabel, pendingLabel, tone = "danger", pending, onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && !pending && onCancel()}>
      <AlertDialogContent className="rounded-[24px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">{description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl" disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              if (!pending) onConfirm();
            }}
            className={cn("rounded-xl text-white", tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary/90")}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {pending ? pendingLabel || confirmLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
