// @ts-check

export function createInitialState() {
    return {
        currentExercise: null,
        currentPlan: null,
        currentPlanKey: null,
        currentPlanIndex: 0,
        isPlaying: false,
        isPaused: false,
        speed: 1,
        dotSizePx: 26,
        timeRemaining: 0,
        animationFrame: null,
        startTime: null,
        pausedTime: 0,
        pauseStartTime: null,
        isFullscreen: false,
        fullscreenMode: 'none', // none | native | pseudo
        scrollBeforeFullscreen: 0,
        customPlan: [],
        textFadeTimeout: null,
        lastBlinkCount: -1,
        hasPlayedCloseEyes: false,
        hasPlayedOpenEyes: false,
        lastFocusPhase: null,
        lastDirection: null
    };
}
