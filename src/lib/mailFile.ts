import { bytesToBase64 } from "./download";

export interface MailWithAttachment {
  to: string;
  cc?: string;
  subject: string;
  text: string;
  /** Formatted version (bold data, tables). Email apps show it instead of the text. */
  html?: string;
  /** One PDF, or one per year for a request across New Year. */
  attachments: { filename: string; pdf: Uint8Array }[];
}

const CRLF = "\r\n";

function wrap76(b64: string): string {
  return b64.replace(/.{1,76}/g, (line) => line + CRLF).trimEnd();
}

function encodeHeader(value: string): string {
  // ASCII stays readable, everything else goes as RFC 2047 encoded word.
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${bytesToBase64(new TextEncoder().encode(value))}?=`;
}

/**
 * Builds an unsent email (.eml) with the PDFs attached. Outlook opens it as a
 * ready draft with recipient, subject, text and attachments ("X-Unsent: 1").
 */
export function buildEml(m: MailWithAttachment): string {
  const boundary = `----=_vacation_${Math.random().toString(36).slice(2)}`;
  const headers = [
    `To: ${m.to}`,
    m.cc ? `Cc: ${m.cc}` : "",
    `Subject: ${encodeHeader(m.subject)}`,
    "X-Unsent: 1",
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].filter(Boolean);
  const attachmentParts = m.attachments.flatMap((a) => {
    const safeName = a.filename.replace(/["\\\r\n]/g, "_");
    return [
      `--${boundary}`,
      `Content-Type: application/pdf; name="${safeName}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${safeName}"`,
      "",
      wrap76(bytesToBase64(a.pdf)),
    ];
  });
  const b64 = (s: string) => wrap76(bytesToBase64(new TextEncoder().encode(s.replace(/\r?\n/g, CRLF))));
  const textPart = ["Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64", "", b64(m.text)];
  // With HTML: text and HTML as alternatives, the email app shows the HTML.
  const alt = `----=_alt_${Math.random().toString(36).slice(2)}`;
  const content = m.html
    ? [
        `Content-Type: multipart/alternative; boundary="${alt}"`,
        "",
        `--${alt}`,
        ...textPart,
        `--${alt}`,
        "Content-Type: text/html; charset=utf-8",
        "Content-Transfer-Encoding: base64",
        "",
        b64(m.html),
        `--${alt}--`,
      ]
    : textPart;
  const body = [
    `--${boundary}`,
    ...content,
    ...attachmentParts,
    `--${boundary}--`,
    "",
  ];
  return [...headers, "", ...body].join(CRLF);
}

/** VR-2026-005_2026_Vacation-Request_Name.pdf -> VR-2026-005_Vacation-Request_Name.eml */
export function emlFilename(pdfName: string): string {
  return pdfName.replace(/_\d{4}_Vacation/, "_Vacation").replace(/\.pdf$/i, "") + ".eml";
}

/** True when the device can hand the PDFs to an email app (share sheet). */
export function canShareFiles(files: File[]): boolean {
  try {
    return typeof navigator !== "undefined" && !!navigator.canShare && navigator.canShare({ files });
  } catch {
    return false;
  }
}
