import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { ProfileFields, WorkdayPicker } from "../components/ProfileFields";
import { Button, Card, Field, Input, Notice, PageHeader, Select, Textarea } from "../components/ui";
import { useStore } from "../data/store";
import { supabaseConfigured } from "../data/supabase";
import { yearOf } from "../domain/dates";
import { DEFAULT_EMAIL_TEMPLATE } from "../domain/defaults";
import { renderEmail, TEMPLATE_PLACEHOLDERS } from "../domain/email";
import { formatDate, formatDateTime, formatDays } from "../domain/format";
import type { Bucket, EmailTemplate, ExpiryPolicy, Policy, Profile, ProrationMethod, YearAccount } from "../domain/types";
import { exportBackup, exportCsv, parseBackup } from "../lib/backup";
import { LANGUAGES } from "../i18n";

function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card className="scroll-mt-5 p-4 sm:p-6">
      <div id={id} className="mb-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </Card>
  );
}

function SaveBar({ onSave, saved, disabled }: { onSave: () => void; saved: boolean; disabled?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="mt-4 flex items-center justify-end gap-3">
      {saved && <span className="text-sm font-medium text-ok">{t("settings.saved")}</span>}
      <Button onClick={onSave} disabled={disabled}>
        {t("common.save")}
      </Button>
    </div>
  );
}

function useFlash(): [boolean, () => void] {
  const [on, setOn] = useState(false);
  return [
    on,
    () => {
      setOn(true);
      setTimeout(() => setOn(false), 2200);
    },
  ];
}

export default function Settings() {
  const { t } = useTranslation();
  const location = useLocation();
  const store = useStore();
  const { data, today, saveSettings, saveYearAccount, addAdjustment, ledger, mode, replaceAll } = store;
  const year = yearOf(today);

  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
  }, [location.hash]);

  // Profile
  const [profile, setProfile] = useState<Profile>(data.settings.profile);
  const [profileSaved, flashProfile] = useFlash();

  // Vacation account
  const [policy, setPolicy] = useState<Policy>(data.settings.policy);
  const [workdays, setWorkdays] = useState<number[]>(data.settings.profile.workdays);
  const startAccount = data.yearAccounts.find((a) => a.year === policy.trackingStartYear);
  const [startCarry, setStartCarry] = useState<number>(startAccount?.carryoverOverride ?? 0);
  const [policySaved, flashPolicy] = useFlash();

  // Year overrides
  const [ovYear, setOvYear] = useState(year);
  const acc = data.yearAccounts.find((a) => a.year === ovYear);
  const [ov, setOv] = useState<YearAccount>(acc ?? { year: ovYear });
  useEffect(() => setOv(data.yearAccounts.find((a) => a.year === ovYear) ?? { year: ovYear }), [ovYear, data.yearAccounts]);
  const [ovSaved, flashOv] = useFlash();

  // Email template
  const [tpl, setTpl] = useState<EmailTemplate>(data.settings.emailTemplate);
  const [tplSaved, flashTpl] = useFlash();

  // Adjustments
  const [adj, setAdj] = useState<{ year: number; bucket: Bucket; days: number; reason: string }>({ year, bucket: "current", days: 0, reason: "" });
  const [adjSaved, flashAdj] = useFlash();

  // Backup
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const saveProfile = async () => {
    await saveSettings({ ...data.settings, profile: { ...profile, workdays: data.settings.profile.workdays } });
    flashProfile();
  };

  const savePolicy = async () => {
    await saveSettings({ ...data.settings, profile: { ...data.settings.profile, workdays }, policy });
    const existing = data.yearAccounts.find((a) => a.year === policy.trackingStartYear);
    await saveYearAccount({ ...(existing ?? { year: policy.trackingStartYear }), carryoverOverride: startCarry });
    flashPolicy();
  };

  const saveOverride = async () => {
    const clean = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(v) ? null : v);
    await saveYearAccount({
      ...ov,
      year: ovYear,
      entitlementOverride: clean(ov.entitlementOverride),
      carryoverOverride: ovYear === policy.trackingStartYear ? (ov.carryoverOverride ?? 0) : clean(ov.carryoverOverride),
      carryoverDeadlineOverride: ov.carryoverDeadlineOverride || null,
    });
    flashOv();
  };

  const saveTemplate = async () => {
    await saveSettings({ ...data.settings, emailTemplate: tpl });
    flashTpl();
  };

  const saveAdjustment = async () => {
    await addAdjustment({ id: crypto.randomUUID(), ...adj, createdAt: new Date().toISOString() });
    setAdj({ ...adj, days: 0, reason: "" });
    flashAdj();
  };

  const onImport = async (file: File) => {
    try {
      const parsed = parseBackup(await file.text());
      if (!window.confirm(t("settings.data.importConfirm"))) return;
      await replaceAll(parsed);
      setImportMsg({ tone: "ok", text: t("settings.data.importOk") });
    } catch {
      setImportMsg({ tone: "error", text: t("settings.data.importError") });
    }
  };

  const sample = renderEmail(tpl, {
    employeeName: `${profile.firstName} ${profile.lastName}`.trim() || "Alex Example",
    managerName: profile.managerName || "Ms. Miller",
    from: "May 3, 2027",
    to: "May 7, 2027",
    dateRange: "May 3 to May 7, 2027",
    days: "4",
    carryover: "5",
    carryoverDeadline: "March 31, 2027",
    currentRemaining: "30",
    totalAvailable: "35",
    projected: "31",
    comment: "",
    commentBlock: "",
    company: profile.company,
    employeeId: profile.employeeId,
  });

  const ovLedger = ledger(ovYear);
  const yearOptions = Array.from({ length: Math.max(1, year + 2 - policy.trackingStartYear) }, (_, i) => policy.trackingStartYear + i);

  return (
    <>
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <nav className="mb-4 flex gap-1.5 overflow-x-auto pb-1 text-sm">
        {["profile", "account", "years", "adjustments", "email", "data"].map((s) => (
          <a key={s} href={`#${s}`} className="whitespace-nowrap rounded-full border border-line bg-white px-3 py-1.5 font-semibold text-slate-600">
            {t(`settings.nav.${s}`)}
          </a>
        ))}
      </nav>
      <div className="grid gap-4">
        <Section id="profile" title={t("settings.profile.title")} subtitle={t("settings.profile.subtitle")}>
          <ProfileFields p={profile} set={(patch) => setProfile((p) => ({ ...p, ...patch }))} />
          <SaveBar onSave={saveProfile} saved={profileSaved} />
        </Section>

        <Section id="account" title={t("settings.account.title")} subtitle={t("settings.account.subtitle")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("settings.account.workdays")} hint={t("settings.account.workdaysHint", { count: workdays.length })} className="sm:col-span-2">
              <WorkdayPicker value={workdays} onChange={setWorkdays} />
            </Field>
            <Field label={t("settings.account.proration")} hint={t("settings.account.prorationHint")}>
              <Select value={policy.prorationMethod} onChange={(e) => setPolicy({ ...policy, prorationMethod: e.target.value as ProrationMethod })}>
                {(["fullMonthsRoundUp", "fullMonthsRound", "exactDays", "none"] as const).map((m) => (
                  <option key={m} value={m}>
                    {t(`settings.account.prorationMethod.${m}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("settings.account.expiry")} hint={t("settings.account.expiryHint")}>
              <Select value={policy.expiryPolicy} onChange={(e) => setPolicy({ ...policy, expiryPolicy: e.target.value as ExpiryPolicy })}>
                <option value="expire">{t("settings.account.expiryExpire")}</option>
                <option value="keep">{t("settings.account.expiryKeep")}</option>
              </Select>
            </Field>
            <Field label={t("settings.account.deadline")} hint={t("settings.account.deadlineHint")}>
              <div className="flex gap-2">
                <Select
                  value={policy.carryoverDeadlineMonth}
                  onChange={(e) => setPolicy({ ...policy, carryoverDeadlineMonth: Number(e.target.value) })}
                  aria-label={t("settings.account.deadlineMonth")}
                >
                  {Array.from({ length: 12 }, (_, m) => (
                    <option key={m} value={m + 1}>
                      {t(`calendar.month.${m}`)}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={policy.carryoverDeadlineDay}
                  onChange={(e) => setPolicy({ ...policy, carryoverDeadlineDay: Number(e.target.value) })}
                  className="w-24"
                  aria-label={t("settings.account.deadlineDay")}
                />
              </div>
            </Field>
            <Field label={t("settings.account.trackingStart")} hint={t("settings.account.trackingStartHint")}>
              <Input
                type="number"
                min={1990}
                max={year + 1}
                value={policy.trackingStartYear}
                onChange={(e) => setPolicy({ ...policy, trackingStartYear: Number(e.target.value) })}
              />
            </Field>
            <Field
              label={t("settings.account.startCarryover", { year: policy.trackingStartYear - 1 })}
              hint={t("settings.account.startCarryoverHint", { year: policy.trackingStartYear })}
            >
              <Input type="number" min={0} step={0.5} value={startCarry} onChange={(e) => setStartCarry(Number(e.target.value))} />
            </Field>
          </div>
          <SaveBar onSave={savePolicy} saved={policySaved} disabled={workdays.length === 0} />
        </Section>

        <Section id="years" title={t("settings.years.title")} subtitle={t("settings.years.subtitle")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("common.year")}>
              <Select value={ovYear} onChange={(e) => setOvYear(Number(e.target.value))}>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="rounded-xl bg-canvas p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">{t("settings.years.calculatedEntitlement")}</span>
                <b className="tabular">{formatDays(ovLedger.entitlement)}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t("settings.years.calculatedCarryover")}</span>
                <b className="tabular">{formatDays(ovLedger.carryoverOpening)}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t("settings.years.deadline")}</span>
                <b>{formatDate(ovLedger.carryoverDeadline)}</b>
              </div>
            </div>
            <Field label={t("settings.years.entitlementOverride")} hint={t("settings.years.emptyAuto")}>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={ov.entitlementOverride ?? ""}
                onChange={(e) => setOv({ ...ov, entitlementOverride: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </Field>
            <Field
              label={t("settings.years.carryoverOverride")}
              hint={ovYear === policy.trackingStartYear ? t("settings.years.firstYear") : t("settings.years.emptyAuto")}
            >
              <Input
                type="number"
                min={0}
                step={0.5}
                value={ov.carryoverOverride ?? ""}
                onChange={(e) => setOv({ ...ov, carryoverOverride: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </Field>
            <Field label={t("settings.years.deadlineOverride")} hint={t("settings.years.emptyAuto")}>
              <Input type="date" value={ov.carryoverDeadlineOverride ?? ""} onChange={(e) => setOv({ ...ov, carryoverDeadlineOverride: e.target.value || null })} />
            </Field>
            <Field label={t("settings.years.note")}>
              <Input value={ov.note ?? ""} onChange={(e) => setOv({ ...ov, note: e.target.value })} />
            </Field>
          </div>
          <SaveBar onSave={saveOverride} saved={ovSaved} />
        </Section>

        <Section id="adjustments" title={t("settings.adjustments.title")} subtitle={t("settings.adjustments.subtitle")}>
          <div className="grid gap-3 sm:grid-cols-[110px_1fr_120px]">
            <Field label={t("common.year")}>
              <Select value={adj.year} onChange={(e) => setAdj({ ...adj, year: Number(e.target.value) })}>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("settings.adjustments.bucket")}>
              <Select value={adj.bucket} onChange={(e) => setAdj({ ...adj, bucket: e.target.value as Bucket })}>
                <option value="current">{t("bucket.current")}</option>
                <option value="carryover">{t("bucket.carryover")}</option>
              </Select>
            </Field>
            <Field label={t("settings.adjustments.days")} hint={t("settings.adjustments.daysHint")}>
              <Input type="number" step={0.5} value={adj.days} onChange={(e) => setAdj({ ...adj, days: Number(e.target.value) })} />
            </Field>
            <Field label={t("settings.adjustments.reason")} className="sm:col-span-3">
              <Input value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} placeholder={t("settings.adjustments.reasonPlaceholder")} />
            </Field>
          </div>
          <div className="mt-4 flex items-center justify-end gap-3">
            {adjSaved && <span className="text-sm font-medium text-ok">{t("settings.saved")}</span>}
            <Button onClick={saveAdjustment} disabled={!adj.days || !adj.reason.trim()}>
              {t("settings.adjustments.add")}
            </Button>
          </div>
          <h3 className="mb-2 mt-5 text-sm font-semibold">{t("settings.adjustments.audit")}</h3>
          {data.adjustments.length === 0 ? (
            <p className="text-sm text-slate-500">{t("settings.adjustments.none")}</p>
          ) : (
            <ul className="grid gap-1.5 text-sm">
              {[...data.adjustments].reverse().map((a) => (
                <li key={a.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-canvas px-3 py-2">
                  <span>
                    <b className="tabular">
                      {a.days > 0 ? "+" : ""}
                      {formatDays(a.days)}
                    </b>{" "}
                    {t(`bucket.${a.bucket}`)} {a.year} · {a.reason}
                  </span>
                  <span className="text-xs text-slate-500">{formatDateTime(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="email" title={t("settings.email.title")} subtitle={t("settings.email.subtitle")}>
          <div className="grid gap-3">
            <Field label={t("settings.email.subject")}>
              <Input value={tpl.subject} onChange={(e) => setTpl({ ...tpl, subject: e.target.value })} />
            </Field>
            <Field label={t("settings.email.body")}>
              <Textarea rows={14} value={tpl.body} onChange={(e) => setTpl({ ...tpl, body: e.target.value })} className="font-mono text-[13px]" />
            </Field>
            <p className="text-xs text-slate-500">
              {t("settings.email.placeholders")}{" "}
              {TEMPLATE_PLACEHOLDERS.map((p) => (
                <code key={p} className="mr-1 rounded bg-canvas px-1 py-0.5">{`{{${p}}}`}</code>
              ))}
            </p>
            <details className="rounded-xl border border-line-soft p-3">
              <summary className="cursor-pointer text-sm font-semibold">{t("settings.email.preview")}</summary>
              <div className="mt-2 text-sm">
                <b>{sample.subject}</b>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-[13.5px] leading-relaxed">{sample.body}</pre>
              </div>
            </details>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            {tplSaved && <span className="text-sm font-medium text-ok">{t("settings.saved")}</span>}
            <Button variant="ghost" onClick={() => setTpl({ ...DEFAULT_EMAIL_TEMPLATE })}>
              {t("settings.email.reset")}
            </Button>
            <Button onClick={saveTemplate}>{t("common.save")}</Button>
          </div>
        </Section>

        <Section id="data" title={t("settings.data.title")} subtitle={t("settings.data.subtitle")}>
          <div className="mb-4">
            <Notice tone="info">
              {mode === "local" ? t("settings.data.modeLocal") : t("settings.data.modeCloud")}
              {!supabaseConfigured && ` ${t("settings.data.howToCloud")}`}
            </Notice>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => exportBackup(data)}>
              {t("settings.data.export")}
            </Button>
            <Button variant="secondary" onClick={() => exportCsv(data.requests)}>
              {t("settings.data.exportCsv")}
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              {t("settings.data.import")}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImport(f);
                e.target.value = "";
              }}
            />
          </div>
          {importMsg && (
            <div className="mt-3">
              <Notice tone={importMsg.tone}>{importMsg.text}</Notice>
            </div>
          )}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Field label={t("settings.data.language")} hint={t("settings.data.languageHint")}>
              <Select value={data.settings.profile.language} disabled>
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Section>
      </div>
    </>
  );
}
