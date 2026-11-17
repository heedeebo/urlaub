import { bytesToBase64 } from "./download";

export interface MailWithAttachment {
  to: string;
  cc?: string;
  subject: string;
  text: string;
  filename: string;
  pdf: Uint8Array;
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
 * Builds an unsent email (.eml) with the PDF attached. Outlook opens it as a
 * ready draft with recipient, subject, text and attachment ("X-Unsent: 1").
 */
export function buildEml(m: MailWithAttachment): string {
  const boundary = `----=_vacation_${Math.random().toString(36).slice(2)}`;
  const safeName = m.filename.replace(/["\\\r\n]/g, "_");
  const headers = [
    `To: ${m.to}`,
    m.cc ? `Cc: ${m.cc}` : "",
    `Subject: ${encodeHeader(m.subject)}`,
    "X-Unsent: 1",
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].filter(Boolean);
  const body = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(bytesToBase64(new TextEncoder().encode(m.text.replace(/\r?\n/g, CRLF)))),
    `--${boundary}`,
    `Content-Type: application/pdf; name="${safeName}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${safeName}"`,
    "",
    wrap76(bytesToBase64(m.pdf)),
    `--${boundary}--`,
    "",
  ];
  return [...headers, "", ...body].join(CRLF);
}

export function emlFilename(pdfName: string): string {
  return pdfName.replace(/\.pdf$/i, "") + ".eml";
}

/** True when the device can hand a PDF to an email app (share sheet). */
export function canShareFile(file: File): boolean {
  try {
    return typeof navigator !== "undefined" && !!navigator.canShare && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}
