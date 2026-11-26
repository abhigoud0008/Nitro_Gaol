import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

import {
  CAR_FINISHES,
  CarArchetypeId,
  CarFinishOption,
  GraphicsCapabilitiesProfile,
  InputState,
  MatchStats,
  ReplayFrame,
  ResolvedGraphicsConfig,
  ScreenState,
  UserSettings,
} from './types';
import { probeCapabilities, resolveGraphicsConfig } from './graphicsConfig';
import {
  ARENA_HALF_LENGTH,
  ARENA_HALF_WIDTH,
  MatchSimulation,
  createMatchSimulation,
  resetKickoffPositions,
  stepMatchSimulation,
} from './physics';
import {
  ProceduralTextureSet,
  createProceduralTextureSet,
  drawJumbotronScoreboard,
  drawLedAdBanner,
} from './textures';
import { ArenaAssetLoader } from './assetLoader';
import { VehicleRig, buildVehicleRig } from './vehicles';
import { FootballRig, buildFootballRig } from './football';
import { ArenaParticleSystem } from './particles';
import { StadiumRig, buildStadium } from './stadium';
import { ArenaAudioEngine } from './audio';

const ColorGradingSpeedShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSpeedAmount: { value: 0.0 },
    uContrast: { value: 1.06 },
    uSaturation: { value: 1.08 },
    uVignette: { value: 0.28 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uSpeedAmount;
    uniform float uContrast;
    uniform float uSaturation;
    uniform float uVignette;
    varying vec2 vUv;

    void main() {
      vec2 dir = vUv - vec2(0.5);
      float dist = length(dir);
      vec4 col = texture2D(tDiffuse, vUv);

      if (uSpeedAmount > 0.01) {
        vec2 blurStep = dir * (uSpeedAmount * 0.016 * dist);
        vec4 s1 = texture2D(tDiffuse, vUv - blurStep);
        vec4 s2 = texture2D(tDiffuse, vUv - blurStep * 2.0);
        col = mix(col, (col + s1 + s2) / 3.0, clamp(uSpeedAmount * dist * 1.4, 0.0, 0.75));
      }

      // Contrast & saturation grading
      vec3 rgb = (col.rgb - 0.5) * uContrast + 0.5;
      float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
      rgb = mix(vec3(luma), rgb, uSaturation);

      // Subtle cinematic vignette
      float vig = smoothstep(0.35, 0.98, dist) * uVignette;
      rgb *= (1.0 - vig);

      gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), col.a);
    }
  `,
};

export interface LiveHudDomRefs {
  speedEl: HTMLElement | null;
  boostArcEl: SVGCircleElement | null;
  boostTextEl: HTMLElement | null;
  supersonicEl: HTMLElement | null;
}

export interface EngineCallbacks {
  onLoadProgress: (progress: number, label: string) => void;
  onStatsUpdate: (stats: MatchStats) => void;
  onBallCamChange: (enabled: boolean) => void;
  onMatchEnded: (stats: MatchStats) => void;
  onCapabilitiesDetected: (
    profile: GraphicsCapabilitiesProfile,
    resolved: ResolvedGraphicsConfig
  ) => void;
}

const _camDesired = new THREE.Vector3();
const _camTarget = new THREE.Vector3();

export class ArenaEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private hudRefs: LiveHudDomRefs = {
    speedEl: null,
    boostArcEl: null,
    boostTextEl: null,
    supersonicEl: null,
  };

  public readonly capabilities: GraphicsCapabilitiesProfile;
  public graphicsConfig: ResolvedGraphicsConfig;
  public readonly audio = new ArenaAudioEngine();

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private ssaoPass: SSAOPass | null = null;
  private bokehPass: BokehPass | null = null;
  private gradingPass: ShaderPass | null = null;
  private fxaaPass: ShaderPass | null = null;
  private smaaPass: SMAAPass | null = null;

  private textures: ProceduralTextureSet;
  private assetLoader: ArenaAssetLoader;
  private stadium: StadiumRig;
  private football: FootballRig;
  private particles: ArenaParticleSystem;
  private carRigs = new Map<string, VehicleRig>();
  private showcaseRig: VehicleRig | null = null;
  private customCarModel: THREE.Group | null = null;
  private garageTurntable: THREE.Group;
  private softboxLights: THREE.RectAreaLight[] = [];

  private sim: MatchSimulation;
  private settings: UserSettings;
  private selectedArchetype: CarArchetypeId = 'apex-gt';
  private selectedFinish: CarFinishOption = CAR_FINISHES[0];
  private screenState: ScreenState = 'loading';
  private ballCam = true;

  // Input state (keyboard + touch combined)
  private keys = new Set<string>();
  private touchInput: Partial<InputState> = {};
  private jumpQueued = false;
  private ballCamQueued = false;

  // Garage orbit controls
  private garageYaw = 0.72;
  private garagePitch = 0.22;
  private garageDist = 5.6;
  private isDraggingGarage = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // Camera & Juice
  private camPos = new THREE.Vector3(0, 8, -35);
  private camLook = new THREE.Vector3(0, 1.5, 0);
  private cameraTrauma = 0;
  private lastHudPushTime = 0;
  private lastJumbotronKey = '';
  private lastScoreHash = '';
  private replayBuffer: ReplayFrame[] = [];
  private replayPlaybackIndex = 0;
  private replayTimer = 0;

  // Loop & adaptive perf
  private frameId = 0;
  private lastTime = 0;
  private elapsedTime = 0;
  private frameTimes: number[] = [];
  private adaptiveScale = 1.0;
  private disposed = false;

  constructor(
    container: HTMLElement,
    initialSettings: UserSettings,
    callbacks: EngineCallbacks
  ) {
    this.container = container;
    this.settings = { ...initialSettings };
    this.callbacks = callbacks;

    this.capabilities = probeCapabilities();
    this.graphicsConfig = resolveGraphicsConfig(
      this.settings.graphicsMode,
      this.capabilities,
      {
        motionBlur: this.settings.motionBlur,
        depthOfField: this.settings.depthOfField,
      }
    );
    callbacks.onCapabilitiesDetected(this.capabilities, this.graphicsConfig);
    callbacks.onLoadProgress(15, 'Initializing WebGL Renderer');

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.capabilities.isSoftwareGl && this.graphicsConfig.preset !== 'LOW',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.68;
    this.renderer.setPixelRatio(this.graphicsConfig.pixelRatio);
    this.renderer.setSize(container.clientWidth || 1280, container.clientHeight || 720);
    this.renderer.shadowMap.enabled = this.graphicsConfig.shadowsEnabled;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      62,
      (container.clientWidth || 1280) / (container.clientHeight || 720),
      0.2,
      1150
    );

    // Calibrated low-glare studio IBL environment map
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.28;
    pmrem.dispose();

    // Subtle studio softbox highlights on GPU
    if (!this.capabilities.isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const sb1 = new THREE.RectAreaLight(0xffffff, 0.65, 8, 3);
      sb1.position.set(0, 5.8, 3.5);
      sb1.lookAt(0, 0.8, 0);
      const sb2 = new THREE.RectAreaLight(0x38bdf8, 0.45, 8, 2.5);
      sb2.position.set(-5.5, 3.4, -3.5);
      sb2.lookAt(0, 0.8, 0);
      this.scene.add(sb1, sb2);
      this.softboxLights.push(sb1, sb2);
    }

    callbacks.onLoadProgress(40, 'Generating Procedural PBR Textures');
    this.textures = createProceduralTextureSet(
      this.graphicsConfig.textureSize,
      Math.min(
        this.graphicsConfig.anisotropy,
        this.renderer.capabilities.getMaxAnisotropy()
      )
    );
    this.assetLoader = new ArenaAssetLoader(this.renderer);

    callbacks.onLoadProgress(65, 'Building Esports Stadium');
    this.sim = createMatchSimulation(this.selectedArchetype, this.settings.matchFormat);
    this.stadium = buildStadium(this.textures, this.graphicsConfig, this.sim.boostPads);
    this.stadium.applyTimeOfDay(this.scene, this.settings.timeOfDay);
    this.scene.add(this.stadium.root);

    this.football = buildFootballRig(this.textures, this.graphicsConfig);
    this.scene.add(this.football.root);

    this.particles = new ArenaParticleSystem(this.graphicsConfig.particleBudget);
    this.scene.add(this.particles.group);

    // Garage Rotating Turntable Platform at center field
    this.garageTurntable = this.createGarageTurntable();
    this.scene.add(this.garageTurntable);

    callbacks.onLoadProgress(85, 'Assembling Sports Vehicles');
    this.rebuildMatchCars();
    this.rebuildShowcaseCar();
    this.rebuildPostProcessing();

    if (!this.capabilities.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    drawJumbotronScoreboard(
      this.textures.jumbotronCtx,
      this.textures.jumbotronTexture,
      0,
      0,
      this.sim.stats.timeRemaining,
      false
    );

    this.bindEvents();
    callbacks.onLoadProgress(100, 'Arena Ready');
    this.lastTime = performance.now();
    this.tick();
  }

  private createGarageTurntable(): THREE.Group {
    const g = new THREE.Group();
    const baseGeom = new THREE.CylinderGeometry(4.4, 4.7, 0.24, 48);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0b101b,
      metalness: 0.42,
      roughness: 0.68,
    });
    const base = new THREE.Mesh(baseGeom, baseMat);
    base.position.y = 0.12;
    base.receiveShadow = true;

    const ringGeom = new THREE.RingGeometry(4.28, 4.45, 48);
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.position.y = 0.25;

    const innerRingGeom = new THREE.RingGeometry(2.85, 2.94, 48);
    innerRingGeom.rotateX(-Math.PI / 2);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0x1e3a5f,
      side: THREE.DoubleSide,
    });
    const innerRing = new THREE.Mesh(innerRingGeom, innerRingMat);
    innerRing.position.y = 0.248;

    g.add(base, ring, innerRing);
    g.visible = true;
    return g;
  }

  private rebuildPostProcessing(): void {
    if (this.composer) {
      this.composer.dispose();
      this.composer = null;
      this.bloomPass = null;
      this.ssaoPass = null;
      this.bokehPass = null;
      this.gradingPass = null;
      this.fxaaPass = null;
      this.smaaPass = null;
    }

    if (
      this.capabilities.isSoftwareGl ||
      this.graphicsConfig.preset === 'LOW'
    ) {
      return;
    }

    const w = this.container.clientWidth || 1280;
    const h = this.container.clientHeight || 720;
    const pr = this.renderer.getPixelRatio();

    const composer = new EffectComposer(this.renderer);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    composer.addPass(new RenderPass(this.scene, this.camera));

    if (this.graphicsConfig.ssaoEnabled) {
      const ssao = new SSAOPass(this.scene, this.camera, w, h);
      ssao.kernelRadius = 10;
      ssao.minDistance = 0.005;
      ssao.maxDistance = 0.12;
      composer.addPass(ssao);
      this.ssaoPass = ssao;
    }

    if (this.graphicsConfig.bloomEnabled) {
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(w * 0.5, h * 0.5),
        this.graphicsConfig.bloomStrength,
        0.25,
        0.96
      );
      composer.addPass(bloom);
      this.bloomPass = bloom;
    }

    if (this.graphicsConfig.depthOfFieldEnabled) {
      const bokeh = new BokehPass(this.scene, this.camera, {
        focus: 14.0,
        aperture: 0.00018,
        maxblur: 0.008,
      });
      composer.addPass(bokeh);
      this.bokehPass = bokeh;
    }

    const grading = new ShaderPass(ColorGradingSpeedShader);
    composer.addPass(grading);
    this.gradingPass = grading;

    composer.addPass(new OutputPass());

    if (this.graphicsConfig.antiAliasing === 'smaa') {
      const smaa = new SMAAPass();
      composer.addPass(smaa);
      this.smaaPass = smaa;
    } else if (this.graphicsConfig.antiAliasing === 'fxaa') {
      const fxaa = new ShaderPass(FXAAShader);
      fxaa.material.uniforms['resolution'].value.set(1 / (w * pr), 1 / (h * pr));
      composer.addPass(fxaa);
      this.fxaaPass = fxaa;
    }

    this.composer = composer;
  }

  private rebuildShowcaseCar(): void {
    if (this.showcaseRig) {
      this.garageTurntable.remove(this.showcaseRig.root);
      this.showcaseRig.dispose();
      this.showcaseRig = null;
    }
    const rig = buildVehicleRig(
      this.selectedArchetype,
      this.selectedFinish,
      this.textures,
      this.graphicsConfig,
      this.selectedFinish.accentColor
    );
    rig.root.position.set(0, 0.24, 0);
    if (this.customCarModel) {
      rig.bodyGroup.visible = false;
      const cloned = this.customCarModel.clone();
      rig.root.add(cloned);
    }
    this.garageTurntable.add(rig.root);
    this.showcaseRig = rig;
  }

  private rebuildMatchCars(): void {
    for (const rig of this.carRigs.values()) {
      this.scene.remove(rig.root);
      rig.dispose();
    }
    this.carRigs.clear();

    const aiBlueFinish = CAR_FINISHES[0];
    const aiAmberFinish = CAR_FINISHES[1];
    const aiAmberAlt = CAR_FINISHES[2];

    for (const car of this.sim.cars) {
      const finish = car.isPlayer
        ? this.selectedFinish
        : car.team === 'blue'
          ? aiBlueFinish
          : car.id === 'amber-1'
            ? aiAmberFinish
            : aiAmberAlt;

      const rig = buildVehicleRig(
        car.archetype,
        finish,
        this.textures,
        this.graphicsConfig,
        car.team === 'blue' ? '#38bdf8' : '#f59e0b'
      );

      if (car.isPlayer && this.customCarModel) {
        rig.bodyGroup.visible = false;
        rig.root.add(this.customCarModel.clone());
      }

      this.scene.add(rig.root);
      this.carRigs.set(car.id, rig);
    }
  }

  public setHudRefs(refs: LiveHudDomRefs): void {
    this.hudRefs = refs;
  }

  public setScreenState(next: ScreenState): void {
    this.screenState = next;
    const isMenuOrGarage = next === 'title' || next === 'garage' || next === 'loading';
    this.garageTurntable.visible = isMenuOrGarage;
    this.football.root.visible = !isMenuOrGarage;

    for (const rig of this.carRigs.values()) {
      rig.root.visible = !isMenuOrGarage;
    }

    for (const sb of this.softboxLights) {
      sb.intensity = isMenuOrGarage ? 0.65 : 0;
    }

    if (next !== 'playing') {
      this.audio.updateVehicleLoop(false, 0, false);
      this.keys.clear();
    }
  }

  private snapCameraBehindPlayer(): void {
    const playerCar = this.sim.cars.find((c) => c.isPlayer) ?? this.sim.cars[0];
    if (!playerCar) return;
    const fwdX = Math.sin(playerCar.yaw);
    const fwdZ = Math.cos(playerCar.yaw);
    this.camPos.set(
      playerCar.pos.x - fwdX * 10.5,
      playerCar.pos.y + 4.2,
      playerCar.pos.z - fwdZ * 10.5
    );
    this.camLook.set(0, 1.8, 0);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  public startNewMatch(): void {
    this.audio.unlock();
    this.sim = createMatchSimulation(
      this.selectedArchetype,
      this.settings.matchFormat
    );
    this.rebuildMatchCars();
    this.replayBuffer = [];
    this.setScreenState('playing');
    this.snapCameraBehindPlayer();
    this.callbacks.onStatsUpdate({ ...this.sim.stats });
  }

  public resetKickoff(): void {
    resetKickoffPositions(this.sim, this.settings.matchFormat);
    this.replayBuffer = [];
    this.snapCameraBehindPlayer();
    this.callbacks.onStatsUpdate({ ...this.sim.stats });
  }

  public skipReplay(): void {
    if (this.sim.stats.matchPhase === 'replay') {
      resetKickoffPositions(this.sim, this.settings.matchFormat);
      this.snapCameraBehindPlayer();
      this.callbacks.onStatsUpdate({ ...this.sim.stats });
    }
  }

  public selectVehicle(archetype: CarArchetypeId, finish: CarFinishOption): void {
    this.selectedArchetype = archetype;
    this.selectedFinish = finish;
    this.customCarModel = null;
    this.rebuildShowcaseCar();
    if (this.screenState === 'playing') {
      this.rebuildMatchCars();
    }
  }

  public async importCustomGlbVehicle(file: File): Promise<void> {
    const model = await this.assetLoader.loadVehicleFromFile(file);
    this.customCarModel = model;
    this.rebuildShowcaseCar();
  }

  public updateSettings(next: UserSettings): void {
    const prevTime = this.settings.timeOfDay;
    const prevGraphics = this.settings.graphicsMode;
    const prevMotion = this.settings.motionBlur;
    const prevDof = this.settings.depthOfField;

    this.settings = { ...next };
    this.audio.setMuted(next.muted);

    if (prevTime !== next.timeOfDay) {
      this.stadium.applyTimeOfDay(this.scene, next.timeOfDay);
    }

    if (
      prevGraphics !== next.graphicsMode ||
      prevMotion !== next.motionBlur ||
      prevDof !== next.depthOfField
    ) {
      this.graphicsConfig = resolveGraphicsConfig(
        next.graphicsMode,
        this.capabilities,
        { motionBlur: next.motionBlur, depthOfField: next.depthOfField }
      );
      this.adaptiveScale = 1.0;
      this.renderer.setPixelRatio(this.graphicsConfig.pixelRatio);
      this.renderer.shadowMap.enabled = this.graphicsConfig.shadowsEnabled;
      this.stadium.keyLight.castShadow = this.graphicsConfig.shadowsEnabled;
      this.rebuildPostProcessing();
      this.rebuildShowcaseCar();
      this.callbacks.onCapabilitiesDetected(this.capabilities, this.graphicsConfig);
    }
  }

  public setTouchControlsInput(partial: Partial<InputState>): void {
    Object.assign(this.touchInput, partial);
    if (partial.jumpJustPressed) {
      this.jumpQueued = true;
    }
  }

  public toggleBallCam(): void {
    this.ballCam = !this.ballCam;
    this.callbacks.onBallCamChange(this.ballCam);
  }

  private gatherPlayerInput(): InputState {
    let throttle = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) throttle += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) throttle -= 1;
    if (this.touchInput.throttle !== undefined && this.touchInput.throttle !== 0) {
      throttle = this.touchInput.throttle;
    }

    let steer = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) steer += 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) steer -= 1;
    if (this.touchInput.steer !== undefined && this.touchInput.steer !== 0) {
      steer = this.touchInput.steer;
    }

    const boost =
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight') ||
      this.keys.has('KeyJ') ||
      Boolean(this.touchInput.boost);

    const handbrake =
      this.keys.has('KeyE') ||
      this.keys.has('ControlLeft') ||
      Boolean(this.touchInput.handbrake);

    const jumpJustPressed = this.jumpQueued;
    this.jumpQueued = false;

    const ballCamToggleJustPressed = this.ballCamQueued;
    this.ballCamQueued = false;

    return {
      throttle,
      steer,
      boost,
      jumpJustPressed,
      jumpHeld: this.keys.has('Space') || Boolean(this.touchInput.jumpHeld),
      handbrake,
      ballCamToggleJustPressed,
    };
  }

  private bindEvents(): void {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space') {
        this.jumpQueued = true;
      }
      if (e.code === 'KeyC') {
        this.ballCamQueued = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };

    const onBlur = () => {
      this.keys.clear();
      this.touchInput = {};
    };

    const onPointerDown = (e: PointerEvent) => {
      this.audio.unlock();
      if (this.screenState === 'garage') {
        this.isDraggingGarage = true;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!this.isDraggingGarage || this.screenState !== 'garage') return;
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.garageYaw -= dx * 0.008;
      this.garagePitch = THREE.MathUtils.clamp(
        this.garagePitch + dy * 0.005,
        0.08,
        0.72
      );
    };

    const onPointerUp = () => {
      this.isDraggingGarage = false;
    };

    const onWheel = (e: WheelEvent) => {
      if (this.screenState === 'garage') {
        this.garageDist = THREE.MathUtils.clamp(
          this.garageDist + e.deltaY * 0.004,
          4.8,
          12.0
        );
      }
    };

    const onResize = () => {
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      if (this.composer) {
        this.composer.setSize(w, h);
        const pr = this.renderer.getPixelRatio();
        if (this.fxaaPass) {
          this.fxaaPass.material.uniforms['resolution'].value.set(
            1 / (w * pr),
            1 / (h * pr)
          );
        }
        if (this.bloomPass) {
          this.bloomPass.resolution.set(w * 0.5, h * 0.5);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onResize);
    this.renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    this.renderer.domElement.addEventListener('wheel', onWheel, { passive: true });

    this.cleanupEvents = () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onResize);
      this.renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      this.renderer.domElement.removeEventListener('wheel', onWheel);
    };
  }

  private cleanupEvents: () => void = () => {};

  private recordReplayFrame(): void {
    this.replayBuffer.push({
      time: this.sim.simTime,
      ballPos: { ...this.sim.ball.pos },
      ballVel: { ...this.sim.ball.vel },
      cars: this.sim.cars.map((c) => ({
        id: c.id,
        pos: { ...c.pos },
        yaw: c.yaw,
        pitch: c.pitch,
        roll: c.roll,
        isBoosting: c.isBoosting,
        steerAngle: c.steerAngle,
        wheelSpin: c.wheelSpin,
      })),
    });
    if (this.replayBuffer.length > 210) {
      this.replayBuffer.shift();
    }
  }

  private stepGameplay(dt: number): void {
    if (this.sim.stats.matchPhase === 'replay') {
      this.replayTimer += dt;
      const frameIdx = Math.min(
        this.replayBuffer.length - 1,
        Math.floor(this.replayTimer * 52)
      );
      this.replayPlaybackIndex = frameIdx;
      const frame = this.replayBuffer[frameIdx];
      if (frame) {
        this.football.updateVisuals(
          frame.ballPos.x,
          frame.ballPos.y,
          frame.ballPos.z,
          frame.ballVel.x,
          frame.ballVel.z,
          dt
        );
        for (const cState of frame.cars) {
          const rig = this.carRigs.get(cState.id);
          if (!rig) continue;
          rig.root.position.set(cState.pos.x, cState.pos.y - 0.56, cState.pos.z);
          rig.root.rotation.set(cState.pitch, cState.yaw, cState.roll, 'YXZ');
          rig.updateVisuals({
            wheelSpin: cState.wheelSpin,
            steerAngle: cState.steerAngle,
            suspensionCompression: [0.05, 0.05, 0.05, 0.05],
            isBraking: false,
            isBoosting: cState.isBoosting,
            altitude: cState.pos.y - 0.56,
            time: this.elapsedTime,
          });
        }
        // Cinematic sideline broadcast camera during replay
        _camDesired.set(
          frame.ballPos.x * 0.4 + 18,
          7.5,
          frame.ballPos.z * 0.65 - 12
        );
        this.camPos.lerp(_camDesired, 1 - Math.exp(-5 * dt));
        this.camLook.lerp(
          _camTarget.set(frame.ballPos.x, frame.ballPos.y, frame.ballPos.z),
          1 - Math.exp(-8 * dt)
        );
        this.camera.position.copy(this.camPos);
        this.camera.lookAt(this.camLook);
      }
      if (frameIdx >= this.replayBuffer.length - 1) {
        resetKickoffPositions(this.sim, this.settings.matchFormat);
        this.snapCameraBehindPlayer();
        this.callbacks.onStatsUpdate({ ...this.sim.stats });
      }
      return;
    }

    const input = this.gatherPlayerInput();
    if (input.ballCamToggleJustPressed) {
      this.toggleBallCam();
    }

    const prevPhase = this.sim.stats.matchPhase;
    stepMatchSimulation(this.sim, input, dt, this.settings.matchFormat);

    if (this.sim.stats.matchPhase === 'live') {
      this.recordReplayFrame();
    }

    // Handle goal celebration -> replay or kickoff transition
    if (this.sim.stats.matchPhase === 'goal' && this.sim.stats.goalBannerTimer <= 0) {
      if (this.settings.goalReplays && this.replayBuffer.length > 30) {
        this.sim.stats.matchPhase = 'replay';
        this.replayTimer = 0;
        this.replayPlaybackIndex = 0;
        this.callbacks.onStatsUpdate({ ...this.sim.stats });
      } else {
        resetKickoffPositions(this.sim, this.settings.matchFormat);
        this.snapCameraBehindPlayer();
        this.callbacks.onStatsUpdate({ ...this.sim.stats });
      }
    }

    if (prevPhase !== 'ended' && this.sim.stats.matchPhase === 'ended') {
      this.audio.updateVehicleLoop(false, 0, false);
      this.callbacks.onMatchEnded({ ...this.sim.stats });
    }

    // Process physics events for audio, camera shake & particles
    for (const ev of this.sim.events) {
      if (ev.type === 'car-ball-hit') {
        this.audio.playImpact(ev.intensity, 'ball');
        this.cameraTrauma = Math.min(1, this.cameraTrauma + ev.intensity * 0.42);
        this.particles.emitCollisionSparks(ev.pos.x, ev.pos.y, ev.pos.z, 12);
      } else if (ev.type === 'car-car-hit') {
        this.audio.playImpact(ev.intensity, 'car');
        this.cameraTrauma = Math.min(1, this.cameraTrauma + ev.intensity * 0.35);
        this.particles.emitCollisionSparks(ev.pos.x, ev.pos.y, ev.pos.z, 10);
      } else if (ev.type === 'wall-hit') {
        this.audio.playImpact(ev.intensity, 'wall');
        this.particles.emitCollisionSparks(ev.pos.x, ev.pos.y, ev.pos.z, 6);
      } else if (ev.type === 'jump') {
        this.audio.playJump(ev.intensity > 0.85);
      } else if (ev.type === 'boost-pickup') {
        this.audio.playBoostPickup(ev.intensity > 0.8);
      } else if (ev.type === 'countdown-tick') {
        this.audio.playCountdownBeep(false);
      } else if (ev.type === 'kickoff-go') {
        this.audio.playCountdownBeep(true);
      } else if (ev.type === 'goal') {
        this.audio.playGoalHorn();
        this.cameraTrauma = 0.95;
        this.particles.emitGoalExplosion(
          ev.pos.x,
          ev.pos.y,
          ev.pos.z,
          ev.team ?? 'blue'
        );
      }
    }

    // Sync car meshes & particles
    let playerCar = this.sim.cars[0];
    for (const car of this.sim.cars) {
      if (car.isPlayer) playerCar = car;
      const rig = this.carRigs.get(car.id);
      if (!rig) continue;

      rig.root.position.set(car.pos.x, car.pos.y - 0.56, car.pos.z);
      rig.root.rotation.set(car.pitch, car.yaw, car.roll, 'YXZ');
      rig.updateVisuals({
        wheelSpin: car.wheelSpin,
        steerAngle: car.steerAngle,
        suspensionCompression: car.suspensionCompression,
        isBraking: car.isPlayer ? input.throttle < -0.1 : false,
        isBoosting: car.isBoosting,
        altitude: car.pos.y - 0.56,
        time: this.elapsedTime,
      });

      if (car.isBoosting) {
        this.particles.emitNitroTrail(
          car.pos.x,
          car.pos.y - 0.56,
          car.pos.z,
          Math.sin(car.yaw),
          Math.cos(car.yaw)
        );
      }
      if (car.grounded && (car.isDrifting || (car.isBoosting && Math.random() < 0.35))) {
        this.particles.emitTireSmokeAndGrass(
          car.pos.x,
          car.pos.z,
          car.yaw,
          car.isDrifting
        );
      }
    }

    // Sync football mesh
    this.football.updateVisuals(
      this.sim.ball.pos.x,
      this.sim.ball.pos.y,
      this.sim.ball.pos.z,
      this.sim.ball.vel.x,
      this.sim.ball.vel.z,
      dt
    );

    // Sync audio engine loop & direct DOM HUD refs (zero React 60Hz re-renders)
    this.audio.updateVehicleLoop(
      this.sim.stats.matchPhase === 'live',
      playerCar.speedKmh,
      playerCar.isBoosting
    );

    if (this.hudRefs.speedEl) {
      this.hudRefs.speedEl.textContent = String(playerCar.speedKmh);
    }
    if (this.hudRefs.boostTextEl) {
      this.hudRefs.boostTextEl.textContent = String(Math.round(playerCar.boost));
    }
    if (this.hudRefs.boostArcEl) {
      const circumference = 251.2;
      const offset = circumference * (1 - playerCar.boost / 100);
      this.hudRefs.boostArcEl.style.strokeDashoffset = offset.toFixed(1);
    }
    if (this.hudRefs.supersonicEl) {
      const showSpeedLines = playerCar.isBoosting && playerCar.speedKmh > 110;
      this.hudRefs.supersonicEl.style.opacity = showSpeedLines ? '1' : '0';
    }
    if (this.gradingPass) {
      const speedAmt =
        this.graphicsConfig.motionBlurEnabled && playerCar.isBoosting
          ? THREE.MathUtils.clamp((playerCar.speedKmh - 75) / 70, 0, 1)
          : 0;
      this.gradingPass.uniforms['uSpeedAmount'].value = speedAmt;
    }

    // Chase Cam / Ball Cam with wall pull-in & trauma shake
    if (this.ballCam) {
      const toBallX = this.sim.ball.pos.x - playerCar.pos.x;
      const toBallZ = this.sim.ball.pos.z - playerCar.pos.z;
      const dist = Math.hypot(toBallX, toBallZ) || 1;
      const dirX = toBallX / dist;
      const dirZ = toBallZ / dist;
      _camDesired.set(
        playerCar.pos.x - dirX * 9.8,
        playerCar.pos.y + 3.9,
        playerCar.pos.z - dirZ * 9.8
      );
      _camTarget.set(
        playerCar.pos.x * 0.42 + this.sim.ball.pos.x * 0.58,
        playerCar.pos.y * 0.4 + this.sim.ball.pos.y * 0.6 + 0.8,
        playerCar.pos.z * 0.42 + this.sim.ball.pos.z * 0.58
      );
    } else {
      const fwdX = Math.sin(playerCar.yaw);
      const fwdZ = Math.cos(playerCar.yaw);
      _camDesired.set(
        playerCar.pos.x - fwdX * 9.5,
        playerCar.pos.y + 3.6,
        playerCar.pos.z - fwdZ * 9.5
      );
      _camTarget.set(
        playerCar.pos.x + fwdX * 8,
        playerCar.pos.y + 1.4,
        playerCar.pos.z + fwdZ * 8
      );
    }

    // Clamp camera inside stadium walls so it never clips outside glass
    _camDesired.x = THREE.MathUtils.clamp(
      _camDesired.x,
      -ARENA_HALF_WIDTH + 1.4,
      ARENA_HALF_WIDTH - 1.4
    );
    _camDesired.z = THREE.MathUtils.clamp(
      _camDesired.z,
      -ARENA_HALF_LENGTH + 1.4,
      ARENA_HALF_LENGTH - 1.4
    );
    _camDesired.y = Math.max(1.8, _camDesired.y);

    const damp = 1 - Math.exp(-9.5 * dt);
    this.camPos.lerp(_camDesired, damp);
    this.camLook.lerp(_camTarget, 1 - Math.exp(-12 * dt));

    // Dynamic FOV boost kick
    const targetFov = playerCar.isBoosting ? 71 : 62;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 8);
      this.camera.updateProjectionMatrix();
    }

    // Trauma camera shake
    this.camera.position.copy(this.camPos);
    if (this.cameraTrauma > 0.005) {
      const shake = this.cameraTrauma * this.cameraTrauma;
      this.camera.position.x += (Math.random() - 0.5) * shake * 0.9;
      this.camera.position.y += (Math.random() - 0.5) * shake * 0.65;
      this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 2.1);
    }
    this.camera.lookAt(this.camLook);

    // Throttled HUD state sync (<= 8Hz or immediate on score/phase change)
    const scoreHash = `${this.sim.stats.blueScore}-${this.sim.stats.amberScore}-${this.sim.stats.matchPhase}-${Math.ceil(this.sim.stats.timeRemaining)}`;
    if (scoreHash !== this.lastScoreHash || this.elapsedTime - this.lastHudPushTime > 0.15) {
      this.lastScoreHash = scoreHash;
      this.lastHudPushTime = this.elapsedTime;
      this.callbacks.onStatsUpdate({ ...this.sim.stats });
    }
  }

  private stepMenuOrGarageCamera(dt: number): void {
    if (this.screenState === 'garage') {
      if (!this.isDraggingGarage) {
        this.garageTurntable.rotation.y += dt * 0.35;
      }
      const cx = Math.sin(this.garageYaw) * Math.cos(this.garagePitch) * this.garageDist;
      const cy = Math.sin(this.garagePitch) * this.garageDist + 0.9;
      const cz = Math.cos(this.garageYaw) * Math.cos(this.garagePitch) * this.garageDist;
      _camDesired.set(cx, cy, cz);
      this.camPos.lerp(_camDesired, 1 - Math.exp(-7 * dt));
      this.camLook.lerp(_camTarget.set(0, 0.85, 0), 1 - Math.exp(-7 * dt));
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
    } else {
      // Title / Loading cinematic stadium sweep framing front-3/4 car + pitch + floodlights
      this.garageTurntable.rotation.y += dt * 0.28;
      const t = this.elapsedTime * 0.2;
      _camDesired.set(
        Math.sin(t + 0.55) * 5.8 + 1.4,
        2.15 + Math.sin(t * 0.7) * 0.3,
        Math.cos(t + 0.55) * 5.8
      );
      this.camPos.lerp(_camDesired, 1 - Math.exp(-5 * dt));
      this.camLook.lerp(_camTarget.set(-1.1, 0.85, 0), 1 - Math.exp(-5 * dt));
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
    }

    if (this.showcaseRig) {
      this.showcaseRig.updateVisuals({
        wheelSpin: 0,
        steerAngle: 0.22,
        suspensionCompression: [0.05, 0.05, 0.05, 0.05],
        isBraking: false,
        isBoosting: false,
        altitude: 0,
        time: this.elapsedTime,
      });
    }
  }

  private updateAdaptiveResolution(rawDt: number): void {
    if (!this.graphicsConfig.adaptiveResolution || this.capabilities.isSoftwareGl) {
      return;
    }
    this.frameTimes.push(rawDt);
    if (this.frameTimes.length < 45) return;

    const avg =
      this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;

    if (avg > 1 / 29 && this.adaptiveScale > 0.72) {
      this.adaptiveScale = Math.max(0.72, this.adaptiveScale - 0.12);
      this.renderer.setPixelRatio(this.graphicsConfig.pixelRatio * this.adaptiveScale);
    } else if (avg < 1 / 52 && this.adaptiveScale < 1.0) {
      this.adaptiveScale = Math.min(1.0, this.adaptiveScale + 0.08);
      this.renderer.setPixelRatio(this.graphicsConfig.pixelRatio * this.adaptiveScale);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = Math.max(0.001, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const clampedTotal = Math.min(rawDt, this.capabilities.isSoftwareGl ? 0.2 : 0.05);
    this.elapsedTime += clampedTotal;

    this.updateAdaptiveResolution(rawDt);

    if (this.screenState === 'playing') {
      const subSteps = this.capabilities.isSoftwareGl
        ? Math.max(1, Math.ceil(clampedTotal / 0.033))
        : 1;
      const subDt = clampedTotal / subSteps;
      for (let s = 0; s < subSteps; s++) {
        this.stepGameplay(subDt);
      }
    } else if (this.screenState !== 'paused' && this.screenState !== 'gameover') {
      this.stepMenuOrGarageCamera(clampedTotal);
    }

    const dt = clampedTotal;

    // Update stadium animated elements
    this.stadium.updateBoostPads(this.sim.boostPads, this.elapsedTime);
    const excitement =
      this.sim.stats.matchPhase === 'goal'
        ? 1.0
        : this.sim.stats.matchPhase === 'live'
          ? 0.2
          : 0.1;
    this.stadium.updateCrowdWave(this.elapsedTime, excitement);

    // Update animated LED perimeter boards (~15Hz)
    if (Math.floor(this.elapsedTime * 15) !== Math.floor((this.elapsedTime - dt) * 15)) {
      drawLedAdBanner(
        this.textures.ledAdCtx,
        this.textures.ledAdTexture,
        this.elapsedTime
      );
    }

    // Update Jumbotron only when score or clock second changes
    const secKey = `${this.sim.stats.blueScore}:${this.sim.stats.amberScore}:${Math.floor(this.sim.stats.timeRemaining)}:${this.sim.stats.isOvertime}`;
    if (secKey !== this.lastJumbotronKey) {
      this.lastJumbotronKey = secKey;
      drawJumbotronScoreboard(
        this.textures.jumbotronCtx,
        this.textures.jumbotronTexture,
        this.sim.stats.blueScore,
        this.sim.stats.amberScore,
        this.sim.stats.timeRemaining,
        this.sim.stats.isOvertime
      );
    }

    this.particles.update(dt);

    // Render frame
    if (this.composer && !this.capabilities.isSoftwareGl) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    if (this.capabilities.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.cleanupEvents();
    this.audio.dispose();

    for (const rig of this.carRigs.values()) {
      rig.dispose();
    }
    this.showcaseRig?.dispose();
    this.football.dispose();
    this.stadium.dispose();
    this.particles.dispose();
    this.textures.dispose();
    this.assetLoader.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
