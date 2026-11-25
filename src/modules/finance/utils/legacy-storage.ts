/**
 * Browser keys used by the removed finance demo ledger (pre-Phase 4). Nothing reads them any more;
 * they are deleted so stale demo records cannot linger in the browser. Records are NOT migrated anywhere.
 */
export const LEGACY_FINANCE_STORAGE_KEYS = ["promocraft_finance_state_v1", "promocraft_demo_agency_settings_v1"] as const;

export function removeLegacyFinanceStorage(): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    LEGACY_FINANCE_STORAGE_KEYS.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // Storage unavailable — nothing to clean.
  }
}
