import { supabase } from "../data/supabase";

export interface EmailPayload {
  to: string;
  cc?: string;
  replyTo?: string;
  subject: string;
  text: string;
  attachment: { filename: string; contentBase64: string };
}

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not_configured" | "unauthorized" | "error"; message: string };

/** Sends the email through the server function (Resend). Never exposes API keys. */
export async function sendViaServer(payload: EmailPayload): Promise<SendResult> {
  // Static hosting (GitHub Pages) has no server function: go straight to the mail draft.
  if (import.meta.env.VITE_STATIC_HOSTING === "true") return { ok: false, reason: "not_configured", message: "static hosting" };
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  let res: Response;
  try {
    res = await fetch("/api/send-request", { method: "POST", headers, body: JSON.stringify(payload) });
  } catch (e) {
    return { ok: false, reason: "not_configured", message: (e as Error).message };
  }
  const isJson = res.headers.get("content-type")?.includes("application/json");
  if (!isJson) return { ok: false, reason: "not_configured", message: `HTTP ${res.status}` };
  const body = (await res.json()) as { id?: string; error?: string; message?: string };
  if (res.ok && body.id) return { ok: true, id: body.id };
  if (res.status === 501 || body.error === "not_configured") return { ok: false, reason: "not_configured", message: body.message ?? "" };
  if (res.status === 401) return { ok: false, reason: "unauthorized", message: body.message ?? "" };
  return { ok: false, reason: "error", message: body.message ?? body.error ?? `HTTP ${res.status}` };
}

/** Fallback: opens a pre-filled draft in the default email app. */
export function openMailDraft(p: { to: string; cc?: string; subject: string; text: string }) {
  const params = [`subject=${encodeURIComponent(p.subject)}`, `body=${encodeURIComponent(p.text)}`];
  if (p.cc) params.unshift(`cc=${encodeURIComponent(p.cc)}`);
  window.location.href = `mailto:${encodeURIComponent(p.to)}?${params.join("&")}`;
}
