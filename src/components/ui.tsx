import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useTranslation } from "react-i18next";
import type { RequestStatus } from "../domain/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cx("rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(15,23,42,.04),0_4px_16px_rgba(15,23,42,.04)]", className)}>
      {children}
    </section>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const styles: Record<Variant, string> = {
    primary: "bg-navy-900 text-white hover:bg-navy-800 disabled:bg-navy-100 disabled:text-slate-400",
    secondary: "bg-white text-slate-900 border border-line hover:border-slate-300 disabled:text-slate-400",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-white text-rejected border border-rejected-soft hover:bg-rejected-soft",
  };
  return (
    <button
      type="button"
      className={cx(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-line bg-white px-3 py-2 text-[15px] outline-none transition focus:border-navy-800 focus:ring-2 focus:ring-navy-100 disabled:bg-slate-50 disabled:text-slate-500";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputCls, "pr-8", props.className)} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputCls, props.className)} />;
}

const statusStyle: Record<RequestStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  pending: "bg-pending-soft text-pending",
  approved: "bg-ok-soft text-ok",
  rejected: "bg-rejected-soft text-rejected",
  withdrawn: "bg-slate-100 text-slate-500",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  const { t } = useTranslation();
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", statusStyle[status])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {t(`status.${status}`)}
    </span>
  );
}

export function Dot({ className }: { className: string }) {
  return <span className={cx("inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]", className)} />;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "ok"; children: ReactNode }) {
  const styles = {
    info: "bg-navy-50 text-navy-800",
    warn: "bg-carry-soft text-carry-dark",
    error: "bg-rejected-soft text-rejected",
    ok: "bg-ok-soft text-ok",
  };
  return <div className={cx("rounded-xl px-3 py-2.5 text-[13px] leading-snug", styles[tone])}>{children}</div>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border-[1.5px] border-dashed border-line p-6 text-center text-sm text-slate-500">{children}</div>;
}
