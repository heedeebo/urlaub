/**
 * After an update GitHub Pages removes the files of the old version. An app
 * that was still open then fails to load them ("Importing a module script
 * failed"). Reloading fetches the new version. Guarded so it never loops.
 */
const KEY = "vm-stale-reload";

export function reloadForNewVersion(): boolean {
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* storage blocked: reload anyway once per page */
    if ((window as { __vmReloaded?: boolean }).__vmReloaded) return false;
    (window as { __vmReloaded?: boolean }).__vmReloaded = true;
  }
  window.location.reload();
  return true;
}

/** Wraps a lazy import: on failure reload once, otherwise pass the error on. */
export function importOrReload<T>(load: () => Promise<T>): Promise<T> {
  return load().catch((err) => {
    if (reloadForNewVersion()) return new Promise<T>(() => {});
    throw err;
  });
}
