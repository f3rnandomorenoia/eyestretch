import { createAudioController } from './src/audio.js';

const audio = createAudioController();

const elements = {
    summaryBadge: document.getElementById('summaryBadge'),
    audioState: document.getElementById('audioState'),
    primedState: document.getElementById('primedState'),
    pendingState: document.getElementById('pendingState'),
    uaState: document.getElementById('uaState'),
    log: document.getElementById('log'),
    unlockBtn: document.getElementById('unlockBtn'),
    blinkBtn: document.getElementById('blinkBtn'),
    sequenceBtn: document.getElementById('sequenceBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    clearLogBtn: document.getElementById('clearLogBtn')
};

function log(message) {
    const timestamp = new Date().toLocaleTimeString('es-ES', { hour12: false });
    elements.log.textContent = `[${timestamp}] ${message}\n${elements.log.textContent}`.trim();
}

function renderState() {
    const state = audio.getDebugState();

    elements.audioState.textContent = state.contextState;
    elements.primedState.textContent = state.hasPrimedAudio ? 'sí' : 'no';
    elements.pendingState.textContent = String(state.pendingPlaybackTasks);
    elements.uaState.textContent = navigator.userAgent;

    elements.summaryBadge.className = 'badge';

    if (!state.supported) {
        elements.summaryBadge.classList.add('bad');
        elements.summaryBadge.textContent = 'Web Audio no soportado';
        return state;
    }

    if (state.contextState === 'running') {
        elements.summaryBadge.classList.add('ok');
        elements.summaryBadge.textContent = 'Audio desbloqueado';
    } else if (state.contextState === 'suspended' || state.contextState === 'interrupted') {
        elements.summaryBadge.classList.add('bad');
        elements.summaryBadge.textContent = `Audio bloqueado (${state.contextState})`;
    } else {
        elements.summaryBadge.classList.add('warn');
        elements.summaryBadge.textContent = `Estado: ${state.contextState}`;
    }

    return state;
}

async function unlockAudio() {
    log('Intentando desbloquear audio...');
    const ok = await audio.unlockAudio();
    const state = renderState();
    log(`unlockAudio() => ${ok ? 'ok' : 'fail'} | contextState=${state.contextState} | primed=${state.hasPrimedAudio}`);
}

function playBlinkBeep() {
    audio.playBlinkBeep();
    const state = renderState();
    log(`Beep corto lanzado | contextState=${state.contextState} | pending=${state.pendingPlaybackTasks}`);
}

async function playSequence() {
    await unlockAudio();
    log('Lanzando secuencia: blink -> near -> far -> success');
    audio.playBlinkBeep();
    setTimeout(() => audio.playNearBeep(), 250);
    setTimeout(() => audio.playFarBeep(), 550);
    setTimeout(() => audio.playSuccessSound(), 900);
    setTimeout(() => {
        const state = renderState();
        log(`Fin de secuencia | contextState=${state.contextState} | pending=${state.pendingPlaybackTasks}`);
    }, 1400);
}

elements.unlockBtn.addEventListener('click', () => {
    void unlockAudio();
});

elements.blinkBtn.addEventListener('click', playBlinkBeep);

elements.sequenceBtn.addEventListener('click', () => {
    void playSequence();
});

elements.refreshBtn.addEventListener('click', () => {
    const state = renderState();
    log(`Estado refrescado | contextState=${state.contextState} | primed=${state.hasPrimedAudio}`);
});

elements.clearLogBtn.addEventListener('click', () => {
    elements.log.textContent = '';
    log('Log limpiado');
});

renderState();
log('Página cargada. Pulsa “Desbloquear audio” y luego “Secuencia de prueba”.');
