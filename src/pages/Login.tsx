import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, Field, Input, Notice } from "../components/ui";
import { supabase } from "../data/supabase";

export default function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "ok"; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMsg(null);
    const res =
      mode === "signIn"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (res.error) setMsg({ tone: "error", text: res.error.message });
    else if (mode === "signUp" && !res.data.session) setMsg({ tone: "ok", text: t("auth.checkEmail") });
  };

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="h-10 w-10 rounded-xl" />
          <div>
            <h1 className="text-lg font-bold">{t("app.name")}</h1>
            <p className="text-sm text-slate-500">{mode === "signIn" ? t("auth.signInTitle") : t("auth.signUpTitle")}</p>
          </div>
        </div>
        <form onSubmit={submit} className="grid gap-3">
          <Field label={t("auth.email")}>
            <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label={t("auth.password")} hint={mode === "signUp" ? t("auth.passwordHint") : undefined}>
            <Input
              type="password"
              autoComplete={mode === "signIn" ? "current-password" : "new-password"}
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
          <Button type="submit" disabled={busy}>
            {mode === "signIn" ? t("auth.signIn") : t("auth.signUp")}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
          className="mt-4 w-full text-center text-sm font-semibold text-navy-800"
        >
          {mode === "signIn" ? t("auth.toSignUp") : t("auth.toSignIn")}
        </button>
      </Card>
    </div>
  );
}
