"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

type Props = {
  /** Called once with the decoded text the moment a barcode is read. */
  onDetect: (code: string) => void;
};

type CameraState = "starting" | "scanning" | "error";

const HINTS = new Map([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.CODE_128]],
]);

/**
 * Camera barcode scanner shared by both the admin and employee قارئ باركود
 * tabs — decodes live in the browser via ZXing (works on iOS Safari too,
 * unlike the native BarcodeDetector API), then feeds the result into the
 * exact same lookup used for keyboard/HID scanning.
 */
export default function CameraScan({ onDetect }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CameraState>("starting");
  const [errorMsg, setErrorMsg] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setState("starting");
    setErrorMsg("");

    const reader = new BrowserMultiFormatReader(HINTS);
    reader
      .decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current!,
        (result) => {
          if (result && !cancelled) {
            cancelled = true;
            controlsRef.current?.stop();
            controlsRef.current = null;
            setOpen(false);
            onDetect(result.getText().trim());
          }
          // A per-frame "not found" error is expected on nearly every frame
          // while the camera hunts for a barcode — not a real failure.
        },
      )
      .then((controls) => {
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setState("scanning");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState("error");
        const name = err instanceof Error ? err.name : "";
        setErrorMsg(
          name === "NotAllowedError"
            ? "تم رفض إذن الوصول إلى الكاميرا — يرجى السماح بالوصول من إعدادات المتصفح"
            : name === "NotFoundError"
              ? "لم يتم العثور على كاميرا في هذا الجهاز"
              : "تعذر تشغيل الكاميرا — حاول مرة أخرى",
        );
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onDetect]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="camera-scan-btn"
        title="مسح بالكاميرا"
        className="flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border-none bg-[#101C36] px-3.5 font-[inherit] text-[13px] font-bold text-white hover:brightness-125"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
        >
          <path d="M4 8V6a2 2 0 0 1 2-2h1l1.2-1.6A1 1 0 0 1 9 2h6a1 1 0 0 1 .8.4L17 4h1a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
      </button>

      {open ? (
        <div
          data-testid="camera-scan-modal"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4"
        >
          <div className="relative w-full max-w-[420px] overflow-hidden rounded-[14px] bg-black">
            <video
              ref={videoRef}
              data-testid="camera-scan-video"
              className="aspect-square w-full object-cover"
              muted
              playsInline
            />
            {state === "starting" ? (
              <div className="absolute inset-0 flex items-center justify-center text-[13px] text-white">
                جارٍ تشغيل الكاميرا…
              </div>
            ) : null}
            {state === "scanning" ? (
              <div className="pointer-events-none absolute inset-8 rounded-[10px] border-2 border-[#16A34A]" />
            ) : null}
          </div>

          {state === "error" ? (
            <div
              data-testid="camera-scan-error"
              className="mt-3 max-w-[420px] rounded-[9px] bg-[#FDECEC] px-4 py-2.5 text-center text-[13px] font-semibold text-[#DC2626]"
            >
              {errorMsg}
            </div>
          ) : (
            <div className="mt-3 text-center text-[12px] text-white/80">
              وجّه الكاميرا نحو باركود المنتج
            </div>
          )}

          <button
            onClick={() => setOpen(false)}
            data-testid="camera-scan-cancel"
            className="mt-3 cursor-pointer rounded-[9px] border-none bg-white px-6 py-2.5 font-[inherit] text-[13px] font-bold text-[#101C36] hover:brightness-95"
          >
            إلغاء
          </button>
        </div>
      ) : null}
    </>
  );
}
