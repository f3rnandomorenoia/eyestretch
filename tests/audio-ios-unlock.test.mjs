import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioController } from '../src/audio.js';

let gestureActive = false;
let pendingResumeResolvers = [];

function withUserGesture(fn) {
  gestureActive = true;
  try {
    return fn();
  } finally {
    gestureActive = false;
  }
}

async function flushMicrotasks(times = 3) {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

class FakeAudioParam {
  setValueAtTime() {}
  exponentialRampToValueAtTime() {}
  linearRampToValueAtTime() {}
}

class FakeGainNode {
  constructor(ctx) {
    this.ctx = ctx;
    this.gain = new FakeAudioParam();
  }

  connect(target) {
    this.target = target;
    return target;
  }
}

class FakeOscillatorNode {
  constructor(ctx) {
    this.ctx = ctx;
    this.frequency = new FakeAudioParam();
    this.type = 'sine';
  }

  connect(target) {
    this.target = target;
    return target;
  }

  start() {
    if (gestureActive) {
      this.ctx.__primedInGesture = true;
    }

    if (this.ctx.state === 'running') {
      this.ctx.__audibleStarts += 1;
    }
  }

  stop() {}
}

class FakeBufferSourceNode {
  constructor(ctx) {
    this.ctx = ctx;
    this.buffer = null;
  }

  connect(target) {
    this.target = target;
    return target;
  }

  start() {
    if (gestureActive) {
      this.ctx.__primedInGesture = true;
    }

    if (this.ctx.state === 'running') {
      this.ctx.__audibleStarts += 1;
    }
  }

  stop() {}
}

class FakeAudioContext {
  static lastInstance = null;

  constructor() {
    this.state = 'suspended';
    this.currentTime = 0;
    this.destination = { kind: 'destination' };
    this.__primedInGesture = false;
    this.__audibleStarts = 0;
    FakeAudioContext.lastInstance = this;
  }

  createOscillator() {
    return new FakeOscillatorNode(this);
  }

  createGain() {
    return new FakeGainNode(this);
  }

  createBuffer() {
    return { kind: 'buffer' };
  }

  createBufferSource() {
    return new FakeBufferSourceNode(this);
  }

  resume() {
    return new Promise(resolve => {
      pendingResumeResolvers.push(() => {
        if (this.__primedInGesture) {
          this.state = 'running';
        }
        resolve();
      });
    });
  }
}

function resolveAllPendingResumes() {
  const resolvers = [...pendingResumeResolvers];
  pendingResumeResolvers = [];
  resolvers.forEach(resolve => resolve());
}

function installFakeWindow() {
  FakeAudioContext.lastInstance = null;
  pendingResumeResolvers = [];
  global.window = {
    AudioContext: FakeAudioContext,
    webkitAudioContext: FakeAudioContext
  };
}

test.beforeEach(() => {
  installFakeWindow();
});

test.afterEach(() => {
  delete global.window;
});

test('unlockAudio deja el contexto en running en un Safari/iPhone simulado', async () => {
  const audio = createAudioController();

  withUserGesture(() => {
    audio.unlockAudio();
  });

  resolveAllPendingResumes();
  await flushMicrotasks();

  assert.equal(FakeAudioContext.lastInstance?.state, 'running');
});

test('un beep disparado después del tap inicial sigue sonando tras el unlock', async () => {
  const audio = createAudioController();

  withUserGesture(() => {
    audio.unlockAudio();
  });

  audio.playBlinkBeep();
  assert.equal(FakeAudioContext.lastInstance?.__audibleStarts, 0);

  resolveAllPendingResumes();
  await flushMicrotasks();

  assert.equal(FakeAudioContext.lastInstance?.state, 'running');
  assert.equal(FakeAudioContext.lastInstance?.__audibleStarts, 1);
});
