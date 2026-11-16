import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Link } from "react-router-dom";
import { useStore } from "../data/store";
import { supabase } from "../data/supabase";
import { formatDate } from "../domain/format";
import { cx } from "./ui";

const icons: Record<string, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="2" />
      <rect x="14" y="3" width="7" height="5" rx="2" />
      <rect x="14" y="12" width="7" height="9" rx="2" />
      <rect x="3" y="16" width="7" height="5" rx="2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  requests: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M8 13h8M8 17h5" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
};

export function Icon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {icons[name]}
    </svg>
  );
}

const NAV = [
  { to: "/", key: "dashboard", end: true },
  { to: "/calendar", key: "calendar" },
  { to: "/requests", key: "requests" },
  { to: "/history", key: "history" },
  { to: "/settings", key: "settings" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { data, mode, simulatedToday, today, error } = useStore();
  const p = data.settings.profile;
  const initials = `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase() || "?";

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-1 bg-navy-900 px-3.5 py-5 text-slate-300 lg:flex">
        <Link to="/" className="mb-5 flex items-center gap-2.5 px-2.5 text-[15px] font-bold text-white">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="h-9 w-9 rounded-[10px]" />
          {t("app.name")}
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cx("flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium", isActive ? "bg-white/10 text-white" : "hover:bg-white/5")
              }
            >
              <Icon name={n.key} className="h-[18px] w-[18px]" />
              {t(`nav.${n.key}`)}
            </NavLink>
          ))}
        </nav>
        <Link
          to="/requests/new"
          className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-navy-900 hover:bg-navy-50"
        >
          <Icon name="plus" className="h-4 w-4" />
          {t("nav.newRequest")}
        </Link>
        <div className="mt-auto flex items-center gap-2.5 border-t border-white/10 px-2 pt-3">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-navy-700 text-[13px] font-semibold text-white">{initials}</div>
          <div className="min-w-0 text-sm">
            <div className="truncate font-semibold text-white">{p.firstName || t("app.name")}</div>
            <div className="text-xs text-slate-400">{mode === "local" ? t("app.modeLocal") : t("app.modeCloud")}</div>
          </div>
          {supabase && (
            <button onClick={() => supabase!.auth.signOut()} className="ml-auto text-xs text-slate-400 hover:text-white">
              {t("auth.signOut")}
            </button>
          )}
        </div>
      </aside>

      <div className="min-w-0">
        {simulatedToday && (
          <div className="bg-carry-soft px-4 py-1.5 text-center text-xs font-medium text-carry-dark">
            {t("app.simulatedToday", { date: formatDate(today) })}
          </div>
        )}
        {error && <div className="bg-rejected-soft px-4 py-2 text-center text-sm text-rejected">{t("app.saveError", { message: error })}</div>}
        <main className="mx-auto w-full max-w-[1240px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-7">{children}</main>
      </div>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-line bg-white/95 px-1 pt-2 backdrop-blur lg:hidden">
        {[NAV[0], NAV[1], { to: "/requests/new", key: "plus", label: "nav.new" }, NAV[2], NAV[4]].map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={"end" in n ? n.end : n.to === "/requests"}
            className={({ isActive }) =>
              cx("flex min-w-14 flex-col items-center gap-0.5 text-[10.5px] font-medium", isActive ? "text-navy-900" : "text-slate-500")
            }
          >
            {n.key === "plus" ? (
              <span className="-mt-1 grid h-9 w-9 place-items-center rounded-full bg-navy-900 text-white">
                <Icon name="plus" className="h-5 w-5" />
              </span>
            ) : (
              <Icon name={n.key} className="h-[22px] w-[22px]" />
            )}
            {t("label" in n ? n.label! : `nav.${n.key}`)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
