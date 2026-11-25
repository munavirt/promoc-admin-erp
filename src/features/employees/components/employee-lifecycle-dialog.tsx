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

interface EmployeeLifecycleDialogProps {
  /** "terminate" → DELETE /api/employees/{id}/ (soft). "reactivate" → PATCH status + PATCH user is_active. */
  action: "terminate" | "reactivate";
  employeeName?: string;
  open: boolean;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation for employee lifecycle changes. The backend DELETE endpoint does not remove
 * the record — it sets status TERMINATED and disables the login — so the copy says exactly that.
 */
export function EmployeeLifecycleDialog({
  action,
  employeeName,
  open,
  pending,
  onConfirm,
  onCancel,
}: EmployeeLifecycleDialogProps) {
  const terminate = action === "terminate";
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && !pending && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {terminate ? `Terminate ${employeeName || "employee"}?` : `Reactivate ${employeeName || "employee"}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {terminate
              ? "The employee's status will be set to Terminated and their login account will be disabled, so they can no longer sign in. The employee record is kept and is not permanently deleted."
              : "The employee's status will be set back to Active and their login account will be re-enabled, so they can sign in again with their existing password."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              if (!pending) onConfirm();
            }}
            className={cn(terminate ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700")}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {terminate ? (pending ? "Terminating..." : "Terminate") : pending ? "Reactivating..." : "Reactivate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
