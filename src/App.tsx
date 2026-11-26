import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArenaEngine } from './game/ArenaEngine';
import {
  CAR_FINISHES,
  CarArchetypeId,
  CarFinishOption,
  GraphicsCapabilitiesProfile,
  InputState,
  MatchFormat,
  MatchStats,
  ResolvedGraphicsConfig,
  ScreenState,
  TimeOfDay,
  UserSettings,
} from './game/types';
import { MATCH_DURATION_SECONDS } from './game/physics';
import { LoadingScreen } from './components/LoadingScreen';
import { TitleScreen } from './components/TitleScreen';
import { GarageOverlay } from './components/GarageOverlay';
import { MatchHud } from './components/MatchHud';
import { MobileControls } from './components/MobileControls';
import { SettingsModal } from './components/SettingsModal';
import { MatchEndModal, PauseModal } from './components/PauseAndEndModals';
import { RotatePrompt } from './components/RotatePrompt';

const INITIAL_STATS: MatchStats = {
  blueScore: 0,
  amberScore: 0,
  playerGoals: 0,
  playerShots: 0,
  playerSaves: 0,
  topSpeedKmh: 0,
  boostCollected: 0,
  timeRemaining: MATCH_DURATION_SECONDS,
  isOvertime: false,
  matchPhase: 'kickoff',
  kickoffCountdown: 2.2,
  goalBannerTimer: 0,
  lastScoringTeam: null,
  lastScorerName: '',
};

const INITIAL_SETTINGS: UserSettings = {
  graphicsMode: 'AUTO',
  timeOfDay: 'night',
  matchFormat: '2v2',
  motionBlur: true,
  depthOfField: false,
  goalReplays: true,
  touchControls: 'auto',
  muted: false,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ArenaEngine | null>(null);

  const speedRef = useRef<HTMLSpanElement>(null);
  const boostArcRef = useRef<SVGCircleElement>(null);
  const boostTextRef = useRef<HTMLSpanElement>(null);
  const supersonicRef = useRef<HTMLDivElement>(null);

  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [loadProgress, setLoadProgress] = useState(10);
  const [loadLabel, setLoadLabel] = useState('Initializing Nitro Goal Arena');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [settings, setSettings] = useState<UserSettings>(INITIAL_SETTINGS);
  const [selectedArchetype, setSelectedArchetype] =
    useState<CarArchetypeId>('apex-gt');
  const [selectedFinish, setSelectedFinish] = useState<CarFinishOption>(
    CAR_FINISHES[0]
  );

  const [stats, setStats] = useState<MatchStats>(INITIAL_STATS);
  const [ballCam, setBallCam] = useState(true);
  const [capabilities, setCapabilities] =
    useState<GraphicsCapabilitiesProfile | null>(null);
  const [resolvedGraphics, setResolvedGraphics] =
    useState<ResolvedGraphicsConfig | null>(null);
  const [isTouchViewport, setIsTouchViewport] = useState(false);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [portraitDismissed, setPortraitDismissed] = useState(false);

  const screenRef = useRef<ScreenState>(screenState);
  screenRef.current = screenState;

  useEffect(() => {
    document.body.dataset.state = screenState;
  }, [screenState]);

  const tryLockLandscape = useCallback(async () => {
    try {
      const rootEl = document.documentElement;
      if (rootEl.requestFullscreen && !document.fullscreenElement) {
        await rootEl.requestFullscreen();
      }
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
      };
      if (orientation && typeof orientation.lock === 'function') {
        await orientation.lock('landscape');
      }
    } catch {
      // Orientation lock or fullscreen is unavailable in desktop preview / non-PWA Safari
    }
  }, []);

  useEffect(() => {
    const checkViewport = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const hasTouch =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        w <= 960 ||
        h <= 540;
      const portrait = hasTouch && h > w && w <= 640;
      setIsTouchViewport(hasTouch);
      setIsPortraitMobile(portrait);
      if (!portrait) {
        setPortraitDismissed(false);
      }
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    window.addEventListener('orientationchange', checkViewport);
    return () => {
      window.removeEventListener('resize', checkViewport);
      window.removeEventListener('orientationchange', checkViewport);
    };
  }, []);

  const showMobileControls = useMemo(() => {
    if (screenState !== 'playing') return false;
    if (settings.touchControls === 'on') return true;
    if (settings.touchControls === 'off') return false;
    return isTouchViewport;
  }, [screenState, settings.touchControls, isTouchViewport]);

  const startMatch = useCallback(() => {
    if (!engineRef.current) return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (isTouchViewport && window.innerHeight > window.innerWidth) {
      void tryLockLandscape();
    }
    engineRef.current.audio.playUiClick();
    engineRef.current.startNewMatch();
    document.body.dataset.state = 'playing';
    setScreenState('playing');
  }, [isTouchViewport, tryLockLandscape]);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const autostart =
      new URLSearchParams(window.location.search).get('autostart') === '1';

    const engine = new ArenaEngine(mount, INITIAL_SETTINGS, {
      onLoadProgress: (p, label) => {
        setLoadProgress(p);
        setLoadLabel(label);
      },
      onStatsUpdate: (nextStats) => {
        setStats(nextStats);
      },
      onBallCamChange: (enabled) => {
        setBallCam(enabled);
      },
      onMatchEnded: (finalStats) => {
        setStats(finalStats);
        document.body.dataset.state = 'gameover';
        setScreenState('gameover');
      },
      onCapabilitiesDetected: (profile, resolved) => {
        setCapabilities(profile);
        setResolvedGraphics(resolved);
      },
    });

    engine.setHudRefs({
      speedEl: speedRef.current,
      boostArcEl: boostArcRef.current,
      boostTextEl: boostTextRef.current,
      supersonicEl: supersonicRef.current,
    });

    engineRef.current = engine;

    const readyTimer = window.setTimeout(() => {
      if (autostart) {
        engine.startNewMatch();
        document.body.dataset.state = 'playing';
        setScreenState('playing');
      } else {
        engine.setScreenState('title');
        document.body.dataset.state = 'title';
        setScreenState('title');
      }
    }, 180);

    return () => {
      window.clearTimeout(readyTimer);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Keep HUD DOM refs synced when MatchHud mounts
  useEffect(() => {
    engineRef.current?.setHudRefs({
      speedEl: speedRef.current,
      boostArcEl: boostArcRef.current,
      boostTextEl: boostTextRef.current,
      supersonicEl: supersonicRef.current,
    });
  }, [screenState]);

  // Global keyboard shortcuts (Title start, Pause, Mute, Reset)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (settingsOpen) {
        if (e.code === 'Escape') {
          setSettingsOpen(false);
        }
        return;
      }

      if (screenRef.current === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        startMatch();
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (screenRef.current === 'playing') {
          engineRef.current?.setScreenState('paused');
          document.body.dataset.state = 'paused';
          setScreenState('paused');
        } else if (screenRef.current === 'paused') {
          engineRef.current?.setScreenState('playing');
          document.body.dataset.state = 'playing';
          setScreenState('playing');
        }
      } else if (e.code === 'KeyM' && screenRef.current === 'playing') {
        setSettings((prev) => {
          const next = { ...prev, muted: !prev.muted };
          engineRef.current?.updateSettings(next);
          return next;
        });
      } else if (e.code === 'KeyR' && screenRef.current === 'playing') {
        engineRef.current?.resetKickoff();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [settingsOpen, startMatch]);

  const handleUpdateSettings = (next: UserSettings) => {
    setSettings(next);
    engineRef.current?.updateSettings(next);
  };

  const handleSelectVehicle = (
    archetype: CarArchetypeId,
    finish: CarFinishOption
  ) => {
    setSelectedArchetype(archetype);
    setSelectedFinish(finish);
    engineRef.current?.audio.playUiClick();
    engineRef.current?.selectVehicle(archetype, finish);
  };

  const handleTouchInput = (partial: Partial<InputState>) => {
    engineRef.current?.setTouchControlsInput(partial);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#07090e]">
      {/* Isolated WebGL Canvas Container */}
      <div
        ref={canvasMountRef}
        className="fixed inset-0 z-0"
        data-testid="arena-canvas-mount"
      />

      {screenState === 'loading' && (
        <LoadingScreen progress={loadProgress} label={loadLabel} />
      )}

      {screenState === 'title' && (
        <TitleScreen
          matchFormat={settings.matchFormat}
          timeOfDay={settings.timeOfDay}
          qualityLabel={resolvedGraphics?.preset ?? settings.graphicsMode}
          onStartMatch={startMatch}
          onOpenGarage={() => {
            engineRef.current?.audio.unlock();
            engineRef.current?.audio.playUiClick();
            engineRef.current?.setScreenState('garage');
            document.body.dataset.state = 'garage';
            setScreenState('garage');
          }}
          onOpenSettings={() => {
            engineRef.current?.audio.unlock();
            engineRef.current?.audio.playUiClick();
            setSettingsOpen(true);
          }}
          onChangeFormat={(matchFormat: MatchFormat) =>
            handleUpdateSettings({ ...settings, matchFormat })
          }
          onChangeTimeOfDay={(timeOfDay: TimeOfDay) =>
            handleUpdateSettings({ ...settings, timeOfDay })
          }
        />
      )}

      {screenState === 'garage' && (
        <GarageOverlay
          selectedArchetype={selectedArchetype}
          selectedFinish={selectedFinish}
          onSelectVehicle={handleSelectVehicle}
          onImportGlb={(file) =>
            engineRef.current
              ? engineRef.current.importCustomGlbVehicle(file)
              : Promise.resolve()
          }
          onPlayNow={startMatch}
          onBack={() => {
            engineRef.current?.audio.playUiClick();
            engineRef.current?.setScreenState('title');
            document.body.dataset.state = 'title';
            setScreenState('title');
          }}
        />
      )}

      {screenState === 'playing' && (
        <>
          <MatchHud
            stats={stats}
            ballCam={ballCam}
            muted={settings.muted}
            showMobileControls={showMobileControls}
            speedRef={speedRef}
            boostArcRef={boostArcRef}
            boostTextRef={boostTextRef}
            supersonicRef={supersonicRef}
            onToggleBallCam={() => engineRef.current?.toggleBallCam()}
            onToggleMute={() =>
              handleUpdateSettings({ ...settings, muted: !settings.muted })
            }
            onPause={() => {
              engineRef.current?.setScreenState('paused');
              document.body.dataset.state = 'paused';
              setScreenState('paused');
            }}
            onResetKickoff={() => engineRef.current?.resetKickoff()}
            onSkipReplay={() => engineRef.current?.skipReplay()}
          />
          {showMobileControls && (
            <MobileControls onInputChange={handleTouchInput} />
          )}
        </>
      )}

      {screenState === 'paused' && (
        <PauseModal
          onResume={() => {
            engineRef.current?.setScreenState('playing');
            document.body.dataset.state = 'playing';
            setScreenState('playing');
          }}
          onRestart={startMatch}
          onOpenSettings={() => setSettingsOpen(true)}
          onExitToMenu={() => {
            engineRef.current?.setScreenState('title');
            document.body.dataset.state = 'title';
            setScreenState('title');
          }}
        />
      )}

      {screenState === 'gameover' && (
        <MatchEndModal
          stats={stats}
          onPlayAgain={startMatch}
          onExitToMenu={() => {
            engineRef.current?.setScreenState('title');
            document.body.dataset.state = 'title';
            setScreenState('title');
          }}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          capabilities={capabilities}
          resolvedGraphics={resolvedGraphics}
          onUpdate={handleUpdateSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {isPortraitMobile && !portraitDismissed && screenState !== 'loading' && (
        <RotatePrompt
          onRequestLandscape={() => {
            void tryLockLandscape();
          }}
          onDismissPortrait={() => setPortraitDismissed(true)}
        />
      )}
    </div>
  );
}
