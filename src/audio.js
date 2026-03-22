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
        return !!(
            typeof navigator !== 'undefined' &&
            navigator.maxTouchPoints > 0 &&
            typeof window !== 'undefined' &&
            window.webkitAudioContext
        );
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

        if (ctx.state === 'running' && (htmlAudioState === 'allowed' || htmlAudioState === 'not-needed' || !isIosWebkitAudioEnvironment())) {
            flushPendingPlaybackTasks();
            return Promise.resolve(true);
        }

        if (unlockPromise) {
            return unlockPromise;
        }

        unlockPromise = (async () => {
            try {
                const htmlAudioPromise = ensureHtmlAudioUnlocked();

                primeAudioContext(ctx);

                if (typeof ctx.resume === 'function' && ctx.state !== 'running') {
                    await ctx.resume();
                }

                await htmlAudioPromise;
            } catch {
                // ignore and let the caller retry on the next user gesture
            }

            const isReady =
                ctx.state === 'running' &&
                (htmlAudioState === 'allowed' || htmlAudioState === 'not-needed' || !isIosWebkitAudioEnvironment());

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
        if (ctx.state === 'running' && htmlReady) {
            task(ctx);
            return;
        }

        pendingPlaybackTasks.push(task);
        void unlockAudio();
    }

    /**
     * @param {number} frequency
     * @param {number} durationSeconds
     * @param {number} volume
     * @param {OscillatorType} [waveType]
     */
    function playSingleTone(frequency, durationSeconds, volume, waveType = 'sine') {
        withReadyAudioContext(ctx => {
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
            const now = ctx.currentTime;
            const freqs = [523.25, 659.25, 783.99, 1046.5];

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
            htmlUnmuteActive: !!htmlUnmuteAudio
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
