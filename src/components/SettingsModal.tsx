import { X } from 'lucide-react';
import type {
  GraphicsCapabilitiesProfile,
  GraphicsSettingMode,
  ResolvedGraphicsConfig,
  TimeOfDay,
  TouchControlsMode,
  UserSettings,
} from '../game/types';

interface SettingsModalProps {
  settings: UserSettings;
  capabilities: GraphicsCapabilitiesProfile | null;
  resolvedGraphics: ResolvedGraphicsConfig | null;
  onUpdate: (next: UserSettings) => void;
  onClose: () => void;
}

const PRESET_DESCRIPTIONS: Record<GraphicsSettingMode, string> = {
  AUTO: 'Detects device GPU & memory automatically',
  LOW: 'Optimized 512px textures, minimal particles, no shadows or post-FX',
  MEDIUM: '1024px textures, dynamic shadows, FXAA, basic reflections',
  HIGH: 'Detailed materials, soft 2048px shadows, Bloom & enhanced lighting',
  ULTRA: '2048px textures, SSAO ambient occlusion, SMAA & cinematic post-FX',
};

export function SettingsModal({
  settings,
  capabilities,
  resolvedGraphics,
  onUpdate,
  onClose,
}: SettingsModalProps) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Arena & Graphics Settings"
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-white/15 bg-[#090d16] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="font-display text-xl font-bold text-white">
              Graphics & Arena Settings
            </h2>
            <p className="text-xs text-slate-400">
              Active Tier: {resolvedGraphics?.preset ?? 'AUTO'}
              {capabilities?.isSoftwareGl ? ' · Software WebGL Mode' : ''}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close Settings"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-6">
          {/* Graphics Quality Preset */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold tracking-wider text-slate-300 uppercase">
              Graphics Quality Preset
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {(['AUTO', 'LOW', 'MEDIUM', 'HIGH', 'ULTRA'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onUpdate({ ...settings, graphicsMode: mode })}
                  className={`min-h-[40px] rounded-lg px-2 py-2 text-xs font-bold transition-colors ${
                    settings.graphicsMode === mode
                      ? 'bg-sky-500 text-slate-950'
                      : 'border border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              {PRESET_DESCRIPTIONS[settings.graphicsMode]}
            </p>
          </div>

          {/* Stadium Environment Time */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold tracking-wider text-slate-300 uppercase">
              Stadium Atmosphere
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['night', 'sunset', 'day'] as TimeOfDay[]).map((tod) => (
                <button
                  key={tod}
                  type="button"
                  onClick={() => onUpdate({ ...settings, timeOfDay: tod })}
                  className={`min-h-[40px] rounded-lg px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                    settings.timeOfDay === tod
                      ? 'bg-amber-500 text-slate-950'
                      : 'border border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {tod}
                </button>
              ))}
            </div>
          </div>

          {/* Touch Controls Visibility */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold tracking-wider text-slate-300 uppercase">
              On-Screen Touch Controls
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'auto', label: 'Auto (Mobile)' },
                  { id: 'on', label: 'Always On' },
                  { id: 'off', label: 'Off' },
                ] as Array<{ id: TouchControlsMode; label: string }>
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdate({ ...settings, touchControls: opt.id })}
                  className={`min-h-[40px] rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    settings.touchControls === opt.id
                      ? 'bg-slate-100 text-slate-950'
                      : 'border border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3 border-t border-white/10 pt-4">
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span className="text-sm text-slate-200">
                Boost Motion Blur (High / Ultra)
              </span>
              <input
                type="checkbox"
                checked={settings.motionBlur}
                onChange={(e) =>
                  onUpdate({ ...settings, motionBlur: e.target.checked })
                }
                className="h-5 w-5 accent-sky-500"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span className="text-sm text-slate-200">
                Depth of Field (Ultra)
              </span>
              <input
                type="checkbox"
                checked={settings.depthOfField}
                onChange={(e) =>
                  onUpdate({ ...settings, depthOfField: e.target.checked })
                }
                className="h-5 w-5 accent-sky-500"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span className="text-sm text-slate-200">
                Cinematic Goal Replays
              </span>
              <input
                type="checkbox"
                checked={settings.goalReplays}
                onChange={(e) =>
                  onUpdate({ ...settings, goalReplays: e.target.checked })
                }
                className="h-5 w-5 accent-sky-500"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span className="text-sm text-slate-200">Mute Audio</span>
              <input
                type="checkbox"
                checked={settings.muted}
                onChange={(e) =>
                  onUpdate({ ...settings, muted: e.target.checked })
                }
                className="h-5 w-5 accent-sky-500"
              />
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] rounded-lg bg-sky-500 px-6 py-2 font-display text-sm font-bold text-slate-950 hover:bg-sky-400"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
