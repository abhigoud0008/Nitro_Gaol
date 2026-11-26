export type ScreenState =
  | 'loading'
  | 'title'
  | 'garage'
  | 'playing'
  | 'paused'
  | 'gameover';

export type GraphicsPreset = 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';
export type GraphicsSettingMode = 'AUTO' | GraphicsPreset;
export type TimeOfDay = 'night' | 'sunset' | 'day';
export type MatchFormat = '1v1' | '2v2';
export type TouchControlsMode = 'auto' | 'on' | 'off';

export type CarArchetypeId = 'apex-gt' | 'valkyrie-aero' | 'titan-v8';

export interface CarFinishOption {
  id: string;
  name: string;
  primaryColor: string;
  accentColor: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
  rimColor: string;
}

export interface CarArchetypeSpec {
  id: CarArchetypeId;
  name: string;
  subtitle: string;
  topSpeed: number;
  boostAccel: number;
  handling: number;
  mass: number;
  length: number;
  width: number;
  height: number;
}

export interface GraphicsCapabilitiesProfile {
  isSoftwareGl: boolean;
  isMobile: boolean;
  deviceMemoryGb: number;
  hardwareConcurrency: number;
  maxTextureSize: number;
  devicePixelRatio: number;
}

export interface ResolvedGraphicsConfig {
  preset: GraphicsPreset;
  pixelRatio: number;
  textureSize: number;
  anisotropy: number;
  shadowsEnabled: boolean;
  shadowMapSize: number;
  envMapEnabled: boolean;
  advancedMaterials: boolean;
  bloomEnabled: boolean;
  bloomStrength: number;
  ssaoEnabled: boolean;
  antiAliasing: 'none' | 'fxaa' | 'smaa';
  motionBlurEnabled: boolean;
  depthOfFieldEnabled: boolean;
  particleBudget: number;
  crowdInstanceCount: number;
  adaptiveResolution: boolean;
}

export interface UserSettings {
  graphicsMode: GraphicsSettingMode;
  timeOfDay: TimeOfDay;
  matchFormat: MatchFormat;
  motionBlur: boolean;
  depthOfField: boolean;
  goalReplays: boolean;
  touchControls: TouchControlsMode;
  muted: boolean;
}

export interface InputState {
  throttle: number; // -1 to 1
  steer: number; // -1 (right) to 1 (left)
  boost: boolean;
  jumpJustPressed: boolean;
  jumpHeld: boolean;
  handbrake: boolean;
  ballCamToggleJustPressed: boolean;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CarPhysicsState {
  id: string;
  team: 'blue' | 'amber';
  isPlayer: boolean;
  archetype: CarArchetypeId;
  pos: Vec3;
  vel: Vec3;
  yaw: number;
  pitch: number;
  roll: number;
  angularVelYaw: number;
  steerAngle: number;
  wheelSpin: number;
  suspensionCompression: [number, number, number, number];
  grounded: boolean;
  airJumpsLeft: number;
  boost: number; // 0..100
  isBoosting: boolean;
  isDrifting: boolean;
  speedKmh: number;
  aiRole: 'striker' | 'sweeper';
  flipTimer: number;
  flipPitchRate: number;
  flipRollRate: number;
  lastTouchTime: number;
}

export interface BallPhysicsState {
  pos: Vec3;
  vel: Vec3;
  angVel: Vec3;
  radius: number;
  lastTouchTeam: 'blue' | 'amber' | null;
  lastTouchCarId: string | null;
}

export interface BoostPadState {
  id: string;
  x: number;
  z: number;
  isLarge: boolean;
  amount: number;
  active: boolean;
  respawnTimer: number;
}

export interface MatchStats {
  blueScore: number;
  amberScore: number;
  playerGoals: number;
  playerShots: number;
  playerSaves: number;
  topSpeedKmh: number;
  boostCollected: number;
  timeRemaining: number;
  isOvertime: boolean;
  matchPhase: 'kickoff' | 'live' | 'goal' | 'replay' | 'ended';
  kickoffCountdown: number;
  goalBannerTimer: number;
  lastScoringTeam: 'blue' | 'amber' | null;
  lastScorerName: string;
}

export interface PhysicsEvent {
  type:
    | 'car-ball-hit'
    | 'car-car-hit'
    | 'wall-hit'
    | 'jump'
    | 'land'
    | 'boost-pickup'
    | 'goal'
    | 'countdown-tick'
    | 'kickoff-go';
  pos: Vec3;
  intensity: number;
  team?: 'blue' | 'amber';
  scorerName?: string;
}

export interface ReplayFrame {
  time: number;
  ballPos: Vec3;
  ballVel: Vec3;
  cars: Array<{
    id: string;
    pos: Vec3;
    yaw: number;
    pitch: number;
    roll: number;
    isBoosting: boolean;
    steerAngle: number;
    wheelSpin: number;
  }>;
}

export const CAR_ARCHETYPES: Record<CarArchetypeId, CarArchetypeSpec> = {
  'apex-gt': {
    id: 'apex-gt',
    name: 'Apex GT',
    subtitle: 'Balanced Aero Coupe',
    topSpeed: 39,
    boostAccel: 29,
    handling: 1.04,
    mass: 1.0,
    length: 4.5,
    width: 2.08,
    height: 1.24,
  },
  'valkyrie-aero': {
    id: 'valkyrie-aero',
    name: 'Valkyrie Aero',
    subtitle: 'Low-Drag Prototype',
    topSpeed: 41.5,
    boostAccel: 30.5,
    handling: 1.12,
    mass: 0.94,
    length: 4.7,
    width: 2.04,
    height: 1.14,
  },
  'titan-v8': {
    id: 'titan-v8',
    name: 'Titan V8',
    subtitle: 'Heavy Strike Interceptor',
    topSpeed: 38,
    boostAccel: 28,
    handling: 0.96,
    mass: 1.14,
    length: 4.65,
    width: 2.22,
    height: 1.36,
  },
};

export const CAR_FINISHES: CarFinishOption[] = [
  {
    id: 'cobalt-metallic',
    name: 'Cobalt Carbon',
    primaryColor: '#1d5cff',
    accentColor: '#38bdf8',
    metalness: 0.88,
    roughness: 0.22,
    clearcoat: 1.0,
    rimColor: '#cbd5e1',
  },
  {
    id: 'solar-amber',
    name: 'Solar Amber',
    primaryColor: '#f59e0b',
    accentColor: '#fde68a',
    metalness: 0.86,
    roughness: 0.2,
    clearcoat: 1.0,
    rimColor: '#1e293b',
  },
  {
    id: 'crimson-alloy',
    name: 'Crimson Alloy',
    primaryColor: '#dc2626',
    accentColor: '#fb7185',
    metalness: 0.9,
    roughness: 0.18,
    clearcoat: 1.0,
    rimColor: '#e2e8f0',
  },
  {
    id: 'emerald-gt',
    name: 'British Emerald',
    primaryColor: '#059669',
    accentColor: '#6ee7b7',
    metalness: 0.84,
    roughness: 0.24,
    clearcoat: 1.0,
    rimColor: '#d4af37',
  },
  {
    id: 'obsidian-stealth',
    name: 'Obsidian Satin',
    primaryColor: '#181c26',
    accentColor: '#38bdf8',
    metalness: 0.72,
    roughness: 0.36,
    clearcoat: 0.65,
    rimColor: '#94a3b8',
  },
  {
    id: 'titanium-pearl',
    name: 'Titanium Pearl',
    primaryColor: '#cbd5e1',
    accentColor: '#0284c7',
    metalness: 0.92,
    roughness: 0.16,
    clearcoat: 1.0,
    rimColor: '#0f172a',
  },
];
