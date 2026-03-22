// @ts-check

export function createAudioController() {
    /** @type {AudioContext | null} */
    let audioContext = null;

    function getAudioContext() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioContext;
    }

    function unlockAudio() {
        try {
            const ctx = getAudioContext();
            if (ctx.state === 'suspended') {
                void ctx.resume();
            }
        } catch {
            // ignore
        }
    }

    /**
     * @param {number} frequency
     * @param {number} durationSeconds
     * @param {number} volume
     */
    function playSingleTone(frequency, durationSeconds, volume) {
        const ctx = getAudioContext();
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
    }

    function playBlinkBeep() {
        playSingleTone(659.25, 0.15, 0.15);
    }

    function playCloseEyesBeep() {
        playSingleTone(440, 0.3, 0.2);
    }

    function playOpenEyesBeep() {
        const ctx = getAudioContext();

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
    }

    function playNearBeep() {
        playSingleTone(783.99, 0.15, 0.15);
    }

    function playFarBeep() {
        playSingleTone(523.25, 0.15, 0.15);
    }

    function playSuccessSound() {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        const freqs = [523.25, 659.25, 783.99, 1046.50];

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
    }

    function playExerciseEndSound() {
        const ctx = getAudioContext();
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
    }

    return {
        unlockAudio,
        playBlinkBeep,
        playCloseEyesBeep,
        playOpenEyesBeep,
        playNearBeep,
        playFarBeep,
        playSuccessSound,
        playExerciseEndSound
    };
}

