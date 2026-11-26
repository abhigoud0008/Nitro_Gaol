import {
  BallPhysicsState,
  BoostPadState,
  CAR_ARCHETYPES,
  CarArchetypeId,
  CarPhysicsState,
  InputState,
  MatchFormat,
  MatchStats,
  PhysicsEvent,
  Vec3,
} from './types';

// Mega Championship Stadium Dimensions (136m x 200m)
export const ARENA_HALF_WIDTH = 68;
export const ARENA_HALF_LENGTH = 100;
export const ARENA_CORNER_RADIUS = 24;
export const ARENA_WALL_HEIGHT = 32;
export const GOAL_HALF_WIDTH = 14;
export const GOAL_HEIGHT = 10.0;
export const GOAL_DEPTH = 9.0;
export const BALL_RADIUS = 2.6;
export const MATCH_DURATION_SECONDS = 180; // 3:00 match

const GRAVITY = -26;
const CAR_RADIUS = 1.7;
const CAR_CHASSIS_HALF_HEIGHT = 0.56;

export interface MatchSimulation {
  cars: CarPhysicsState[];
  ball: BallPhysicsState;
  boostPads: BoostPadState[];
  stats: MatchStats;
  events: PhysicsEvent[];
  simTime: number;
  lastCountdownInt: number;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function createBoostPads(): BoostPadState[] {
  const pads: BoostPadState[] = [];
  // 6 large 100-boost canisters (4 corners + 2 midfield wings)
  const largeCoords: Array<[number, number]> = [
    [-52, -70],
    [52, -70],
    [-52, 70],
    [52, 70],
    [-56, 0],
    [56, 0],
  ];
  largeCoords.forEach(([x, z], idx) => {
    pads.push({
      id: `large-${idx}`,
      x,
      z,
      isLarge: true,
      amount: 100,
      active: true,
      respawnTimer: 0,
    });
  });

  // 16 tactical small boost pads (24 boost) across the mega pitch
  const smallCoords: Array<[number, number]> = [
    [-26, 0],
    [26, 0],
    [0, -22],
    [0, 22],
    [-34, -28],
    [34, -28],
    [-34, 28],
    [34, 28],
    [-20, -64],
    [20, -64],
    [-20, 64],
    [20, 64],
    [0, -76],
    [0, 76],
    [-42, -46],
    [42, 46],
  ];
  smallCoords.forEach(([x, z], idx) => {
    pads.push({
      id: `small-${idx}`,
      x,
      z,
      isLarge: false,
      amount: 24,
      active: true,
      respawnTimer: 0,
    });
  });

  return pads;
}

function createCar(
  id: string,
  team: 'blue' | 'amber',
  isPlayer: boolean,
  archetype: CarArchetypeId,
  x: number,
  z: number,
  yaw: number,
  aiRole: 'striker' | 'sweeper'
): CarPhysicsState {
  return {
    id,
    team,
    isPlayer,
    archetype,
    pos: { x, y: CAR_CHASSIS_HALF_HEIGHT, z },
    vel: { x: 0, y: 0, z: 0 },
    yaw,
    pitch: 0,
    roll: 0,
    angularVelYaw: 0,
    steerAngle: 0,
    wheelSpin: 0,
    suspensionCompression: [0, 0, 0, 0],
    grounded: true,
    airJumpsLeft: 1,
    boost: 45,
    isBoosting: false,
    isDrifting: false,
    speedKmh: 0,
    aiRole,
    flipTimer: 0,
    flipPitchRate: 0,
    flipRollRate: 0,
    lastTouchTime: -10,
  };
}

export function createMatchSimulation(
  playerArchetype: CarArchetypeId,
  format: MatchFormat
): MatchSimulation {
  const cars: CarPhysicsState[] = [];

  if (format === '1v1') {
    cars.push(createCar('player', 'blue', true, playerArchetype, 0, -36, 0, 'striker'));
    cars.push(
      createCar('amber-1', 'amber', false, 'valkyrie-aero', 0, 36, Math.PI, 'striker')
    );
  } else {
    cars.push(createCar('player', 'blue', true, playerArchetype, -12, -36, 0.16, 'striker'));
    cars.push(createCar('blue-ai', 'blue', false, 'titan-v8', 12, -48, -0.14, 'sweeper'));
    cars.push(
      createCar('amber-1', 'amber', false, 'valkyrie-aero', 12, 36, Math.PI + 0.16, 'striker')
    );
    cars.push(
      createCar('amber-2', 'amber', false, 'apex-gt', -12, 48, Math.PI - 0.14, 'sweeper')
    );
  }

  return {
    cars,
    ball: {
      pos: { x: 0, y: BALL_RADIUS, z: 0 },
      vel: { x: 0, y: 0, z: 0 },
      angVel: { x: 0, y: 0, z: 0 },
      radius: BALL_RADIUS,
      lastTouchTeam: null,
      lastTouchCarId: null,
    },
    boostPads: createBoostPads(),
    stats: {
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
      kickoffCountdown: 1.2,
      goalBannerTimer: 0,
      lastScoringTeam: null,
      lastScorerName: '',
    },
    events: [],
    simTime: 0,
    lastCountdownInt: 2,
  };
}

export function resetKickoffPositions(sim: MatchSimulation, format: MatchFormat): void {
  sim.ball.pos = { x: 0, y: BALL_RADIUS, z: 0 };
  sim.ball.vel = { x: 0, y: 0, z: 0 };
  sim.ball.angVel = { x: 0, y: 0, z: 0 };
  sim.ball.lastTouchTeam = null;
  sim.ball.lastTouchCarId = null;

  const spawns1v1: Record<string, [number, number, number]> = {
    player: [0, -36, 0],
    'amber-1': [0, 36, Math.PI],
  };
  const spawns2v2: Record<string, [number, number, number]> = {
    player: [-12, -36, 0.16],
    'blue-ai': [12, -48, -0.14],
    'amber-1': [12, 36, Math.PI + 0.16],
    'amber-2': [-12, 48, Math.PI - 0.14],
  };

  const map = format === '1v1' ? spawns1v1 : spawns2v2;
  for (const car of sim.cars) {
    const spawn =
      map[car.id] ?? [0, car.team === 'blue' ? -36 : 36, car.team === 'blue' ? 0 : Math.PI];
    car.pos = { x: spawn[0], y: CAR_CHASSIS_HALF_HEIGHT, z: spawn[1] };
    car.vel = { x: 0, y: 0, z: 0 };
    car.yaw = spawn[2];
    car.pitch = 0;
    car.roll = 0;
    car.angularVelYaw = 0;
    car.steerAngle = 0;
    car.grounded = true;
    car.airJumpsLeft = 1;
    car.boost = Math.max(car.boost, 45);
    car.isBoosting = false;
    car.isDrifting = false;
    car.flipTimer = 0;
  }

  sim.stats.matchPhase = 'kickoff';
  sim.stats.kickoffCountdown = 1.2;
  sim.lastCountdownInt = 2;
}

function computeAiInput(car: CarPhysicsState, sim: MatchSimulation): InputState {
  const ball = sim.ball;
  const targetGoalZ = car.team === 'blue' ? ARENA_HALF_LENGTH : -ARENA_HALF_LENGTH;
  const ownGoalZ = car.team === 'blue' ? -ARENA_HALF_LENGTH : ARENA_HALF_LENGTH;

  const toGoalX = 0 - ball.pos.x;
  const toGoalZ = targetGoalZ - ball.pos.z;
  const toGoalLen = Math.hypot(toGoalX, toGoalZ) || 1;
  const dirX = toGoalX / toGoalLen;
  const dirZ = toGoalZ / toGoalLen;

  let targetX = ball.pos.x - dirX * 3.0;
  let targetZ = ball.pos.z - dirZ * 3.0;

  if (car.aiRole === 'sweeper') {
    const ballInOwnHalf =
      car.team === 'blue' ? ball.pos.z < 8 : ball.pos.z > -8;
    if (!ballInOwnHalf) {
      targetX = ball.pos.x * 0.45;
      targetZ = ownGoalZ * 0.45;
    }
  }

  targetX = clamp(targetX, -ARENA_HALF_WIDTH + 4, ARENA_HALF_WIDTH - 4);
  targetZ = clamp(targetZ, -ARENA_HALF_LENGTH + 3, ARENA_HALF_LENGTH - 3);

  const dx = targetX - car.pos.x;
  const dz = targetZ - car.pos.z;
  const distToTarget = Math.hypot(dx, dz);

  const desiredYaw = Math.atan2(dx, dz);
  let angleDiff = desiredYaw - car.yaw;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

  const steer = clamp(angleDiff * 2.1, -1, 1);
  const aligned = Math.abs(angleDiff) < 0.45;
  const shouldReverse = Math.abs(angleDiff) > 2.35 && distToTarget < 10;

  const distToBall = Math.hypot(ball.pos.x - car.pos.x, ball.pos.z - car.pos.z);

  // Relaxed AI throttle so offline bots stay comfortably within player movement speed
  let throttle = shouldReverse ? -0.6 : 0.62;
  if (distToBall < 8 && car.team === 'amber') {
    throttle = 0.48;
  }

  const recoveringOnDefense =
    car.team === 'amber'
      ? ball.pos.z > 24 && car.pos.z < ball.pos.z
      : ball.pos.z < -24 && car.pos.z > ball.pos.z;
  const shouldBoost =
    aligned && car.boost > 30 && distToTarget > 28 && recoveringOnDefense;

  const jumpJustPressed =
    car.grounded &&
    aligned &&
    distToBall < 4.8 &&
    ball.pos.y > 2.4 &&
    ball.pos.y < 4.5 &&
    Math.abs(car.vel.x) + Math.abs(car.vel.z) > 14;

  return {
    throttle,
    steer,
    boost: shouldBoost,
    jumpJustPressed,
    jumpHeld: false,
    handbrake: Math.abs(angleDiff) > 1.35 && distToTarget > 10,
    ballCamToggleJustPressed: false,
  };
}

function constrainInsideArena(
  pos: Vec3,
  vel: Vec3,
  radius: number,
  restitution: number,
  allowGoalPocket: boolean
): { hitWall: boolean; impactSpeed: number } {
  let hitWall = false;
  let impactSpeed = 0;

  const inGoalX = Math.abs(pos.x) < GOAL_HALF_WIDTH - radius * 0.25;
  const inGoalY = pos.y < GOAL_HEIGHT - radius * 0.2;
  const inGoalChannel = allowGoalPocket && inGoalX && inGoalY;

  const maxX = ARENA_HALF_WIDTH - radius;
  const maxZ = inGoalChannel
    ? ARENA_HALF_LENGTH + GOAL_DEPTH - radius
    : ARENA_HALF_LENGTH - radius;

  const cornerInnerX = ARENA_HALF_WIDTH - ARENA_CORNER_RADIUS;
  const cornerInnerZ = ARENA_HALF_LENGTH - ARENA_CORNER_RADIUS;

  if (!inGoalChannel && Math.abs(pos.x) > cornerInnerX && Math.abs(pos.z) > cornerInnerZ) {
    const cx = Math.sign(pos.x) * cornerInnerX;
    const cz = Math.sign(pos.z) * cornerInnerZ;
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const dist = Math.hypot(dx, dz) || 0.001;
    const limit = ARENA_CORNER_RADIUS - radius;
    if (dist > limit) {
      const nx = dx / dist;
      const nz = dz / dist;
      pos.x = cx + nx * limit;
      pos.z = cz + nz * limit;
      const vn = vel.x * nx + vel.z * nz;
      if (vn > 0) {
        impactSpeed = Math.max(impactSpeed, vn);
        vel.x -= (1 + restitution) * vn * nx;
        vel.z -= (1 + restitution) * vn * nz;
        hitWall = true;
      }
    }
  } else {
    if (pos.x > maxX) {
      pos.x = maxX;
      if (vel.x > 0) {
        impactSpeed = Math.max(impactSpeed, vel.x);
        vel.x = -vel.x * restitution;
        hitWall = true;
      }
    } else if (pos.x < -maxX) {
      pos.x = -maxX;
      if (vel.x < 0) {
        impactSpeed = Math.max(impactSpeed, -vel.x);
        vel.x = -vel.x * restitution;
        hitWall = true;
      }
    }

    if (pos.z > maxZ) {
      pos.z = maxZ;
      if (vel.z > 0) {
        impactSpeed = Math.max(impactSpeed, vel.z);
        vel.z = -vel.z * restitution;
        hitWall = true;
      }
    } else if (pos.z < -maxZ) {
      pos.z = -maxZ;
      if (vel.z < 0) {
        impactSpeed = Math.max(impactSpeed, -vel.z);
        vel.z = -vel.z * restitution;
        hitWall = true;
      }
    }
  }

  if (allowGoalPocket && Math.abs(pos.z) > ARENA_HALF_LENGTH - radius) {
    const goalSideMaxX = GOAL_HALF_WIDTH - radius;
    if (Math.abs(pos.x) < GOAL_HALF_WIDTH + 1.0 && Math.abs(pos.x) > goalSideMaxX) {
      const signX = Math.sign(pos.x);
      pos.x = signX * goalSideMaxX;
      if (vel.x * signX > 0) {
        vel.x = -vel.x * restitution;
        hitWall = true;
      }
    }
    if (pos.y > GOAL_HEIGHT - radius) {
      pos.y = GOAL_HEIGHT - radius;
      if (vel.y > 0) {
        vel.y = -vel.y * restitution;
        hitWall = true;
      }
    }
  }

  if (pos.y > ARENA_WALL_HEIGHT - radius) {
    pos.y = ARENA_WALL_HEIGHT - radius;
    if (vel.y > 0) {
      vel.y = -vel.y * 0.6;
      hitWall = true;
    }
  }

  return { hitWall, impactSpeed };
}

function stepCar(
  car: CarPhysicsState,
  input: InputState,
  dt: number,
  sim: MatchSimulation
): void {
  const spec = CAR_ARCHETYPES[car.archetype];
  // Right-handed Three.js basis where yaw=0 faces +Z:
  // forward = (sin(yaw), 0, cos(yaw))
  // right   = forward x up = (-cos(yaw), 0, sin(yaw))
  const fwdX = Math.sin(car.yaw);
  const fwdZ = Math.cos(car.yaw);
  const rightX = -Math.cos(car.yaw);
  const rightZ = Math.sin(car.yaw);

  const forwardSpeed = car.vel.x * fwdX + car.vel.z * fwdZ;
  const lateralSpeed = car.vel.x * rightX + car.vel.z * rightZ;

  // Smooth front wheel steering angle (+steer = turn left = +yaw)
  const targetSteerAngle = input.steer * 0.5;
  car.steerAngle += (targetSteerAngle - car.steerAngle) * Math.min(1, dt * 16);

  // Jump & Directional Rocket Dodge Flip
  if (input.jumpJustPressed) {
    if (car.grounded) {
      car.vel.y = 13.0;
      car.grounded = false;
      car.pos.y += 0.06;
      sim.events.push({ type: 'jump', pos: { ...car.pos }, intensity: 0.7 });
    } else if (car.airJumpsLeft > 0) {
      car.airJumpsLeft -= 1;
      car.vel.y = Math.max(car.vel.y * 0.35, 0) + 7.5;
      const dodgeFwd = input.throttle;
      const dodgeLat = input.steer; // +1 = Left (-right), -1 = Right (+right)
      const mag = Math.hypot(dodgeFwd, dodgeLat);
      if (mag > 0.15) {
        const nf = dodgeFwd / mag;
        const nl = dodgeLat / mag;
        // Left dodge pushes along -right; Right dodge pushes along +right
        car.vel.x += (fwdX * nf - rightX * nl) * 14.5;
        car.vel.z += (fwdZ * nf - rightZ * nl) * 14.5;
        car.flipTimer = 0.42;
        car.flipPitchRate = nf * 14.5;
        car.flipRollRate = -nl * 15.0;
      }
      sim.events.push({ type: 'jump', pos: { ...car.pos }, intensity: 1.0 });
    }
  }

  // Boosting
  const canBoost = input.boost && car.boost > 0.5;
  car.isBoosting = canBoost;
  if (canBoost) {
    car.boost = Math.max(0, car.boost - 30 * dt);
  }

  // Responsive Rocket-League-inspired steering & powerslide
  car.isDrifting = car.grounded && input.handbrake && Math.abs(forwardSpeed) > 5;
  const speedFactor = clamp(Math.abs(forwardSpeed) / 5.5, 0.42, 1);
  const reverseSign = forwardSpeed >= -1.2 ? 1 : -1;
  const driftTurnMult = car.isDrifting ? 1.55 : 1.0;
  const targetYawRate =
    input.steer * 3.05 * spec.handling * speedFactor * reverseSign * driftTurnMult;

  if (car.grounded) {
    car.angularVelYaw += (targetYawRate - car.angularVelYaw) * Math.min(1, dt * 19);
  } else {
    car.angularVelYaw += (input.steer * 2.35 - car.angularVelYaw) * Math.min(1, dt * 7.5);
  }
  car.yaw += car.angularVelYaw * dt;

  // Drive & Boost Acceleration (offline AI capped to 62% pace)
  const aiPaceScale = car.isPlayer ? 1.0 : 0.62;
  const effectiveTopSpeed =
    (car.isBoosting ? spec.topSpeed * 1.42 : spec.topSpeed) * aiPaceScale;
  let newFwdSpeed = forwardSpeed;
  if (car.grounded) {
    const accel = (input.throttle >= 0 ? 42 : 32) * aiPaceScale;
    newFwdSpeed += input.throttle * accel * dt;
    if (car.isBoosting) {
      newFwdSpeed += spec.boostAccel * aiPaceScale * dt;
    }
    if (Math.abs(input.throttle) < 0.05 && !car.isBoosting) {
      newFwdSpeed *= Math.exp(-1.5 * dt);
    }
  } else if (car.isBoosting) {
    newFwdSpeed += spec.boostAccel * 0.78 * aiPaceScale * dt;
  }

  newFwdSpeed = clamp(newFwdSpeed, -spec.topSpeed * 0.62 * aiPaceScale, effectiveTopSpeed);

  // High lateral grip for crisp Left/Right cornering (low grip only during handbrake drift)
  const lateralGrip = car.grounded ? (car.isDrifting ? 2.6 : 15.5) : 0.55;
  const newLatSpeed = lateralSpeed * Math.exp(-lateralGrip * dt);

  const newFwdX = Math.sin(car.yaw);
  const newFwdZ = Math.cos(car.yaw);
  const newRightX = -Math.cos(car.yaw);
  const newRightZ = Math.sin(car.yaw);

  car.vel.x = newFwdX * newFwdSpeed + newRightX * newLatSpeed;
  car.vel.z = newFwdZ * newFwdSpeed + newRightZ * newLatSpeed;

  if (!car.grounded) {
    car.vel.y += GRAVITY * dt;
  }

  car.pos.x += car.vel.x * dt;
  car.pos.y += car.vel.y * dt;
  car.pos.z += car.vel.z * dt;

  const wasGrounded = car.grounded;
  if (car.pos.y <= CAR_CHASSIS_HALF_HEIGHT) {
    if (!wasGrounded && car.vel.y < -4) {
      sim.events.push({
        type: 'land',
        pos: { x: car.pos.x, y: 0, z: car.pos.z },
        intensity: clamp(-car.vel.y / 20, 0.2, 1),
      });
    }
    car.pos.y = CAR_CHASSIS_HALF_HEIGHT;
    car.vel.y = 0;
    car.grounded = true;
    car.airJumpsLeft = 1;
    car.flipTimer = 0;
  } else {
    car.grounded = false;
  }

  // Body roll & pitch
  if (car.flipTimer > 0) {
    car.flipTimer = Math.max(0, car.flipTimer - dt);
    car.pitch += car.flipPitchRate * dt;
    car.roll += car.flipRollRate * dt;
  } else if (car.grounded) {
    const targetPitch = -input.throttle * 0.045 - (car.isBoosting ? 0.035 : 0);
    // Turning left (+angularVelYaw) leans body slightly right (+roll)
    const targetRoll = clamp(car.angularVelYaw * 0.035 - lateralSpeed * 0.008, -0.14, 0.14);
    car.pitch += (targetPitch - car.pitch) * Math.min(1, dt * 10);
    car.roll += (targetRoll - car.roll) * Math.min(1, dt * 10);
  } else {
    car.pitch += (input.throttle * 0.28 - car.pitch) * Math.min(1, dt * 3);
    car.roll += (0 - car.roll) * Math.min(1, dt * 4);
  }

  const pitchComp = car.pitch * 0.6;
  const rollComp = car.roll * 0.6;
  car.suspensionCompression = [
    clamp(0.05 + pitchComp - rollComp, 0, 0.16),
    clamp(0.05 + pitchComp + rollComp, 0, 0.16),
    clamp(0.05 - pitchComp - rollComp, 0, 0.16),
    clamp(0.05 - pitchComp + rollComp, 0, 0.16),
  ];

  car.wheelSpin += (newFwdSpeed / 0.42) * dt;

  const wallRes = constrainInsideArena(car.pos, car.vel, CAR_RADIUS, 0.35, true);
  if (wallRes.hitWall && wallRes.impactSpeed > 6) {
    sim.events.push({
      type: 'wall-hit',
      pos: { ...car.pos },
      intensity: clamp(wallRes.impactSpeed / 25, 0.2, 1),
    });
  }

  const horizSpeed = Math.hypot(car.vel.x, car.vel.z);
  car.speedKmh = Math.round(horizSpeed * 3.6);
  if (car.isPlayer && car.speedKmh > sim.stats.topSpeedKmh) {
    sim.stats.topSpeedKmh = car.speedKmh;
  }

  for (const pad of sim.boostPads) {
    if (!pad.active) continue;
    const dx = car.pos.x - pad.x;
    const dz = car.pos.z - pad.z;
    const triggerR = pad.isLarge ? 2.8 : 2.1;
    if (dx * dx + dz * dz < triggerR * triggerR && car.pos.y < 2.4 && car.boost < 99.5) {
      const gained = Math.min(100 - car.boost, pad.amount);
      car.boost = Math.min(100, car.boost + pad.amount);
      pad.active = false;
      pad.respawnTimer = pad.isLarge ? 8.5 : 4.0;
      if (car.isPlayer) {
        sim.stats.boostCollected += Math.round(gained);
        sim.events.push({
          type: 'boost-pickup',
          pos: { x: pad.x, y: 0.4, z: pad.z },
          intensity: pad.isLarge ? 1.0 : 0.6,
        });
      }
    }
  }
}

function stepBall(sim: MatchSimulation, dt: number): void {
  const ball = sim.ball;

  ball.vel.y += GRAVITY * 0.72 * dt;
  const airDrag = Math.exp(-0.16 * dt);
  ball.vel.x *= airDrag;
  ball.vel.z *= airDrag;

  ball.pos.x += ball.vel.x * dt;
  ball.pos.y += ball.vel.y * dt;
  ball.pos.z += ball.vel.z * dt;

  if (ball.pos.y < ball.radius) {
    ball.pos.y = ball.radius;
    if (ball.vel.y < -1.8) {
      ball.vel.y = -ball.vel.y * 0.7;
    } else {
      ball.vel.y = 0;
    }
    const rollFric = Math.exp(-0.38 * dt);
    ball.vel.x *= rollFric;
    ball.vel.z *= rollFric;
  }

  ball.angVel.x = ball.vel.z / ball.radius;
  ball.angVel.z = -ball.vel.x / ball.radius;

  const wallRes = constrainInsideArena(ball.pos, ball.vel, ball.radius, 0.8, true);
  if (wallRes.hitWall && wallRes.impactSpeed > 5) {
    sim.events.push({
      type: 'wall-hit',
      pos: { ...ball.pos },
      intensity: clamp(wallRes.impactSpeed / 30, 0.2, 1),
    });
  }
}

function resolveCarBallCollisions(sim: MatchSimulation): void {
  const ball = sim.ball;
  for (const car of sim.cars) {
    const dx = ball.pos.x - car.pos.x;
    const dy = ball.pos.y - car.pos.y;
    const dz = ball.pos.z - car.pos.z;
    const dist = Math.hypot(dx, dy, dz) || 0.001;
    const minDist = ball.radius + CAR_RADIUS;

    if (dist < minDist) {
      const nx = dx / dist;
      const ny = dy / dist;
      const nz = dz / dist;

      const overlap = minDist - dist;
      ball.pos.x += nx * overlap * 0.84;
      ball.pos.y += ny * overlap * 0.84;
      ball.pos.z += nz * overlap * 0.84;
      car.pos.x -= nx * overlap * 0.16;
      car.pos.z -= nz * overlap * 0.16;

      const relVx = ball.vel.x - car.vel.x;
      const relVy = ball.vel.y - car.vel.y;
      const relVz = ball.vel.z - car.vel.z;
      const relNormal = relVx * nx + relVy * ny + relVz * nz;

      if (relNormal < 0) {
        const spec = CAR_ARCHETYPES[car.archetype];
        const impulse = -1.72 * relNormal * (0.95 + spec.mass * 0.15);
        ball.vel.x += nx * impulse + car.vel.x * 0.25;
        ball.vel.y += Math.max(ny * impulse, 2.4);
        ball.vel.z += nz * impulse + car.vel.z * 0.25;

        const bSpeed = Math.hypot(ball.vel.x, ball.vel.y, ball.vel.z);
        if (bSpeed > 68) {
          const s = 68 / bSpeed;
          ball.vel.x *= s;
          ball.vel.y *= s;
          ball.vel.z *= s;
        }

        car.vel.x -= nx * impulse * 0.12;
        car.vel.z -= nz * impulse * 0.12;

        const isShotTowardAmber =
          car.isPlayer &&
          car.team === 'blue' &&
          ball.vel.z > 16 &&
          Math.abs(ball.pos.x) < 22;
        const isSaveNearBlue =
          car.isPlayer &&
          car.team === 'blue' &&
          car.pos.z < -66 &&
          relNormal < -8 &&
          ball.vel.z > 4;

        if (sim.simTime - car.lastTouchTime > 0.6) {
          if (isShotTowardAmber) sim.stats.playerShots += 1;
          if (isSaveNearBlue) sim.stats.playerSaves += 1;
        }

        car.lastTouchTime = sim.simTime;
        ball.lastTouchTeam = car.team;
        ball.lastTouchCarId = car.id;

        sim.events.push({
          type: 'car-ball-hit',
          pos: {
            x: ball.pos.x - nx * ball.radius,
            y: ball.pos.y - ny * ball.radius,
            z: ball.pos.z - nz * ball.radius,
          },
          intensity: clamp(-relNormal / 26, 0.25, 1.0),
        });
      }
    }
  }
}

function resolveCarCarCollisions(sim: MatchSimulation): void {
  const cars = sim.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.pos.x - a.pos.x;
      const dz = b.pos.z - a.pos.z;
      const dist = Math.hypot(dx, b.pos.y - a.pos.y, dz) || 0.001;
      const minDist = CAR_RADIUS * 2;
      if (dist < minDist) {
        const nx = dx / dist;
        const nz = dz / dist;
        const overlap = (minDist - dist) * 0.5;
        a.pos.x -= nx * overlap;
        a.pos.z -= nz * overlap;
        b.pos.x += nx * overlap;
        b.pos.z += nz * overlap;

        const rvx = b.vel.x - a.vel.x;
        const rvz = b.vel.z - a.vel.z;
        const vn = rvx * nx + rvz * nz;
        if (vn < 0) {
          const jImp = -0.65 * vn;
          a.vel.x -= nx * jImp;
          a.vel.z -= nz * jImp;
          b.vel.x += nx * jImp;
          b.vel.z += nz * jImp;
          if (-vn > 7) {
            sim.events.push({
              type: 'car-car-hit',
              pos: {
                x: (a.pos.x + b.pos.x) * 0.5,
                y: (a.pos.y + b.pos.y) * 0.5,
                z: (a.pos.z + b.pos.z) * 0.5,
              },
              intensity: clamp(-vn / 26, 0.25, 1),
            });
          }
        }
      }
    }
  }
}

function applyGoalExplosionKnockback(sim: MatchSimulation, goalPos: Vec3): void {
  for (const car of sim.cars) {
    const dx = car.pos.x - goalPos.x;
    const dy = car.pos.y - goalPos.y + 1.5;
    const dz = car.pos.z - goalPos.z;
    const dist = Math.hypot(dx, dy, dz) || 1;
    const force = clamp(42 - dist * 0.35, 12, 36);
    car.vel.x += (dx / dist) * force;
    car.vel.y += Math.max(8, (dy / dist) * force * 0.65);
    car.vel.z += (dz / dist) * force;
    car.grounded = false;
  }
}

function checkGoalScored(sim: MatchSimulation): 'blue' | 'amber' | null {
  const b = sim.ball;
  if (Math.abs(b.pos.x) > GOAL_HALF_WIDTH || b.pos.y > GOAL_HEIGHT) {
    return null;
  }
  if (b.pos.z > ARENA_HALF_LENGTH + b.radius * 0.72) {
    return 'blue';
  }
  if (b.pos.z < -(ARENA_HALF_LENGTH + b.radius * 0.72)) {
    return 'amber';
  }
  return null;
}

export function stepMatchSimulation(
  sim: MatchSimulation,
  playerInput: InputState,
  rawDt: number,
  format: MatchFormat
): void {
  const dt = Math.min(rawDt, 0.05);
  sim.events.length = 0;

  if (sim.stats.matchPhase === 'ended') {
    return;
  }

  for (const pad of sim.boostPads) {
    if (!pad.active) {
      pad.respawnTimer -= dt;
      if (pad.respawnTimer <= 0) {
        pad.active = true;
        pad.respawnTimer = 0;
      }
    }
  }

  if (sim.stats.matchPhase === 'kickoff') {
    sim.stats.kickoffCountdown -= dt;
    const countInt = Math.ceil(sim.stats.kickoffCountdown);
    if (countInt !== sim.lastCountdownInt && countInt > 0) {
      sim.lastCountdownInt = countInt;
      sim.events.push({
        type: 'countdown-tick',
        pos: { x: 0, y: 0, z: 0 },
        intensity: 1,
      });
    }
    if (sim.stats.kickoffCountdown <= 0) {
      sim.stats.kickoffCountdown = 0;
      sim.stats.matchPhase = 'live';
      sim.events.push({
        type: 'kickoff-go',
        pos: { x: 0, y: 0, z: 0 },
        intensity: 1,
      });
    }
    return;
  }

  if (sim.stats.matchPhase === 'goal') {
    sim.stats.goalBannerTimer -= dt;
    const slowDt = dt * 0.35;
    sim.simTime += slowDt;
    for (const car of sim.cars) {
      stepCar(
        car,
        {
          throttle: 0,
          steer: 0,
          boost: false,
          jumpJustPressed: false,
          jumpHeld: false,
          handbrake: false,
          ballCamToggleJustPressed: false,
        },
        slowDt,
        sim
      );
    }
    stepBall(sim, slowDt);
    return;
  }

  sim.simTime += dt;

  if (!sim.stats.isOvertime) {
    sim.stats.timeRemaining -= dt;
    if (sim.stats.timeRemaining <= 0) {
      sim.stats.timeRemaining = 0;
      if (sim.stats.blueScore === sim.stats.amberScore) {
        sim.stats.isOvertime = true;
      } else {
        sim.stats.matchPhase = 'ended';
        return;
      }
    }
  }

  for (const car of sim.cars) {
    const input = car.isPlayer ? playerInput : computeAiInput(car, sim);
    stepCar(car, input, dt, sim);
  }

  stepBall(sim, dt);
  resolveCarBallCollisions(sim);
  resolveCarCarCollisions(sim);

  const scoringTeam = checkGoalScored(sim);
  if (scoringTeam) {
    if (scoringTeam === 'blue') {
      sim.stats.blueScore += 1;
      if (sim.ball.lastTouchCarId === 'player') {
        sim.stats.playerGoals += 1;
      }
    } else {
      sim.stats.amberScore += 1;
    }
    sim.stats.lastScoringTeam = scoringTeam;
    sim.stats.lastScorerName =
      sim.ball.lastTouchTeam === scoringTeam
        ? sim.ball.lastTouchCarId === 'player'
          ? 'YOU'
          : scoringTeam === 'blue'
            ? 'BLUE WING'
            : 'AMBER STRIKER'
        : scoringTeam === 'blue'
          ? 'BLUE TEAM'
          : 'AMBER TEAM';

    applyGoalExplosionKnockback(sim, sim.ball.pos);

    sim.events.push({
      type: 'goal',
      pos: { ...sim.ball.pos },
      intensity: 1,
      team: scoringTeam,
      scorerName: sim.stats.lastScorerName,
    });

    if (sim.stats.isOvertime) {
      sim.stats.matchPhase = 'ended';
    } else {
      sim.stats.matchPhase = 'goal';
      sim.stats.goalBannerTimer = 2.6;
    }
  }
}
