import { useRef } from "react";
import { FileText, Image as ImageIcon, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AttachmentFile } from "../types/finance.types";
import { formatFileSize } from "../utils/formatters";

interface AttachmentUploaderProps {
  label: string;
  value?: AttachmentFile | null;
  onChange: (file: AttachmentFile | null) => void;
  accept?: string;
  helperText?: string;
}


/** Mirrors finance/validators.py (validate_receipt_file); the backend also checks file content. */
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
export const RECEIPT_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".doc", ".docx"];

export function AttachmentUploader({
  label,
  value,
  onChange,
  accept = RECEIPT_EXTENSIONS.join(","),
  helperText = "PDF, PNG, JPG, WEBP, DOC or DOCX up to 10 MB",
}: AttachmentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const dot = file.name.lastIndexOf(".");
    const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
    if (!RECEIPT_EXTENSIONS.includes(ext)) {
      toast.error(`File type ${ext || "(none)"} is not allowed. Allowed: ${RECEIPT_EXTENSIONS.join(", ")}.`);
      return;
    }
    if (file.size > RECEIPT_MAX_BYTES) {
      toast.error("File exceeds the 10 MB limit.");
      return;
    }
    // Keep the File itself; it is uploaded to Django on save (multipart). Nothing is stored in the browser.
    onChange({
      id: `local-${Date.now()}`,
      name: file.name,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      file,
      uploadedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-medium text-foreground block">{label}</label>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />

      {!value ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-between rounded-xl border border-dashed border-border/80 bg-secondary/20 px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-secondary/40"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Upload className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-foreground">Attach file</p>
              <p className="text-[11px] text-muted-foreground">{helperText}</p>
            </div>
          </div>
          <span className="text-[12px] font-medium text-primary">Browse</span>
        </button>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-border/70 bg-secondary/20 px-3.5 py-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              {value.mimeType.startsWith("image/") ? (
                <ImageIcon className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-foreground">{value.name}</p>
              <p className="text-[11px] text-muted-foreground">{formatFileSize(value.size)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => inputRef.current?.click()}
            >
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => onChange(null)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AttachmentPreviewCard({
  attachment,
  emptyLabel = "No attachment uploaded.",
}: {
  attachment?: AttachmentFile | null;
  emptyLabel?: string;
}) {
  if (!attachment) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border/70 bg-secondary/20 px-4 py-3 text-[13px] text-muted-foreground">
        <Paperclip className="h-4 w-4" />
        <span>{emptyLabel}</span>
      </div>
    );
  }

  const isImage = attachment.mimeType.startsWith("image/") && attachment.url;

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-secondary/20 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-foreground">{attachment.name}</p>
            {attachment.size > 0 && <p className="text-[11px] text-muted-foreground">{formatFileSize(attachment.size)}</p>}
          </div>
        </div>
        {attachment.url && (
          <a
            href={attachment.url}
            download={attachment.name}
            className="text-[12px] font-medium text-primary hover:underline shrink-0"
          >
            Download
          </a>
        )}
      </div>
      {isImage && (
        <img
          src={attachment.url}
          alt={attachment.name}
          className="max-h-52 w-full rounded-lg border border-border/60 object-contain bg-white"
        />
      )}
    </div>
  );
}
