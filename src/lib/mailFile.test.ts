import { describe, expect, it } from "vitest";
import { buildEml, emlFilename } from "./mailFile";

describe("email file with PDF", () => {
  const pdf = new TextEncoder().encode("%PDF-1.7 test");
  const eml = buildEml({
    to: "chef@firma.de",
    cc: "chris@example.com",
    subject: "Urlaubsantrag März",
    text: "Hallo,\nanbei mein Antrag.\nChris",
    attachments: [
      { filename: "VR-2026-001_2026_Vacation-Request_Chris.pdf", pdf },
      { filename: "VR-2026-001_2027_Vacation-Request_Chris.pdf", pdf },
    ],
  });

  it("opens as an unsent draft with recipient and subject", () => {
    expect(eml).toContain("To: chef@firma.de\r\n");
    expect(eml).toContain("Cc: chris@example.com\r\n");
    expect(eml).toContain("X-Unsent: 1\r\n");
    const subject = /Subject: =\?UTF-8\?B\?([^?]+)\?=/.exec(eml)![1];
    expect(new TextDecoder().decode(Uint8Array.from(atob(subject), (c) => c.charCodeAt(0)))).toBe("Urlaubsantrag März");
  });

  it("carries the text and the PDF as attachment", () => {
    const boundary = /boundary="([^"]+)"/.exec(eml)![1];
    const parts = eml.split(`--${boundary}`);
    expect(parts).toHaveLength(5);
    const textB64 = parts[1].split("\r\n\r\n")[1].replace(/\r\n/g, "");
    const text = new TextDecoder().decode(Uint8Array.from(atob(textB64), (c) => c.charCodeAt(0)));
    expect(text).toBe("Hallo,\r\nanbei mein Antrag.\r\nChris");
    expect(parts[2]).toContain('Content-Disposition: attachment; filename="VR-2026-001_2026_Vacation-Request_Chris.pdf"');
    expect(atob(parts[2].split("\r\n\r\n")[1].replace(/\r\n/g, ""))).toBe("%PDF-1.7 test");
    expect(parts[3]).toContain('filename="VR-2026-001_2027_Vacation-Request_Chris.pdf"');
    expect(parts[4].startsWith("--")).toBe(true);
  });

  it("names the file like the PDF", () => {
    expect(emlFilename("A_B.pdf")).toBe("A_B.eml");
    expect(emlFilename("VR-1_2026_Vacation-Request_C.pdf")).toBe("VR-1_Vacation-Request_C.eml");
  });
});
