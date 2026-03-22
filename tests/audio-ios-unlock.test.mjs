import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioController } from '../src/audio.js';

let gestureActive = false;
let pendingResumeResolvers = [];
let htmlAudioUnlocked = false;
let createdHtmlAudioElements = [];

function withUserGesture(fn) {
  gestureActive = true;
  try {
    return fn();
  } finally {
    gestureActive = false;
  }
}

async function flushMicrotasks(times = 4) {
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

    if (this.ctx.state === 'running' && (!this.ctx.__requiresHtmlAudioUnlock || htmlAudioUnlocked)) {
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

    if (this.ctx.state === 'running' && (!this.ctx.__requiresHtmlAudioUnlock || htmlAudioUnlocked)) {
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
    this.sampleRate = 44100;
    this.destination = { kind: 'destination' };
    this.__primedInGesture = false;
    this.__audibleStarts = 0;
    this.__requiresHtmlAudioUnlock = true;
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

class FakeHtmlAudioElement {
  constructor() {
    this.loop = false;
    this.preload = 'auto';
    this.playsInline = true;
    this.src = '';
    this.attributes = new Map();
    this.playCount = 0;
    createdHtmlAudioElements.push(this);
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  load() {}

  pause() {}

  play() {
    return new Promise((resolve, reject) => {
      if (!gestureActive && !htmlAudioUnlocked) {
        reject(new Error('NotAllowedError'));
        return;
      }

      this.playCount += 1;
      htmlAudioUnlocked = true;
      resolve();
    });
  }
}

function resolveAllPendingResumes() {
  const resolvers = [...pendingResumeResolvers];
  pendingResumeResolvers = [];
  resolvers.forEach(resolve => resolve());
}

function installFakeDomEnvironment() {
  FakeAudioContext.lastInstance = null;
  pendingResumeResolvers = [];
  htmlAudioUnlocked = false;
  createdHtmlAudioElements = [];

  global.window = {
    AudioContext: FakeAudioContext,
    webkitAudioContext: FakeAudioContext,
    btoa: input => Buffer.from(input, 'binary').toString('base64')
  };

  global.document = {
    createElement(tagName) {
      if (tagName !== 'audio') {
        throw new Error(`Unexpected element request: ${tagName}`);
      }
      return new FakeHtmlAudioElement();
    }
  };

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      maxTouchPoints: 5,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile Safari/604.1'
    }
  });
}

test.beforeEach(() => {
  installFakeDomEnvironment();
});

test.afterEach(() => {
  delete global.window;
  delete global.document;
  delete global.navigator;
});

test('unlockAudio deja el contexto en running en un Safari/iPhone simulado', async () => {
  const audio = createAudioController();

  withUserGesture(() => {
    void audio.unlockAudio();
  });

  resolveAllPendingResumes();
  await flushMicrotasks();

  assert.equal(FakeAudioContext.lastInstance?.state, 'running');
});

test('en iPhone simulado con mute switch, unlockAudio activa el workaround HTML audio', async () => {
  const audio = createAudioController();

  withUserGesture(() => {
    void audio.unlockAudio();
  });

  resolveAllPendingResumes();
  await flushMicrotasks();

  const debug = audio.getDebugState();
  assert.equal(debug.contextState, 'running');
  assert.equal(debug.htmlAudioState, 'allowed');
  assert.equal(htmlAudioUnlocked, true);
});

test('un beep disparado después del tap inicial sigue sonando tras el unlock', async () => {
  const audio = createAudioController();

  withUserGesture(() => {
    void audio.unlockAudio();
  });

  audio.playBlinkBeep();
  assert.equal(FakeAudioContext.lastInstance?.__audibleStarts, 0);

  resolveAllPendingResumes();
  await flushMicrotasks();

  assert.equal(FakeAudioContext.lastInstance?.state, 'running');

  const nonLoopingHtmlAudioPlayed = createdHtmlAudioElements.filter(el => el.playCount > 0 && el.loop === false).length;
  assert.ok(
    FakeAudioContext.lastInstance?.__audibleStarts === 1 || nonLoopingHtmlAudioPlayed >= 1,
    'expected audible playback via Web Audio or HTML audio fallback'
  );
});

test('en iPhone simulado, los pitidos usan un fallback de HTML audio reproducible', async () => {
  const audio = createAudioController();

  withUserGesture(() => {
    void audio.unlockAudio();
  });

  resolveAllPendingResumes();
  await flushMicrotasks();

  audio.playBlinkBeep();
  await flushMicrotasks();

  const playedNonLoopingHtmlAudio = createdHtmlAudioElements.filter(el => el.playCount > 0 && el.loop === false);
  assert.ok(playedNonLoopingHtmlAudio.length >= 1, 'expected at least one non-looping HTML audio playback for the beep');
});
