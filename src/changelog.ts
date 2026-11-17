/**
 * Version history shown in Settings > Version.
 * For every release: raise "version" in package.json, add an entry here
 * (newest first) and add its texts under "changelog" in src/i18n/en.ts.
 */
export interface Release {
  version: string;
  date: string; // ISO date
  /** i18n key under "changelog" holding a list of short texts. */
  key: string;
}

export const RELEASES: Release[] = [
  { version: "1.5.0", date: "2026-11-17", key: "v1_5_0" },
  { version: "1.4.1", date: "2026-11-17", key: "v1_4_1" },
  { version: "1.4.0", date: "2026-11-17", key: "v1_4_0" },
  { version: "1.3.0", date: "2026-11-17", key: "v1_3_0" },
  { version: "1.2.0", date: "2026-11-17", key: "v1_2_0" },
  { version: "1.1.0", date: "2026-11-16", key: "v1_1_0" },
  { version: "1.0.0", date: "2026-11-16", key: "v1_0_0" },
];

export const APP_VERSION = __APP_VERSION__;
export const BUILD_TIME = __BUILD_TIME__;
export const BUILD_COMMIT = __BUILD_COMMIT__;
