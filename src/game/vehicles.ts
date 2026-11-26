import * as THREE from 'three';
import type { CarArchetypeId, CarFinishOption, ResolvedGraphicsConfig } from './types';
import type { ProceduralTextureSet } from './textures';

export interface VehicleRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  lod: THREE.LOD;
  wheels: [THREE.Group, THREE.Group, THREE.Group, THREE.Group]; // FL, FR, RL, RR
  frontKnuckles: [THREE.Group, THREE.Group];
  suspensionArms: [THREE.Mesh, THREE.Mesh, THREE.Mesh, THREE.Mesh];
  brakeLightsMat: THREE.MeshStandardMaterial;
  nitroFlames: THREE.Mesh[];
  contactShadow: THREE.Mesh;
  paintMaterial: THREE.MeshPhysicalMaterial;
  accentMaterial: THREE.MeshStandardMaterial;
  rimMaterial: THREE.MeshStandardMaterial;
  setFinish: (finish: CarFinishOption) => void;
  updateVisuals: (params: {
    wheelSpin: number;
    steerAngle: number;
    suspensionCompression: [number, number, number, number];
    isBraking: boolean;
    isBoosting: boolean;
    altitude: number;
    time: number;
  }) => void;
  dispose: () => void;
}

function createCarBodyProfileGeometry(archetype: CarArchetypeId): THREE.ExtrudeGeometry {
  // Side silhouette in X-Y plane, extruded along Z (then rotated so car faces +Z)
  const shape = new THREE.Shape();

  if (archetype === 'valkyrie-aero') {
    // Low-slung hypercar prototype silhouette
    shape.moveTo(-2.35, 0.22);
    shape.lineTo(-2.3, 0.42);
    shape.lineTo(-1.85, 0.56);
    shape.lineTo(-1.15, 0.72);
    shape.lineTo(-0.45, 1.08);
    shape.lineTo(0.45, 1.12);
    shape.lineTo(1.25, 0.78);
    shape.lineTo(2.1, 0.58);
    shape.lineTo(2.34, 0.44);
    shape.lineTo(2.3, 0.22);
    shape.closePath();
  } else if (archetype === 'titan-v8') {
    // Muscular wide-body interceptor GT
    shape.moveTo(-2.32, 0.26);
    shape.lineTo(-2.3, 0.54);
    shape.lineTo(-1.75, 0.76);
    shape.lineTo(-0.95, 0.84);
    shape.lineTo(-0.42, 1.24);
    shape.lineTo(0.55, 1.24);
    shape.lineTo(1.38, 0.88);
    shape.lineTo(2.15, 0.74);
    shape.lineTo(2.32, 0.52);
    shape.lineTo(2.26, 0.26);
    shape.closePath();
  } else {
    // Apex GT sculpted aerodynamic coupe
    shape.moveTo(-2.28, 0.24);
    shape.lineTo(-2.25, 0.48);
    shape.lineTo(-1.72, 0.66);
    shape.lineTo(-1.05, 0.76);
    shape.lineTo(-0.38, 1.16);
    shape.lineTo(0.5, 1.16);
    shape.lineTo(1.28, 0.82);
    shape.lineTo(2.05, 0.64);
    shape.lineTo(2.26, 0.48);
    shape.lineTo(2.22, 0.24);
    shape.closePath();
  }

  const width = archetype === 'titan-v8' ? 1.88 : archetype === 'valkyrie-aero' ? 1.78 : 1.82;
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 2,
    bevelSize: 0.11,
    bevelThickness: 0.12,
  });
  // Center along Z, then rotate -PI/2 around Y so +X nose becomes +Z forward
  geom.translate(0, 0, -width * 0.5);
  geom.rotateY(-Math.PI / 2);
  geom.computeVertexNormals();
  return geom;
}

function createCanopyGeometry(archetype: CarArchetypeId): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const topY = archetype === 'valkyrie-aero' ? 1.15 : archetype === 'titan-v8' ? 1.27 : 1.19;
  shape.moveTo(-0.95, 0.76);
  shape.lineTo(-0.35, topY);
  shape.lineTo(0.52, topY);
  shape.lineTo(1.18, 0.82);
  shape.lineTo(0.95, 0.72);
  shape.lineTo(-0.78, 0.7);
  shape.closePath();

  const cabinW = archetype === 'titan-v8' ? 1.4 : 1.32;
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: cabinW,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.08,
    bevelThickness: 0.1,
  });
  geom.translate(0, 0, -cabinW * 0.5);
  geom.rotateY(-Math.PI / 2);
  geom.computeVertexNormals();
  return geom;
}

function createWheelAssembly(
  tireMat: THREE.Material,
  rimMat: THREE.Material,
  caliperMat: THREE.Material,
  discMat: THREE.Material,
  sideSign: number
): THREE.Group {
  const wheelGroup = new THREE.Group();

  // Rubber tire (torus + outer cylinder tread)
  const tireGeom = new THREE.CylinderGeometry(0.41, 0.41, 0.34, 24);
  tireGeom.rotateZ(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeom, tireMat);
  tire.castShadow = true;
  wheelGroup.add(tire);

  // Sidewall shoulder ring
  const wallGeom = new THREE.TorusGeometry(0.32, 0.095, 10, 24);
  wallGeom.rotateY(Math.PI / 2);
  const wall = new THREE.Mesh(wallGeom, tireMat);
  wheelGroup.add(wall);

  // Inner alloy barrel
  const barrelGeom = new THREE.CylinderGeometry(0.28, 0.28, 0.29, 20);
  barrelGeom.rotateZ(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeom, rimMat);
  wheelGroup.add(barrel);

  // 5-split-spoke alloy rim
  const spokeGeom = new THREE.BoxGeometry(0.04, 0.52, 0.045);
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(spokeGeom, rimMat);
    spoke.rotation.x = (i / 5) * Math.PI * 2;
    spoke.position.x = sideSign * 0.12;
    wheelGroup.add(spoke);
  }

  // Center lock lug hub
  const hubGeom = new THREE.CylinderGeometry(0.075, 0.09, 0.08, 12);
  hubGeom.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeom, caliperMat);
  hub.position.x = sideSign * 0.14;
  wheelGroup.add(hub);

  // Ventilated brake rotor & caliper
  const discGeom = new THREE.CylinderGeometry(0.22, 0.22, 0.035, 18);
  discGeom.rotateZ(Math.PI / 2);
  const disc = new THREE.Mesh(discGeom, discMat);
  disc.position.x = -sideSign * 0.04;
  wheelGroup.add(disc);

  return wheelGroup;
}

export function buildVehicleRig(
  archetype: CarArchetypeId,
  finish: CarFinishOption,
  textures: ProceduralTextureSet,
  graphics: ResolvedGraphicsConfig,
  teamGlowHex: string
): VehicleRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  const lod = new THREE.LOD();
  const hiDetail = new THREE.Group();
  const lowDetail = new THREE.Group();

  const disposables: Array<{ dispose: () => void }> = [];

  // 1. Metallic Clear-Coat Car Paint Material (MeshPhysicalMaterial)
  const paintMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(finish.primaryColor),
    metalness: finish.metalness,
    roughness: finish.roughness,
    clearcoat: graphics.advancedMaterials ? finish.clearcoat : 0.2,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.35,
  });

  // 2. Carbon Fiber Aero Material
  const carbonMaterial = new THREE.MeshStandardMaterial({
    color: 0x161922,
    metalness: 0.35,
    roughness: 0.42,
    normalMap: graphics.advancedMaterials ? textures.carbonNormal : null,
    roughnessMap: graphics.advancedMaterials ? textures.carbonRoughness : null,
  });

  // 3. Tinted Smoked Canopy Glass
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x050811,
    metalness: 0.15,
    roughness: 0.14,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
    transparent: true,
    opacity: 0.92,
    envMapIntensity: 0.65,
  });

  // 4. Accent Trim Material
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(finish.accentColor),
    metalness: 0.65,
    roughness: 0.28,
    emissive: new THREE.Color(teamGlowHex),
    emissiveIntensity: 0.22,
  });

  // 5. Tire Rubber & Alloy Rim Materials
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x15171c,
    metalness: 0.05,
    roughness: 0.85,
    normalMap: graphics.advancedMaterials ? textures.tireNormal : null,
  });

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(finish.rimColor),
    metalness: 0.92,
    roughness: 0.2,
  });

  const caliperMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(finish.accentColor),
    metalness: 0.6,
    roughness: 0.35,
  });

  const discMat = new THREE.MeshStandardMaterial({
    color: 0x8b95a5,
    metalness: 0.9,
    roughness: 0.32,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xdbeafe,
    emissiveIntensity: 2.2,
    roughness: 0.1,
  });

  const brakeLightsMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });

  const exhaustPipeMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.96,
    roughness: 0.18,
  });

  const nitroFlameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  disposables.push(
    paintMaterial,
    carbonMaterial,
    glassMaterial,
    accentMaterial,
    tireMat,
    rimMaterial,
    caliperMat,
    discMat,
    headlightMat,
    brakeLightsMat,
    exhaustPipeMat,
    nitroFlameMat
  );

  // --- Primary Sculpted Bodywork ---
  const bodyGeom = createCarBodyProfileGeometry(archetype);
  const bodyMesh = new THREE.Mesh(bodyGeom, paintMaterial);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  hiDetail.add(bodyMesh);
  disposables.push(bodyGeom);

  // --- Low-Detail LOD Body Proxy (for far distance) ---
  const lowBodyMesh = new THREE.Mesh(bodyGeom, paintMaterial);
  lowDetail.add(lowBodyMesh);

  // --- Transparent Aerodynamic Canopy ---
  const canopyGeom = createCanopyGeometry(archetype);
  const canopyMesh = new THREE.Mesh(canopyGeom, glassMaterial);
  canopyMesh.castShadow = true;
  hiDetail.add(canopyMesh);
  disposables.push(canopyGeom);

  // --- Carbon Underbody Chassis & Diffuser ---
  const underbodyGeom = new THREE.BoxGeometry(1.78, 0.12, 4.35);
  const underbodyMesh = new THREE.Mesh(underbodyGeom, carbonMaterial);
  underbodyMesh.position.set(0, 0.2, 0);
  hiDetail.add(underbodyMesh);
  disposables.push(underbodyGeom);

  // Front carbon aero splitter
  const splitterGeom = new THREE.BoxGeometry(2.04, 0.06, 0.65);
  const splitter = new THREE.Mesh(splitterGeom, carbonMaterial);
  splitter.position.set(0, 0.21, 2.08);
  hiDetail.add(splitter);
  disposables.push(splitterGeom);

  // Side skirts & wheel-arch flares
  const skirtGeom = new THREE.BoxGeometry(0.16, 0.13, 2.55);
  const archGeom = new THREE.TorusGeometry(0.49, 0.085, 8, 16, Math.PI);
  archGeom.rotateY(Math.PI / 2);
  const intakeGeom = new THREE.BoxGeometry(0.18, 0.24, 0.92);
  const mirrorGeom = new THREE.BoxGeometry(0.22, 0.08, 0.14);

  for (const sx of [-0.96, 0.96]) {
    const skirt = new THREE.Mesh(skirtGeom, carbonMaterial);
    skirt.position.set(sx, 0.23, 0);
    hiDetail.add(skirt);

    // Sculpted front & rear wheel arch fenders
    for (const wz of [1.38, -1.36]) {
      const arch = new THREE.Mesh(archGeom, paintMaterial);
      arch.position.set(sx * 0.99, 0.42, wz);
      hiDetail.add(arch);
    }

    // Side aero intake pod
    const intake = new THREE.Mesh(intakeGeom, carbonMaterial);
    intake.position.set(sx * 0.97, 0.5, -0.35);
    hiDetail.add(intake);

    // Aerodynamic wing mirror
    const mirror = new THREE.Mesh(mirrorGeom, carbonMaterial);
    mirror.position.set(sx * 0.94, 0.82, 0.56);
    hiDetail.add(mirror);
  }
  disposables.push(skirtGeom, archGeom, intakeGeom, mirrorGeom);

  // Rear diffuser fins
  const finGeom = new THREE.BoxGeometry(0.05, 0.22, 0.45);
  for (let i = -2; i <= 2; i++) {
    const fin = new THREE.Mesh(finGeom, carbonMaterial);
    fin.position.set(i * 0.28, 0.24, -2.22);
    hiDetail.add(fin);
  }
  disposables.push(finGeom);

  // --- Rear Spoiler Wing & Uprights ---
  const wingSpan = archetype === 'titan-v8' ? 2.1 : 1.98;
  const wingY = archetype === 'valkyrie-aero' ? 1.26 : 1.32;
  const wingGeom = new THREE.BoxGeometry(wingSpan, 0.06, 0.34);
  const wing = new THREE.Mesh(wingGeom, carbonMaterial);
  wing.position.set(0, wingY, -2.06);
  wing.rotation.x = 0.12;
  wing.castShadow = true;
  hiDetail.add(wing);
  disposables.push(wingGeom);

  // Wing endplates (accent painted)
  const endplateGeom = new THREE.BoxGeometry(0.05, 0.24, 0.42);
  for (const sx of [-wingSpan * 0.5, wingSpan * 0.5]) {
    const ep = new THREE.Mesh(endplateGeom, accentMaterial);
    ep.position.set(sx, wingY - 0.03, -2.06);
    hiDetail.add(ep);
  }
  disposables.push(endplateGeom);

  // Wing uprights
  const uprightGeom = new THREE.BoxGeometry(0.06, 0.48, 0.16);
  for (const sx of [-0.52, 0.52]) {
    const up = new THREE.Mesh(uprightGeom, carbonMaterial);
    up.position.set(sx, wingY - 0.24, -2.02);
    hiDetail.add(up);
  }
  disposables.push(uprightGeom);

  // --- Headlights & Taillights ---
  const hlGeom = new THREE.BoxGeometry(0.42, 0.08, 0.1);
  for (const sx of [-0.66, 0.66]) {
    const hl = new THREE.Mesh(hlGeom, headlightMat);
    hl.position.set(sx, 0.48, 2.24);
    hl.rotation.y = sx > 0 ? -0.18 : 0.18;
    hiDetail.add(hl);
  }
  disposables.push(hlGeom);

  const tlGeom = new THREE.BoxGeometry(0.56, 0.085, 0.09);
  for (const sx of [-0.62, 0.62]) {
    const tl = new THREE.Mesh(tlGeom, brakeLightsMat);
    tl.position.set(sx, 0.58, -2.26);
    hiDetail.add(tl);
  }
  // Full-width LED taillight signature bar
  const tlBarGeom = new THREE.BoxGeometry(1.5, 0.04, 0.07);
  const tlBar = new THREE.Mesh(tlBarGeom, brakeLightsMat);
  tlBar.position.set(0, 0.58, -2.27);
  hiDetail.add(tlBar);
  disposables.push(tlGeom, tlBarGeom);

  // --- Accent Racing Livery Stripe ---
  const stripeGeom = new THREE.BoxGeometry(0.28, 0.025, 3.6);
  const stripe = new THREE.Mesh(stripeGeom, accentMaterial);
  stripe.position.set(0, 0.78, 0.22);
  hiDetail.add(stripe);
  disposables.push(stripeGeom);

  // --- Exhaust Pipes & Nitro Flame Cones ---
  const pipeGeom = new THREE.CylinderGeometry(0.075, 0.085, 0.28, 14);
  pipeGeom.rotateX(Math.PI / 2);
  const flameGeom = new THREE.ConeGeometry(0.16, 1.35, 14, 1, true);
  flameGeom.rotateX(-Math.PI / 2);
  flameGeom.translate(0, 0, -0.68);
  disposables.push(pipeGeom, flameGeom);

  const nitroFlames: THREE.Mesh[] = [];
  const exhaustOffsets = archetype === 'titan-v8' ? [-0.52, -0.34, 0.34, 0.52] : [-0.4, 0.4];
  for (const ex of exhaustOffsets) {
    const pipe = new THREE.Mesh(pipeGeom, exhaustPipeMat);
    pipe.position.set(ex, 0.26, -2.3);
    hiDetail.add(pipe);

    const flame = new THREE.Mesh(flameGeom, nitroFlameMat);
    flame.position.set(ex, 0.26, -2.4);
    flame.visible = false;
    hiDetail.add(flame);
    nitroFlames.push(flame);
  }

  // --- Visible Suspension Arms & Wheel Assemblies ---
  const wheelCoords: Array<[number, number, number]> = [
    [-0.96, 0.41, 1.38],  // FL (index 0)
    [0.96, 0.41, 1.38],   // FR (index 1)
    [-0.98, 0.41, -1.36], // RL (index 2)
    [0.98, 0.41, -1.36],  // RR (index 3)
  ];

  const wheels: THREE.Group[] = [];
  const frontKnuckles: THREE.Group[] = [];
  const suspensionArms: THREE.Mesh[] = [];

  const armGeom = new THREE.BoxGeometry(0.55, 0.055, 0.14);
  const armMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.85,
    roughness: 0.3,
  });
  disposables.push(armGeom, armMat);

  wheelCoords.forEach(([wx, wy, wz], idx) => {
    const sideSign = wx > 0 ? 1 : -1;
    const arm = new THREE.Mesh(armGeom, armMat);
    arm.position.set(wx - sideSign * 0.28, 0.36, wz);
    hiDetail.add(arm);
    suspensionArms.push(arm);

    const wAssembly = createWheelAssembly(
      tireMat,
      rimMaterial,
      caliperMat,
      discMat,
      sideSign
    );

    if (idx < 2) {
      const knuckle = new THREE.Group();
      knuckle.position.set(wx, wy, wz);
      knuckle.add(wAssembly);
      root.add(knuckle);
      frontKnuckles.push(knuckle);
      wheels.push(wAssembly);
    } else {
      wAssembly.position.set(wx, wy, wz);
      root.add(wAssembly);
      wheels.push(wAssembly);
    }

    // Also add simplified wheel proxy to lowDetail LOD
    const lowW = new THREE.Mesh(
      new THREE.CylinderGeometry(0.41, 0.41, 0.32, 10),
      tireMat
    );
    lowW.rotation.z = Math.PI / 2;
    lowW.position.set(wx, wy, wz);
    lowDetail.add(lowW);
  });

  // Shift bodyGroup down slightly relative to root so chassis sits grounded at root y=0
  // Note: physics car.pos.y = 0.56 when grounded, so root will be placed at (pos.x, pos.y - 0.56, pos.z)
  lod.addLevel(hiDetail, 0);
  lod.addLevel(lowDetail, 46);
  bodyGroup.add(lod);
  root.add(bodyGroup);

  // Contact shadow disc grounded under car
  const shadowGeom = new THREE.PlaneGeometry(3.2, 5.6);
  shadowGeom.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadow,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(shadowGeom, shadowMat);
  contactShadow.position.y = 0.025;
  root.add(contactShadow);
  disposables.push(shadowGeom, shadowMat);

  const setFinish = (newFinish: CarFinishOption) => {
    paintMaterial.color.set(newFinish.primaryColor);
    paintMaterial.metalness = newFinish.metalness;
    paintMaterial.roughness = newFinish.roughness;
    paintMaterial.clearcoat = graphics.advancedMaterials ? newFinish.clearcoat : 0.2;
    accentMaterial.color.set(newFinish.accentColor);
    rimMaterial.color.set(newFinish.rimColor);
    caliperMat.color.set(newFinish.accentColor);
  };

  const updateVisuals: VehicleRig['updateVisuals'] = ({
    wheelSpin,
    steerAngle,
    suspensionCompression,
    isBraking,
    isBoosting,
    altitude,
    time,
  }) => {
    // Steering alignment on front wheel knuckles
    frontKnuckles[0].rotation.y = steerAngle;
    frontKnuckles[1].rotation.y = steerAngle;

    // Animated wheel spin & visible suspension movement
    for (let i = 0; i < 4; i++) {
      wheels[i].rotation.x = wheelSpin;
      const comp = suspensionCompression[i];
      if (i < 2) {
        frontKnuckles[i].position.y = 0.41 + comp * 0.45;
      } else {
        wheels[i].position.y = 0.41 + comp * 0.45;
      }
      suspensionArms[i].rotation.z = (i % 2 === 0 ? -1 : 1) * comp * 1.4;
    }

    // Reactive brake lights
    brakeLightsMat.emissiveIntensity = isBraking ? 3.2 : 0.85;

    // Nitro flames flicker
    for (let i = 0; i < nitroFlames.length; i++) {
      const f = nitroFlames[i];
      f.visible = isBoosting;
      if (isBoosting) {
        const flicker = 0.85 + Math.sin(time * 48 + i * 1.7) * 0.25;
        f.scale.set(1, 1, flicker);
      }
    }

    // Contact shadow stays projected onto ground beneath car
    contactShadow.position.y = Math.max(0.02, -altitude + 0.02);
    const shadowAlpha = Math.max(0.08, 0.55 - altitude * 0.08);
    (contactShadow.material as THREE.MeshBasicMaterial).opacity = shadowAlpha;
  };

  const dispose = () => {
    for (const d of disposables) {
      d.dispose();
    }
  };

  return {
    root,
    bodyGroup,
    lod,
    wheels: wheels as [THREE.Group, THREE.Group, THREE.Group, THREE.Group],
    frontKnuckles: frontKnuckles as [THREE.Group, THREE.Group],
    suspensionArms: suspensionArms as [THREE.Mesh, THREE.Mesh, THREE.Mesh, THREE.Mesh],
    brakeLightsMat,
    nitroFlames,
    contactShadow,
    paintMaterial,
    accentMaterial,
    rimMaterial,
    setFinish,
    updateVisuals,
    dispose,
  };
}
