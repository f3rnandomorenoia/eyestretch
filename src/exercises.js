// @ts-check

/**
 * @param {{
 *   state: any,
 *   elements: any,
 *   audio: any,
 * }} deps
 */
export function createExercises({ state, elements, audio }) {
    const exercises = {
        vertical: {
            name: 'Arriba y abajo',
            icon: '↕️',
            duration: 30,
            instruction: 'Sigue el punto hacia arriba y hacia abajo con la mirada',
            animate: animateVertical
        },
        horizontal: {
            name: 'Izquierda y derecha',
            icon: '↔️',
            duration: 30,
            instruction: 'Sigue el punto de izquierda a derecha con la mirada',
            animate: animateHorizontal
        },
        circle: {
            name: 'Círculos',
            icon: '⭕',
            duration: 48,
            instruction: 'Dibuja un círculo con la mirada: primero en un sentido y luego en el otro',
            animate: animateCircle
        },
        infinity: {
            name: 'Infinito (∞)',
            icon: '∞',
            duration: 45,
            instruction: 'Sigue el ∞ de forma continua, sin prisas',
            animate: animateInfinity
        },
        diagonal: {
            name: 'Diagonales',
            icon: '↗️',
            duration: 40,
            instruction: 'Recorre las diagonales: de esquina a esquina',
            animate: animateDiagonal
        },
        focus: {
            name: 'Cerca / lejos',
            icon: '🔍',
            duration: 45,
            instruction: 'Alterna el enfoque: cerca cuando crece, lejos cuando se hace pequeño',
            animate: animateFocus
        },
        saccadic: {
            name: 'Saltos',
            icon: '⚡',
            duration: 30,
            instruction: 'Mueve la mirada de un salto al siguiente punto',
            animate: animateSaccadic
        },
        blink: {
            name: 'Parpadeo',
            icon: '😌',
            duration: 30,
            instruction: 'Parpadea rápido unas 20 veces y después descansa con los ojos cerrados',
            animate: animateBlink
        },
        clock: {
            name: 'Reloj',
            icon: '🕐',
            duration: 36,
            instruction: 'Imagina un reloj y recorre sus 12 posiciones con la mirada',
            animate: animateClock
        },
        zigzag: {
            name: 'Zigzag',
            icon: '📉',
            duration: 30,
            instruction: 'Sigue el zigzag de lado a lado, con movimientos suaves',
            animate: animateZigZag
        },
        palming: {
            name: 'Palmeo',
            icon: '🤲',
            duration: 40,
            instruction: 'Frota las manos, cierra los ojos y cúbrelos con las palmas (sin presionar)',
            animate: animatePalming
        },
        twenty: {
            name: '20-20-20',
            icon: '🔭',
            duration: 20,
            instruction: 'Durante 20 segundos, mira algo a unos 6 metros. Consejo: repítelo cada 20 minutos',
            animate: animateTwenty
        },
        massage: {
            name: 'Masaje suave',
            icon: '💆',
            duration: 60,
            instruction: 'Masajea alrededor de los ojos en círculos; cambia de sentido a mitad',
            animate: animateMassage
        },
        abc: {
            name: 'Letras',
            icon: '🔤',
            duration: 45,
            instruction: 'Sigue el punto mientras dibuja letras en el aire con la mirada',
            animate: animateABC
        }
    };

    function animateVertical(progress, bounds) {
        const cycleProgress = (progress * state.speed * 0.25) % 1;
        const angle = cycleProgress * Math.PI * 2;
        const y = bounds.centerY + Math.sin(angle) * (bounds.height / 2);

        return { x: bounds.centerX, y };
    }

    function animateHorizontal(progress, bounds) {
        const cycleProgress = (progress * state.speed * 0.25) % 1;
        const angle = cycleProgress * Math.PI * 2;
        const x = bounds.centerX + Math.sin(angle) * (bounds.width / 2);

        return { x, y: bounds.centerY };
    }

    function animateCircle(progress, bounds) {
        const circleDuration = 8;
        const angularSpeed = (Math.PI * 2) / circleDuration;
        const halfDuration = exercises.circle.duration / 2;
        const elapsed = progress;
        const scaledElapsed = elapsed * state.speed;
        let angle;

        if (elapsed < halfDuration) {
            angle = scaledElapsed * angularSpeed;
        } else {
            const switchAngle = halfDuration * state.speed * angularSpeed;
            const afterSwitch = (elapsed - halfDuration) * state.speed;
            angle = switchAngle - afterSwitch * angularSpeed;
        }

        const isFirstHalf = elapsed < halfDuration;
        const currentDirection = isFirstHalf ? 'clockwise' : 'counter';

        if (state.lastDirection !== currentDirection) {
            audio.playNearBeep();
            state.lastDirection = currentDirection;
        }

        const radius = Math.min(bounds.width, bounds.height) / 2;

        return {
            x: bounds.centerX + Math.cos(angle) * radius,
            y: bounds.centerY + Math.sin(angle) * radius
        };
    }

    function animateInfinity(progress, bounds) {
        const cycleProgress = (progress * state.speed * 0.125) % 1;
        const t = cycleProgress * Math.PI * 2;

        const maxX = bounds.width / 2;
        const maxY = bounds.height / 2;
        const yScale = Math.min(maxY, maxX * 0.9);

        const x = bounds.centerX + Math.sin(t) * maxX;
        const y = bounds.centerY + Math.sin(t) * Math.cos(t) * 2 * yScale;

        return { x, y };
    }

    function animateDiagonal(progress, bounds) {
        const totalCycleTime = 10;
        const elapsed = progress * state.speed;
        const cycleProgress = (elapsed % totalCycleTime) / totalCycleTime;

        const halfWidth = bounds.width / 2;
        const halfHeight = bounds.height / 2;

        const phase = Math.floor(cycleProgress * 4);
        const t = (cycleProgress * 4) % 1;

        const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
        const easedT = ease(t);

        let x;
        let y;

        switch (phase) {
            case 0:
                x = bounds.centerX - halfWidth + (halfWidth * 2) * easedT;
                y = bounds.centerY - halfHeight + (halfHeight * 2) * easedT;
                break;
            case 1:
                x = bounds.centerX + halfWidth;
                y = bounds.centerY + halfHeight - (halfHeight * 2) * easedT;
                break;
            case 2:
                x = bounds.centerX + halfWidth - (halfWidth * 2) * easedT;
                y = bounds.centerY - halfHeight + (halfHeight * 2) * easedT;
                break;
            case 3:
            default:
                x = bounds.centerX - halfWidth;
                y = bounds.centerY + halfHeight - (halfHeight * 2) * easedT;
                break;
        }

        return { x, y };
    }

    function animateFocus(progress, bounds) {
        const cycleProgress = (progress * state.speed * 0.1) % 1;
        const angle = cycleProgress * Math.PI * 2;

        const scale = 1.5 + Math.sin(angle) * 1;
        elements.dot.style.transform = `translate(-50%, -50%) scale(${scale})`;

        if (elements.exerciseInstruction) {
            const isNear = Math.sin(angle) > 0;
            const currentPhase = isNear ? 'near' : 'far';

            if (currentPhase !== state.lastFocusPhase) {
                if (isNear) {
                    audio.playNearBeep();
                } else {
                    audio.playFarBeep();
                }
                state.lastFocusPhase = currentPhase;
            }

            const phaseText = isNear ? 'Cerca: mira la punta de la nariz' : 'Lejos: enfoca un punto en la distancia';
            elements.exerciseInstruction.textContent = phaseText;
            elements.exerciseInstruction.classList.remove('fade-out');
        }

        return { x: bounds.centerX, y: bounds.centerY };
    }

    function animateSaccadic(progress, bounds) {
        const jumpInterval = 1.5;
        const elapsed = progress * state.speed;
        const jumpNumber = Math.floor(elapsed / jumpInterval);

        const halfWidth = bounds.width / 2;
        const isLeft = jumpNumber % 2 === 0;

        return {
            x: bounds.centerX + (isLeft ? -halfWidth : halfWidth),
            y: bounds.centerY
        };
    }

    function animateBlink(progress, bounds) {
        const elapsed = progress * state.speed;
        const blinkPhase = (elapsed % 1.5) / 1.5;

        const pulseScale = 1 + Math.sin(blinkPhase * Math.PI * 2) * 0.3;
        elements.dot.style.transform = `translate(-50%, -50%) scale(${pulseScale})`;

        if (elapsed > 20) {
            if (elements.exerciseInstruction) {
                elements.exerciseInstruction.textContent = elapsed >= 29
                    ? 'Abre los ojos. Hemos terminado.'
                    : 'Cierra los ojos y descansa...';
                elements.exerciseInstruction.classList.remove('fade-out');
            }

            if (!state.hasPlayedCloseEyes) {
                audio.playCloseEyesBeep();
                state.hasPlayedCloseEyes = true;
            }

            if (elapsed >= 29 && !state.hasPlayedOpenEyes) {
                audio.playOpenEyesBeep();
                state.hasPlayedOpenEyes = true;
            }

            elements.dot.style.opacity = String(Math.max(0, 1 - (elapsed - 20) / 5));
        } else {
            elements.dot.style.opacity = '1';
            const blinkCount = Math.floor(elapsed / 1.5);

            if (blinkCount > state.lastBlinkCount && blinkCount < 20) {
                audio.playBlinkBeep();
                state.lastBlinkCount = blinkCount;
            }

            if (elements.exerciseInstruction && blinkCount <= 20) {
                elements.exerciseInstruction.textContent = `¡Parpadea! (${blinkCount}/20)`;
                elements.exerciseInstruction.classList.remove('fade-out');
            }
        }

        return { x: bounds.centerX, y: bounds.centerY };
    }

    function animateClock(progress, bounds) {
        const secondsPerPosition = 3;
        const elapsed = progress * state.speed;
        const currentPosition = Math.floor(elapsed / secondsPerPosition) % 12;
        const positionProgress = (elapsed % secondsPerPosition) / secondsPerPosition;

        const currentAngle = (currentPosition * 30 - 90) * (Math.PI / 180);
        const nextAngle = ((currentPosition + 1) * 30 - 90) * (Math.PI / 180);

        const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
        const easedProgress = ease(positionProgress);

        const angle = currentAngle + (nextAngle - currentAngle) * easedProgress;
        const radius = Math.min(bounds.width, bounds.height) / 2;

        const hourLabels = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
        if (elements.exerciseInstruction) {
            elements.exerciseInstruction.textContent = `Posición: ${hourLabels[currentPosition]} en punto`;
            elements.exerciseInstruction.classList.remove('fade-out');
        }

        return {
            x: bounds.centerX + Math.cos(angle) * radius,
            y: bounds.centerY + Math.sin(angle) * radius
        };
    }

    function animateZigZag(progress, bounds) {
        const elapsed = progress * state.speed;
        const cycleTime = 5;
        const t = (elapsed % cycleTime) / cycleTime;

        const halfWidth = bounds.width / 2;
        const halfHeight = bounds.height / 2;

        const x = bounds.centerX + Math.cos(t * Math.PI * 2) * halfWidth;

        const yPhase = (t * 4) % 1;
        const yDirection = Math.floor(t * 4) % 2 === 0 ? 1 : -1;
        const yOffset =
            yDirection === 1
                ? -halfHeight + yPhase * halfHeight * 2
                : halfHeight - yPhase * halfHeight * 2;
        const y = bounds.centerY + yOffset;

        return { x, y };
    }

    function animatePalming(progress, bounds) {
        elements.dot.style.opacity = '0';
        return { x: bounds.centerX, y: bounds.centerY };
    }

    function animateTwenty(progress, bounds) {
        const elapsed = progress * state.speed;
        const pulse = 1 + Math.sin(elapsed * 2) * 0.2;
        elements.dot.style.transform = `translate(-50%, -50%) scale(${pulse})`;
        elements.dot.style.opacity = '0.7';
        elements.dot.style.boxShadow = `0 0 ${20 + Math.sin(elapsed * 4) * 10}px var(--dot-glow)`;

        return { x: bounds.centerX, y: bounds.centerY };
    }

    function animateMassage(progress, bounds) {
        const totalDuration = exercises.massage.duration;
        const halfDuration = totalDuration / 2;
        const elapsed = progress;
        const scaledElapsed = elapsed * state.speed;
        const circleDuration = 1.5;
        const angularSpeed = (Math.PI * 2) / circleDuration;

        let angle;
        if (elapsed < halfDuration) {
            angle = scaledElapsed * angularSpeed;
        } else {
            const switchAngle = halfDuration * state.speed * angularSpeed;
            const afterSwitch = (elapsed - halfDuration) * state.speed;
            angle = switchAngle - afterSwitch * angularSpeed;
        }

        const radius = 20 + Math.sin(scaledElapsed * 2) * 10;

        const isFirstHalf = elapsed < halfDuration;
        const currentDirection = isFirstHalf ? 'clockwise' : 'counter';

        if (state.lastDirection !== currentDirection) {
            audio.playNearBeep();
            state.lastDirection = currentDirection;
        }

        return {
            x: bounds.centerX + Math.cos(angle) * radius,
            y: bounds.centerY + Math.sin(angle) * radius
        };
    }

    function animateABC(progress, bounds) {
        const elapsed = progress * state.speed;
        const letterDuration = 15;
        const phase = Math.floor(elapsed / letterDuration) % 3;
        const t = (elapsed % letterDuration) / letterDuration;

        const size = Math.min(bounds.width, bounds.height) * 0.72;
        let x = bounds.centerX;
        let y = bounds.centerY;

        if (phase === 0) {
            if (t < 0.4) {
                const localT = t / 0.4;
                x = bounds.centerX + size / 2 - size * localT;
                y = bounds.centerY + size / 2 - size * localT;
            } else if (t < 0.8) {
                const localT = (t - 0.4) / 0.4;
                x = bounds.centerX - size / 2 + size * localT;
                y = bounds.centerY - size / 2 + size * localT;
            } else {
                const localT = (t - 0.8) / 0.2;
                x = bounds.centerX - size / 4 + (size / 2) * localT;
                y = bounds.centerY;
            }
        } else if (phase === 1) {
            if (t < 0.3) {
                const localT = t / 0.3;
                x = bounds.centerX - size / 3;
                y = bounds.centerY - size / 2 + size * localT;
            } else if (t < 0.65) {
                const localT = (t - 0.3) / 0.35;
                const angle = -Math.PI / 2 + localT * Math.PI;
                x = bounds.centerX - size / 3 + Math.cos(angle) * (size / 3);
                y = bounds.centerY - size / 4 + Math.sin(angle) * (size / 4);
            } else {
                const localT = (t - 0.65) / 0.35;
                const angle = -Math.PI / 2 + localT * Math.PI;
                x = bounds.centerX - size / 3 + Math.cos(angle) * (size / 3);
                y = bounds.centerY + size / 4 + Math.sin(angle) * (size / 4);
            }
        } else {
            const angle = Math.PI * 0.2 + t * Math.PI * 1.6;
            x = bounds.centerX + Math.cos(angle) * (size / 2);
            y = bounds.centerY + Math.sin(angle) * (size / 2);
        }

        return { x, y };
    }

    return exercises;
}
