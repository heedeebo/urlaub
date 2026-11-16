import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import SignaturePad from "signature_pad";
import { formatDateTime } from "../domain/format";
import type { Signature } from "../domain/types";
import { Button } from "./ui";

/**
 * Handwritten signature for one request. Works with finger, mouse and stylus
 * (pointer events). The signature is never taken over from another request.
 */
export default function SignatureField({
  value,
  onChange,
  disabled,
}: {
  value: Signature | null;
  onChange: (s: Signature | null) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    if (value) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pad = new SignaturePad(canvas, {
      penColor: "#0f1f3d",
      minWidth: 0.8,
      maxWidth: 2.6,
      backgroundColor: "rgba(0,0,0,0)",
    });
    padRef.current = pad;

    // Match the canvas resolution to the screen so lines stay sharp.
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const data = pad.toData();
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d")!.scale(ratio, ratio);
      pad.clear();
      pad.fromData(data);
    };
    resize();
    const onEnd = () => setHasInk(!pad.isEmpty());
    pad.addEventListener("endStroke", onEnd);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => {
      ro.disconnect();
      pad.removeEventListener("endStroke", onEnd);
      pad.off();
      padRef.current = null;
    };
  }, [value]);

  useEffect(() => {
    if (disabled) padRef.current?.off();
    else padRef.current?.on();
  }, [disabled, value]);

  const undo = () => {
    const pad = padRef.current;
    if (!pad) return;
    const data = pad.toData();
    data.pop();
    pad.fromData(data);
    setHasInk(!pad.isEmpty());
  };
  const clear = () => {
    padRef.current?.clear();
    setHasInk(false);
  };
  const confirm = () => {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) return;
    onChange({ dataUrl: pad.toDataURL("image/png"), signedAt: new Date().toISOString() });
    setHasInk(false);
  };

  if (value) {
    return (
      <div>
        <div className="rounded-xl border border-line bg-white p-3">
          <img src={value.dataUrl} alt={t("signature.previewAlt")} className="mx-auto h-28 object-contain" />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-500">{t("signature.signedAt", { date: formatDateTime(value.signedAt) })}</span>
          {!disabled && (
            <Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={() => onChange(null)}>
              {t("signature.signAgain")}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="relative rounded-xl border-[1.5px] border-dashed border-slate-300 bg-white">
        <canvas
          ref={canvasRef}
          data-testid="signature-canvas"
          className="block h-44 w-full touch-none select-none rounded-xl"
          style={{ touchAction: "none" }}
        />
        <div className="pointer-events-none absolute inset-x-6 bottom-9 border-b border-slate-300" />
        <span className="pointer-events-none absolute bottom-3 left-6 text-[11px] text-slate-400">{t("signature.hint")}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="secondary" className="min-h-9 px-3" onClick={undo} disabled={!hasInk || disabled}>
          {t("signature.undo")}
        </Button>
        <Button variant="secondary" className="min-h-9 px-3" onClick={clear} disabled={!hasInk || disabled}>
          {t("signature.clear")}
        </Button>
        <Button className="ml-auto min-h-9 px-3" onClick={confirm} disabled={!hasInk || disabled}>
          {t("signature.confirm")}
        </Button>
      </div>
    </div>
  );
}
