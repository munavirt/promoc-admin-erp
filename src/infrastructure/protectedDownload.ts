/**
 * Downloads a private file (receipt / task attachment) through the authenticated API.
 *
 * Uploaded files are never served from a public /media/ URL (security audit H5), so a
 * plain <a href> cannot be used: the request needs the Bearer token, and benefits from
 * apiClient's automatic token refresh.
 */
import { apiClient } from "./apiClient";

export async function downloadProtectedFile(apiPath: string, fileName: string): Promise<void> {
  const response = await apiClient.get<Blob>(apiPath, { responseType: "blob" });
  const url = URL.createObjectURL(response.data);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName || "download";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}

export const protectedFilePaths = {
  expenseReceipt: (expenseId: string | number) => `/finance/expenses/${expenseId}/receipt/`,
  taskAttachment: (taskId: string | number, attachmentId: string | number) =>
    `/work-items/${taskId}/attachments/${attachmentId}/download/`,
};
