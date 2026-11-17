import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { VacationRequest } from "../domain/types";
import { downloadBlob } from "../lib/download";
import { buildEml, canShareFile, emlFilename, type MailWithAttachment } from "../lib/mailFile";
import { openMailDraft } from "../lib/sendRequest";
import { useRequestActions } from "../lib/useRequestActions";
import { Button, Card, Notice, cx } from "./ui";

/**
 * Without an email server the browser cannot send by itself.
 * This box hands the email with the signed PDF attached to the email app.
 */
export default function MailWithPdf({ request, highlight }: { request: VacationRequest; highlight?: boolean }) {
  const { t } = useTranslation();
  const { mailWithPdf } = useRequestActions();
  const [mail, setMail] = useState<MailWithAttachment | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

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

  const file = mail ? new File([mail.pdf as BlobPart], mail.filename, { type: "application/pdf" }) : null;
  const canShare = !!file && canShareFile(file);

  const share = async () => {
    if (!mail || !file) return;
    setError("");
    try {
      await navigator.share({ files: [file], title: mail.subject, text: mail.text });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    }
  };

  const eml = () => {
    if (!mail) return;
    downloadBlob(new Blob([buildEml(mail)], { type: "message/rfc822" }), emlFilename(mail.filename));
  };

  const draft = () => {
    if (!mail || !file) return;
    downloadBlob(file, mail.filename);
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
    <Card className={cx("p-4 sm:p-5", highlight && "ring-2 ring-navy-800")}>
      <h2 className="text-base font-semibold">{t("mailPdf.title")}</h2>
      <p className="mb-3 text-sm text-slate-500">{t("mailPdf.intro")}</p>
      {!mail && !error && <p className="text-sm text-slate-500">{t("mailPdf.preparing")}</p>}
      {error && <Notice tone="error">{error}</Notice>}
      {mail && (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-canvas px-3 py-2 text-sm">
            <span className="text-slate-500">{t("mailPdf.to")}</span>
            <b className="break-all">{mail.to}</b>
            <button onClick={copy} className="ml-auto text-xs font-semibold text-navy-800 hover:underline">
              {copied ? t("mailPdf.copied") : t("mailPdf.copy")}
            </button>
          </div>

          {canShare && (
            <div>
              <Button className="w-full sm:w-auto" onClick={share}>
                {t("mailPdf.share")}
              </Button>
              <p className="mt-1.5 text-xs text-slate-500">{t("mailPdf.shareHint")}</p>
            </div>
          )}

          <div>
            <Button variant={canShare ? "secondary" : "primary"} className="w-full sm:w-auto" onClick={eml}>
              {t("mailPdf.eml")}
            </Button>
            <p className="mt-1.5 text-xs text-slate-500">{t("mailPdf.emlHint")}</p>
          </div>

          <div>
            <button onClick={draft} className="text-sm font-semibold text-navy-800 hover:underline">
              {t("mailPdf.draft")}
            </button>
            <p className="mt-1 text-xs text-slate-500">{t("mailPdf.draftHint")}</p>
          </div>
        </div>
      )}
    </Card>
  );
}
