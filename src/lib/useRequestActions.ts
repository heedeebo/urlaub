import { useTranslation } from "react-i18next";
import { useStore } from "../data/store";
import { renderEmail, templateValues } from "../domain/email";
import { balanceForRequest } from "../domain/ledger";
import type { RequestStatus, VacationRequest } from "../domain/types";
import { downloadBlob } from "./download";
// Bundled with the app on purpose: a lazy chunk can vanish during an update.
import * as pdfModule from "./pdf";
const loadPdf = async () => pdfModule;

export type SendOutcome =
  | { kind: "email"; to: string }
  | { kind: "mailto"; to: string }
  | { kind: "error"; message: string };

export function useRequestActions() {
  const { t } = useTranslation();
  const { data, input, saveRequest } = useStore();
  const profile = data.settings.profile;

  /** Balance block: frozen snapshot once sent, live numbers while draft. */
  const balanceOf = (r: VacationRequest) => (r.status !== "draft" && r.snapshot ? r.snapshot : balanceForRequest(input, r));

  const buildPdf = async (r: VacationRequest) => (await loadPdf()).generateRequestPdf({ t, profile, request: r, balance: balanceOf(r) });

  /** Downloads the PDF, or one PDF per year for a request across New Year. */
  const downloadPdf = async (r: VacationRequest) => {
    const files = await (await loadPdf()).generateRequestPdfs({ t, profile, request: r, balance: balanceOf(r) });
    files.forEach((f, i) =>
      setTimeout(() => downloadBlob(new Blob([f.bytes as BlobPart], { type: "application/pdf" }), f.filename), i * 600),
    );
  };

  const previewEmail = (r: VacationRequest) =>
    renderEmail(data.settings.emailTemplate, templateValues(profile, r, balanceOf(r)));

  /**
   * Freezes the balance and marks the request as pending. Nothing is sent
   * from here: the request page opens an email draft with the PDF attached.
   */
  const send = async (draft: VacationRequest): Promise<SendOutcome> => {
    if (!draft.signature) return { kind: "error", message: t("send.needSignature") };
    if (!profile.managerEmail) return { kind: "error", message: t("send.needManager") };
    const now = new Date().toISOString();
    const snapshot = balanceForRequest(input, draft);
    const prepared: VacationRequest = { ...draft, snapshot, sentAt: now };
    // No server: the request page then offers ways to send the email with the PDF attached.
    await saveRequest({
      ...prepared,
      status: "pending",
      sentVia: "mailto",
      updatedAt: now,
      statusHistory: [...prepared.statusHistory, { status: "pending", at: now, note: t("send.historyMailto") }],
    });
    return { kind: "mailto", to: profile.managerEmail };
  };

  /** Everything needed to send a request by hand: recipient, text and the signed PDF. */
  const mailWithPdf = async (r: VacationRequest) => {
    const { generateRequestPdfs } = await loadPdf();
    const balance = balanceOf(r);
    const files = await generateRequestPdfs({ t, profile, request: r, balance });
    const mail = renderEmail(data.settings.emailTemplate, templateValues(profile, r, balance));
    return {
      to: profile.managerEmail,
      cc: profile.personalEmail || undefined,
      subject: mail.subject,
      text: mail.body,
      attachments: files.map((f) => ({ filename: f.filename, pdf: f.bytes })),
    };
  };

  const setStatus = async (r: VacationRequest, status: RequestStatus, note: string) => {
    const now = new Date().toISOString();
    await saveRequest({
      ...r,
      status,
      // A request marked as sent by hand still needs a frozen balance.
      snapshot: r.snapshot ?? balanceForRequest(input, r),
      sentAt: r.sentAt ?? (status !== "draft" ? now : null),
      sentVia: r.sentVia ?? (status !== "draft" ? "manual" : null),
      updatedAt: now,
      statusHistory: [...r.statusHistory, { status, at: now, note: note.trim() || undefined }],
    });
  };

  return { balanceOf, buildPdf, downloadPdf, mailWithPdf, previewEmail, send, setStatus };
}
