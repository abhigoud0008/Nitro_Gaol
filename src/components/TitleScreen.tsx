import { Play, Settings, SlidersHorizontal, Sun, Sunset, Moon } from 'lucide-react';
import type { MatchFormat, TimeOfDay } from '../game/types';

interface TitleScreenProps {
  matchFormat: MatchFormat;
  timeOfDay: TimeOfDay;
  qualityLabel: string;
  onStartMatch: () => void;
  onOpenGarage: () => void;
  onOpenSettings: () => void;
  onChangeFormat: (format: MatchFormat) => void;
  onChangeTimeOfDay: (tod: TimeOfDay) => void;
}

export function TitleScreen({
  matchFormat,
  timeOfDay,
  qualityLabel,
  onStartMatch,
  onOpenGarage,
  onOpenSettings,
  onChangeFormat,
  onChangeTimeOfDay,
}: TitleScreenProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-5 md:p-10 [@media(max-height:460px)]:p-3.5">
      {/* Subtle left-side scrim for crisp typography contrast over live 3D arena */}
      <div
        className="pointer-events-none fixed inset-y-0 left-0 w-full max-w-xl"
        style={{
          background:
            'linear-gradient(90deg, rgba(7,9,14,0.88) 0%, rgba(7,9,14,0.62) 55%, rgba(7,9,14,0) 100%)',
        }}
      />

      {/* Top minimal info row */}
      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-xs font-medium text-slate-300">
          <span>Season Premier</span>
          <span aria-hidden="true">·</span>
          <span>Graphics: {qualityLabel}</span>
        </div>

        {/* Stadium lighting time quick selector */}
        <div
          className="pointer-events-auto flex items-center gap-1 rounded-lg border border-white/10 bg-[#090d16]/90 p-1"
          role="group"
          aria-label="Stadium Time of Day"
        >
          {(
            [
              { id: 'night', label: 'Night', Icon: Moon },
              { id: 'sunset', label: 'Sunset', Icon: Sunset },
              { id: 'day', label: 'Day', Icon: Sun },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onChangeTimeOfDay(id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                timeOfDay === id
                  ? 'bg-sky-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Left-third negative-space hero lockup & actions */}
      <main className="relative z-10 my-auto max-w-md space-y-5 [@media(max-height:460px)]:space-y-3">
        <div className="space-y-2 [@media(max-height:460px)]:space-y-1">
          <svg
            viewBox="0 0 360 92"
            className="w-full max-w-[320px] [@media(max-height:460px)]:max-w-[230px]"
            aria-label="Nitro Goal Arena"
          >
            <polygon points="10,12 52,12 36,78 0,78" fill="#2563eb" />
            <polygon points="46,12 66,12 50,78 30,78" fill="#f59e0b" />
            <text
              x="82"
              y="44"
              fill="#f8fafc"
              fontFamily="Chakra Petch, sans-serif"
              fontWeight="700"
              fontSize="40"
              letterSpacing="2"
            >
              NITRO GOAL
            </text>
            <text
              x="84"
              y="73"
              fill="#38bdf8"
              fontFamily="Chakra Petch, sans-serif"
              fontWeight="700"
              fontSize="24"
              letterSpacing="6"
            >
              ARENA
            </text>
          </svg>
          <p className="max-w-sm text-sm leading-relaxed text-slate-300 [@media(max-height:460px)]:hidden">
            High-downforce aerodynamic supercars meet floodlit championship
            football. Master boost aerials, power shots, and stadium rebounds.
          </p>
        </div>

        {/* Match Format Selector */}
        <div className="pointer-events-auto inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#090d16]/90 p-1">
          {(['1v1', '2v2'] as const).map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => onChangeFormat(fmt)}
              className={`rounded-md px-4 py-1.5 text-xs font-semibold tracking-wide whitespace-nowrap transition-colors ${
                matchFormat === fmt
                  ? 'bg-slate-100 text-slate-950'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {fmt === '1v1' ? '1v1 Duel' : '2v2 Championship'}
            </button>
          ))}
        </div>

        {/* <= 3 Primary Menu Actions */}
        <div className="pointer-events-auto flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            data-start="true"
            onClick={onStartMatch}
            className="flex min-h-[48px] items-center justify-center gap-2.5 rounded-lg bg-sky-500 px-7 py-3 font-display text-base font-bold tracking-wide text-slate-950 shadow-lg transition-colors hover:bg-sky-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 whitespace-nowrap"
          >
            <Play className="h-4 w-4 fill-current" aria-hidden="true" />
            <span>Play Match</span>
          </button>

          <button
            type="button"
            onClick={onOpenGarage}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-white/15 bg-[#0f1624]/95 px-5 py-3 font-display text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-800 whitespace-nowrap"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            <span>3D Garage</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-white/15 bg-[#0f1624]/95 px-5 py-3 font-display text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-800 whitespace-nowrap"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            <span>Settings</span>
          </button>
        </div>
        <nav aria-label="Site information" className="pointer-events-auto flex flex-wrap gap-x-3 gap-y-1 text-xs text-sky-200" onKeyDown={(event) => event.stopPropagation()}>
          {([['about','About'],['how-to-play','How to Play'],['privacy','Privacy'],['terms','Terms'],['contact','Contact'],['cookies','Cookie Choices']] as const).map(([slug,label]) => (
            <a key={slug} href={`/${slug}.html`} className="underline hover:text-white">{label}</a>
          ))}
        </nav>
      </main>

      {/* Bottom gradient scrim + flat borderless control hints */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 h-24 [@media(max-height:460px)]:hidden"
        style={{
          background:
            'linear-gradient(to top, rgba(7,9,14,0.86) 0%, rgba(7,9,14,0) 100%)',
        }}
      />
      <footer className="relative z-10 flex flex-wrap items-center justify-between gap-4 text-xs font-medium text-slate-200 [@media(max-height:460px)]:hidden">
        <span>
          WASD / Arrows Drive · Shift Boost · Space Jump / Dodge · E Drift · C Ball Cam
        </span>
        <span className="text-sky-300">Press Enter or Space to Kick Off</span>
      </footer>
    </div>
  );
}
