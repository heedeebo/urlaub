import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { todayISO } from "../domain/dates";
import { emptyData } from "../domain/defaults";
import { createHolidayLookup } from "../domain/holidays";
import { computeYear, type LedgerInput, type YearLedger } from "../domain/ledger";
import type { Adjustment, AppData, Settings, VacationRequest, YearAccount } from "../domain/types";
import type { WorkdayContext } from "../domain/workdays";
import type { Repository } from "./repository";

/**
 * "Today" can be simulated for testing the deadline logic:
 * open the app with ?today=2027-04-01 (kept for the browser session).
 */
function resolveToday(): string {
  try {
    const param = new URLSearchParams(window.location.search).get("today");
    if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) sessionStorage.setItem("vm-today", param);
    if (param === "reset") sessionStorage.removeItem("vm-today");
    return sessionStorage.getItem("vm-today") ?? todayISO();
  } catch {
    return todayISO();
  }
}

interface StoreValue {
  ready: boolean;
  error: string | null;
  mode: Repository["mode"];
  /** True once a profile has been saved (first-run setup done). */
  initialized: boolean;
  data: AppData;
  today: string;
  simulatedToday: boolean;
  input: LedgerInput;
  workdayCtx: WorkdayContext;
  holiday: (date: string) => string | undefined;
  ledger: (year: number) => YearLedger;
  saveSettings(s: Settings): Promise<void>;
  saveYearAccount(a: YearAccount): Promise<void>;
  addAdjustment(a: Adjustment): Promise<void>;
  saveRequest(r: VacationRequest): Promise<void>;
  deleteDraft(id: string): Promise<void>;
  replaceAll(d: AppData): Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ repo, children }: { repo: Repository; children: ReactNode }) {
  const [today] = useState(resolveToday);
  const [data, setData] = useState<AppData>(() => emptyData(Number(today.slice(0, 4))));
  const [initialized, setInitialized] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    repo
      .load()
      .then((loaded) => {
        if (!alive) return;
        if (loaded) {
          setData(loaded);
          setInitialized(true);
        }
        setReady(true);
      })
      .catch((e: Error) => {
        setError(e.message);
        setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [repo]);

  // Every write goes to the repository first, then updates the screen.
  const run = useCallback(
    async (write: () => Promise<void>, update: (d: AppData) => AppData) => {
      setError(null);
      try {
        await write();
        setData(update);
      } catch (e) {
        setError((e as Error).message);
        throw e;
      }
    },
    [],
  );

  const value = useMemo<StoreValue>(() => {
    const { profile } = data.settings;
    const holiday = createHolidayLookup(profile.country, profile.region);
    const workdayCtx: WorkdayContext = { workdays: profile.workdays, holiday };
    const input: LedgerInput = { ...data, today };
    const cache = new Map<number, YearLedger>();
    return {
      ready,
      error,
      mode: repo.mode,
      initialized,
      data,
      today,
      simulatedToday: today !== todayISO(),
      input,
      workdayCtx,
      holiday,
      ledger: (year) => computeYear(year, input, undefined, cache),
      saveSettings: async (s) => {
        await run(() => repo.saveSettings(s), (d) => ({ ...d, settings: s }));
        setInitialized(true);
      },
      saveYearAccount: (a) =>
        run(
          () => repo.saveYearAccount(a),
          (d) => ({ ...d, yearAccounts: [...d.yearAccounts.filter((x) => x.year !== a.year), a] }),
        ),
      addAdjustment: (a) => run(() => repo.addAdjustment(a), (d) => ({ ...d, adjustments: [...d.adjustments, a] })),
      saveRequest: (r) =>
        run(
          () => repo.saveRequest(r),
          (d) => ({ ...d, requests: [...d.requests.filter((x) => x.id !== r.id), r] }),
        ),
      deleteDraft: (id) =>
        run(
          () => repo.deleteDraft(id),
          (d) => ({ ...d, requests: d.requests.filter((x) => !(x.id === id && x.status === "draft")) }),
        ),
      replaceAll: async (nd) => {
        await run(() => repo.replaceAll(nd), () => nd);
        setInitialized(true);
      },
    };
  }, [data, today, ready, error, initialized, repo, run]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore outside StoreProvider");
  return ctx;
}
