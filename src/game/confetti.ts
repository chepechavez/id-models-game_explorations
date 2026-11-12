import confetti from 'canvas-confetti';

/**
 * Dispara confeti festivo para celebrar el acierto de un estudiante o la victoria final.
 */
export function fireSuccessConfetti(): void {
  try {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.7 },
      colors: ['#10b981', '#f59e0b', '#0ea5e9', '#ec4899', '#8b5cf6'],
      ticks: 200,
      gravity: 1.1,
    });
  } catch {
    // Si canvas-confetti no está disponible o falla, silenciar
  }
}

/**
 * Confeti múltiple / cañón para la pantalla final o podio.
 */
export function fireCelebrationCannon(): void {
  try {
    const end = Date.now() + 1500;
    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ['#f59e0b', '#10b981', '#0ea5e9'],
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ['#f59e0b', '#10b981', '#0ea5e9'],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  } catch {
    // Silenciar
  }
}
