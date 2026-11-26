import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARENA_HALF_LENGTH,
  BALL_RADIUS,
  createMatchSimulation,
  resetKickoffPositions,
  stepMatchSimulation,
} from './physics';
import { detectAutoQualityPreset, resolveGraphicsConfig } from './graphicsConfig';
import type { InputState } from './types';

const IDLE_INPUT: InputState = {
  throttle: 0,
  steer: 0,
  boost: false,
  jumpJustPressed: false,
  jumpHeld: false,
  handbrake: false,
  ballCamToggleJustPressed: false,
};

test('match initializes with kickoff countdown and balanced spawns', () => {
  const sim = createMatchSimulation('apex-gt', '2v2');
  assert.equal(sim.cars.length, 4);
  assert.equal(sim.stats.matchPhase, 'kickoff');
  assert.equal(sim.ball.pos.x, 0);
  assert.equal(sim.ball.pos.z, 0);
  assert.equal(sim.ball.pos.y, BALL_RADIUS);
});

test('car accelerates, turns left (+yaw), and boosts forward after kickoff', () => {
  const sim = createMatchSimulation('valkyrie-aero', '1v1');
  sim.stats.matchPhase = 'live';
  const player = sim.cars.find((c) => c.isPlayer)!;
  const startZ = player.pos.z;
  const startBoost = player.boost;

  for (let i = 0; i < 15; i++) {
    stepMatchSimulation(
      sim,
      { ...IDLE_INPUT, throttle: 1, boost: true, steer: 0.5 },
      1 / 60,
      '1v1'
    );
  }

  assert.ok(player.pos.z > startZ + 1.0, 'Player car should move forward (+Z)');
  assert.ok(player.yaw > 0.02, 'Positive steer should turn car left (+yaw)');
  assert.ok(player.boost < startBoost, 'Boosting should consume nitro meter');
  assert.ok(player.speedKmh > 25, 'Car speedometer should reflect movement');
});

test('driving over a boost pad refills nitro and schedules respawn', () => {
  const sim = createMatchSimulation('apex-gt', '1v1');
  sim.stats.matchPhase = 'live';
  const player = sim.cars.find((c) => c.isPlayer)!;
  const pad = sim.boostPads.find((p) => p.isLarge)!;
  player.boost = 10;
  player.pos = { x: pad.x, y: 0.56, z: pad.z };

  stepMatchSimulation(sim, IDLE_INPUT, 1 / 60, '1v1');
  assert.equal(player.boost, 100);
  assert.equal(pad.active, false);
  assert.ok(pad.respawnTimer > 0);
});

test('car-ball collision imparts forward velocity and triggers hit event', () => {
  const sim = createMatchSimulation('titan-v8', '1v1');
  sim.stats.matchPhase = 'live';
  const player = sim.cars.find((c) => c.isPlayer)!;
  player.pos = { x: 0, y: 0.56, z: -3.2 };
  player.vel = { x: 0, y: 0, z: 24 };
  player.yaw = 0;

  let sawHit = false;
  for (let i = 0; i < 10; i++) {
    stepMatchSimulation(sim, { ...IDLE_INPUT, throttle: 1 }, 1 / 60, '1v1');
    if (sim.events.some((e) => e.type === 'car-ball-hit')) {
      sawHit = true;
    }
  }

  assert.ok(sawHit, 'Should emit car-ball-hit event on impact');
  assert.ok(sim.ball.vel.z > 10, 'Ball should accelerate toward opponent goal');
});

test('scoring a goal updates score, switches phase to goal, and resets on kickoff', () => {
  const sim = createMatchSimulation('apex-gt', '1v1');
  sim.stats.matchPhase = 'live';
  sim.ball.pos = { x: 0, y: 2.0, z: ARENA_HALF_LENGTH + BALL_RADIUS * 0.85 };
  sim.ball.lastTouchTeam = 'blue';
  sim.ball.lastTouchCarId = 'player';

  stepMatchSimulation(sim, IDLE_INPUT, 1 / 60, '1v1');

  assert.equal(sim.stats.blueScore, 1);
  assert.equal(sim.stats.playerGoals, 1);
  assert.equal(sim.stats.matchPhase, 'goal');
  assert.ok(sim.events.some((e) => e.type === 'goal' && e.team === 'blue'));

  resetKickoffPositions(sim, '1v1');
  assert.equal(sim.stats.matchPhase, 'kickoff');
  assert.equal(sim.ball.pos.z, 0);
});

test('tie game enters overtime when timer hits zero', () => {
  const sim = createMatchSimulation('apex-gt', '1v1');
  sim.stats.matchPhase = 'live';
  sim.stats.timeRemaining = 0.01;
  sim.stats.blueScore = 2;
  sim.stats.amberScore = 2;

  stepMatchSimulation(sim, IDLE_INPUT, 0.03, '1v1');

  assert.equal(sim.stats.isOvertime, true);
  assert.equal(sim.stats.matchPhase, 'live');
});

test('graphics auto-detection selects LOW on software GL and mobile, ULTRA on high-end desktop', () => {
  assert.equal(
    detectAutoQualityPreset({
      isSoftwareGl: true,
      isMobile: false,
      deviceMemoryGb: 16,
      hardwareConcurrency: 12,
      maxTextureSize: 16384,
      devicePixelRatio: 2,
    }),
    'LOW'
  );

  assert.equal(
    detectAutoQualityPreset({
      isSoftwareGl: false,
      isMobile: true,
      deviceMemoryGb: 4,
      hardwareConcurrency: 4,
      maxTextureSize: 4096,
      devicePixelRatio: 2,
    }),
    'LOW'
  );

  assert.equal(
    detectAutoQualityPreset({
      isSoftwareGl: false,
      isMobile: false,
      deviceMemoryGb: 16,
      hardwareConcurrency: 8,
      maxTextureSize: 16384,
      devicePixelRatio: 2,
    }),
    'ULTRA'
  );

  const ultra = resolveGraphicsConfig(
    'ULTRA',
    {
      isSoftwareGl: false,
      isMobile: false,
      deviceMemoryGb: 16,
      hardwareConcurrency: 8,
      maxTextureSize: 16384,
      devicePixelRatio: 2,
    },
    { motionBlur: true, depthOfField: true }
  );
  assert.equal(ultra.bloomEnabled, true);
  assert.equal(ultra.ssaoEnabled, true);
  assert.equal(ultra.motionBlurEnabled, true);
  assert.equal(ultra.depthOfFieldEnabled, true);
});

test('player reaches kickoff ball well ahead of capped offline AI opponent', () => {
  const sim = createMatchSimulation('apex-gt', '1v1');
  sim.stats.matchPhase = 'live';
  const player = sim.cars.find((c) => c.isPlayer)!;
  const ai = sim.cars.find((c) => !c.isPlayer)!;

  for (let i = 0; i < 45; i++) {
    stepMatchSimulation(sim, { ...IDLE_INPUT, throttle: 1 }, 1 / 60, '1v1');
  }

  const playerDist = Math.hypot(sim.ball.pos.x - player.pos.x, sim.ball.pos.z - player.pos.z);
  const aiDist = Math.hypot(sim.ball.pos.x - ai.pos.x, sim.ball.pos.z - ai.pos.z);

  assert.ok(player.speedKmh > ai.speedKmh, 'Player should move faster than offline AI');
  assert.ok(playerDist < aiDist, 'Player should arrive closer to the kickoff ball than AI');
});

test('steering left moves toward +X (screen left) and steering right moves toward -X (screen right)', () => {
  const simLeft = createMatchSimulation('apex-gt', '1v1');
  simLeft.stats.matchPhase = 'live';
  const pLeft = simLeft.cars.find((c) => c.isPlayer)!;
  pLeft.pos = { x: 0, y: 0.56, z: 0 };
  pLeft.yaw = 0;

  for (let i = 0; i < 20; i++) {
    stepMatchSimulation(simLeft, { ...IDLE_INPUT, throttle: 1, steer: 1 }, 1 / 60, '1v1');
  }
  assert.ok(pLeft.yaw > 0.1, 'Steer +1 (Left) should increase yaw');
  assert.ok(pLeft.pos.x > 0.3, 'Steer +1 (Left) should move car toward +X (screen left)');

  const simRight = createMatchSimulation('apex-gt', '1v1');
  simRight.stats.matchPhase = 'live';
  const pRight = simRight.cars.find((c) => c.isPlayer)!;
  pRight.pos = { x: 0, y: 0.56, z: 0 };
  pRight.yaw = 0;

  for (let i = 0; i < 20; i++) {
    stepMatchSimulation(simRight, { ...IDLE_INPUT, throttle: 1, steer: -1 }, 1 / 60, '1v1');
  }
  assert.ok(pRight.yaw < -0.1, 'Steer -1 (Right) should decrease yaw');
  assert.ok(pRight.pos.x < -0.3, 'Steer -1 (Right) should move car toward -X (screen right)');
});
