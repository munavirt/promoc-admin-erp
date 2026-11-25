import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { financeApiService } from "@/services/api/finance.service";
import { extractApiErrorMessage } from "@/infrastructure/apiClient";
import type { AgencySettingsPatch, CategoryType, OverviewQuery } from "../types/api-contracts";

/** Agency settings and Finance Overview — real API only (Phase 4). */
export const workspaceKeys = {
  agencySettings: ["finance", "agency-settings"] as const,
  overviewSummary: (q: OverviewQuery) => ["finance", "overview", "summary", q] as const,
  overviewTrends: (q: OverviewQuery) => ["finance", "overview", "trends", q] as const,
  recent: (limit: number, type?: CategoryType) => ["finance", "overview", "recent", limit, type ?? "all"] as const,
};

/** `data === null` means the singleton has not been configured yet (GET /api/settings/ → 404). */
export function useAgencySettings() {
  return useQuery({
    queryKey: workspaceKeys.agencySettings,
    queryFn: ({ signal }) => financeApiService.getAgencySettings(signal),
  });
}

export function useUpdateAgencySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: AgencySettingsPatch) => financeApiService.updateAgencySettings(patch),
    onSuccess: (data) => {
      qc.setQueryData(workspaceKeys.agencySettings, data);
      toast.success("Agency settings saved.");
    },
    onError: (err) => toast.error(extractApiErrorMessage(err, "Could not save agency settings.").message),
  });
}

/** POST /api/settings/ — one-time initialisation of the singleton. */
export function useCreateAgencySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AgencySettingsPatch) => financeApiService.createAgencySettings(payload),
    onSuccess: (data) => {
      qc.setQueryData(workspaceKeys.agencySettings, data);
      toast.success("Agency settings created.");
    },
    onError: (err) => toast.error(extractApiErrorMessage(err, "Could not create agency settings.").message),
  });
}

export function useOverviewSummary(q: OverviewQuery, enabled = true) {
  return useQuery({
    queryKey: workspaceKeys.overviewSummary(q),
    queryFn: ({ signal }) => financeApiService.getOverviewSummary(q, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useOverviewTrends(q: OverviewQuery, enabled = true) {
  return useQuery({
    queryKey: workspaceKeys.overviewTrends(q),
    queryFn: ({ signal }) => financeApiService.getOverviewTrends(q, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useRecentTransactions(limit = 8, type?: CategoryType, enabled = true) {
  return useQuery({
    queryKey: workspaceKeys.recent(limit, type),
    queryFn: ({ signal }) => financeApiService.getRecentTransactions({ limit, type }, signal),
    enabled,
  });
}
