// @ts-check

export const PLANS = Object.freeze({
    quick: {
        name: 'Alivio Rápido',
        exercises: ['blink', 'vertical', 'horizontal', 'circle', 'blink'],
        description: '5 minutos para aliviar fatiga digital'
    },
    complete: {
        name: 'Rutina Completa',
        exercises: ['blink', 'vertical', 'horizontal', 'circle', 'infinity', 'diagonal',
            'clock', 'saccadic', 'focus', 'blink'],
        description: '15 minutos de yoga ocular completo'
    },
    reading: {
        name: 'Para Lectura',
        exercises: ['blink', 'horizontal', 'saccadic', 'saccadic', 'blink'],
        description: 'Mejora tu velocidad de lectura'
    },
    digital_break: {
        name: 'Descanso Digital',
        exercises: ['blink', 'twenty', 'focus', 'massage', 'palming'],
        description: 'Ideal para después de usar pantallas'
    },
    pro_training: {
        name: 'Entrenamiento Pro',
        exercises: ['blink', 'zigzag', 'infinity', 'clock', 'abc', 'saccadic', 'blink'],
        description: 'Mejora la agilidad y coordinación visual'
    },
    total_relax: {
        name: 'Relajación Total',
        exercises: ['blink', 'circle', 'massage', 'palming', 'blink'],
        description: 'Libera toda la tensión acumulada'
    }
});

