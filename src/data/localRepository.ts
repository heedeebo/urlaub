import { get, set } from "idb-keyval";
import type { AppData } from "../domain/types";
import type { Repository } from "./repository";

const KEY = "my-vacation-manager-data";

/** Stores everything in the browser's IndexedDB. Data stays on this device. */
export function createLocalRepository(): Repository {
  let cache: AppData | null = null;

  async function read(): Promise<AppData | null> {
    if (!cache) cache = ((await get(KEY)) as AppData | undefined) ?? null;
    return cache;
  }
  async function write(mutate: (d: AppData) => void) {
    const data = await read();
    if (!data) throw new Error("No data loaded");
    const next = structuredClone(data);
    mutate(next);
    await set(KEY, next);
    cache = next;
  }

  return {
    mode: "local",
    // Hand out a copy: the screen state must never share objects with the store.
    load: async () => {
      const data = await read();
      return data ? structuredClone(data) : null;
    },
    async saveSettings(settings) {
      const data = await read();
      if (!data) {
        cache = { settings: structuredClone(settings), yearAccounts: [], adjustments: [], requests: [] };
        await set(KEY, cache);
        return;
      }
      await write((d) => (d.settings = settings));
    },
    saveYearAccount: (account) =>
      write((d) => {
        d.yearAccounts = [...d.yearAccounts.filter((a) => a.year !== account.year), structuredClone(account)];
      }),
    addAdjustment: (adjustment) => write((d) => d.adjustments.push(structuredClone(adjustment))),
    saveRequest: (request) =>
      write((d) => {
        d.requests = [...d.requests.filter((r) => r.id !== request.id), structuredClone(request)];
      }),
    deleteDraft: (id) =>
      write((d) => {
        d.requests = d.requests.filter((r) => !(r.id === id && r.status === "draft"));
      }),
    async replaceAll(data) {
      const copy = structuredClone(data);
      await set(KEY, copy);
      cache = copy;
    },
  };
}
