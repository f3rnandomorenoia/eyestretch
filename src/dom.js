// @ts-check

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
function requireElement(id) {
    const el = document.getElementById(id);
    if (!el) {
        throw new Error(`Missing required element: #${id}`);
    }
    return el;
}

export function getElements() {
    return {
        appContainer: /** @type {HTMLDivElement} */ (requireElement('appContainer')),
        exerciseArea: /** @type {HTMLElement} */ (requireElement('exerciseArea')),
        exerciseCanvas: /** @type {HTMLDivElement} */ (requireElement('exerciseCanvas')),
        dot: /** @type {HTMLDivElement} */ (requireElement('dot')),
        modeBadge: /** @type {HTMLSpanElement} */ (requireElement('modeBadge')),
        statusBadge: /** @type {HTMLSpanElement} */ (requireElement('statusBadge')),
        sessionTitle: /** @type {HTMLElement} */ (requireElement('sessionTitle')),
        sessionSubtitle: /** @type {HTMLElement} */ (requireElement('sessionSubtitle')),
        startHint: /** @type {HTMLButtonElement} */ (requireElement('startHint')),
        exerciseName: /** @type {HTMLElement} */ (requireElement('exerciseName')),
        exerciseInstruction: /** @type {HTMLElement} */ (requireElement('exerciseInstruction')),
        timer: /** @type {HTMLElement} */ (requireElement('timer')),
        progressFill: /** @type {HTMLElement} */ (requireElement('progressFill')),
        playBtn: /** @type {HTMLButtonElement} */ (requireElement('playBtn')),
        playIcon: /** @type {HTMLElement} */ (requireElement('playIcon')),
        stopBtn: /** @type {HTMLButtonElement} */ (requireElement('stopBtn')),
        prevBtn: /** @type {HTMLButtonElement} */ (requireElement('prevBtn')),
        nextBtn: /** @type {HTMLButtonElement} */ (requireElement('nextBtn')),
        speedSelect: /** @type {HTMLSelectElement} */ (requireElement('speedSelect')),
        dotSizeSelect: /** @type {HTMLSelectElement} */ (requireElement('dotSizeSelect')),
        fullscreenBtn: /** @type {HTMLButtonElement} */ (requireElement('fullscreenBtn')),
        fullscreenIcon: /** @type {HTMLElement} */ (requireElement('fullscreenIcon')),
        currentPlan: /** @type {HTMLElement} */ (requireElement('currentPlan')),
        currentPlanTitle: /** @type {HTMLElement} */ (requireElement('currentPlanTitle')),
        currentPlanMeta: /** @type {HTMLElement} */ (requireElement('currentPlanMeta')),
        planProgress: /** @type {HTMLElement} */ (requireElement('planProgress')),
        exitPlanBtn: /** @type {HTMLButtonElement} */ (requireElement('exitPlanBtn')),
        customPlanModal: /** @type {HTMLElement} */ (requireElement('customPlanModal')),
        modalClose: /** @type {HTMLButtonElement} */ (requireElement('modalClose')),
        customPlanBtn: /** @type {HTMLButtonElement} */ (requireElement('customPlanBtn')),
        selectedExercises: /** @type {HTMLElement} */ (requireElement('selectedExercises')),
        clearPlanBtn: /** @type {HTMLButtonElement} */ (requireElement('clearPlanBtn')),
        startCustomPlanBtn: /** @type {HTMLButtonElement} */ (requireElement('startCustomPlanBtn'))
    };
}
