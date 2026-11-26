import { Home, Play, RotateCcw, Settings } from 'lucide-react';
import type { MatchStats } from '../game/types';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onExitToMenu: () => void;
}

export function PauseModal({
  onResume,
  onRestart,
  onOpenSettings,
  onExitToMenu,
}: PauseModalProps) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Match Paused"
    >
      <div className="max-h-[90vh] w-full max-w-sm space-y-5 overflow-y-auto rounded-xl border border-white/15 bg-[#090d16] p-6 text-center shadow-2xl">
        <div className="space-y-1">
          <h2 className="font-display text-2xl font-bold text-white">
            Match Paused
          </h2>
          <p className="text-xs text-slate-400">
            Press Esc or P to resume gameplay
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-sky-500 px-5 py-2.5 font-display text-sm font-bold text-slate-950 hover:bg-sky-400"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Resume Match</span>
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-white/15 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-800"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Restart Match</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-white/15 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-800"
          >
            <Settings className="h-4 w-4" />
            <span>Graphics & Settings</span>
          </button>

          <button
            type="button"
            onClick={onExitToMenu}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-5 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200"
          >
            <Home className="h-4 w-4" />
            <span>Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface MatchEndModalProps {
  stats: MatchStats;
  onPlayAgain: () => void;
  onExitToMenu: () => void;
}

export function MatchEndModal({
  stats,
  onPlayAgain,
  onExitToMenu,
}: MatchEndModalProps) {
  const playerWon = stats.blueScore > stats.amberScore;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/78 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Match Summary"
    >
      <div className="max-h-[90vh] w-full max-w-md space-y-6 overflow-y-auto rounded-xl border border-white/15 bg-[#090d16] p-7 text-center shadow-2xl">
        <div className="space-y-1">
          <div className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
            {stats.isOvertime ? 'Overtime Winner' : 'Full Time'}
          </div>
          <h2
            className={`font-display text-3xl font-bold ${
              playerWon ? 'text-sky-400' : 'text-amber-400'
            }`}
          >
            {playerWon ? 'Blue Victory' : 'Amber Victory'}
          </h2>
          <div className="font-mono-tabular pt-1 text-4xl font-bold text-white">
            {stats.blueScore} — {stats.amberScore}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 border-y border-white/10 py-4">
          <div>
            <div className="font-mono-tabular text-xl font-bold text-white">
              {stats.playerGoals}
            </div>
            <div className="text-[11px] text-slate-400 uppercase">Goals</div>
          </div>
          <div>
            <div className="font-mono-tabular text-xl font-bold text-white">
              {stats.playerShots}
            </div>
            <div className="text-[11px] text-slate-400 uppercase">Shots</div>
          </div>
          <div>
            <div className="font-mono-tabular text-xl font-bold text-white">
              {stats.topSpeedKmh}
            </div>
            <div className="text-[11px] text-slate-400 uppercase">Top km/h</div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            data-start="true"
            onClick={onPlayAgain}
            className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-lg bg-sky-500 px-5 py-2.5 font-display text-sm font-bold text-slate-950 hover:bg-sky-400"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Play Again</span>
          </button>

          <button
            type="button"
            onClick={onExitToMenu}
            className="flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-lg border border-white/15 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-800"
          >
            <Home className="h-4 w-4" />
            <span>Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
}
