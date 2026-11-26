import { Camera, Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import type { MatchStats } from '../game/types';

interface MatchHudProps {
  stats: MatchStats;
  ballCam: boolean;
  muted: boolean;
  showMobileControls: boolean;
  speedRef: React.RefObject<HTMLSpanElement | null>;
  boostArcRef: React.RefObject<SVGCircleElement | null>;
  boostTextRef: React.RefObject<HTMLSpanElement | null>;
  supersonicRef: React.RefObject<HTMLDivElement | null>;
  onToggleBallCam: () => void;
  onToggleMute: () => void;
  onPause: () => void;
  onResetKickoff: () => void;
  onSkipReplay: () => void;
}

export function MatchHud({
  stats,
  ballCam,
  muted,
  showMobileControls,
  speedRef,
  boostArcRef,
  boostTextRef,
  supersonicRef,
  onToggleBallCam,
  onToggleMute,
  onPause,
  onResetKickoff,
  onSkipReplay,
}: MatchHudProps) {
  const mins = Math.floor(Math.max(0, stats.timeRemaining) / 60);
  const secs = Math.floor(Math.max(0, stats.timeRemaining) % 60);
  const clockStr = stats.isOvertime
    ? 'OT'
    : `${mins}:${secs.toString().padStart(2, '0')}`;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-5">
      {/* Radial Supersonic Speed Lines Overlay */}
      <div
        ref={supersonicRef}
        className="pointer-events-none fixed inset-0 opacity-0 transition-opacity duration-150"
        aria-hidden="true"
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full speed-lines-active">
          <g stroke="rgba(56,189,248,0.28)" strokeWidth="0.22">
            <line x1="50" y1="50" x2="0" y2="8" />
            <line x1="50" y1="50" x2="18" y2="0" />
            <line x1="50" y1="50" x2="82" y2="0" />
            <line x1="50" y1="50" x2="100" y2="10" />
            <line x1="50" y1="50" x2="100" y2="90" />
            <line x1="50" y1="50" x2="84" y2="100" />
            <line x1="50" y1="50" x2="16" y2="100" />
            <line x1="50" y1="50" x2="0" y2="92" />
            <line x1="50" y1="50" x2="0" y2="50" />
            <line x1="50" y1="50" x2="100" y2="50" />
          </g>
          <radialGradient id="speedMask" cx="50%" cy="50%" r="50%">
            <stop offset="55%" stopColor="black" stopOpacity="0" />
            <stop offset="100%" stopColor="black" stopOpacity="1" />
          </radialGradient>
        </svg>
      </div>

      {/* Top Row: Compact Scoreboard & Utility Buttons */}
      <div className="relative z-10 flex items-start justify-between gap-2">
        {/* Left: Ball Cam Indicator */}
        <div className="pointer-events-auto">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleBallCam();
            }}
            aria-label="Toggle Ball Camera"
            className={`flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              ballCam
                ? 'border-sky-400/50 bg-[#090d16]/90 text-sky-300'
                : 'border-white/15 bg-[#090d16]/85 text-slate-300'
            }`}
          >
            <Camera className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Ball Cam [C]</span>
            <span className="sm:hidden">{ballCam ? 'Ball' : 'Car'}</span>
          </button>
        </div>

        {/* Center: Futuristic Broadcast Scoreboard */}
        <div
          className="flex items-center overflow-hidden rounded-lg border border-white/15 bg-[#090d16]/92 shadow-xl"
          aria-label="Match Scoreboard"
        >
          <div className="flex items-center gap-2.5 bg-sky-600/25 px-3.5 py-1.5 sm:px-5">
            <span className="hidden text-[11px] font-semibold tracking-wider text-sky-300 uppercase sm:inline">
              Blue
            </span>
            <span
              className="font-mono-tabular text-xl font-bold text-white sm:text-2xl"
              data-testid="score-blue"
            >
              {stats.blueScore}
            </span>
          </div>

          <div className="border-x border-white/10 px-3.5 py-1.5 text-center sm:px-5">
            <div
              className={`font-mono-tabular text-base font-bold sm:text-lg ${
                stats.isOvertime ? 'text-amber-400' : 'text-slate-100'
              }`}
            >
              {clockStr}
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-amber-600/25 px-3.5 py-1.5 sm:px-5">
            <span
              className="font-mono-tabular text-xl font-bold text-white sm:text-2xl"
              data-testid="score-amber"
            >
              {stats.amberScore}
            </span>
            <span className="hidden text-[11px] font-semibold tracking-wider text-amber-300 uppercase sm:inline">
              Amber
            </span>
          </div>
        </div>

        {/* Right: Utility Icon Buttons */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            tabIndex={-1}
            aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-[#090d16]/90 text-slate-200 hover:bg-slate-800"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Reset Kickoff"
            onClick={(e) => {
              e.currentTarget.blur();
              onResetKickoff();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-[#090d16]/90 text-slate-200 hover:bg-slate-800"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Pause Match"
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-[#090d16]/90 text-slate-200 hover:bg-slate-800"
          >
            <Pause className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Center Kickoff Countdown / Goal Celebration / Replay Banner */}
      <div className="relative z-10 my-auto flex flex-col items-center justify-center text-center">
        {stats.matchPhase === 'kickoff' && (
          <div className="rounded-xl border border-white/15 bg-[#090d16]/85 px-8 py-4 shadow-2xl">
            <div className="text-xs font-semibold tracking-widest text-sky-400 uppercase">
              Kickoff
            </div>
            <div className="font-mono-tabular text-5xl font-bold text-white">
              {Math.max(1, Math.ceil(stats.kickoffCountdown))}
            </div>
          </div>
        )}

        {stats.matchPhase === 'goal' && (
          <div
            className={`rounded-xl border px-10 py-5 shadow-2xl ${
              stats.lastScoringTeam === 'blue'
                ? 'border-sky-400/50 bg-[#081529]/92'
                : 'border-amber-400/50 bg-[#241506]/92'
            }`}
          >
            <div
              className={`font-display text-4xl font-bold tracking-wider sm:text-5xl ${
                stats.lastScoringTeam === 'blue' ? 'text-sky-400' : 'text-amber-400'
              }`}
            >
              GOAL!
            </div>
            <div className="mt-1 text-xs font-semibold tracking-widest text-slate-200 uppercase">
              Scored by {stats.lastScorerName}
            </div>
          </div>
        )}

        {stats.matchPhase === 'replay' && (
          <div className="pointer-events-auto flex items-center gap-4 rounded-lg border border-white/15 bg-[#090d16]/90 px-5 py-2.5">
            <span className="font-display text-sm font-bold tracking-wider text-amber-400 uppercase">
              Goal Replay
            </span>
            <button
              type="button"
              onClick={onSkipReplay}
              className="rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-white"
            >
              Skip
            </button>
          </div>
        )}
      </div>

      {/* Bottom Row: Minimal Speedometer & Animated Boost Gauge */}
      <div
        className={`relative z-10 flex items-end justify-between ${
          showMobileControls ? 'mb-[156px] min-[560px]:mb-0 min-[560px]:mr-[156px] sm:mr-[180px]' : ''
        }`}
      >
        {!showMobileControls && (
          <div className="hidden text-xs font-medium text-slate-200 drop-shadow md:block">
            WASD Drive · Shift Nitro · Space Jump / Dodge · E Drift
          </div>
        )}

        <div className="ml-auto flex items-center gap-3 rounded-xl border border-white/15 bg-[#090d16]/90 px-3.5 py-2 shadow-xl sm:gap-4 sm:px-4 sm:py-2.5">
          {/* Speedometer */}
          <div className="text-right">
            <span
              ref={speedRef}
              className="font-mono-tabular block text-xl leading-none font-bold text-white sm:text-2xl"
            >
              0
            </span>
            <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
              km/h
            </span>
          </div>

          {/* Animated SVG Arc Nitro Boost Meter */}
          <div className="relative flex h-14 w-14 items-center justify-center sm:h-16 sm:w-16">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="10"
              />
              <circle
                ref={boostArcRef}
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray="251.2"
                strokeDashoffset="138"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                ref={boostTextRef}
                className="font-mono-tabular text-base leading-none font-bold text-amber-300"
              >
                45
              </span>
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">
                Nitro
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
