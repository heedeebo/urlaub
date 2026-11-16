import { useTranslation } from "react-i18next";
import { COUNTRIES, GERMAN_STATES } from "../domain/holidays";
import type { Profile } from "../domain/types";
import { Field, Input, Select } from "./ui";

export function ProfileFields({ p, set, compact }: { p: Profile; set: (patch: Partial<Profile>) => void; compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("settings.profile.firstName")}>
        <Input value={p.firstName} onChange={(e) => set({ firstName: e.target.value })} autoComplete="given-name" required />
      </Field>
      <Field label={t("settings.profile.lastName")}>
        <Input value={p.lastName} onChange={(e) => set({ lastName: e.target.value })} autoComplete="family-name" required />
      </Field>
      <Field label={t("settings.profile.company")}>
        <Input value={p.company} onChange={(e) => set({ company: e.target.value })} autoComplete="organization" required />
      </Field>
      <Field label={t("settings.profile.employeeId")} hint={t("common.optional")}>
        <Input value={p.employeeId} onChange={(e) => set({ employeeId: e.target.value })} />
      </Field>
      {!compact && (
        <>
          <Field label={t("settings.profile.department")} hint={t("common.optional")}>
            <Input value={p.department} onChange={(e) => set({ department: e.target.value })} />
          </Field>
          <Field label={t("settings.profile.jobTitle")} hint={t("common.optional")}>
            <Input value={p.jobTitle} onChange={(e) => set({ jobTitle: e.target.value })} autoComplete="organization-title" />
          </Field>
        </>
      )}
      <Field label={t("settings.profile.employmentStart")}>
        <Input type="date" value={p.employmentStart} onChange={(e) => set({ employmentStart: e.target.value })} required />
      </Field>
      <Field label={t("settings.profile.annualEntitlement")} hint={t("settings.profile.annualEntitlementHint")}>
        <Input
          type="number"
          min={0}
          max={60}
          step={0.5}
          value={p.annualEntitlement}
          onChange={(e) => set({ annualEntitlement: Number(e.target.value) })}
        />
      </Field>
      <Field label={t("settings.profile.country")}>
        <Select value={p.country} onChange={(e) => set({ country: e.target.value })}>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {t(`country.${c.code}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("settings.profile.region")}>
        <Select value={p.region} onChange={(e) => set({ region: e.target.value })} disabled={p.country !== "DE"}>
          {GERMAN_STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("settings.profile.personalEmail")}>
        <Input type="email" value={p.personalEmail} onChange={(e) => set({ personalEmail: e.target.value })} autoComplete="email" />
      </Field>
      <div className="hidden sm:block" />
      <Field label={t("settings.profile.managerName")}>
        <Input value={p.managerName} onChange={(e) => set({ managerName: e.target.value })} placeholder={t("settings.profile.managerNamePlaceholder")} />
      </Field>
      <Field label={t("settings.profile.managerEmail")}>
        <Input type="email" value={p.managerEmail} onChange={(e) => set({ managerEmail: e.target.value })} required />
      </Field>
    </div>
  );
}

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

export function WorkdayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-1.5">
      {WEEKDAYS.map((w) => {
        const on = value.includes(w);
        return (
          <button
            key={w}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== w) : [...value, w].sort())}
            className={
              "h-10 min-w-12 rounded-xl border px-2 text-sm font-semibold " +
              (on ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white text-slate-500")
            }
          >
            {t(`calendar.weekdayShort.${w}`)}
          </button>
        );
      })}
    </div>
  );
}
