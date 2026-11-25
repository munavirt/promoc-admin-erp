import type { DownloadedFile } from "../types/api-contracts";

/** Hands a file streamed by Django to the browser as a download (no client-side file generation). */
export function saveDownloadedFile(file: DownloadedFile): void {
  const url = URL.createObjectURL(file.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
