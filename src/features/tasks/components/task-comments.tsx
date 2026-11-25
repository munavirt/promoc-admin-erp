import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, Loader2, MessageSquare, RefreshCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStore } from "@/store";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { useAddTaskComment, useTaskComments } from "../hooks/use-tasks";

function initials(name?: string | null) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { relative: iso, absolute: iso };
  return {
    relative: formatDistanceToNow(d, { addSuffix: true }),
    absolute: d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
  };
}

/**
 * Comments of a work item — GET/POST /api/work-items/{id}/comments/.
 * The backend has no edit or delete endpoint for comments, so none is offered.
 */
export function TaskComments({ taskId, compact = false }: { taskId: string | number; compact?: boolean }) {
  const { currentUser } = useStore();
  const commentsQuery = useTaskComments(taskId);
  const addMutation = useAddTaskComment();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const comments = commentsQuery.data ?? [];
  const trimmed = text.trim();

  const submit = () => {
    if (addMutation.isPending) return;
    if (!trimmed) {
      setError("Write a comment before posting.");
      return;
    }
    setError(null);
    addMutation.mutate(
      { id: taskId, comment: trimmed },
      {
        onSuccess: () => {
          setText("");
          toast.success("Comment added.");
        },
        onError: (err) => {
          const { message, fieldErrors } = extractApiErrorMessage(err, "Failed to add comment.");
          setError(fieldErrors?.comment?.[0] || message);
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      {/* Composer */}
      <div className="flex gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary mt-1">
          {initials(currentUser?.name)}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
            }}
            disabled={addMutation.isPending}
            aria-label="Add a comment"
            aria-invalid={Boolean(error)}
            placeholder="Add a comment or update..."
            className={cn(
              "w-full resize-none rounded-lg border p-3 text-[13px] focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-70",
              compact ? "min-h-[80px]" : "min-h-[96px]",
              error ? "border-red-400" : "border-border/70",
            )}
          />
          <div className="flex items-center justify-between gap-3">
            {error ? (
              <p className="flex items-center gap-1 text-[11px] text-red-500"><AlertCircle className="h-3 w-3" />{error}</p>
            ) : (
              <span className="text-[11px] text-muted-foreground">Ctrl/⌘ + Enter to post</span>
            )}
            <Button size="sm" onClick={submit} disabled={!trimmed || addMutation.isPending} className="gap-1.5">
              {addMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {addMutation.isPending ? "Posting..." : "Post Comment"}
            </Button>
          </div>
        </div>
      </div>

      {/* Thread (backend order: newest first) */}
      {commentsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-16 rounded-lg bg-secondary/60 animate-pulse" />)}
        </div>
      ) : commentsQuery.isError ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/70 py-6 text-center">
          <p className="text-[13px] font-medium text-foreground">Unable to load comments</p>
          <p className="text-[12px] text-muted-foreground">{extractApiErrorMessage(commentsQuery.error).message}</p>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => void commentsQuery.refetch()}>
            <RefreshCcw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : comments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
          <p className="text-sm font-medium text-muted-foreground">No comments yet</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => {
            const when = formatWhen(c.created_at);
            const mine = currentUser?.id && String(c.user) === String(currentUser.id);
            return (
              <li key={c.id} className="flex gap-3">
                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold mt-1", mine ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
                  {initials(c.user_name)}
                </div>
                <div className="flex-1 min-w-0 rounded-lg border border-border/70 bg-white p-3 shadow-sm">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-semibold text-foreground">
                      {c.user_name || "Unknown user"}{mine ? <span className="ml-1 font-normal text-muted-foreground">(you)</span> : null}
                    </span>
                    <time dateTime={c.created_at} title={when.absolute} className="shrink-0 text-[11px] text-muted-foreground">{when.relative}</time>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground">{c.comment}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
