import { useQuery } from "@tanstack/react-query";
import { financeApiService } from "@/services/api/finance.service";
import type { ReportDTOMap, ReportKind, ReportQuery } from "../types/api-contracts";

/** Key: ["finance","reports",kind,query] — refreshed by every finance mutation via invalidateFinance. */
export const reportKeys = {
  report: (kind: ReportKind, q: ReportQuery) => ["finance", "reports", kind, q] as const,
};

export function useFinancialReport<K extends ReportKind>(kind: K, q: ReportQuery, enabled = true) {
  return useQuery<ReportDTOMap[K], Error, ReportDTOMap[K], ReturnType<typeof reportKeys.report>>({
    queryKey: reportKeys.report(kind, q),
    queryFn: ({ signal }) => financeApiService.getReport(kind, q, signal),
    // Keep the previous result while a filter changes, but never across report kinds (different shapes).
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[2] === kind ? prev : undefined),
    enabled,
  });
}
