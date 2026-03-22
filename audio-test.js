import { createAudioController } from './src/audio.js?v=20260323b';

const audio = createAudioController();

const elements = {
    summaryBadge: document.getElementById('summaryBadge'),
    audioState: document.getElementById('audioState'),
    primedState: document.getElementById('primedState'),
    htmlAudioState: document.getElementById('htmlAudioState'),
    pendingState: document.getElementById('pendingState'),
    iosEnvState: document.getElementById('iosEnvState'),
    uaState: document.getElementById('uaState'),
    log: document.getElementById('log'),
    unlockBtn: document.getElementById('unlockBtn'),
    webToneBtn: document.getElementById('webToneBtn'),
    htmlToneBtn: document.getElementById('htmlToneBtn'),
    sequenceBtn: document.getElementById('sequenceBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    clearLogBtn: document.getElementById('clearLogBtn')
};

function log(message) {
    const timestamp = new Date().toLocaleTimeString('es-ES', { hour12: false });
    elements.log.textContent = `[${timestamp}] ${message}\n${elements.log.textContent}`.trim();
}

function createToneWavDataUri({ frequency = 880, durationSeconds = 1, volume = 0.4, sampleRate = 44100 } = {}) {
    const frameCount = Math.max(1, Math.floor(sampleRate * durationSeconds));
    const bytesPerSample = 2;
    const numChannels = 1;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = frameCount * blockAlign;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    function writeString(offset, value) {
        for (let i = 0; i < value.length; i += 1) {
            view.setUint8(offset + i, value.charCodeAt(i));
        }
    }

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

    for (let i = 0; i < frameCount; i += 1) {
        const t = i / sampleRate;
        const fadeIn = Math.min(1, i / (sampleRate * 0.02));
        const fadeOut = Math.min(1, (frameCount - i) / (sampleRate * 0.06));
        const envelope = Math.min(fadeIn, fadeOut);
        const sample = Math.sin(2 * Math.PI * frequency * t) * volume * envelope;
        view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true);
    }

    let binary = '';
    const bytes = new Uint8Array(buffer);
    bytes.forEach(byte => {
        binary += String.fromCharCode(byte);
    });

    return `data:audio/wav;base64,${btoa(binary)}`;
}

function renderState() {
    const state = audio.getDebugState();

    elements.audioState.textContent = state.contextState;
    elements.primedState.textContent = state.hasPrimedAudio ? 'sí' : 'no';
    elements.htmlAudioState.textContent = state.htmlAudioState;
    elements.pendingState.textContent = String(state.pendingPlaybackTasks);
    elements.iosEnvState.textContent = state.iosWebkitAudioEnvironment ? 'sí' : 'no';
    elements.uaState.textContent = navigator.userAgent;

    elements.summaryBadge.className = 'badge';

    if (!state.supported) {
        elements.summaryBadge.classList.add('bad');
        elements.summaryBadge.textContent = 'Web Audio no soportado';
        return state;
    }

    const htmlReady = state.htmlAudioState === 'allowed' || state.htmlAudioState === 'not-needed';

    if (state.contextState === 'running' && htmlReady) {
        elements.summaryBadge.classList.add('ok');
        elements.summaryBadge.textContent = 'Audio desbloqueado';
    } else if (state.contextState === 'suspended' || state.contextState === 'interrupted' || state.htmlAudioState === 'failed') {
        elements.summaryBadge.classList.add('bad');
        elements.summaryBadge.textContent = `Audio bloqueado (${state.contextState} / ${state.htmlAudioState})`;
    } else {
        elements.summaryBadge.classList.add('warn');
        elements.summaryBadge.textContent = `Estado: ${state.contextState} / ${state.htmlAudioState}`;
    }

    return state;
}

async function unlockAudio() {
    log('Intentando desbloquear audio...');
    const ok = await audio.unlockAudio();
    const state = renderState();
    log(`unlockAudio() => ${ok ? 'ok' : 'fail'} | contextState=${state.contextState} | primed=${state.hasPrimedAudio} | htmlAudioState=${state.htmlAudioState}`);
    return ok;
}

function playWebTone() {
    audio.playDiagnosticTone();
    const state = renderState();
    log(`Tono Web Audio lanzado | contextState=${state.contextState} | htmlAudioState=${state.htmlAudioState} | pending=${state.pendingPlaybackTasks}`);
}

async function playHtmlTone() {
    try {
        const el = document.createElement('audio');
        el.preload = 'auto';
        el.playsInline = true;
        el.src = createToneWavDataUri({ frequency: 880, durationSeconds: 1.1, volume: 0.6 });
        el.load();
        await el.play();
        log('Tono HTML audio lanzado');
    } catch (error) {
        log(`Error reproduciendo HTML audio: ${error?.message || error}`);
    }
}

async function playSequence() {
    await unlockAudio();
    log('Lanzando secuencia: WebAudio fuerte -> blink -> near -> far -> success');
    audio.playDiagnosticTone();
    setTimeout(() => audio.playBlinkBeep(), 1300);
    setTimeout(() => audio.playNearBeep(), 1600);
    setTimeout(() => audio.playFarBeep(), 1900);
    setTimeout(() => audio.playSuccessSound(), 2200);
    setTimeout(() => {
        const state = renderState();
        log(`Fin de secuencia | contextState=${state.contextState} | htmlAudioState=${state.htmlAudioState} | pending=${state.pendingPlaybackTasks}`);
    }, 2900);
}

elements.unlockBtn.addEventListener('click', () => {
    void unlockAudio();
});

elements.webToneBtn.addEventListener('click', () => {
    playWebTone();
});

elements.htmlToneBtn.addEventListener('click', () => {
    void playHtmlTone();
});

elements.sequenceBtn.addEventListener('click', () => {
    void playSequence();
});

elements.refreshBtn.addEventListener('click', () => {
    const state = renderState();
    log(`Estado refrescado | contextState=${state.contextState} | primed=${state.hasPrimedAudio} | htmlAudioState=${state.htmlAudioState}`);
});

elements.clearLogBtn.addEventListener('click', () => {
    elements.log.textContent = '';
    log('Log limpiado');
});

renderState();
log('Página cargada. Pulsa “Desbloquear audio”, luego “Tono Web Audio (fuerte)” y “Tono HTML audio”.');
