// @ts-check

export function createAudioController() {
    /** @type {AudioContext | null} */
    let audioContext = null;

    /** @type {Promise<boolean> | null} */
    let unlockPromise = null;

    /** @type {Array<(ctx: AudioContext) => void>} */
    let pendingPlaybackTasks = [];

    let hasPrimedAudio = false;

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

        if (ctx.state === 'running') {
            flushPendingPlaybackTasks();
            return Promise.resolve(true);
        }

        if (unlockPromise) {
            return unlockPromise;
        }

        unlockPromise = (async () => {
            try {
                primeAudioContext(ctx);

                if (typeof ctx.resume === 'function' && ctx.state !== 'running') {
                    await ctx.resume();
                }
            } catch {
                // ignore and let the caller retry on the next user gesture
            }

            if (ctx.state === 'running') {
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

        if (ctx.state === 'running') {
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
     */
    function playSingleTone(frequency, durationSeconds, volume) {
        withReadyAudioContext(ctx => {
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(volume, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + durationSeconds);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + durationSeconds);
        });
    }

    function playBlinkBeep() {
        playSingleTone(659.25, 0.15, 0.15);
    }

    function playCloseEyesBeep() {
        playSingleTone(440, 0.3, 0.2);
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
            oscillator1.type = 'sine';
            oscillator2.type = 'sine';

            gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

            oscillator1.start(ctx.currentTime);
            oscillator2.start(ctx.currentTime);
            oscillator1.stop(ctx.currentTime + 0.4);
            oscillator2.stop(ctx.currentTime + 0.4);
        });
    }

    function playNearBeep() {
        playSingleTone(783.99, 0.15, 0.15);
    }

    function playFarBeep() {
        playSingleTone(523.25, 0.15, 0.15);
    }

    function playSuccessSound() {
        withReadyAudioContext(ctx => {
            const now = ctx.currentTime;
            const freqs = [523.25, 659.25, 783.99, 1046.5];

            freqs.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.frequency.setValueAtTime(freq, now + i * 0.1);
                osc.type = 'sine';

                gain.gain.setValueAtTime(0, now + i * 0.1);
                gain.gain.linearRampToValueAtTime(0.2, now + i * 0.1 + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3);
                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now + i * 0.1);
                osc.stop(now + i * 0.1 + 0.3);
            });
        });
    }

    function playExerciseEndSound() {
        withReadyAudioContext(ctx => {
            const now = ctx.currentTime;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);

            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.3);
        });
    }

    function getDebugState() {
        return {
            supported: !!(window.AudioContext || window.webkitAudioContext),
            contextState: audioContext?.state ?? 'not-created',
            hasPrimedAudio,
            pendingPlaybackTasks: pendingPlaybackTasks.length
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
        getDebugState
    };
}
