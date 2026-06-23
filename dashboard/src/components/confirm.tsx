"use client";

import { useCallback, useEffect, useState } from "react";

type ConfirmOptions = {
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  title?: string;
};

type ConfirmState = ConfirmOptions & {
  message: string;
  resolve: (value: boolean) => void;
};

export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const ask = useCallback(
    (message: string, opts?: ConfirmOptions): Promise<boolean> => {
      return new Promise((resolve) => {
        setState({ message, resolve, ...opts });
      });
    },
    [],
  );

  const close = useCallback(
    (value: boolean) => {
      if (!state) return;
      state.resolve(value);
      setState(null);
    },
    [state],
  );

  useEffect(() => {
    if (!state) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [state, close]);

  const dialog = state ? (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) close(false);
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-surface border border-line-soft rounded-2xl p-6 max-w-md w-full shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)] animate-[fade-in_120ms_ease-out]"
        style={{ animation: "fade-in 120ms ease-out" }}
      >
        {state.title ? (
          <h2 className="font-serif font-medium text-[1.15rem] mb-2">{state.title}</h2>
        ) : null}
        <p className="text-text text-[0.95rem] leading-relaxed mb-5">{state.message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => close(false)}
            className="px-4 py-2 rounded-full border border-line text-text font-semibold text-[0.85rem] hover:border-text transition-colors"
          >
            {state.cancelLabel ?? "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            autoFocus
            className={`px-4 py-2 rounded-full font-semibold text-[0.85rem] transition-all ${
              state.danger
                ? "bg-red text-bg hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(214,115,95,0.3)]"
                : "bg-accent text-bg hover:-translate-y-px hover:shadow-[0_8px_22px_rgba(232,116,59,0.3)]"
            }`}
          >
            {state.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { ask, dialog };
}
