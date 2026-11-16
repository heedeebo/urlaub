import type { SupabaseClient } from "@supabase/supabase-js";
import type { Adjustment, AppData, Settings, VacationRequest, YearAccount } from "../domain/types";
import type { Repository } from "./repository";

/**
 * Supabase storage. Every table is protected by Row Level Security
 * (see supabase/schema.sql), so a user only ever sees their own rows.
 */
export function createSupabaseRepository(db: SupabaseClient): Repository {
  async function check<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
    const { data, error } = await p;
    if (error) throw new Error(error.message);
    return data;
  }

  const requestRow = (r: VacationRequest) => ({
    id: r.id,
    number: r.number,
    status: r.status,
    start_date: r.start,
    end_date: r.end,
    data: r,
    updated_at: new Date().toISOString(),
  });

  return {
    mode: "supabase",
    async load() {
      const settings = await check(db.from("settings").select("data").maybeSingle());
      if (!settings) return null;
      const [years, adjustments, requests] = await Promise.all([
        check(db.from("year_accounts").select("data")),
        check(db.from("adjustments").select("data").order("created_at")),
        check(db.from("vacation_requests").select("data").order("start_date")),
      ]);
      return {
        settings: (settings as { data: Settings }).data,
        yearAccounts: (years as { data: YearAccount }[]).map((r) => r.data),
        adjustments: (adjustments as { data: Adjustment }[]).map((r) => r.data),
        requests: (requests as { data: VacationRequest }[]).map((r) => r.data),
      } satisfies AppData;
    },
    async saveSettings(settings) {
      await check(db.from("settings").upsert({ data: settings, updated_at: new Date().toISOString() }));
    },
    async saveYearAccount(account) {
      await check(db.from("year_accounts").upsert({ year: account.year, data: account }, { onConflict: "user_id,year" }));
    },
    async addAdjustment(a) {
      await check(db.from("adjustments").insert({ id: a.id, year: a.year, data: a, created_at: a.createdAt }));
    },
    async saveRequest(r) {
      await check(db.from("vacation_requests").upsert(requestRow(r)));
    },
    async deleteDraft(id) {
      await check(db.from("vacation_requests").delete().eq("id", id).eq("status", "draft"));
    },
    async replaceAll(data) {
      // Restore: settings and year accounts are overwritten, requests upserted,
      // adjustments only added if missing (they are append-only by design).
      await this.saveSettings(data.settings);
      for (const a of data.yearAccounts) await this.saveYearAccount(a);
      if (data.requests.length) await check(db.from("vacation_requests").upsert(data.requests.map(requestRow)));
      const existing = (await check(db.from("adjustments").select("id"))) as { id: string }[];
      const known = new Set(existing.map((e) => e.id));
      const missing = data.adjustments.filter((a) => !known.has(a.id));
      if (missing.length) {
        await check(
          db.from("adjustments").insert(missing.map((a) => ({ id: a.id, year: a.year, data: a, created_at: a.createdAt }))),
        );
      }
    },
  };
}
