import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ProfileFields } from "../components/ProfileFields";
import { Button, Card, Field, Input, Notice } from "../components/ui";
import { useStore } from "../data/store";
import { yearOf } from "../domain/dates";
import { isProfileComplete } from "../domain/defaults";
import { entitlementForYear } from "../domain/entitlement";
import type { Profile } from "../domain/types";
import { demoData } from "../lib/demo";

/** First run: the minimum the app needs to calculate balances. */
export default function Welcome() {
  const { t } = useTranslation();
  const { data, today, replaceAll } = useStore();
  const year = yearOf(today);
  const [profile, setProfile] = useState<Profile>(data.settings.profile);
  const [carryover, setCarryover] = useState(0);
  const [busy, setBusy] = useState(false);
  const settings = { ...data.settings, profile, policy: { ...data.settings.policy, trackingStartYear: year } };
  const complete = isProfileComplete(settings);
  const startsThisYear = profile.employmentStart && yearOf(profile.employmentStart) === year;

  const save = async () => {
    setBusy(true);
    try {
      // One write for profile and opening balance, so both arrive together.
      await replaceAll({
        settings,
        yearAccounts: [{ year, carryoverOverride: startsThisYear ? 0 : carryover }],
        adjustments: [],
        requests: [],
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-center gap-3">
        <img src="/icon.svg" alt="" className="h-11 w-11 rounded-xl" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("welcome.title")}</h1>
          <p className="text-sm text-slate-500">{t("welcome.subtitle")}</p>
        </div>
      </div>
      <Card className="p-5 sm:p-6">
        <h2 className="mb-3 text-base font-semibold">{t("welcome.profile")}</h2>
        <ProfileFields p={profile} set={(patch) => setProfile((p) => ({ ...p, ...patch }))} compact />
        <h2 className="mb-3 mt-6 text-base font-semibold">{t("welcome.balance", { year })}</h2>
        {startsThisYear ? (
          <Notice tone="info">
            {t("welcome.prorated", {
              days: entitlementForYear(profile.annualEntitlement, profile.employmentStart, year, data.settings.policy.prorationMethod),
            })}
          </Notice>
        ) : (
          <Field label={t("welcome.carryover", { year: year - 1 })} hint={t("welcome.carryoverHint")}>
            <Input type="number" min={0} step={0.5} value={carryover} onChange={(e) => setCarryover(Number(e.target.value))} />
          </Field>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-400">{t("welcome.later")}</p>
          <Button onClick={save} disabled={!complete || busy}>
            {t("welcome.start")}
          </Button>
        </div>
      </Card>
      <div className="mt-5 text-center">
        <button
          type="button"
          className="text-sm font-semibold text-navy-800 underline-offset-2 hover:underline"
          onClick={() => replaceAll(demoData(year, today))}
        >
          {t("welcome.demo")}
        </button>
        <p className="mt-1 text-xs text-slate-400">{t("welcome.demoHint")}</p>
      </div>
    </div>
  );
}
