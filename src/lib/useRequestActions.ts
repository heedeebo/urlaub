import { useTranslation } from "react-i18next";
import { useStore } from "../data/store";
import { renderEmail, templateValues } from "../domain/email";
import { balanceForRequest } from "../domain/ledger";
import type { RequestStatus, VacationRequest } from "../domain/types";
import { bytesToBase64, downloadBlob } from "./download";
const loadPdf = () => import("./pdf");
import { openMailDraft, sendViaServer } from "./sendRequest";

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

  const downloadPdf = async (r: VacationRequest) => {
    const bytes = await buildPdf(r);
    downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), (await loadPdf()).pdfFilename(r, profile));
  };

  const previewEmail = (r: VacationRequest) =>
    renderEmail(data.settings.emailTemplate, templateValues(profile, r, balanceOf(r)));

  /**
   * Freezes the balance, builds the signed PDF and sends it to the manager.
   * Without email configuration it downloads the PDF and opens an email draft.
   */
  const send = async (draft: VacationRequest): Promise<SendOutcome> => {
    if (!draft.signature) return { kind: "error", message: t("send.needSignature") };
    if (!profile.managerEmail) return { kind: "error", message: t("send.needManager") };
    const now = new Date().toISOString();
    const snapshot = balanceForRequest(input, draft);
    const prepared: VacationRequest = { ...draft, snapshot, sentAt: now };
    const { generateRequestPdf, pdfFilename } = await loadPdf();
    const bytes = await generateRequestPdf({ t, profile, request: prepared, balance: snapshot });
    const filename = pdfFilename(prepared, profile);
    const mail = renderEmail(data.settings.emailTemplate, templateValues(profile, prepared, snapshot));

    const result = await sendViaServer({
      to: profile.managerEmail,
      cc: profile.personalEmail || undefined,
      replyTo: profile.personalEmail || undefined,
      subject: mail.subject,
      text: mail.body,
      attachment: { filename, contentBase64: bytesToBase64(bytes) },
    });

    if (result.ok) {
      await saveRequest({
        ...prepared,
        status: "pending",
        sentVia: "email",
        updatedAt: now,
        statusHistory: [...prepared.statusHistory, { status: "pending", at: now, note: t("send.historyEmail", { to: profile.managerEmail }) }],
      });
      return { kind: "email", to: profile.managerEmail };
    }
    if (result.reason !== "not_configured") return { kind: "error", message: result.message || t("send.failed") };

    downloadBlob(new Blob([bytes as BlobPart], { type: "application/pdf" }), filename);
    await saveRequest({
      ...prepared,
      status: "pending",
      sentVia: "mailto",
      updatedAt: now,
      statusHistory: [...prepared.statusHistory, { status: "pending", at: now, note: t("send.historyMailto") }],
    });
    setTimeout(() => openMailDraft({ to: profile.managerEmail, cc: profile.personalEmail, subject: mail.subject, text: mail.body }), 400);
    return { kind: "mailto", to: profile.managerEmail };
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

  return { balanceOf, buildPdf, downloadPdf, previewEmail, send, setStatus };
}
