import type { Adjustment, AppData, Settings, VacationRequest, YearAccount } from "../domain/types";

/**
 * Storage abstraction. The app runs with a local IndexedDB store until Supabase
 * is configured, then switches to the Supabase implementation.
 */
export interface Repository {
  mode: "local" | "supabase";
  load(): Promise<AppData | null>;
  saveSettings(settings: Settings): Promise<void>;
  saveYearAccount(account: YearAccount): Promise<void>;
  /** Adjustments are append-only (audit history). */
  addAdjustment(adjustment: Adjustment): Promise<void>;
  saveRequest(request: VacationRequest): Promise<void>;
  /** Only drafts may be deleted. Sent requests stay in the history. */
  /** Removes a request completely, whatever its status. */
  deleteRequest(id: string): Promise<void>;
  /** Restore from a backup file. */
  replaceAll(data: AppData): Promise<void>;
}
