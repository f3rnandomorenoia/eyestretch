// @ts-check

export function createAudioController() {
    /** @type {AudioContext | null} */
    let audioContext = null;

    /** @type {Promise<boolean> | null} */
    let unlockPromise = null;

    /** @type {Array<(ctx: AudioContext) => void>} */
    let pendingPlaybackTasks = [];

    /** @type {HTMLAudioElement | null} */
    let htmlUnmuteAudio = null;

    /** @type {Promise<boolean> | null} */
    let htmlUnmutePromise = null;

    /** @type {'idle' | 'pending' | 'allowed' | 'failed' | 'not-needed'} */
    let htmlAudioState = 'idle';

    let hasPrimedAudio = false;

    function isIosWebkitAudioEnvironment() {
        if (typeof navigator === 'undefined' || typeof window === 'undefined') {
            return false;
        }

        const ua = navigator.userAgent || '';
        const platform = navigator.platform || '';
        const touchPoints = navigator.maxTouchPoints || 0;

        const isiPhoneOrIPadUA = /iPad|iPhone|iPod/i.test(ua);
        const isiPadOsDesktopMode = platform === 'MacIntel' && touchPoints > 1;
        const hasWebAudio = !!(window.AudioContext || window.webkitAudioContext);

        return hasWebAudio && (isiPhoneOrIPadUA || isiPadOsDesktopMode);
    }

    function getAudioContext() {
        if (!audioContext) {
            const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextCtor) {
                throw new Error('Web Audio API no soportada en este navegador');
            }
            audioContext = new AudioContextCtor();
        }
        return audioContext;
    }

    function flushPendingPlaybackTasks() {
        if (!audioContext || audioContext.state !== 'running' || pendingPlaybackTasks.length === 0) {
            return;
        }

        const tasks = pendingPlaybackTasks;
        pendingPlaybackTasks = [];

        tasks.forEach(task => {
            try {
                task(audioContext);
            } catch {
                // ignore individual playback failures
            }
        });
    }

    /**
     * Safari/iPhone puede dejar Web Audio en `running` pero aún así seguir
     * silenciado si el interruptor físico de silencio está activado. Este WAV
     * silencioso por etiqueta <audio> fuerza la sesión de reproducción correcta.
     * Basado en la técnica de `unmute-ios-audio`.
     *
     * @param {number} sampleRate
     */
    function createSilentAudioDataUri(sampleRate) {
        const arrayBuffer = new ArrayBuffer(10);
        const dataView = new DataView(arrayBuffer);

        dataView.setUint32(0, sampleRate, true);
        dataView.setUint32(4, sampleRate, true);
        dataView.setUint16(8, 1, true);

        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        bytes.forEach(byte => {
            binary += String.fromCharCode(byte);
        });

        const missingCharacters = window.btoa(binary).slice(0, 13);
        return `data:audio/wav;base64,UklGRisAAABXQVZFZm10IBAAAAABAAEA${missingCharacters}AgAZGF0YQcAAACAgICAgICAAAA=`;
    }

    function ensureHtmlUnmuteAudioElement(ctx) {
        if (htmlUnmuteAudio || typeof document === 'undefined' || !document.createElement) {
            return htmlUnmuteAudio;
        }

        const audioEl = document.createElement('audio');
        audioEl.setAttribute('x-webkit-airplay', 'deny');
        audioEl.preload = 'auto';
        audioEl.loop = true;
        audioEl.playsInline = true;
        audioEl.src = createSilentAudioDataUri(typeof ctx.sampleRate === 'number' && ctx.sampleRate > 0 ? ctx.sampleRate : 44100);
        audioEl.load();

        htmlUnmuteAudio = audioEl;
        return htmlUnmuteAudio;
    }

    async function ensureHtmlAudioUnlocked() {
        if (!isIosWebkitAudioEnvironment()) {
            htmlAudioState = 'not-needed';
            return true;
        }

        if (htmlAudioState === 'allowed') {
            return true;
        }

        if (htmlUnmutePromise) {
            return htmlUnmutePromise;
        }

        htmlUnmutePromise = (async () => {
            try {
                const ctx = getAudioContext();
                const audioEl = ensureHtmlUnmuteAudioElement(ctx);

                if (!audioEl || typeof audioEl.play !== 'function') {
                    htmlAudioState = 'failed';
                    htmlUnmutePromise = null;
                    return false;
                }

                htmlAudioState = 'pending';
                await audioEl.play();
                htmlAudioState = 'allowed';
                return true;
            } catch {
                htmlAudioState = 'failed';
                htmlUnmutePromise = null;
                return false;
            }
        })();

        return htmlUnmutePromise;
    }

    /**
     * iOS/Safari a veces no queda realmente desbloqueado solo con resume().
     * Reproducimos un buffer silencioso dentro del gesto del usuario para "primar"
     * el audio antes de lanzar los tonos reales.
     *
     * @param {AudioContext} ctx
     */
    function primeAudioContext(ctx) {
        if (hasPrimedAudio) return;

        try {
            const gainNode = ctx.createGain();
            gainNode.connect(ctx.destination);
            gainNode.gain.setValueAtTime(0, ctx.currentTime);

            if (typeof ctx.createBuffer === 'function' && typeof ctx.createBufferSource === 'function') {
                const sampleRate = typeof ctx.sampleRate === 'number' && ctx.sampleRate > 0 ? ctx.sampleRate : 44100;
                const buffer = ctx.createBuffer(1, 1, sampleRate);
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(gainNode);
                source.start(ctx.currentTime);
                hasPrimedAudio = true;
                return;
            }

            const oscillator = ctx.createOscillator();
            oscillator.connect(gainNode);
            oscillator.frequency.value = 1;
            oscillator.type = 'sine';
            oscillator.start(ctx.currentTime);
            hasPrimedAudio = true;

            try {
                oscillator.stop(ctx.currentTime + 0.001);
            } catch {
                // ignore
            }
        } catch {
            // ignore; we'll still try resume()
        }
    }

    function unlockAudio() {
        let ctx;
        try {
            ctx = getAudioContext();
        } catch {
            return Promise.resolve(false);
        }

        if (
            ctx.state === 'running' &&
            (htmlAudioState === 'allowed' || htmlAudioState === 'not-needed' || !isIosWebkitAudioEnvironment()) &&
            (htmlPatternAudioState === 'allowed' || htmlPatternAudioState === 'not-needed' || !shouldPreferHtmlAudioPlayback())
        ) {
            flushPendingPlaybackTasks();
            return Promise.resolve(true);
        }

        if (unlockPromise) {
            return unlockPromise;
        }

        unlockPromise = (async () => {
            try {
                const htmlAudioPromise = ensureHtmlAudioUnlocked();
                const htmlPatternPromise = primeKnownHtmlPatternPlayers();

                primeAudioContext(ctx);

                if (typeof ctx.resume === 'function' && ctx.state !== 'running') {
                    await ctx.resume();
                }

                await htmlAudioPromise;
                await htmlPatternPromise;
            } catch {
                // ignore and let the caller retry on the next user gesture
            }

            const isReady =
                ctx.state === 'running' &&
                (htmlAudioState === 'allowed' || htmlAudioState === 'not-needed' || !isIosWebkitAudioEnvironment()) &&
                (htmlPatternAudioState === 'allowed' || htmlPatternAudioState === 'not-needed' || !shouldPreferHtmlAudioPlayback());

            if (isReady) {
                flushPendingPlaybackTasks();
                return true;
            }

            unlockPromise = null;
            return false;
        })();

        return unlockPromise;
    }

    /**
     * @param {(ctx: AudioContext) => void} task
     */
    function withReadyAudioContext(task) {
        let ctx;
        try {
            ctx = getAudioContext();
        } catch {
            return;
        }

        const htmlReady = htmlAudioState === 'allowed' || htmlAudioState === 'not-needed' || !isIosWebkitAudioEnvironment();
        const htmlPatternReady = htmlPatternAudioState === 'allowed' || htmlPatternAudioState === 'not-needed' || !shouldPreferHtmlAudioPlayback();
        if (ctx.state === 'running' && htmlReady && htmlPatternReady) {
            task(ctx);
            return;
        }

        pendingPlaybackTasks.push(task);
        void unlockAudio();
    }

    const htmlToneCache = new Map();

    /** @type {Map<string, { config: any, players: HTMLAudioElement[], nextIndex: number, primed: boolean }>} */
    const htmlPatternPlayers = new Map();

    let htmlPatternAudioState = 'idle';

    function shouldPreferHtmlAudioPlayback() {
        return isIosWebkitAudioEnvironment();
    }

    /**
     * @param {number} phase
     * @param {OscillatorType | 'triangle'} waveType
     */
    function sampleWave(phase, waveType) {
        switch (waveType) {
            case 'square':
                return Math.sign(Math.sin(phase)) || 1;
            case 'sawtooth': {
                const normalized = phase / (Math.PI * 2);
                return 2 * (normalized - Math.floor(normalized + 0.5));
            }
            case 'triangle':
                return (2 / Math.PI) * Math.asin(Math.sin(phase));
            case 'sine':
            default:
                return Math.sin(phase);
        }
    }

    /**
     * @param {{
     *   totalDurationSeconds: number,
     *   masterVolume: number,
     *   waveType?: OscillatorType | 'triangle',
     *   events: Array<{ frequency: number, startSeconds?: number, durationSeconds: number, gain?: number }>
     * }} config
     */
    function createToneAudioDataUri(config) {
        const key = JSON.stringify(config);
        const cached = htmlToneCache.get(key);
        if (cached) return cached;

        const sampleRate = 44100;
        const totalFrames = Math.max(1, Math.ceil(config.totalDurationSeconds * sampleRate));
        const bytesPerSample = 2;
        const numChannels = 1;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = totalFrames * blockAlign;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);

        const writeString = (offset, value) => {
            for (let i = 0; i < value.length; i += 1) {
                view.setUint8(offset + i, value.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, dataSize, true);

        const waveType = config.waveType ?? 'triangle';

        for (let frame = 0; frame < totalFrames; frame += 1) {
            const time = frame / sampleRate;
            let mixedSample = 0;

            config.events.forEach(event => {
                const startSeconds = event.startSeconds ?? 0;
                const endSeconds = startSeconds + event.durationSeconds;
                if (time < startSeconds || time > endSeconds) return;

                const localTime = time - startSeconds;
                const attack = Math.min(0.015, event.durationSeconds / 4);
                const release = Math.min(0.08, event.durationSeconds / 3);
                const attackGain = attack > 0 ? Math.min(1, localTime / attack) : 1;
                const releaseGain = release > 0 ? Math.min(1, (endSeconds - time) / release) : 1;
                const envelope = Math.max(0, Math.min(attackGain, releaseGain));
                const amplitude = (event.gain ?? 1) * config.masterVolume;
                mixedSample += sampleWave(localTime * event.frequency * Math.PI * 2, waveType) * amplitude * envelope;
            });

            const clamped = Math.max(-1, Math.min(1, mixedSample));
            view.setInt16(44 + frame * 2, clamped * 0x7fff, true);
        }

        const bytes = new Uint8Array(buffer);
        let binary = '';
        bytes.forEach(byte => {
            binary += String.fromCharCode(byte);
        });

        const dataUri = `data:audio/wav;base64,${window.btoa(binary)}`;
        htmlToneCache.set(key, dataUri);
        return dataUri;
    }

    /**
     * @param {number} frequency
     * @param {number} durationSeconds
     * @param {number} volume
     * @param {OscillatorType | 'triangle'} [waveType]
     */
    function createSingleToneConfig(frequency, durationSeconds, volume, waveType = 'triangle') {
        return {
            totalDurationSeconds: durationSeconds,
            masterVolume: Math.max(0.15, Math.min(0.95, volume * 1.8)),
            waveType,
            events: [{ frequency, durationSeconds, gain: 1 }]
        };
    }

    function getBlinkToneConfig() {
        return createSingleToneConfig(659.25, 0.18, 0.22, 'triangle');
    }

    function getCloseEyesToneConfig() {
        return createSingleToneConfig(440, 0.35, 0.24, 'triangle');
    }

    function getNearToneConfig() {
        return createSingleToneConfig(783.99, 0.18, 0.22, 'triangle');
    }

    function getFarToneConfig() {
        return createSingleToneConfig(523.25, 0.18, 0.22, 'triangle');
    }

    function getDiagnosticToneConfig() {
        return createSingleToneConfig(880, 1.1, 0.42, 'triangle');
    }

    function getOpenEyesToneConfig() {
        return {
            totalDurationSeconds: 0.45,
            masterVolume: 0.42,
            waveType: 'triangle',
            events: [
                { frequency: 523.25, durationSeconds: 0.45, gain: 0.9 },
                { frequency: 659.25, durationSeconds: 0.45, gain: 0.9 }
            ]
        };
    }

    function getSuccessToneConfig() {
        const freqs = [523.25, 659.25, 783.99, 1046.5];
        return {
            totalDurationSeconds: 0.65,
            masterVolume: 0.38,
            waveType: 'triangle',
            events: freqs.map((frequency, i) => ({
                frequency,
                startSeconds: i * 0.1,
                durationSeconds: 0.32,
                gain: 0.95
            }))
        };
    }

    function getExerciseEndToneConfig() {
        return {
            totalDurationSeconds: 0.36,
            masterVolume: 0.38,
            waveType: 'triangle',
            events: [
                { frequency: 440, startSeconds: 0, durationSeconds: 0.16, gain: 1 },
                { frequency: 660, startSeconds: 0.1, durationSeconds: 0.16, gain: 0.95 },
                { frequency: 880, startSeconds: 0.2, durationSeconds: 0.16, gain: 0.9 }
            ]
        };
    }

    function getKnownHtmlToneConfigs() {
        return [
            getBlinkToneConfig(),
            getCloseEyesToneConfig(),
            getNearToneConfig(),
            getFarToneConfig(),
            getDiagnosticToneConfig(),
            getOpenEyesToneConfig(),
            getSuccessToneConfig(),
            getExerciseEndToneConfig()
        ];
    }

    /**
     * @param {{
     *   totalDurationSeconds: number,
     *   masterVolume: number,
     *   waveType?: OscillatorType | 'triangle',
     *   events: Array<{ frequency: number, startSeconds?: number, durationSeconds: number, gain?: number }>
     * }} config
     */
    function ensureHtmlPatternEntry(config) {
        const key = JSON.stringify(config);
        const existing = htmlPatternPlayers.get(key);
        if (existing) return existing;

        if (typeof document === 'undefined' || !document.createElement) {
            const emptyEntry = { config, players: [], nextIndex: 0, primed: false };
            htmlPatternPlayers.set(key, emptyEntry);
            return emptyEntry;
        }

        const players = Array.from({ length: 2 }, () => {
            const audioEl = document.createElement('audio');
            audioEl.setAttribute('x-webkit-airplay', 'deny');
            audioEl.preload = 'auto';
            audioEl.loop = false;
            audioEl.playsInline = true;
            audioEl.src = createToneAudioDataUri(config);
            audioEl.load?.();
            return audioEl;
        });

        const entry = { config, players, nextIndex: 0, primed: false };
        htmlPatternPlayers.set(key, entry);
        return entry;
    }

    async function primeHtmlPatternEntry(entry) {
        if (!shouldPreferHtmlAudioPlayback()) {
            htmlPatternAudioState = 'not-needed';
            return true;
        }

        if (entry.primed) return true;
        if (!entry.players.length) {
            htmlPatternAudioState = 'failed';
            return false;
        }

        htmlPatternAudioState = 'pending';
        let primedCount = 0;

        for (const audioEl of entry.players) {
            try {
                audioEl.muted = true;
                audioEl.currentTime = 0;
                const playPromise = audioEl.play?.();
                if (playPromise && typeof playPromise.then === 'function') {
                    await playPromise;
                }
                audioEl.pause?.();
                audioEl.currentTime = 0;
                audioEl.muted = false;
                primedCount += 1;
            } catch {
                try {
                    audioEl.pause?.();
                    audioEl.currentTime = 0;
                    audioEl.muted = false;
                } catch {
                    // ignore
                }
            }
        }

        entry.primed = primedCount > 0;
        htmlPatternAudioState = entry.primed ? 'allowed' : 'failed';
        return entry.primed;
    }

    async function primeKnownHtmlPatternPlayers() {
        if (!shouldPreferHtmlAudioPlayback()) {
            htmlPatternAudioState = 'not-needed';
            return true;
        }

        const entries = getKnownHtmlToneConfigs().map(config => ensureHtmlPatternEntry(config));
        const results = await Promise.all(entries.map(entry => primeHtmlPatternEntry(entry)));
        const ok = results.some(Boolean);
        htmlPatternAudioState = ok ? 'allowed' : 'failed';
        return ok;
    }

    /**
     * @param {{
     *   totalDurationSeconds: number,
     *   masterVolume: number,
     *   waveType?: OscillatorType | 'triangle',
     *   events: Array<{ frequency: number, startSeconds?: number, durationSeconds: number, gain?: number }>
     * }} config
     */
    function playHtmlAudioPattern(config) {
        const entry = ensureHtmlPatternEntry(config);
        if (!entry.players.length) return;

        const audioEl = entry.players[entry.nextIndex % entry.players.length];
        entry.nextIndex = (entry.nextIndex + 1) % entry.players.length;

        try {
            audioEl.pause?.();
            audioEl.muted = false;
            audioEl.currentTime = 0;
            const playPromise = audioEl.play?.();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {
                    // ignore playback rejection on Safari
                });
            }
        } catch {
            // ignore
        }
    }

    /**
     * @param {number} frequency
     * @param {number} durationSeconds
     * @param {number} volume
     * @param {OscillatorType} [waveType]
     */
    function playSingleTone(frequency, durationSeconds, volume, waveType = 'sine') {
        withReadyAudioContext(ctx => {
            if (shouldPreferHtmlAudioPlayback()) {
                playHtmlAudioPattern(createSingleToneConfig(frequency, durationSeconds, volume, waveType));
                return;
            }

            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.frequency.value = frequency;
            oscillator.type = waveType;

            gainNode.gain.setValueAtTime(volume, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + durationSeconds);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + durationSeconds);
        });
    }

    function playBlinkBeep() {
        playSingleTone(659.25, 0.18, 0.22, 'triangle');
    }

    function playCloseEyesBeep() {
        playSingleTone(440, 0.35, 0.24, 'triangle');
    }

    function playOpenEyesBeep() {
        withReadyAudioContext(ctx => {
            if (shouldPreferHtmlAudioPlayback()) {
                playHtmlAudioPattern(getOpenEyesToneConfig());
                return;
            }

            const oscillator1 = ctx.createOscillator();
            const oscillator2 = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator1.connect(gainNode);
            oscillator2.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator1.frequency.value = 523.25; // C5
            oscillator2.frequency.value = 659.25; // E5
            oscillator1.type = 'triangle';
            oscillator2.type = 'triangle';

            gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);

            oscillator1.start(ctx.currentTime);
            oscillator2.start(ctx.currentTime);
            oscillator1.stop(ctx.currentTime + 0.45);
            oscillator2.stop(ctx.currentTime + 0.45);
        });
    }

    function playNearBeep() {
        playSingleTone(783.99, 0.18, 0.22, 'triangle');
    }

    function playFarBeep() {
        playSingleTone(523.25, 0.18, 0.22, 'triangle');
    }

    function playSuccessSound() {
        withReadyAudioContext(ctx => {
            const freqs = [523.25, 659.25, 783.99, 1046.5];

            if (shouldPreferHtmlAudioPlayback()) {
                playHtmlAudioPattern(getSuccessToneConfig());
                return;
            }

            const now = ctx.currentTime;
            freqs.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.frequency.setValueAtTime(freq, now + i * 0.1);
                osc.type = 'triangle';

                gain.gain.setValueAtTime(0, now + i * 0.1);
                gain.gain.linearRampToValueAtTime(0.24, now + i * 0.1 + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.32);
                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now + i * 0.1);
                osc.stop(now + i * 0.1 + 0.32);
            });
        });
    }

    function playExerciseEndSound() {
        withReadyAudioContext(ctx => {
            if (shouldPreferHtmlAudioPlayback()) {
                playHtmlAudioPattern(getExerciseEndToneConfig());
                return;
            }

            const now = ctx.currentTime;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.24);

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.34);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.34);
        });
    }

    function playDiagnosticTone() {
        playSingleTone(880, 1.1, 0.42, 'triangle');
    }

    function getDebugState() {
        return {
            supported: !!(window.AudioContext || window.webkitAudioContext),
            contextState: audioContext?.state ?? 'not-created',
            hasPrimedAudio,
            pendingPlaybackTasks: pendingPlaybackTasks.length,
            iosWebkitAudioEnvironment: isIosWebkitAudioEnvironment(),
            htmlAudioState,
            htmlPatternAudioState,
            htmlUnmuteActive: !!htmlUnmuteAudio,
            htmlPatternPlayersPrimed: Array.from(htmlPatternPlayers.values()).filter(entry => entry.primed).length
        };
    }

    return {
        unlockAudio,
        playBlinkBeep,
        playCloseEyesBeep,
        playOpenEyesBeep,
        playNearBeep,
        playFarBeep,
        playSuccessSound,
        playExerciseEndSound,
        playDiagnosticTone,
        getDebugState
    };
}
