import { test, expect } from '@playwright/test';
import path from 'node:path';

const ARTIFACT_DIR =
  '/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/33ae8cd4-e5bc-4b61-8ab4-101fd360dcca';

test('Flujo completo E2E: Docente + Proyección + Estudiantes + Cambio de respuesta + Vademécum + Mapa de Decisiones', async ({
  browser,
}) => {
  // Usamos un mismo contexto de navegador para compartir localStorage/BroadcastChannel (o Firebase Emulator si ?emulator=1)
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  // 1. Pestaña del Docente: Crear una sala de 6 rondas
  const hostPage = await context.newPage();
  await hostPage.goto('/#/host');
  await expect(hostPage.locator('h1')).toContainText('Configurar Nueva Sesión');

  await hostPage.click('#select-rounds-6');
  await hostPage.click('#create-room-btn');
  await expect(hostPage.locator('h1')).toContainText('SALA ');

  const roomHeading = await hostPage.locator('h1').textContent();
  const roomCode = roomHeading?.replace('SALA ', '').trim() || '';
  expect(roomCode.length).toBeGreaterThanOrEqual(4);

  // 2. Pestaña de Proyección en vivo
  const screenPage = await context.newPage();
  await screenPage.goto(`/#/screen/${roomCode}`);
  await expect(screenPage.locator('#screen-lobby')).toBeVisible();
  await screenPage.screenshot({
    path: path.join(ARTIFACT_DIR, 'live_screen_lobby.png'),
    fullPage: true,
  });

  // 3. Pestaña de Estudiante (vista móvil) uniéndose con código + apodo
  const studentPage = await context.newPage();
  await studentPage.setViewportSize({ width: 430, height: 920 });
  await studentPage.goto('/#/');
  await studentPage.fill('#join-room-code', roomCode);
  await studentPage.fill('#join-player-name', 'Valeria (Lead ID)');
  await studentPage.click('#join-submit-btn');

  await expect(studentPage.locator('#student-lobby-state')).toBeVisible();

  // Verificar que el Vademécum está disponible desde antes/durante la Ronda 1
  await studentPage.click('#tab-guide-btn');
  await expect(studentPage.locator('#vademecum-guide')).toBeVisible();
  await studentPage.screenshot({
    path: path.join(ARTIFACT_DIR, 'live_student_vademecum.png'),
    fullPage: false,
  });
  await studentPage.click('#tab-brief-btn');

  // 4. El Docente abre la Ronda 1 (Caso 1: am-1 -> respuesta correcta: action-mapping)
  await hostPage.click('#host-start-round-1-btn');

  await expect(studentPage.locator('#student-case-brief')).toBeVisible();
  await expect(screenPage.locator('#screen-case-brief')).toBeVisible();

  // Estudiante elige inicialmente un distractor ('backward-design') y luego CAMBIA su respuesta a 'action-mapping' antes del cierre
  await studentPage.click('#option-btn-backward-design');
  await expect(studentPage.locator('#current-choice-indicator')).toContainText('Backward Design');

  await studentPage.click('#option-btn-action-mapping');
  await expect(studentPage.locator('#current-choice-indicator')).toContainText('Action Mapping');

  await studentPage.screenshot({
    path: path.join(ARTIFACT_DIR, 'live_student_round_open.png'),
    fullPage: false,
  });
  await screenPage.screenshot({
    path: path.join(ARTIFACT_DIR, 'live_screen_round_open.png'),
    fullPage: true,
  });

  // Verificar que el panel del docente registra "Respondieron: 1 / 1"
  await expect(hostPage.locator('#host-answer-counter')).toContainText('Respondieron: 1 / 1');
  await hostPage.screenshot({
    path: path.join(ARTIFACT_DIR, 'live_host_panel_open.png'),
    fullPage: true,
  });

  // 5. El Docente cierra y revela la Ronda 1
  await hostPage.click('#host-close-and-reveal-btn');

  // Verificar que en la pantalla del estudiante y en la proyección aparece el feedback validado y el puntaje > 600
  await expect(studentPage.locator('#student-revealed-state')).toBeVisible();
  await expect(studentPage.locator('#my-choice-feedback-card')).toContainText('Cathy Moore');
  const scoreBadgeText = await studentPage.locator('#student-score-badge').textContent();
  expect(scoreBadgeText).toMatch(/[6-9]\d\d|1000/);

  await studentPage.screenshot({
    path: path.join(ARTIFACT_DIR, 'live_student_revealed_feedback.png'),
    fullPage: false,
  });
  await screenPage.screenshot({
    path: path.join(ARTIFACT_DIR, 'live_screen_revealed_feedback.png'),
    fullPage: true,
  });

  // 6. Simular reconexión del estudiante recargando la página y verificando que conserva su puntaje
  await studentPage.reload();
  await expect(studentPage.locator('#student-score-badge')).toContainText(scoreBadgeText || '');

  // 7. Avanzar por las rondas 2 a 6 hasta el Podio Final y el Mapa de Decisiones
  const correctModelsForRemainingRounds = [
    'backward-design',
    'pebble-in-the-pond',
    'addie',
    'dick-carey',
    '4c-id',
  ];

  for (let r = 0; r < correctModelsForRemainingRounds.length; r++) {
    await hostPage.click('#host-next-round-btn');
    const targetOption = correctModelsForRemainingRounds[r];
    await studentPage.click(`#option-btn-${targetOption}`);
    await hostPage.click('#host-close-and-reveal-btn');
    await expect(studentPage.locator('#student-revealed-state')).toBeVisible();
  }

  // Finalizar la sesión después de la ronda 6
  await hostPage.click('#host-next-round-btn');

  await expect(screenPage.locator('#screen-final-summary')).toBeVisible();
  await expect(screenPage.locator('#cohort-decision-map')).toBeVisible();
  await expect(studentPage.locator('#student-final-state')).toBeVisible();

  await screenPage.screenshot({
    path: path.join(ARTIFACT_DIR, 'live_screen_final_decision_map.png'),
    fullPage: true,
  });

  await context.close();
});
