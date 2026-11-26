import * as THREE from 'three';

type ParticleKind = 'nitro' | 'smoke' | 'spark' | 'grass' | 'confetti' | 'firework';

interface ParticleSlot {
  active: boolean;
  kind: ParticleKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  gravity: number;
  color: THREE.Color;
  rot: number;
  rotVel: number;
}

const _dummy = new THREE.Object3D();
const _tmpColor = new THREE.Color();

export class ArenaParticleSystem {
  public readonly group = new THREE.Group();
  private capacity: number;
  private slots: ParticleSlot[] = [];
  private cursor = 0;

  private instancedParticles: THREE.InstancedMesh;
  private particleGeom: THREE.BufferGeometry;
  private particleMat: THREE.MeshBasicMaterial;

  // Skid/drift marks ring buffer
  private skidCapacity = 180;
  private skidCursor = 0;
  private skidInstanced: THREE.InstancedMesh;
  private skidGeom: THREE.BufferGeometry;
  private skidMat: THREE.MeshBasicMaterial;

  // Expanding goal shockwave ring
  private shockwaveMesh: THREE.Mesh;
  private shockwaveMat: THREE.MeshBasicMaterial;
  private shockwaveLife = 0;

  constructor(maxParticles: number) {
    this.capacity = Math.max(120, maxParticles);

    for (let i = 0; i < this.capacity; i++) {
      this.slots.push({
        active: false,
        kind: 'nitro',
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 0.2,
        gravity: 0,
        color: new THREE.Color(1, 1, 1),
        rot: 0,
        rotVel: 0,
      });
    }

    this.particleGeom = new THREE.BoxGeometry(1, 1, 1);
    this.particleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.instancedParticles = new THREE.InstancedMesh(
      this.particleGeom,
      this.particleMat,
      this.capacity
    );
    this.instancedParticles.frustumCulled = false;
    this.instancedParticles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < this.capacity; i++) {
      _dummy.position.set(0, -100, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.instancedParticles.setMatrixAt(i, _dummy.matrix);
      this.instancedParticles.setColorAt(i, _tmpColor.setHex(0xffffff));
    }
    this.group.add(this.instancedParticles);

    // Drift skid marks
    this.skidGeom = new THREE.PlaneGeometry(0.32, 0.9);
    this.skidGeom.rotateX(-Math.PI / 2);
    this.skidMat = new THREE.MeshBasicMaterial({
      color: 0x0b0e14,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });
    this.skidInstanced = new THREE.InstancedMesh(
      this.skidGeom,
      this.skidMat,
      this.skidCapacity
    );
    this.skidInstanced.frustumCulled = false;
    for (let i = 0; i < this.skidCapacity; i++) {
      _dummy.position.set(0, -100, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.skidInstanced.setMatrixAt(i, _dummy.matrix);
    }
    this.group.add(this.skidInstanced);

    // Goal explosion shockwave torus
    const swGeom = new THREE.TorusGeometry(1, 0.16, 12, 48);
    this.shockwaveMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.shockwaveMesh = new THREE.Mesh(swGeom, this.shockwaveMat);
    this.shockwaveMesh.visible = false;
    this.group.add(this.shockwaveMesh);
  }

  private spawn(
    kind: ParticleKind,
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    maxLife: number,
    size: number,
    gravity: number,
    hex: number
  ): void {
    const slot = this.slots[this.cursor];
    this.cursor = (this.cursor + 1) % this.capacity;

    slot.active = true;
    slot.kind = kind;
    slot.x = x;
    slot.y = y;
    slot.z = z;
    slot.vx = vx;
    slot.vy = vy;
    slot.vz = vz;
    slot.life = maxLife;
    slot.maxLife = maxLife;
    slot.size = size;
    slot.gravity = gravity;
    slot.color.setHex(hex);
    slot.rot = Math.random() * Math.PI * 2;
    slot.rotVel = (Math.random() - 0.5) * 10;
  }

  public emitNitroTrail(x: number, y: number, z: number, fwdX: number, fwdZ: number): void {
    this.spawn(
      'nitro',
      x - fwdX * 2.25 + (Math.random() - 0.5) * 0.45,
      y + 0.28 + (Math.random() - 0.5) * 0.12,
      z - fwdZ * 2.25 + (Math.random() - 0.5) * 0.45,
      -fwdX * (8 + Math.random() * 6) + (Math.random() - 0.5) * 2,
      0.5 + Math.random() * 1.4,
      -fwdZ * (8 + Math.random() * 6) + (Math.random() - 0.5) * 2,
      0.24,
      0.28,
      0,
      Math.random() > 0.35 ? 0x38bdf8 : 0xf59e0b
    );
  }

  public emitTireSmokeAndGrass(
    x: number,
    z: number,
    yaw: number,
    isDrifting: boolean
  ): void {
    if (isDrifting) {
      // Stamp drift skid mark pair
      const rx = Math.cos(yaw) * 0.92;
      const rz = -Math.sin(yaw) * 0.92;
      for (const side of [-1, 1]) {
        const idx = this.skidCursor;
        this.skidCursor = (this.skidCursor + 1) % this.skidCapacity;
        _dummy.position.set(x + rx * side, 0.035, z + rz * side);
        _dummy.rotation.set(0, yaw, 0);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        this.skidInstanced.setMatrixAt(idx, _dummy.matrix);
      }
      this.skidInstanced.instanceMatrix.needsUpdate = true;

      this.spawn(
        'smoke',
        x + (Math.random() - 0.5) * 1.4,
        0.22,
        z + (Math.random() - 0.5) * 1.4,
        (Math.random() - 0.5) * 2.5,
        1.4 + Math.random() * 1.2,
        (Math.random() - 0.5) * 2.5,
        0.55,
        0.48,
        -0.5,
        0xcbd5e1
      );
    }

    // Grass turf clods kicked up
    this.spawn(
      'grass',
      x + (Math.random() - 0.5) * 1.2,
      0.16,
      z + (Math.random() - 0.5) * 1.2,
      (Math.random() - 0.5) * 5,
      3.5 + Math.random() * 3.5,
      (Math.random() - 0.5) * 5,
      0.45,
      0.15,
      -18,
      Math.random() > 0.4 ? 0x22c55e : 0x15803d
    );
  }

  public emitCollisionSparks(x: number, y: number, z: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 6 + Math.random() * 14;
      this.spawn(
        'spark',
        x,
        y,
        z,
        Math.cos(ang) * spd,
        3 + Math.random() * 10,
        Math.sin(ang) * spd,
        0.38,
        0.14,
        -22,
        Math.random() > 0.3 ? 0xfbbf24 : 0xfef08a
      );
    }
  }

  public emitGoalExplosion(x: number, y: number, z: number, team: 'blue' | 'amber'): void {
    const primary = team === 'blue' ? 0x38bdf8 : 0xf59e0b;
    const secondary = team === 'blue' ? 0x60a5fa : 0xfef08a;

    // Trigger shockwave torus
    this.shockwaveMesh.position.set(x, Math.max(2.0, y), z);
    this.shockwaveMesh.scale.setScalar(1);
    this.shockwaveMesh.visible = true;
    this.shockwaveMat.color.setHex(primary);
    this.shockwaveMat.opacity = 0.95;
    this.shockwaveLife = 1.25;

    // Fireworks burst
    for (let i = 0; i < 65; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const spd = 12 + Math.random() * 24;
      this.spawn(
        'firework',
        x,
        Math.max(2.0, y),
        z,
        Math.sin(phi) * Math.cos(theta) * spd,
        Math.abs(Math.cos(phi)) * spd + 5,
        Math.sin(phi) * Math.sin(theta) * spd,
        1.15 + Math.random() * 0.45,
        0.36,
        -12,
        i % 2 === 0 ? primary : secondary
      );
    }

    // Confetti shower high above goal
    const confettiPalette = [0x38bdf8, 0xf59e0b, 0xf43f5e, 0x10b981, 0xf8fafc];
    for (let i = 0; i < 70; i++) {
      this.spawn(
        'confetti',
        x + (Math.random() - 0.5) * 18,
        8 + Math.random() * 9,
        z + (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        3 + Math.random() * 9,
        (Math.random() - 0.5) * 10,
        2.4,
        0.28,
        -5.5,
        confettiPalette[i % confettiPalette.length]
      );
    }
  }

  public update(dt: number): void {
    let dirty = false;

    for (let i = 0; i < this.capacity; i++) {
      const s = this.slots[i];
      if (!s.active) continue;

      dirty = true;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        _dummy.position.set(0, -100, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.instancedParticles.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      s.vy += s.gravity * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      if (s.y < 0.08) {
        s.y = 0.08;
        s.vy *= -0.35;
        s.vx *= 0.7;
        s.vz *= 0.7;
      }
      s.rot += s.rotVel * dt;

      const t = s.life / s.maxLife;
      const scale = s.kind === 'smoke' ? s.size * (1.8 - t) : s.size * t;

      _dummy.position.set(s.x, s.y, s.z);
      _dummy.rotation.set(s.rot, s.rot * 0.7, 0);
      if (s.kind === 'confetti') {
        _dummy.scale.set(scale * 1.4, scale * 0.25, scale * 0.9);
      } else {
        _dummy.scale.setScalar(Math.max(0.01, scale));
      }
      _dummy.updateMatrix();
      this.instancedParticles.setMatrixAt(i, _dummy.matrix);
      this.instancedParticles.setColorAt(i, s.color);
    }

    if (dirty) {
      this.instancedParticles.instanceMatrix.needsUpdate = true;
      if (this.instancedParticles.instanceColor) {
        this.instancedParticles.instanceColor.needsUpdate = true;
      }
    }

    if (this.shockwaveLife > 0) {
      this.shockwaveLife -= dt;
      const progress = 1 - Math.max(0, this.shockwaveLife / 1.25);
      this.shockwaveMesh.scale.setScalar(1 + progress * 22);
      this.shockwaveMat.opacity = Math.max(0, 0.95 * (1 - progress));
      if (this.shockwaveLife <= 0) {
        this.shockwaveMesh.visible = false;
      }
    }
  }

  public dispose(): void {
    this.particleGeom.dispose();
    this.particleMat.dispose();
    this.skidGeom.dispose();
    this.skidMat.dispose();
    this.shockwaveMesh.geometry.dispose();
    this.shockwaveMat.dispose();
  }
}
