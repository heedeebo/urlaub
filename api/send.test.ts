import { describe, expect, it, vi } from "vitest";
import { handleSendRequest } from "./_lib/send";

const body = {
  to: "manager@example.com",
  cc: "me@example.com",
  subject: "Vacation request: Alex Example, May 3 to May 7, 2027",
  text: "Dear Ms. Miller, ...",
  attachment: { filename: "VR-2027-001_Vacation-Request_Alex-Example.pdf", contentBase64: "JVBERi0xLjcK" },
};

function mockFetch(userOk = true) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith("/auth/v1/user")) return new Response("{}", { status: userOk ? 200 : 401 });
    if (u === "https://api.resend.com/emails") {
      const sent = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ id: "email_123", echo: sent }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("", { status: 404 });
  });
}

const env = { RESEND_API_KEY: "re_test", SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon" };

describe("send-request function", () => {
  it("reports missing configuration so the app can fall back to an email draft", async () => {
    const r = await handleSendRequest({ method: "POST", body, authorization: null, env: {} });
    expect(r.status).toBe(501);
    expect(r.body.error).toBe("not_configured");
  });

  it("rejects requests without a valid login", async () => {
    const r = await handleSendRequest({ method: "POST", body, authorization: null, env, fetchImpl: mockFetch() });
    expect(r.status).toBe(401);
    const r2 = await handleSendRequest({ method: "POST", body, authorization: "Bearer bad", env, fetchImpl: mockFetch(false) });
    expect(r2.status).toBe(401);
  });

  it("sends the email with the PDF attached", async () => {
    const f = mockFetch();
    const r = await handleSendRequest({ method: "POST", body, authorization: "Bearer good", env, fetchImpl: f });
    expect(r).toEqual({ status: 200, body: { id: "email_123" } });
    const call = f.mock.calls.find((c) => String(c[0]).includes("resend"))!;
    const sent = JSON.parse(String(call[1]!.body));
    expect(sent.to).toEqual(["manager@example.com"]);
    expect(sent.cc).toEqual(["me@example.com"]);
    expect(sent.attachments[0].filename).toMatch(/\.pdf$/);
    expect(sent.attachments[0].content).toBe("JVBERi0xLjcK");
    expect((call[1]!.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
  });

  it("validates the payload", async () => {
    const bad = { ...body, to: "not-an-email" };
    const r = await handleSendRequest({ method: "POST", body: bad, authorization: null, env, trusted: true, fetchImpl: mockFetch() });
    expect(r.status).toBe(400);
    const badFile = { ...body, attachment: { filename: "../evil.exe", contentBase64: "AA==" } };
    expect((await handleSendRequest({ method: "POST", body: badFile, authorization: null, env, trusted: true })).status).toBe(400);
  });

  it("can restrict recipients", async () => {
    const r = await handleSendRequest({
      method: "POST",
      body,
      authorization: null,
      env: { ...env, ALLOWED_RECIPIENTS: "boss@example.com" },
      trusted: true,
      fetchImpl: mockFetch(),
    });
    expect(r.status).toBe(403);
  });

  it("only accepts POST", async () => {
    expect((await handleSendRequest({ method: "GET", body: null, authorization: null, env })).status).toBe(405);
  });
});
