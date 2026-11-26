import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import {
  ARENA_CORNER_RADIUS,
  ARENA_HALF_LENGTH,
  ARENA_HALF_WIDTH,
  ARENA_WALL_HEIGHT,
  GOAL_DEPTH,
  GOAL_HALF_WIDTH,
  GOAL_HEIGHT,
} from './physics';
import type { BoostPadState, ResolvedGraphicsConfig, TimeOfDay } from './types';
import type { ProceduralTextureSet } from './textures';

export interface StadiumRig {
  root: THREE.Group;
  keyLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  fillLight: THREE.DirectionalLight;
  sky: Sky;
  boostPadMeshes: Map<string, { ring: THREE.Mesh; orb: THREE.Mesh }>;
  crowdMesh: THREE.InstancedMesh;
  applyTimeOfDay: (scene: THREE.Scene, tod: TimeOfDay) => void;
  updateBoostPads: (pads: BoostPadState[], time: number) => void;
  updateCrowdWave: (time: number, excitement: number) => void;
  dispose: () => void;
}

function createRoundedRectShape(hw: number, hl: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-hw + r, -hl);
  s.lineTo(hw - r, -hl);
  s.quadraticCurveTo(hw, -hl, hw, -hl + r);
  s.lineTo(hw, hl - r);
  s.quadraticCurveTo(hw, hl, hw - r, hl);
  s.lineTo(-hw + r, hl);
  s.quadraticCurveTo(-hw, hl, -hw, hl - r);
  s.lineTo(-hw, -hl + r);
  s.quadraticCurveTo(-hw, -hl, -hw + r, -hl);
  return s;
}

function createGoalStructure(
  teamColorHex: number,
  frameMat: THREE.Material,
  netMat: THREE.Material,
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const g = new THREE.Group();
  const postRadius = 0.24;

  // Goal posts & crossbar (chamfered steel tubes)
  const postGeom = new THREE.CylinderGeometry(postRadius, postRadius, GOAL_HEIGHT, 16);
  const crossGeom = new THREE.CylinderGeometry(
    postRadius,
    postRadius,
    GOAL_HALF_WIDTH * 2 + postRadius * 2,
    16
  );
  crossGeom.rotateZ(Math.PI / 2);

  const leftPost = new THREE.Mesh(postGeom, frameMat);
  leftPost.position.set(-GOAL_HALF_WIDTH, GOAL_HEIGHT * 0.5, 0);
  leftPost.castShadow = true;

  const rightPost = new THREE.Mesh(postGeom, frameMat);
  rightPost.position.set(GOAL_HALF_WIDTH, GOAL_HEIGHT * 0.5, 0);
  rightPost.castShadow = true;

  const crossbar = new THREE.Mesh(crossGeom, frameMat);
  crossbar.position.set(0, GOAL_HEIGHT, 0);
  crossbar.castShadow = true;

  // Rear structural support frame
  const rearPostL = new THREE.Mesh(postGeom, frameMat);
  rearPostL.position.set(-GOAL_HALF_WIDTH, GOAL_HEIGHT * 0.5, GOAL_DEPTH);
  const rearPostR = new THREE.Mesh(postGeom, frameMat);
  rearPostR.position.set(GOAL_HALF_WIDTH, GOAL_HEIGHT * 0.5, GOAL_DEPTH);
  const rearCross = new THREE.Mesh(crossGeom, frameMat);
  rearCross.position.set(0, GOAL_HEIGHT, GOAL_DEPTH);

  const sideBarGeom = new THREE.CylinderGeometry(0.16, 0.16, GOAL_DEPTH, 12);
  sideBarGeom.rotateX(Math.PI / 2);
  const topSideL = new THREE.Mesh(sideBarGeom, frameMat);
  topSideL.position.set(-GOAL_HALF_WIDTH, GOAL_HEIGHT, GOAL_DEPTH * 0.5);
  const topSideR = new THREE.Mesh(sideBarGeom, frameMat);
  topSideR.position.set(GOAL_HALF_WIDTH, GOAL_HEIGHT, GOAL_DEPTH * 0.5);

  // Team LED goal-line glow strip
  const glowGeom = new THREE.BoxGeometry(GOAL_HALF_WIDTH * 2, 0.16, 0.22);
  const glowMat = new THREE.MeshStandardMaterial({
    color: teamColorHex,
    emissive: teamColorHex,
    emissiveIntensity: 1.15,
    roughness: 0.25,
  });
  const glowBar = new THREE.Mesh(glowGeom, glowMat);
  glowBar.position.set(0, 0.08, 0);

  // Tensioned 3D Goal Nets (back + left + right + roof)
  const backNetGeom = new THREE.PlaneGeometry(GOAL_HALF_WIDTH * 2, GOAL_HEIGHT, 18, 8);
  const backNet = new THREE.Mesh(backNetGeom, netMat);
  backNet.position.set(0, GOAL_HEIGHT * 0.5, GOAL_DEPTH);

  const sideNetGeom = new THREE.PlaneGeometry(GOAL_DEPTH, GOAL_HEIGHT, 6, 8);
  const leftNet = new THREE.Mesh(sideNetGeom, netMat);
  leftNet.rotation.y = Math.PI / 2;
  leftNet.position.set(-GOAL_HALF_WIDTH, GOAL_HEIGHT * 0.5, GOAL_DEPTH * 0.5);

  const rightNet = new THREE.Mesh(sideNetGeom, netMat);
  rightNet.rotation.y = -Math.PI / 2;
  rightNet.position.set(GOAL_HALF_WIDTH, GOAL_HEIGHT * 0.5, GOAL_DEPTH * 0.5);

  const topNetGeom = new THREE.PlaneGeometry(GOAL_HALF_WIDTH * 2, GOAL_DEPTH, 18, 6);
  topNetGeom.rotateX(Math.PI / 2);
  const topNet = new THREE.Mesh(topNetGeom, netMat);
  topNet.position.set(0, GOAL_HEIGHT, GOAL_DEPTH * 0.5);

  // Goal floor dark turf pad
  const floorGeom = new THREE.PlaneGeometry(GOAL_HALF_WIDTH * 2, GOAL_DEPTH);
  floorGeom.rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.75,
    metalness: 0.1,
  });
  const goalFloor = new THREE.Mesh(floorGeom, floorMat);
  goalFloor.position.set(0, 0.01, GOAL_DEPTH * 0.5);
  goalFloor.receiveShadow = true;

  g.add(
    leftPost,
    rightPost,
    crossbar,
    rearPostL,
    rearPostR,
    rearCross,
    topSideL,
    topSideR,
    glowBar,
    backNet,
    leftNet,
    rightNet,
    topNet,
    goalFloor
  );

  disposables.push(
    postGeom,
    crossGeom,
    sideBarGeom,
    glowGeom,
    glowMat,
    backNetGeom,
    sideNetGeom,
    topNetGeom,
    floorGeom,
    floorMat
  );

  return g;
}

export function buildStadium(
  textures: ProceduralTextureSet,
  graphics: ResolvedGraphicsConfig,
  boostPads: BoostPadState[]
): StadiumRig {
  const root = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  // 1. Exterior Ground & Stadium Landscape Apron (eliminates floating void)
  const outerGroundGeom = new THREE.CircleGeometry(850, 48);
  outerGroundGeom.rotateX(-Math.PI / 2);
  const outerGroundMat = new THREE.MeshStandardMaterial({
    color: 0x090f18,
    roughness: 0.94,
    metalness: 0.04,
  });
  const outerGround = new THREE.Mesh(outerGroundGeom, outerGroundMat);
  outerGround.position.y = -0.15;
  outerGround.receiveShadow = true;
  root.add(outerGround);
  disposables.push(outerGroundGeom, outerGroundMat);

  // 2. High-Resolution Striped Grass Pitch (136m x 200m)
  const pitchGeom = new THREE.PlaneGeometry(ARENA_HALF_WIDTH * 2, ARENA_HALF_LENGTH * 2);
  pitchGeom.rotateX(-Math.PI / 2);
  pitchGeom.computeTangents();
  const pitchMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.pitchAlbedo,
    normalMap: graphics.advancedMaterials ? textures.pitchNormal : null,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughnessMap: textures.pitchRoughness,
    roughness: 0.88,
    metalness: 0.02,
  });
  const pitchMesh = new THREE.Mesh(pitchGeom, pitchMat);
  pitchMesh.receiveShadow = true;
  root.add(pitchMesh);
  disposables.push(pitchGeom, pitchMat);

  // Dark concrete apron border around curved pitch perimeter (supports 5 grandstand tiers)
  const outerBowlShape = createRoundedRectShape(
    ARENA_HALF_WIDTH + 50,
    ARENA_HALF_LENGTH + 50,
    ARENA_CORNER_RADIUS + 20
  );
  const innerPitchHole = createRoundedRectShape(
    ARENA_HALF_WIDTH,
    ARENA_HALF_LENGTH,
    ARENA_CORNER_RADIUS
  );
  outerBowlShape.holes.push(innerPitchHole);
  const apronGeom = new THREE.ShapeGeometry(outerBowlShape, 28);
  apronGeom.rotateX(Math.PI / 2);
  const apronMat = new THREE.MeshStandardMaterial({
    color: 0x0f1520,
    roughness: 0.82,
    metalness: 0.14,
  });
  const apronMesh = new THREE.Mesh(apronGeom, apronMat);
  apronMesh.position.y = 0.02;
  apronMesh.receiveShadow = true;
  root.add(apronMesh);
  disposables.push(apronGeom, apronMat);

  // 3. Curved Transparent Arena Walls + Structural Metallic Supports
  const wallOuter = createRoundedRectShape(
    ARENA_HALF_WIDTH + 0.4,
    ARENA_HALF_LENGTH + 0.4,
    ARENA_CORNER_RADIUS
  );
  const wallInner = createRoundedRectShape(
    ARENA_HALF_WIDTH,
    ARENA_HALF_LENGTH,
    ARENA_CORNER_RADIUS
  );
  wallOuter.holes.push(wallInner);

  const glassWallGeom = new THREE.ExtrudeGeometry(wallOuter, {
    depth: ARENA_WALL_HEIGHT - 1.4,
    bevelEnabled: false,
    curveSegments: 28,
  });
  glassWallGeom.rotateX(-Math.PI / 2);
  const glassWallMat = new THREE.MeshPhysicalMaterial({
    color: 0x93c5fd,
    roughness: 0.12,
    metalness: 0.08,
    transparent: true,
    opacity: 0.13,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const glassWall = new THREE.Mesh(glassWallGeom, glassWallMat);
  glassWall.position.y = 1.4;
  glassWall.renderOrder = 2;
  root.add(glassWall);
  disposables.push(glassWallGeom, glassWallMat);

  // Solid lower dasher board (1.4m tall) + upper arena rim cornice
  const dasherGeom = new THREE.ExtrudeGeometry(wallOuter, {
    depth: 1.4,
    bevelEnabled: false,
    curveSegments: 28,
  });
  dasherGeom.rotateX(-Math.PI / 2);
  const dasherMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.42,
    metalness: 0.75,
  });
  const dasher = new THREE.Mesh(dasherGeom, dasherMat);
  dasher.position.y = 0.02;
  root.add(dasher);

  const topRimGeom = new THREE.ExtrudeGeometry(wallOuter, {
    depth: 0.75,
    bevelEnabled: false,
    curveSegments: 28,
  });
  topRimGeom.rotateX(-Math.PI / 2);
  const topRim = new THREE.Mesh(topRimGeom, dasherMat);
  topRim.position.y = ARENA_WALL_HEIGHT - 0.35;
  root.add(topRim);
  disposables.push(dasherGeom, topRimGeom, dasherMat);

  // Animated LED Advertising Perimeter Boards along left & right sidelines + goal-end flanks
  const adSideGeom = new THREE.PlaneGeometry(148, 2.5);
  const adEndGeom = new THREE.PlaneGeometry(28, 2.5);
  const adBoardMat = new THREE.MeshBasicMaterial({
    map: textures.ledAdTexture,
    color: 0xd1d5db,
  });
  const adLeft = new THREE.Mesh(adSideGeom, adBoardMat);
  adLeft.rotation.y = Math.PI / 2;
  adLeft.position.set(-ARENA_HALF_WIDTH - 0.15, 2.0, 0);

  const adRight = new THREE.Mesh(adSideGeom, adBoardMat);
  adRight.rotation.y = -Math.PI / 2;
  adRight.position.set(ARENA_HALF_WIDTH + 0.15, 2.0, 0);
  root.add(adLeft, adRight);

  for (const dirZ of [-1, 1]) {
    for (const sideX of [-1, 1]) {
      const endAd = new THREE.Mesh(adEndGeom, adBoardMat);
      endAd.position.set(sideX * 29, 2.0, dirZ * (ARENA_HALF_LENGTH + 0.15));
      if (dirZ === 1) endAd.rotation.y = Math.PI;
      root.add(endAd);
    }
  }
  disposables.push(adSideGeom, adEndGeom, adBoardMat);

  // Metallic Structural Support Ribs around arena sidelines, ends & corners (InstancedMesh)
  const ribGeom = new THREE.BoxGeometry(0.9, ARENA_WALL_HEIGHT + 2.8, 1.1);
  const ribMat = new THREE.MeshStandardMaterial({
    color: 0x263244,
    metalness: 0.85,
    roughness: 0.34,
  });
  const ribPoints: Array<[number, number, number]> = [];
  for (let z = -72; z <= 72; z += 14.4) {
    ribPoints.push([-ARENA_HALF_WIDTH - 1.1, z, 0]);
    ribPoints.push([ARENA_HALF_WIDTH + 1.1, z, 0]);
  }
  for (let x = -42; x <= 42; x += 14) {
    if (Math.abs(x) < GOAL_HALF_WIDTH + 3) continue;
    ribPoints.push([x, -ARENA_HALF_LENGTH - 1.1, Math.PI / 2]);
    ribPoints.push([x, ARENA_HALF_LENGTH + 1.1, Math.PI / 2]);
  }
  const cX = ARENA_HALF_WIDTH - ARENA_CORNER_RADIUS;
  const cZ = ARENA_HALF_LENGTH - ARENA_CORNER_RADIUS;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (const frac of [0.22, 0.5, 0.78]) {
        const ang = frac * Math.PI * 0.5;
        const px = sx * (cX + Math.cos(ang) * (ARENA_CORNER_RADIUS + 1.1));
        const pz = sz * (cZ + Math.sin(ang) * (ARENA_CORNER_RADIUS + 1.1));
        ribPoints.push([px, pz, Math.atan2(px - sx * cX, pz - sz * cZ)]);
      }
    }
  }
  const ribInstanced = new THREE.InstancedMesh(ribGeom, ribMat, ribPoints.length);
  const dummy = new THREE.Object3D();
  ribPoints.forEach(([rx, rz, rotY], i) => {
    dummy.position.set(rx, (ARENA_WALL_HEIGHT + 2.8) * 0.5, rz);
    dummy.rotation.set(0, rotY, 0);
    dummy.updateMatrix();
    ribInstanced.setMatrixAt(i, dummy.matrix);
  });
  ribInstanced.computeBoundingSphere();
  root.add(ribInstanced);
  disposables.push(ribGeom, ribMat);

  // 4. Professional Goalposts & 3D Nets
  const goalFrameMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.9,
    roughness: 0.22,
  });
  const goalNetMat = new THREE.MeshBasicMaterial({
    color: 0xe2e8f0,
    wireframe: true,
    transparent: true,
    opacity: 0.42,
  });
  disposables.push(goalFrameMat, goalNetMat);

  // Blue Goal (-Z end, opening faces +Z)
  const blueGoal = createGoalStructure(0x38bdf8, goalFrameMat, goalNetMat, disposables);
  blueGoal.rotation.y = Math.PI;
  blueGoal.position.set(0, 0, -ARENA_HALF_LENGTH);
  root.add(blueGoal);

  // Amber Goal (+Z end, opening faces -Z)
  const amberGoal = createGoalStructure(0xf59e0b, goalFrameMat, goalNetMat, disposables);
  amberGoal.position.set(0, 0, ARENA_HALF_LENGTH);
  root.add(amberGoal);

  // 5. Mega 5-Tier Championship Grandstand Bowl & VIP Skybox Concourse
  const tierColors = [0x151e2c, 0x0d1420];
  for (let t = 0; t < 5; t++) {
    const offset = 8.5 + t * 7.8;
    const elev = 4.0 + t * 5.6;
    const spanPad = 20 + t * 14;
    const sideStandGeom = new THREE.BoxGeometry(7.8, 2.8, ARENA_HALF_LENGTH * 2 + spanPad);
    const sideMat = new THREE.MeshStandardMaterial({
      color: tierColors[t % 2],
      roughness: 0.76,
      metalness: 0.2,
    });
    const leftTier = new THREE.Mesh(sideStandGeom, sideMat);
    leftTier.position.set(-(ARENA_HALF_WIDTH + offset), elev, 0);
    const rightTier = new THREE.Mesh(sideStandGeom, sideMat);
    rightTier.position.set(ARENA_HALF_WIDTH + offset, elev, 0);

    const endStandGeom = new THREE.BoxGeometry(ARENA_HALF_WIDTH * 2 + spanPad, 2.8, 7.8);
    const northTier = new THREE.Mesh(endStandGeom, sideMat);
    northTier.position.set(0, elev + 2.8, -(ARENA_HALF_LENGTH + offset + 5));
    const southTier = new THREE.Mesh(endStandGeom, sideMat);
    southTier.position.set(0, elev + 2.8, ARENA_HALF_LENGTH + offset + 5);

    root.add(leftTier, rightTier, northTier, southTier);
    disposables.push(sideStandGeom, endStandGeom, sideMat);
  }

  // Elevated VIP Skybox Concourse Fascia around upper bowl
  const vipSideGeom = new THREE.BoxGeometry(4.2, 5.2, ARENA_HALF_LENGTH * 2 + 86);
  const vipEndGeom = new THREE.BoxGeometry(ARENA_HALF_WIDTH * 2 + 86, 5.2, 4.2);
  const vipMat = new THREE.MeshStandardMaterial({
    color: 0x090f1b,
    metalness: 0.72,
    roughness: 0.28,
  });
  const vipL = new THREE.Mesh(vipSideGeom, vipMat);
  vipL.position.set(-(ARENA_HALF_WIDTH + 44), 33, 0);
  const vipR = new THREE.Mesh(vipSideGeom, vipMat);
  vipR.position.set(ARENA_HALF_WIDTH + 44, 33, 0);
  const vipN = new THREE.Mesh(vipEndGeom, vipMat);
  vipN.position.set(0, 35.5, -(ARENA_HALF_LENGTH + 49));
  const vipS = new THREE.Mesh(vipEndGeom, vipMat);
  vipS.position.set(0, 35.5, ARENA_HALF_LENGTH + 49);
  root.add(vipL, vipR, vipN, vipS);
  disposables.push(vipSideGeom, vipEndGeom, vipMat);

  // Instanced Audience Silhouettes across all 5 massive tiers
  const specGeom = new THREE.BoxGeometry(0.75, 1.5, 0.65);
  const specMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.88,
    metalness: 0.04,
  });
  const crowdCount = graphics.crowdInstanceCount;
  const crowdMesh = new THREE.InstancedMesh(specGeom, specMat, crowdCount);
  const crowdPalette = [0x0284c7, 0xd97706, 0x94a3b8, 0x475569, 0x0369a1];
  const tmpColor = new THREE.Color();
  const baseCrowdY = new Float32Array(crowdCount);
  const baseCrowdX = new Float32Array(crowdCount);
  const baseCrowdZ = new Float32Array(crowdCount);

  for (let i = 0; i < crowdCount; i++) {
    const tier = i % 5;
    const side = i % 4;
    const offset = 8.5 + tier * 7.8 + (Math.random() - 0.5) * 3.4;
    const elev = 6.2 + tier * 5.6;
    let cx = 0;
    let cz = 0;
    let cy = elev;

    if (side === 0) {
      cx = -(ARENA_HALF_WIDTH + offset);
      cz = (Math.random() - 0.5) * (ARENA_HALF_LENGTH * 2.15);
    } else if (side === 1) {
      cx = ARENA_HALF_WIDTH + offset;
      cz = (Math.random() - 0.5) * (ARENA_HALF_LENGTH * 2.15);
    } else if (side === 2) {
      cx = (Math.random() - 0.5) * (ARENA_HALF_WIDTH * 2.05);
      cz = -(ARENA_HALF_LENGTH + offset + 5);
      cy += 2.8;
    } else {
      cx = (Math.random() - 0.5) * (ARENA_HALF_WIDTH * 2.05);
      cz = ARENA_HALF_LENGTH + offset + 5;
      cy += 2.8;
    }

    baseCrowdX[i] = cx;
    baseCrowdY[i] = cy;
    baseCrowdZ[i] = cz;

    dummy.position.set(cx, cy, cz);
    dummy.rotation.set(0, Math.atan2(-cx, -cz), 0);
    dummy.scale.setScalar(0.85 + Math.random() * 0.35);
    dummy.updateMatrix();
    crowdMesh.setMatrixAt(i, dummy.matrix);

    tmpColor.setHex(crowdPalette[i % crowdPalette.length]);
    crowdMesh.setColorAt(i, tmpColor);
  }
  crowdMesh.computeBoundingSphere();
  root.add(crowdMesh);
  disposables.push(specGeom, specMat);

  // 6. Monumental Stadium Roof Halo, 6 Sweeping Steel Arch Trusses & Towering Pylons
  const roofRingGeom = new THREE.TorusGeometry(132, 2.4, 10, 64);
  roofRingGeom.rotateX(Math.PI / 2);
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x283548,
    metalness: 0.85,
    roughness: 0.3,
  });
  const roofHalo = new THREE.Mesh(roofRingGeom, roofMat);
  roofHalo.scale.set(0.82, 1, 1.12);
  roofHalo.position.y = 47;
  root.add(roofHalo);

  // 6 sweeping overhead steel roof arches spanning across the mega stadium
  const archGeom = new THREE.TorusGeometry(106, 1.45, 8, 44, Math.PI);
  for (const az of [-75, -45, -15, 15, 45, 75]) {
    const arch = new THREE.Mesh(archGeom, roofMat);
    arch.position.set(0, 16, az);
    arch.scale.set(1.04, 0.44, 1);
    root.add(arch);
  }
  disposables.push(roofRingGeom, archGeom, roofMat);

  // 4 Towering 64m Floodlight Pylon Towers outside the bowl with Low-Glare LED Banks
  const pylonGeom = new THREE.BoxGeometry(3.4, 64, 3.4);
  const bankGeom = new THREE.BoxGeometry(12, 4.2, 1.6);
  const bankMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    emissive: 0x94a3b8,
    emissiveIntensity: 0.65,
  });
  const pylonCoords: Array<[number, number]> = [
    [-90, -118],
    [90, -118],
    [-90, 118],
    [90, 118],
  ];
  for (const [px, pz] of pylonCoords) {
    const pylon = new THREE.Mesh(pylonGeom, roofMat);
    pylon.position.set(px, 32, pz);
    pylon.lookAt(0, 32, 0);
    root.add(pylon);

    const bank = new THREE.Mesh(bankGeom, bankMat);
    bank.position.set(px * 0.95, 62, pz * 0.95);
    bank.lookAt(0, 0, 0);
    root.add(bank);
  }
  disposables.push(pylonGeom, bankGeom, bankMat);

  // 7. Giant Dual Hanging Digital Jumbotron Scoreboards (cleanly above 32m wall rim)
  const jumboGeom = new THREE.PlaneGeometry(42, 19);
  const jumboMat = new THREE.MeshBasicMaterial({
    map: textures.jumbotronTexture,
    color: 0xd1d5db,
  });
  const jumboFrameGeom = new THREE.BoxGeometry(44, 21, 2.2);
  const jumboFrameMat = new THREE.MeshStandardMaterial({
    color: 0x0b1220,
    metalness: 0.8,
    roughness: 0.3,
  });

  for (const dir of [-1, 1]) {
    const jGroup = new THREE.Group();
    const frame = new THREE.Mesh(jumboFrameGeom, jumboFrameMat);
    const screen = new THREE.Mesh(jumboGeom, jumboMat);
    screen.position.z = dir === -1 ? 1.15 : -1.15;
    if (dir === 1) screen.rotation.y = Math.PI;
    jGroup.add(frame, screen);
    jGroup.position.set(0, 42, dir * (ARENA_HALF_LENGTH + 32));
    root.add(jGroup);
  }
  disposables.push(jumboGeom, jumboMat, jumboFrameGeom, jumboFrameMat);

  // 8. Recessed Arena Boost Pads
  const boostPadMeshes = new Map<string, { ring: THREE.Mesh; orb: THREE.Mesh }>();
  const largeRingGeom = new THREE.RingGeometry(1.05, 1.7, 24);
  largeRingGeom.rotateX(-Math.PI / 2);
  const smallRingGeom = new THREE.RingGeometry(0.65, 1.1, 20);
  smallRingGeom.rotateX(-Math.PI / 2);
  const orbGeom = new THREE.OctahedronGeometry(0.64, 1);

  const padRingMat = new THREE.MeshBasicMaterial({
    color: 0xd97706,
    side: THREE.DoubleSide,
  });
  const padOrbMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.72,
    roughness: 0.25,
    metalness: 0.5,
  });
  disposables.push(largeRingGeom, smallRingGeom, orbGeom, padRingMat, padOrbMat);

  for (const pad of boostPads) {
    const ring = new THREE.Mesh(
      pad.isLarge ? largeRingGeom : smallRingGeom,
      padRingMat
    );
    ring.position.set(pad.x, 0.04, pad.z);
    root.add(ring);

    const orb = new THREE.Mesh(orbGeom, padOrbMat);
    orb.position.set(pad.x, pad.isLarge ? 0.95 : 0.64, pad.z);
    orb.scale.setScalar(pad.isLarge ? 1.1 : 0.65);
    root.add(orb);

    boostPadMeshes.set(pad.id, { ring, orb });
  }

  // 9. Calibrated Low-Glare 3-Point Stadium Lighting & Procedural Sky
  const sky = new Sky();
  sky.scale.setScalar(10000);
  root.add(sky);

  const hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x0f172a, 0.3);
  root.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xe2e8f0, 0.85);
  keyLight.position.set(68, 118, 52);
  keyLight.castShadow = graphics.shadowsEnabled;
  keyLight.shadow.mapSize.set(graphics.shadowMapSize, graphics.shadowMapSize);
  keyLight.shadow.camera.near = 15;
  keyLight.shadow.camera.far = 320;
  keyLight.shadow.camera.left = -128;
  keyLight.shadow.camera.right = 128;
  keyLight.shadow.camera.top = 128;
  keyLight.shadow.camera.bottom = -128;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.02;
  root.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.2);
  fillLight.position.set(-72, 54, -58);
  root.add(fillLight);

  const sunVec = new THREE.Vector3();

  const applyTimeOfDay = (scene: THREE.Scene, tod: TimeOfDay) => {
    const skyUniforms = sky.material.uniforms;
    if (tod === 'day') {
      skyUniforms['turbidity'].value = 2.2;
      skyUniforms['rayleigh'].value = 0.95;
      skyUniforms['mieCoefficient'].value = 0.002;
      skyUniforms['mieDirectionalG'].value = 0.72;
      sunVec.setFromSphericalCoords(1, THREE.MathUtils.degToRad(62), THREE.MathUtils.degToRad(135));
      skyUniforms['sunPosition'].value.copy(sunVec);

      keyLight.color.setHex(0xfef3c7);
      keyLight.intensity = 0.95;
      keyLight.position.set(70, 124, 50);
      hemiLight.color.setHex(0x7dd3fc);
      hemiLight.groundColor.setHex(0x0f172a);
      hemiLight.intensity = 0.34;
      fillLight.color.setHex(0x38bdf8);
      fillLight.intensity = 0.2;
      bankMat.emissiveIntensity = 0.25;
      scene.fog = new THREE.FogExp2(0x64748b, 0.00035);
    } else if (tod === 'sunset') {
      skyUniforms['turbidity'].value = 4.8;
      skyUniforms['rayleigh'].value = 2.0;
      skyUniforms['mieCoefficient'].value = 0.003;
      skyUniforms['mieDirectionalG'].value = 0.78;
      sunVec.setFromSphericalCoords(1, THREE.MathUtils.degToRad(86), THREE.MathUtils.degToRad(120));
      skyUniforms['sunPosition'].value.copy(sunVec);

      keyLight.color.setHex(0xfdba74);
      keyLight.intensity = 0.9;
      keyLight.position.set(92, 42, 60);
      hemiLight.color.setHex(0xea580c);
      hemiLight.groundColor.setHex(0x0f172a);
      hemiLight.intensity = 0.3;
      fillLight.color.setHex(0x4f46e5);
      fillLight.intensity = 0.22;
      bankMat.emissiveIntensity = 0.5;
      scene.fog = new THREE.FogExp2(0x1f1421, 0.00055);
    } else {
      // Night esports floodlit arena (deep contrast, comfortable low brightness)
      skyUniforms['turbidity'].value = 1.4;
      skyUniforms['rayleigh'].value = 0.2;
      skyUniforms['mieCoefficient'].value = 0.0008;
      skyUniforms['mieDirectionalG'].value = 0.65;
      sunVec.setFromSphericalCoords(1, THREE.MathUtils.degToRad(104), THREE.MathUtils.degToRad(160));
      skyUniforms['sunPosition'].value.copy(sunVec);

      keyLight.color.setHex(0xcbd5e1);
      keyLight.intensity = 0.85;
      keyLight.position.set(64, 114, 48);
      hemiLight.color.setHex(0x0284c7);
      hemiLight.groundColor.setHex(0x090d16);
      hemiLight.intensity = 0.28;
      fillLight.color.setHex(0xd97706);
      fillLight.intensity = 0.2;
      bankMat.emissiveIntensity = 0.65;
      scene.fog = new THREE.FogExp2(0x05080f, 0.00045);
    }
  };

  const updateBoostPads = (pads: BoostPadState[], time: number) => {
    for (const pad of pads) {
      const m = boostPadMeshes.get(pad.id);
      if (!m) continue;
      m.orb.visible = pad.active;
      if (pad.active) {
        m.orb.rotation.y = time * 2.2;
        m.orb.position.y = (pad.isLarge ? 0.88 : 0.56) + Math.sin(time * 3.5 + pad.x) * 0.1;
      }
      m.ring.scale.setScalar(pad.active ? 1.0 : 0.75);
    }
  };

  const updateCrowdWave = (time: number, excitement: number) => {
    if (excitement < 0.05) return;
    const step = Math.max(1, Math.floor(crowdCount / 220));
    for (let i = 0; i < crowdCount; i += step) {
      const jump = Math.abs(Math.sin(time * 8 + i * 0.4)) * excitement * 0.65;
      dummy.position.set(baseCrowdX[i], baseCrowdY[i] + jump, baseCrowdZ[i]);
      dummy.rotation.set(0, Math.atan2(-baseCrowdX[i], -baseCrowdZ[i]), 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      crowdMesh.setMatrixAt(i, dummy.matrix);
    }
    crowdMesh.instanceMatrix.needsUpdate = true;
  };

  const dispose = () => {
    for (const d of disposables) {
      d.dispose();
    }
  };

  return {
    root,
    keyLight,
    hemiLight,
    fillLight,
    sky,
    boostPadMeshes,
    crowdMesh,
    applyTimeOfDay,
    updateBoostPads,
    updateCrowdWave,
    dispose,
  };
}
