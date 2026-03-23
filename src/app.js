// @ts-check

import { createAudioController } from './audio.js?v=20260323d';
import { getElements } from './dom.js?v=20260323d';
import { createExercises } from './exercises.js?v=20260323d';
import { PLANS } from './plans.js?v=20260323d';
import { createInitialState } from './state.js?v=20260323d';

export function createApp() {
    const state = createInitialState();
    const elements = getElements();
    const audio = createAudioController();
    const EXERCISES = createExercises({ state, elements, audio });

    const initialDotSize = parseInt(elements.dotSizeSelect.value, 10);
    if (Number.isFinite(initialDotSize)) {
        state.dotSizePx = initialDotSize;
        document.documentElement.style.setProperty('--dot-size', `${initialDotSize}px`);
    }

    function scrollToExerciseArea() {
        const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        elements.exerciseArea.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'start'
        });
    }

    function updateExerciseCardStates() {
        document.querySelectorAll('.exercise-card').forEach(card => {
            const exerciseKey = /** @type {HTMLElement} */ (card).dataset.exercise;
            const isSelected = state.currentExercise === exerciseKey;
            const isActive = isSelected && state.isPlaying;

            card.classList.toggle('selected', isSelected);
            card.classList.toggle('active', isActive);
        });
    }

    function updatePlanCardStates() {
        document.querySelectorAll('.plan-card').forEach(card => {
            const planKey = /** @type {HTMLElement} */ (card).dataset.plan;
            const isSelected = state.currentPlanKey === planKey;
            const isActive = isSelected && !!state.currentPlan && state.isPlaying;

            card.classList.toggle('selected', isSelected);
            card.classList.toggle('active', isActive);
        });
    }

    function resetDotInlineStyles() {
        elements.dot.style.left = '50%';
        elements.dot.style.top = '50%';
        elements.dot.style.transform = 'translate(-50%, -50%)';
        elements.dot.style.boxShadow = '';
        elements.dot.style.opacity = '';
    }

    function updateSessionIndicator() {
        const statusText = state.isPlaying ? (state.isPaused ? 'En pausa' : 'En marcha') : 'Listo';
        elements.statusBadge.textContent = statusText;

        if (state.currentPlan) {
            const total = state.currentPlan.exercises.length;
            const currentStep = Math.min(state.currentPlanIndex + 1, total);
            const currentExerciseKey = state.currentPlan.exercises[state.currentPlanIndex];
            const currentExercise = EXERCISES[currentExerciseKey];

            elements.modeBadge.textContent = 'Rutina';
            elements.sessionTitle.textContent = state.currentPlan.name;
            elements.sessionSubtitle.textContent = currentExercise
                ? `Paso ${currentStep}/${total}: ${currentExercise.name}`
                : `Paso ${currentStep}/${total}`;
        } else if (state.currentExercise) {
            const exercise = EXERCISES[state.currentExercise];
            elements.modeBadge.textContent = 'Ejercicio';
            elements.sessionTitle.textContent = exercise?.name ?? 'Ejercicio';
            elements.sessionSubtitle.textContent = exercise ? `Duración: ${exercise.duration} s` : 'Elige un ejercicio';
        } else {
            elements.modeBadge.textContent = 'Ejercicio';
            elements.sessionTitle.textContent = 'Elige una rutina';
            elements.sessionSubtitle.textContent = 'Puedes empezar con una rutina o con un ejercicio suelto';
        }

        elements.startHint.hidden = state.isPlaying || !state.currentExercise;
    }

    function renderIdleState() {
        elements.exerciseName.classList.remove('fade-out');
        elements.exerciseInstruction.classList.remove('fade-out');
        elements.progressFill.style.width = '0%';
        elements.playIcon.textContent = '▶️';

        elements.dot.classList.remove('active');
        elements.dot.classList.remove('focus-mode');
        resetDotInlineStyles();

        if (!state.currentExercise) {
            state.timeRemaining = 0;
            elements.exerciseName.textContent = 'Elige un ejercicio o una rutina';
            elements.exerciseInstruction.textContent = 'Sigue el punto con la mirada, manteniendo la cabeza quieta';
            updateTimerDisplay();
            updateSessionIndicator();
            updateExerciseCardStates();
            updatePlanCardStates();
            return;
        }

        const exercise = EXERCISES[state.currentExercise];
        state.timeRemaining = exercise.duration;

        elements.exerciseName.textContent = exercise.name;
        elements.exerciseInstruction.textContent = exercise.instruction;

        if (state.currentExercise === 'focus') {
            elements.dot.classList.add('focus-mode');
        }

        elements.dot.style.opacity = state.currentExercise === 'palming' ? '0' : '0.85';

        updateTimerDisplay();
        updateSessionIndicator();
        updateExerciseCardStates();
        updatePlanCardStates();
    }

    function clearPlanSelection() {
        state.currentPlan = null;
        state.currentPlanKey = null;
        state.currentPlanIndex = 0;

        elements.currentPlan.classList.remove('active');
        elements.planProgress.innerHTML = '';
        elements.currentPlanTitle.textContent = 'Rutina actual';
        elements.currentPlanMeta.textContent = '';

        updatePlanCardStates();
        updateSessionIndicator();
    }

    function selectExercise(exerciseKey, { fromPlan = false, shouldScroll = true } = {}) {
        const exercise = EXERCISES[exerciseKey];
        if (!exercise) return;

        if (state.isPlaying) {
            stopExercise({ skipRender: true });
        }

        if (!fromPlan) {
            clearPlanSelection();
        }

        state.currentExercise = exerciseKey;
        state.isPlaying = false;
        state.isPaused = false;

        renderIdleState();
        if (shouldScroll) scrollToExerciseArea();
    }

    function selectPlan(planKey, { shouldScroll = true } = {}) {
        const plan = PLANS[planKey];
        if (!plan) return;

        if (state.isPlaying) {
            stopExercise({ skipRender: true });
        }

        state.currentPlan = plan;
        state.currentPlanKey = planKey;
        state.currentPlanIndex = 0;
        state.currentExercise = plan.exercises[0] ?? null;

        elements.currentPlan.classList.add('active');
        updatePlanProgress();
        updatePlanCardStates();

        renderIdleState();
        if (shouldScroll) scrollToExerciseArea();
    }

    function getCanvasBounds() {
        const rect = elements.exerciseCanvas.getBoundingClientRect();
        const dotRadius = Math.max(10, state.dotSizePx / 2);
        const edgeGap = 10;
        const padding = Math.max(14, dotRadius + edgeGap);

        const left = padding;
        const top = padding;
        const right = rect.width - padding;
        const bottom = rect.height - padding;

        return {
            width: Math.max(0, right - left),
            height: Math.max(0, bottom - top),
            centerX: rect.width / 2,
            centerY: rect.height / 2,
            left,
            top,
            right,
            bottom
        };
    }

    function startExercise(exerciseKey) {
        const exercise = EXERCISES[exerciseKey];
        if (!exercise) return;

        state.currentExercise = exerciseKey;
        state.isPlaying = true;
        state.isPaused = false;
        state.timeRemaining = exercise.duration;
        state.startTime = performance.now();
        state.pausedTime = 0;

        state.lastBlinkCount = -1;
        state.hasPlayedCloseEyes = false;
        state.lastFocusPhase = null;
        state.lastDirection = null;

        audio.unlockAudio();

        elements.exerciseName.textContent = exercise.name;
        elements.exerciseInstruction.textContent = exercise.instruction;
        elements.dot.classList.add('active');
        elements.dot.style.opacity = '0.92';
        elements.playIcon.textContent = '⏸️';
        elements.startHint.hidden = true;

        elements.exerciseName.classList.remove('fade-out');
        elements.exerciseInstruction.classList.remove('fade-out');

        if (state.textFadeTimeout) {
            clearTimeout(state.textFadeTimeout);
        }

        state.textFadeTimeout = setTimeout(() => {
            elements.exerciseName.classList.add('fade-out');
            elements.exerciseInstruction.classList.add('fade-out');
        }, 2000);

        elements.dot.classList.remove('focus-mode');
        if (exerciseKey === 'focus') {
            elements.dot.classList.add('focus-mode');
        }

        updateExerciseCardStates();
        updatePlanCardStates();
        updateSessionIndicator();
        if (state.currentPlan) updatePlanProgress();

        animate();
    }

    function animate() {
        if (!state.isPlaying || state.isPaused) return;

        const exercise = EXERCISES[state.currentExercise];
        const elapsed = (performance.now() - state.startTime - state.pausedTime) / 1000;
        const remaining = Math.max(0, exercise.duration - elapsed);

        state.timeRemaining = remaining;
        updateTimerDisplay();

        const progress = 1 - remaining / exercise.duration;
        elements.progressFill.style.width = `${progress * 100}%`;

        if (remaining <= 0) {
            completeExercise();
            return;
        }

        elements.dot.style.transform = 'translate(-50%, -50%)';

        const bounds = getCanvasBounds();
        const position = exercise.animate(elapsed, bounds);

        elements.dot.style.left = `${position.x}px`;
        elements.dot.style.top = `${position.y}px`;

        state.animationFrame = requestAnimationFrame(animate);
    }

    function pauseExercise() {
        if (!state.isPlaying) return;

        state.isPaused = true;
        state.pauseStartTime = performance.now();
        elements.playIcon.textContent = '▶️';
        updateSessionIndicator();

        if (state.animationFrame) {
            cancelAnimationFrame(state.animationFrame);
        }
    }

    function resumeExercise() {
        if (!state.isPlaying || !state.isPaused) return;

        state.isPaused = false;
        state.pausedTime += performance.now() - state.pauseStartTime;
        elements.playIcon.textContent = '⏸️';
        updateSessionIndicator();

        animate();
    }

    function stopExercise({ clearSelection = false, skipRender = false } = {}) {
        state.isPlaying = false;
        state.isPaused = false;
        state.startTime = null;
        state.pausedTime = 0;

        if (clearSelection) {
            state.currentExercise = null;
            state.timeRemaining = 0;
        }

        if (state.animationFrame) {
            cancelAnimationFrame(state.animationFrame);
            state.animationFrame = null;
        }

        if (state.textFadeTimeout) {
            clearTimeout(state.textFadeTimeout);
            state.textFadeTimeout = null;
        }

        elements.dot.classList.remove('active', 'focus-mode');
        resetDotInlineStyles();

        if (!skipRender) {
            renderIdleState();
        }
    }

    function completeExercise() {
        audio.playExerciseEndSound();

        stopExercise({ skipRender: true });

        if (state.currentPlan) {
            state.currentPlanIndex++;
            updatePlanProgress();

            if (state.currentPlanIndex < state.currentPlan.exercises.length) {
                const nextExerciseKey = state.currentPlan.exercises[state.currentPlanIndex];
                state.currentExercise = nextExerciseKey;

                renderIdleState();
                elements.startHint.hidden = true;

                setTimeout(() => {
                    startExercise(nextExerciseKey);
                }, 1000);
            } else {
                audio.playSuccessSound();
                completePlan();
            }
        } else {
            renderIdleState();
        }
    }

    function updateTimerDisplay() {
        const minutes = Math.floor(state.timeRemaining / 60);
        const seconds = Math.floor(state.timeRemaining % 60);
        elements.timer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        if (state.currentPlan) {
            updatePlanTotalRemaining();
        }
    }

    function updatePlanTotalRemaining() {
        if (!state.currentPlan) return;

        let totalRemaining = state.timeRemaining;

        const nextIndex = state.currentPlanIndex + 1;
        const subsequentDuration = getPlanDurationSeconds(state.currentPlan, nextIndex);

        totalRemaining += subsequentDuration;

        if (nextIndex < state.currentPlan.exercises.length) {
            totalRemaining += 1;
        }

        const total = state.currentPlan.exercises.length;
        const currentStep = Math.min(state.currentPlanIndex + 1, total);
        const currentExerciseKey = state.currentPlan.exercises[state.currentPlanIndex];
        const currentExercise = EXERCISES[currentExerciseKey];

        const remainingText = formatPlanDuration(Math.ceil(totalRemaining));

        elements.currentPlanMeta.textContent = currentExercise
            ? `${currentStep}/${total} • ${currentExercise.name} • Restan: ${remainingText}`
            : `${currentStep}/${total} • Restan: ${remainingText}`;
    }

    function getPlanDurationSeconds(plan, startIndex = 0) {
        if (!plan?.exercises) return 0;
        const exercises = plan.exercises.slice(startIndex);
        if (exercises.length === 0) return 0;

        const exercisesTime = exercises.reduce((total, key) => total + (EXERCISES[key]?.duration ?? 0), 0);
        const transitionsTime = Math.max(0, exercises.length - 1) * 1;

        return exercisesTime + transitionsTime;
    }

    function formatPlanDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remaining = Math.floor(seconds % 60);

        if (minutes === 0) return `${remaining}s`;
        if (remaining === 0) return `${minutes} min`;
        return `${minutes} min ${remaining}s`;
    }

    function updatePlanCardDurations() {
        document.querySelectorAll('.plan-card').forEach(card => {
            const planKey = /** @type {HTMLElement} */ (card).dataset.plan;
            if (!planKey || planKey === 'custom') return;
            const plan = PLANS[planKey];
            if (!plan) return;

            const planInfo = card.querySelector('.plan-info p');
            if (!planInfo) return;

            const currentText = planInfo.textContent?.trim() ?? '';
            const parts = currentText.split('•');
            const suffix = parts.length > 1 ? parts.slice(1).join('•').trim() : '';

            const durationText = formatPlanDuration(getPlanDurationSeconds(plan));
            planInfo.textContent = suffix ? `${durationText} • ${suffix}` : durationText;
        });
    }

    function startPlan(planKey) {
        selectPlan(planKey);
    }

    function startCustomPlan() {
        if (state.customPlan.length === 0) return;

        state.currentPlan = {
            name: 'Rutina personalizada',
            exercises: [...state.customPlan]
        };
        state.currentPlanKey = 'custom';
        state.currentPlanIndex = 0;
        state.currentExercise = state.currentPlan.exercises[0] ?? null;

        closeModal();

        elements.currentPlan.classList.add('active');
        updatePlanProgress();

        updatePlanCardStates();
        renderIdleState();
        scrollToExerciseArea();
    }

    function updatePlanProgress() {
        if (!state.currentPlan) return;

        const total = state.currentPlan.exercises.length;
        const currentStep = Math.min(state.currentPlanIndex + 1, total);
        const currentExerciseKey = state.currentPlan.exercises[state.currentPlanIndex];
        const currentExercise = EXERCISES[currentExerciseKey];

        elements.currentPlanTitle.textContent = state.currentPlan.name;

        if (!state.isPlaying && currentExercise) {
            state.timeRemaining = currentExercise.duration;
        }
        updatePlanTotalRemaining();

        elements.planProgress.innerHTML = state.currentPlan.exercises
            .map((ex, index) => {
                const exercise = EXERCISES[ex];
                let className = 'plan-step';
                if (index < state.currentPlanIndex) className += ' completed';
                if (index === state.currentPlanIndex) className += ' current';

                return `<div class="${className}">
                    <span>${exercise.icon}</span>
                    <span>${exercise.name}</span>
                </div>`;
            })
            .join('');

        elements.sessionSubtitle.textContent = currentExercise
            ? `Paso ${currentStep}/${total}: ${currentExercise.name}`
            : `Paso ${currentStep}/${total}`;
    }

    function completePlan() {
        state.currentPlan = null;
        state.currentPlanKey = null;
        state.currentPlanIndex = 0;
        state.currentExercise = null;

        elements.currentPlan.classList.remove('active');
        elements.planProgress.innerHTML = '';
        elements.currentPlanTitle.textContent = 'Rutina actual';
        elements.currentPlanMeta.textContent = '';

        elements.exerciseName.textContent = 'Rutina terminada';
        elements.exerciseInstruction.textContent = 'Buen trabajo. Si estás con pantallas, vuelve a hacer una pausa en un rato.';
        elements.startHint.hidden = true;

        updateExerciseCardStates();
        updatePlanCardStates();
        updateSessionIndicator();
    }

    function previousExercise() {
        if (!state.currentPlan || state.currentPlanIndex === 0) return;

        const wasPlaying = state.isPlaying;
        stopExercise({ skipRender: true });
        state.currentPlanIndex--;
        updatePlanProgress();

        const exerciseKey = state.currentPlan.exercises[state.currentPlanIndex];
        state.currentExercise = exerciseKey;

        if (wasPlaying) {
            startExercise(exerciseKey);
        } else {
            renderIdleState();
        }
    }

    function nextExercise() {
        if (!state.currentPlan || state.currentPlanIndex >= state.currentPlan.exercises.length - 1) return;

        const wasPlaying = state.isPlaying;
        stopExercise({ skipRender: true });
        state.currentPlanIndex++;
        updatePlanProgress();

        const exerciseKey = state.currentPlan.exercises[state.currentPlanIndex];
        state.currentExercise = exerciseKey;

        if (wasPlaying) {
            startExercise(exerciseKey);
        } else {
            renderIdleState();
        }
    }

    function getNativeFullscreenElement() {
        // @ts-ignore - webkitFullscreenElement exists on Safari.
        return document.fullscreenElement || document.webkitFullscreenElement || null;
    }

    /**
     * @param {HTMLElement} targetEl
     * @returns {Promise<boolean>}
     */
    function requestNativeFullscreen(targetEl) {
        // @ts-ignore - vendor-prefixed fullscreen APIs
        const fn =
            targetEl.requestFullscreen ||
            targetEl.webkitRequestFullscreen ||
            targetEl.webkitRequestFullScreen ||
            targetEl.mozRequestFullScreen ||
            targetEl.msRequestFullscreen;

        if (typeof fn !== 'function') return Promise.resolve(false);

        try {
            const result = fn.call(targetEl);
            if (result && typeof result.then === 'function') {
                return result.then(() => true).catch(() => false);
            }
            return Promise.resolve(true);
        } catch {
            return Promise.resolve(false);
        }
    }

    function exitNativeFullscreen() {
        // @ts-ignore - vendor-prefixed fullscreen APIs
        const fn =
            document.exitFullscreen ||
            document.webkitExitFullscreen ||
            document.webkitCancelFullScreen ||
            document.mozCancelFullScreen ||
            document.msExitFullscreen;

        if (typeof fn !== 'function') return Promise.resolve(false);

        try {
            const result = fn.call(document);
            if (result && typeof result.then === 'function') {
                return result.then(() => true).catch(() => false);
            }
            return Promise.resolve(true);
        } catch {
            return Promise.resolve(false);
        }
    }

    function setFullscreenUI(isActive) {
        elements.appContainer.classList.toggle('fullscreen', isActive);
        document.body.classList.toggle('fullscreen-active', isActive);
    }

    async function tryLockLandscape() {
        const lock = screen.orientation?.lock;
        if (typeof lock !== 'function') return false;

        try {
            await lock.call(screen.orientation, 'landscape');
            return true;
        } catch {
            return false;
        }
    }

    function tryUnlockOrientation() {
        try {
            screen.orientation?.unlock?.();
        } catch {
            // ignore
        }
    }

    async function enterImmersiveMode() {
        if (state.isFullscreen) return;

        state.scrollBeforeFullscreen = window.scrollY || 0;

        const enteredNative = await requestNativeFullscreen(elements.appContainer);
        state.fullscreenMode = enteredNative ? 'native' : 'pseudo';
        state.isFullscreen = true;
        setFullscreenUI(true);

        await tryLockLandscape();
    }

    async function exitImmersiveMode() {
        if (!state.isFullscreen) return;

        tryUnlockOrientation();

        if (state.fullscreenMode === 'native') {
            await exitNativeFullscreen();

            if (!getNativeFullscreenElement()) {
                state.isFullscreen = false;
                state.fullscreenMode = 'none';
                setFullscreenUI(false);
                window.scrollTo(0, state.scrollBeforeFullscreen);
            }
            return;
        }

        state.isFullscreen = false;
        state.fullscreenMode = 'none';
        setFullscreenUI(false);
        window.scrollTo(0, state.scrollBeforeFullscreen);
    }

    function syncFullscreenFromNativeEvent() {
        const isNativeActive = !!getNativeFullscreenElement();

        if (isNativeActive) {
            state.isFullscreen = true;
            state.fullscreenMode = 'native';
            setFullscreenUI(true);
            return;
        }

        if (state.fullscreenMode === 'native') {
            state.isFullscreen = false;
            state.fullscreenMode = 'none';
            setFullscreenUI(false);
            window.scrollTo(0, state.scrollBeforeFullscreen);
        }
    }

    function toggleFullscreen() {
        if (state.isFullscreen) {
            void exitImmersiveMode();
        } else {
            void enterImmersiveMode();
        }
    }

    function openModal() {
        elements.customPlanModal.classList.add('active');
    }

    function closeModal() {
        elements.customPlanModal.classList.remove('active');
    }

    function initDragAndDrop() {
        const draggables = document.querySelectorAll('.draggable-exercise');
        const dropzone = elements.selectedExercises;

        draggables.forEach(draggable => {
            draggable.addEventListener('dragstart', (e) => {
                // @ts-ignore - dataTransfer exists in DragEvent
                e.dataTransfer.setData('text/plain', /** @type {HTMLElement} */ (draggable).dataset.exercise ?? '');
                draggable.classList.add('dragging');
            });

            draggable.addEventListener('dragend', () => {
                draggable.classList.remove('dragging');
            });
        });

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('drag-over');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('drag-over');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('drag-over');

            // @ts-ignore - dataTransfer exists in DragEvent
            const exerciseKey = e.dataTransfer.getData('text/plain');
            addToCustomPlan(exerciseKey);
        });
    }

    function addToCustomPlan(exerciseKey) {
        const exercise = EXERCISES[exerciseKey];
        if (!exercise) return;

        state.customPlan.push(exerciseKey);
        updateCustomPlanDisplay();
    }

    function updateCustomPlanDisplay() {
        if (state.customPlan.length === 0) {
            elements.selectedExercises.innerHTML = '<p class="empty-message">Arrastra ejercicios aquí</p>';
            return;
        }

        elements.selectedExercises.innerHTML = state.customPlan
            .map((ex, index) => {
                const exercise = EXERCISES[ex];
                return `<div class="draggable-exercise" data-index="${index}">
                    <span>${exercise.icon}</span> ${exercise.name}
                    <button class="remove-exercise" data-index="${index}">✕</button>
                </div>`;
            })
            .join('');

        elements.selectedExercises.querySelectorAll('.remove-exercise').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(/** @type {HTMLElement} */ (btn).dataset.index ?? '0', 10);
                state.customPlan.splice(index, 1);
                updateCustomPlanDisplay();
            });
        });

        const totalSeconds = getPlanDurationSeconds({ exercises: state.customPlan });
        const durationText = formatPlanDuration(totalSeconds);
        const header = document.querySelector('.selected-exercises h4');
        if (header) {
            header.textContent = `Tu rutina (${durationText})`;
        }
    }

    function clearCustomPlan() {
        state.customPlan = [];
        updateCustomPlanDisplay();
    }

    function initEventListeners() {
        function handlePlayToggle() {
            const willStart = !state.isPlaying;
            const willResume = state.isPlaying && state.isPaused;

            if (willStart || willResume) {
                void audio.unlockAudio();
            }

            if ((willStart || willResume) && !state.isFullscreen) {
                void enterImmersiveMode();
            }

            if (!state.isPlaying && state.currentExercise) {
                startExercise(state.currentExercise);
            } else if (state.isPlaying && !state.isPaused) {
                pauseExercise();
            } else if (state.isPlaying && state.isPaused) {
                resumeExercise();
            } else if (!state.currentExercise) {
                startExercise('vertical');
            }
        }

        document.querySelectorAll('.exercise-card').forEach(card => {
            card.addEventListener('click', () => {
                const key = /** @type {HTMLElement} */ (card).dataset.exercise;
                if (key) selectExercise(key);
            });
        });

        document.querySelectorAll('.plan-card').forEach(card => {
            const key = /** @type {HTMLElement} */ (card).dataset.plan;
            if (key === 'custom') {
                card.addEventListener('click', openModal);
            } else if (key) {
                card.addEventListener('click', () => {
                    startPlan(key);
                });
            }
        });

        elements.playBtn.addEventListener('click', handlePlayToggle);
        elements.startHint.addEventListener('click', handlePlayToggle);

        elements.stopBtn.addEventListener('click', () => {
            stopExercise();
        });

        elements.prevBtn.addEventListener('click', previousExercise);
        elements.nextBtn.addEventListener('click', nextExercise);

        elements.speedSelect.addEventListener('change', (e) => {
            const target = /** @type {HTMLSelectElement} */ (e.target);
            state.speed = parseFloat(target.value);
        });

        elements.dotSizeSelect.addEventListener('change', (e) => {
            const target = /** @type {HTMLSelectElement} */ (e.target);
            const size = parseInt(target.value, 10);
            if (!Number.isFinite(size)) return;
            state.dotSizePx = size;
            document.documentElement.style.setProperty('--dot-size', `${size}px`);
        });

        elements.fullscreenBtn.addEventListener('click', toggleFullscreen);

        elements.modalClose.addEventListener('click', closeModal);
        elements.clearPlanBtn.addEventListener('click', clearCustomPlan);
        elements.startCustomPlanBtn.addEventListener('click', startCustomPlan);

        elements.exitPlanBtn.addEventListener('click', () => {
            if (state.isPlaying) stopExercise();
            clearPlanSelection();
            renderIdleState();
        });

        elements.customPlanModal.addEventListener('click', (e) => {
            if (e.target === elements.customPlanModal) {
                closeModal();
            }
        });

        document.addEventListener('fullscreenchange', syncFullscreenFromNativeEvent);
        // @ts-ignore - webkitfullscreenchange exists on Safari.
        document.addEventListener('webkitfullscreenchange', syncFullscreenFromNativeEvent);

        document.addEventListener('keydown', (e) => {
            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    handlePlayToggle();
                    break;
                case 'Escape':
                    if (state.isFullscreen) {
                        void exitImmersiveMode();
                    } else if (elements.customPlanModal.classList.contains('active')) {
                        closeModal();
                    }
                    break;
                case 'f':
                case 'F':
                    toggleFullscreen();
                    break;
                case 'ArrowLeft':
                    previousExercise();
                    break;
                case 'ArrowRight':
                    nextExercise();
                    break;
            }
        });
    }

    function init() {
        initEventListeners();
        initDragAndDrop();
        updatePlanCardDurations();
        renderIdleState();

        selectPlan('quick', { shouldScroll: false });
    }

    return { init };
}
