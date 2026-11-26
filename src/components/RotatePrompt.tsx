import { RotateCw, Smartphone } from 'lucide-react';

interface RotatePromptProps {
  onRequestLandscape: () => void;
  onDismissPortrait: () => void;
}

export function RotatePrompt({
  onRequestLandscape,
  onDismissPortrait,
}: RotatePromptProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#07090e]/95 p-6 text-center"
      role="dialog"
      aria-modal="true"
      aria-label="Rotate Device to Landscape"
      data-testid="rotate-prompt"
    >
      <div className="w-full max-w-xs space-y-5 rounded-2xl border border-white/15 bg-[#0c1220] p-6 shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-400/30 bg-sky-500/15 text-sky-400">
          <div className="relative flex items-center justify-center">
            <Smartphone className="h-8 w-8 -rotate-90 transition-transform" />
            <RotateCw className="absolute -top-2 -right-2 h-4 w-4 text-amber-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-xl font-bold tracking-wide text-white">
            Rotate Your Screen
          </h2>
          <p className="text-xs leading-relaxed text-slate-300">
            Play Nitro Goal Arena in landscape mode for full stadium visibility
            and dual-thumb steering &amp; nitro controls.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onRequestLandscape}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 font-display text-sm font-bold text-slate-950 hover:bg-sky-400"
          >
            <RotateCw className="h-4 w-4" />
            <span>Switch to Landscape</span>
          </button>

          <button
            type="button"
            onClick={onDismissPortrait}
            className="flex min-h-[40px] w-full items-center justify-center rounded-lg border border-white/12 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            Continue in Portrait
          </button>
        </div>
      </div>
    </div>
  );
}
