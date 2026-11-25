import { useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, Download, FileText, Loader2, Paperclip, RefreshCcw, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import { downloadProtectedFile, protectedFilePaths } from "@/infrastructure/protectedDownload";
import {
  ATTACHMENT_ALLOWED_EXTENSIONS,
  attachmentFileName,
  validateAttachment,
} from "@/api/tasks.api";
import { useTaskAttachments, useUploadTaskAttachment } from "../hooks/use-tasks";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Attachments of a work item — GET/POST /api/work-items/{id}/attachments/ (multipart field `file`).
 * The backend has no delete endpoint and does not return file size, so neither is shown.
 * Files are served from Django MEDIA_URL; the link opens the stored file.
 */
export function TaskAttachments({ taskId, compact = false }: { taskId: string | number; compact?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const attachmentsQuery = useTaskAttachments(taskId);
  const uploadMutation = useUploadTaskAttachment();
  const [uploading, setUploading] = useState<{ name: string; size: number; progress: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const attachments = attachmentsQuery.data ?? [];

  const uploadFiles = async (files: File[]) => {
    if (uploading || files.length === 0) return;
    const problems: string[] = [];
    let done = 0;
    for (const file of files) {
      const invalid = validateAttachment(file);
      if (invalid) {
        problems.push(invalid);
        continue;
      }
      setUploading({ name: file.name, size: file.size, progress: 0 });
      try {
        await uploadMutation.mutateAsync({
          id: taskId,
          file,
          onProgress: (p) => setUploading((u) => (u ? { ...u, progress: p } : u)),
        });
        done += 1;
      } catch (err) {
        const { message, fieldErrors } = extractApiErrorMessage(err, "Upload failed.");
        problems.push(`"${file.name}": ${fieldErrors?.file?.join(" ") || message}`);
      }
    }
    setUploading(null);
    setErrors(problems);
    if (done) toast.success(`${done} file${done === 1 ? "" : "s"} uploaded.`);
    if (problems.length) toast.error(`${problems.length} file${problems.length === 1 ? "" : "s"} could not be uploaded.`);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void uploadFiles(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-white text-center transition-colors",
          compact ? "p-6" : "p-8",
          dragOver ? "border-primary/60 bg-primary/5" : "border-border/70 hover:bg-secondary/20",
          uploading && "pointer-events-none opacity-80",
        )}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
          {uploading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <UploadCloud className="h-5 w-5 text-muted-foreground" />}
        </div>
        {uploading ? (
          <div className="w-full max-w-xs space-y-1.5">
            <p className="truncate text-[13px] font-medium text-foreground">Uploading {uploading.name} ({formatSize(uploading.size)})</p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round(uploading.progress * 100)}%` }} />
            </div>
            <p className="text-[11px] text-muted-foreground">{Math.round(uploading.progress * 100)}%</p>
          </div>
        ) : (
          <>
            <p className="text-[13px] font-medium text-foreground">Drag files here or <button type="button" onClick={() => inputRef.current?.click()} className="text-primary underline">browse</button></p>
            <p className="text-[11px] text-muted-foreground">Max 10 MB each · {ATTACHMENT_ALLOWED_EXTENSIONS.map((e) => e.slice(1).toUpperCase()).join(", ")}</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          accept={ATTACHMENT_ALLOWED_EXTENSIONS.join(",")}
          aria-label="Upload attachments"
          onChange={(e) => void uploadFiles(Array.from(e.target.files ?? []))}
        />
      </div>

      {errors.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-red-200 bg-red-50/80 p-3">
          {errors.map((e, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[12px] text-red-700"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{e}</li>
          ))}
        </ul>
      )}

      {/* List (backend order: newest first) */}
      {attachmentsQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-14 rounded-lg bg-secondary/60 animate-pulse" />)}
        </div>
      ) : attachmentsQuery.isError ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/70 py-6 text-center">
          <p className="text-[13px] font-medium text-foreground">Unable to load attachments</p>
          <p className="text-[12px] text-muted-foreground">{extractApiErrorMessage(attachmentsQuery.error).message}</p>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => void attachmentsQuery.refetch()}>
            <RefreshCcw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      ) : attachments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Paperclip className="h-7 w-7 text-muted-foreground/30 mb-2" />
          <p className="text-sm font-medium text-muted-foreground">No attachments yet</p>
        </div>
      ) : (
        <ul className={cn("grid gap-3", compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
          {attachments.map((a) => {
            const name = attachmentFileName(a.file);
            const when = a.uploaded_at ? new Date(a.uploaded_at) : null;
            return (
              <li key={a.id} className="flex items-center gap-3 rounded-lg border border-border/70 bg-white p-3 shadow-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-blue-50 text-blue-600">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] font-semibold text-foreground" title={name}>{name}</span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {a.uploaded_by_name || "Unknown uploader"}
                    {when && !Number.isNaN(when.getTime()) ? ` · ${formatDistanceToNow(when, { addSuffix: true })}` : ""}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  aria-label={`Download ${name}`}
                  title="Download"
                  onClick={() =>
                    downloadProtectedFile(protectedFilePaths.taskAttachment(taskId, a.id), name).catch((err) =>
                      toast.error(extractApiErrorMessage(err, "The attachment could not be downloaded.").message),
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
