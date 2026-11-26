interface LoadingScreenProps {
  progress: number;
  label: string;
}

export function LoadingScreen({ progress, label }: LoadingScreenProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#07090e] px-6"
      role="status"
      aria-label="Loading Nitro Goal Arena"
    >
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex items-center justify-center">
          <svg
            viewBox="0 0 320 68"
            className="h-14 w-auto"
            aria-label="Nitro Goal Arena"
          >
            <polygon
              points="18,10 56,10 42,58 4,58"
              fill="#1d5cff"
            />
            <polygon
              points="48,10 66,10 52,58 34,58"
              fill="#f59e0b"
            />
            <text
              x="82"
              y="36"
              fill="#f8fafc"
              fontFamily="Chakra Petch, sans-serif"
              fontWeight="700"
              fontSize="26"
              letterSpacing="2"
            >
              NITRO GOAL
            </text>
            <text
              x="82"
              y="56"
              fill="#94a3b8"
              fontFamily="Chakra Petch, sans-serif"
              fontWeight="600"
              fontSize="13"
              letterSpacing="5"
            >
              CHAMPIONSHIP ARENA
            </text>
          </svg>
        </div>

        <div className="space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-sm bg-slate-800">
            <div
              className="h-full bg-sky-500 transition-all duration-200"
              style={{ width: `${Math.min(100, Math.max(4, progress))}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{label}</span>
            <span className="font-mono-tabular text-slate-200">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
