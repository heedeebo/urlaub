/**
 * Server-side email sending via Resend. Runs as a Vercel serverless function
 * (api/send-request.ts) and inside the Vite dev server for local testing.
 * The Resend API key never reaches the browser.
 */

export interface SendInput {
  method: string;
  body: unknown;
  authorization: string | null;
  env: Record<string, string | undefined>;
  /** Local dev server only: skips the login check. */
  trusted?: boolean;
  fetchImpl?: typeof fetch;
}

export interface SendOutput {
  status: number;
  body: Record<string, unknown>;
}

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;

interface Payload {
  to: string;
  cc?: string;
  replyTo?: string;
  subject: string;
  text: string;
  attachment: { filename: string; contentBase64: string };
}

function validate(body: unknown): Payload | string {
  const b = body as Partial<Payload> | null;
  if (!b || typeof b !== "object") return "Missing body";
  if (typeof b.to !== "string" || !EMAIL.test(b.to)) return "Invalid recipient";
  if (b.cc && (typeof b.cc !== "string" || !EMAIL.test(b.cc))) return "Invalid cc";
  if (b.replyTo && (typeof b.replyTo !== "string" || !EMAIL.test(b.replyTo))) return "Invalid reply-to";
  if (typeof b.subject !== "string" || !b.subject.trim() || b.subject.length > 300) return "Invalid subject";
  if (typeof b.text !== "string" || !b.text.trim() || b.text.length > 20000) return "Invalid text";
  const a = b.attachment;
  if (!a || typeof a.filename !== "string" || !/^[\w.\-]+\.pdf$/.test(a.filename)) return "Invalid attachment name";
  if (typeof a.contentBase64 !== "string" || !/^[A-Za-z0-9+/=]+$/.test(a.contentBase64)) return "Invalid attachment";
  if ((a.contentBase64.length * 3) / 4 > MAX_ATTACHMENT_BYTES) return "Attachment too large";
  return b as Payload;
}

async function isLoggedIn(token: string, env: SendInput["env"], f: typeof fetch): Promise<boolean> {
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  const res = await f(`${url.replace(/\/$/, "")}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
  return res.ok;
}

export async function handleSendRequest(input: SendInput): Promise<SendOutput> {
  const f = input.fetchImpl ?? fetch;
  const { env } = input;
  if (input.method !== "POST") return { status: 405, body: { error: "method_not_allowed" } };

  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return { status: 501, body: { error: "not_configured", message: "RESEND_API_KEY is not set" } };

  // Only a logged-in user may send. Without Supabase the endpoint stays closed,
  // unless explicitly opened for a private deployment (not recommended).
  if (!input.trusted && env.ALLOW_UNAUTHENTICATED_EMAIL !== "true") {
    const token = input.authorization?.replace(/^Bearer\s+/i, "");
    if (!token || !(await isLoggedIn(token, env, f))) {
      return { status: 401, body: { error: "unauthorized", message: "Please sign in to send emails." } };
    }
  }

  const payload = validate(input.body);
  if (typeof payload === "string") return { status: 400, body: { error: "invalid", message: payload } };

  const allowed = env.ALLOWED_RECIPIENTS?.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allowed?.length && !allowed.includes(payload.to.toLowerCase())) {
    return { status: 403, body: { error: "recipient_not_allowed", message: "Recipient is not in ALLOWED_RECIPIENTS." } };
  }

  const res = await f("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.RESEND_FROM || "My Vacation Manager <onboarding@resend.dev>",
      to: [payload.to],
      cc: payload.cc ? [payload.cc] : undefined,
      reply_to: payload.replyTo || undefined,
      subject: payload.subject,
      text: payload.text,
      attachments: [{ filename: payload.attachment.filename, content: payload.attachment.contentBase64 }],
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
  if (!res.ok || !data.id) {
    return { status: 502, body: { error: "send_failed", message: data.message ?? `Resend returned ${res.status}` } };
  }
  return { status: 200, body: { id: data.id } };
}
