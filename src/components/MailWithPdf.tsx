import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { VacationRequest } from "../domain/types";
import { downloadBlob } from "../lib/download";
import { buildEml, canShareFiles, emlFilename, type MailWithAttachment } from "../lib/mailFile";
import { openMailDraft } from "../lib/sendRequest";
import { useRequestActions } from "../lib/useRequestActions";
import { Button, Card, Notice, cx } from "./ui";

/** Phones and tablets use the share menu, laptops get an email file for Outlook. */
function isPhone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(pointer: coarse)").matches && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/**
 * Nothing is ever sent from the app. This box opens an email draft with the
 * signed PDF attached; the user checks it and sends it from the email app.
 */
export default function MailWithPdf({ request, autoOpen }: { request: VacationRequest; autoOpen?: boolean }) {
  const { t } = useTranslation();
  const { mailWithPdf } = useRequestActions();
  const [mail, setMail] = useState<MailWithAttachment | null>(null);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [copied, setCopied] = useState(false);
  const opened = useRef(false);

  // Build the PDF beforehand: phones only allow sharing right after a tap.
  useEffect(() => {
    let alive = true;
    mailWithPdf(request)
      .then((m) => alive && setMail(m))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.id, request.updatedAt]);

  const files = mail ? mail.attachments.map((a) => new File([a.pdf as BlobPart], a.filename, { type: "application/pdf" })) : [];
  const canShare = files.length > 0 && canShareFiles(files);
  const useShare = canShare && isPhone();

  const share = async () => {
    if (!mail || !files.length) return;
    setError("");
    try {
      // Many phone mail apps ignore "title" and take the first line of the text
      // as subject. So the subject goes first, then the actual email text.
      await navigator.share({ files, title: mail.subject, text: `${mail.subject}\n\n${mail.text}` });
    } catch (e) {
      const name = (e as Error).name;
      if (name === "NotAllowedError") setHint(t("mailPdf.tapToOpen"));
      else if (name !== "AbortError") setError((e as Error).message);
    }
  };

  const eml = () => {
    if (!mail) return;
    downloadBlob(new Blob([buildEml(mail)], { type: "message/rfc822" }), emlFilename(mail.attachments[0].filename));
  };

  const open = () => (useShare ? share() : eml());

  // Right after "Sign and open email draft": open the draft straight away.
  useEffect(() => {
    if (!autoOpen || !mail || opened.current) return;
    opened.current = true;
    void open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen, mail]);

  const draft = () => {
    if (!mail || !files.length) return;
    files.forEach((f, i) => setTimeout(() => downloadBlob(f, f.name), i * 600));
    setTimeout(() => openMailDraft({ to: mail.to, cc: mail.cc, subject: mail.subject, text: mail.text }), 400);
  };

  const copy = async () => {
    if (!mail) return;
    try {
      await navigator.clipboard.writeText(mail.to);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not allowed: the address is visible anyway */
    }
  };

  return (
    <Card className={cx("p-4 sm:p-5", autoOpen && "ring-2 ring-navy-800")}>
      <h2 className="text-base font-semibold">{t("mailPdf.title")}</h2>
      <p className="mb-3 text-sm text-slate-500">{t("mailPdf.intro")}</p>
      {!mail && !error && <p className="text-sm text-slate-500">{t("mailPdf.preparing")}</p>}
      {error && <Notice tone="error">{error}</Notice>}
      {mail && (
        <div className="grid gap-4">
          {files.length > 1 && (
            <Notice tone="info">{t("mailPdf.twoPdfs", { count: files.length, names: files.map((f) => f.name).join(", ") })}</Notice>
          )}
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-canvas px-3 py-2 text-sm">
            <span className="text-slate-500">{t("mailPdf.to")}</span>
            <b className="break-all">{mail.to}</b>
            <button onClick={copy} className="ml-auto text-xs font-semibold text-navy-800 hover:underline">
              {copied ? t("mailPdf.copied") : t("mailPdf.copy")}
            </button>
          </div>

          {hint && <Notice tone="info">{hint}</Notice>}

          <div>
            <Button className="w-full sm:w-auto" onClick={open}>
              {t("mailPdf.open")}
            </Button>
            <p className="mt-1.5 text-xs text-slate-500">{useShare ? t("mailPdf.shareHint") : t("mailPdf.emlHint")}</p>
          </div>

          <div className="grid gap-2 text-sm">
            {useShare ? (
              <button onClick={eml} className="text-left font-semibold text-navy-800 hover:underline">
                {t("mailPdf.otherEml")}
              </button>
            ) : (
              canShare && (
                <button onClick={share} className="text-left font-semibold text-navy-800 hover:underline">
                  {t("mailPdf.otherShare")}
                </button>
              )
            )}
            <div>
              <button onClick={draft} className="text-left font-semibold text-navy-800 hover:underline">
                {t("mailPdf.draft")}
              </button>
              <p className="mt-1 text-xs text-slate-500">{t("mailPdf.draftHint")}</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
