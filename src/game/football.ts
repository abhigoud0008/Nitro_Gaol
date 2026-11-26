import * as THREE from 'three';
import { BALL_RADIUS } from './physics';
import type { ProceduralTextureSet } from './textures';
import type { ResolvedGraphicsConfig } from './types';

export interface FootballRig {
  root: THREE.Group;
  sphereMesh: THREE.Mesh;
  contactShadow: THREE.Mesh;
  updateVisuals: (
    x: number,
    y: number,
    z: number,
    vx: number,
    vz: number,
    dt: number
  ) => void;
  dispose: () => void;
}

const _rollAxis = new THREE.Vector3();
const _deltaQuat = new THREE.Quaternion();

export function buildFootballRig(
  textures: ProceduralTextureSet,
  graphics: ResolvedGraphicsConfig
): FootballRig {
  const root = new THREE.Group();

  // High-detail geodesic sphere with stitched panel normal & roughness maps
  const sphereGeom = new THREE.SphereGeometry(BALL_RADIUS, 36, 28);
  sphereGeom.computeTangents();

  const ballMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: textures.ballAlbedo,
    normalMap: graphics.advancedMaterials ? textures.ballNormal : null,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughnessMap: textures.ballRoughness,
    roughness: 0.72,
    metalness: 0.14,
    clearcoat: graphics.advancedMaterials ? 0.3 : 0.08,
    clearcoatRoughness: 0.32,
    envMapIntensity: 0.55,
  });

  const sphereMesh = new THREE.Mesh(sphereGeom, ballMat);
  sphereMesh.castShadow = true;
  sphereMesh.receiveShadow = true;
  root.add(sphereMesh);

  // Subtle illuminated seam halo band so ball stays hyper-readable at stadium speeds
  const ringGeom = new THREE.TorusGeometry(BALL_RADIUS * 1.004, 0.045, 8, 48);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.8,
    roughness: 0.28,
  });
  const ring1 = new THREE.Mesh(ringGeom, ringMat);
  const ring2 = new THREE.Mesh(ringGeom, ringMat);
  ring2.rotation.y = Math.PI / 2;
  sphereMesh.add(ring1, ring2);

  // Grounded contact shadow disc directly on grass plane
  const shadowGeom = new THREE.PlaneGeometry(BALL_RADIUS * 2.7, BALL_RADIUS * 2.7);
  shadowGeom.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadow,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(shadowGeom, shadowMat);
  contactShadow.position.y = 0.03;
  root.add(contactShadow);

  const updateVisuals = (
    x: number,
    y: number,
    z: number,
    vx: number,
    vz: number,
    dt: number
  ) => {
    sphereMesh.position.set(x, y, z);

    // Synchronize smooth rolling quaternion with horizontal velocity
    const speed = Math.hypot(vx, vz);
    if (speed > 0.05) {
      _rollAxis.set(vz, 0, -vx).normalize();
      const angle = (speed / BALL_RADIUS) * dt;
      _deltaQuat.setFromAxisAngle(_rollAxis, angle);
      sphereMesh.quaternion.premultiply(_deltaQuat);
    }

    // Contact shadow tracks XZ directly on turf and fades/scales with ball height
    const heightAboveGround = Math.max(0, y - BALL_RADIUS);
    contactShadow.position.set(x, 0.03, z);
    const scale = 1 + heightAboveGround * 0.07;
    contactShadow.scale.set(scale, 1, scale);
    shadowMat.opacity = Math.max(0.1, 0.62 - heightAboveGround * 0.045);
  };

  const dispose = () => {
    sphereGeom.dispose();
    ballMat.dispose();
    ringGeom.dispose();
    ringMat.dispose();
    shadowGeom.dispose();
    shadowMat.dispose();
  };

  return {
    root,
    sphereMesh,
    contactShadow,
    updateVisuals,
    dispose,
  };
}
