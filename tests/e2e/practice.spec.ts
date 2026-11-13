import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CaseItem } from '../../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cases = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../content/cases.json'), 'utf-8')
) as CaseItem[];
const SCREENSHOT_DIR = process.env.PRACTICE_SCREENSHOT_DIR || '';

async function maybeScreenshot(page: import('@playwright/test').Page, filename: string, fullPage = true) {
  if (!SCREENSHOT_DIR) return;
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage });
}

test('Flujo completo E2E: Modo práctica individual (configuración, recarga, Vademécum, balance, reintento y visibilidad topbar)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });

  // 1. Entrada desde barra superior en portada
  await page.goto('/?local=1#/');
  await expect(page.locator('#topbar-practice-link')).toBeVisible();
  await page.click('#topbar-practice-link');
  await expect(page.locator('#practice-setup')).toBeVisible();

  // 2. Verificar filtro de modelos y aviso de repetición
  await page.click('#practice-rounds-12');
  await page.click('#practice-model-toggle-addie');
  await page.click('#practice-model-toggle-dick-carey');
  await page.click('#practice-model-toggle-4c-id');
  await expect(page.locator('#practice-repeat-warning')).toBeVisible();

  await page.getByRole('button', { name: 'Activar todos' }).click();
  await page.click('#practice-rounds-6');
  await expect(page.locator('#practice-repeat-warning')).toHaveCount(0);

  await maybeScreenshot(page, 'practice_setup.png', true);

  // 3. Iniciar práctica de 6 casos
  await page.click('#practice-start-btn');
  await expect(page.locator('#practice-status-bar')).toBeVisible();
  await expect(page.locator('#practice-progress-badge')).toContainText('Caso 1 de 6');

  // Consultar Vademécum sin perder el progreso
  await page.click('#practice-tab-guide-btn');
  await expect(page.locator('#vademecum-guide')).toBeVisible();
  await page.click('#practice-tab-brief-btn');
  await expect(page.locator('#practice-case-brief')).toBeVisible();

  // 4. Resolver los 6 casos (pares correctos, impares erróneos -> 3/6 = 1800 pts)
  for (let idx = 0; idx < 6; idx++) {
    await expect(page.locator('#practice-progress-badge')).toContainText(`Caso ${idx + 1} de 6`);
    const caseId = await page.locator('#practice-case-brief').getAttribute('data-case-id');
    expect(caseId).toBeTruthy();

    const caseItem = cases.find((c) => c.id === caseId)!;
    expect(caseItem).toBeTruthy();

    const shouldAnswerCorrectly = idx % 2 === 0;
    const chosenOption = shouldAnswerCorrectly
      ? caseItem.model
      : caseItem.options.find((o) => o !== caseItem.model)!;

    // En el primer caso, probar cambiar de opinión antes de confirmar
    if (idx === 0) {
      const altOption = caseItem.options.find((o) => o !== chosenOption)!;
      await page.click(`#practice-option-btn-${altOption}`);
      await expect(page.locator('#practice-current-choice')).toBeVisible();
    }

    await page.click(`#practice-option-btn-${chosenOption}`);
    await expect(page.locator('#practice-current-choice')).toBeVisible();

    if (idx === 0) {
      await maybeScreenshot(page, 'practice_case_open.png', false);
    }

    // En el caso 3 (idx === 2), recargar antes de confirmar y verificar que retoma automáticamente
    if (idx === 2) {
      await page.reload();
      await expect(page.locator('#practice-progress-badge')).toContainText('Caso 3 de 6');
      const reloadedCaseId = await page.locator('#practice-case-brief').getAttribute('data-case-id');
      expect(reloadedCaseId).toBe(caseId);
      await expect(page.locator('#practice-current-choice')).toBeVisible();
    }

    await page.click('#practice-confirm-btn');
    await expect(page.locator('#practice-revealed-state')).toBeVisible();
    await expect(page.locator('#practice-dictamen-card')).toBeVisible();
    // Cada opción aparece exactamente una vez (sin tarjeta duplicada)
    await expect(
      page.locator(`#practice-dictamen-card [data-option-id="${chosenOption}"]`)
    ).toHaveCount(1);
    // Sin votos de la cohorte en práctica individual
    await expect(page.locator('#practice-revealed-state')).not.toContainText('votos de la cohorte');

    if (idx === 0) {
      await maybeScreenshot(page, 'practice_revealed.png', true);
    }

    await page.click('#practice-next-btn');
  }

  // 5. Balance final, mapa personal y reintentar solo los fallados
  await expect(page.locator('#practice-final-state')).toBeVisible();
  await expect(page.locator('#practice-score-badge')).toContainText('1800 pts');
  await expect(page.locator('#practice-final-state')).toContainText('3 / 6');
  await expect(page.locator('#practice-model-map')).toBeVisible();
  await expect(page.locator('#practice-failed-list')).toBeVisible();
  await expect(page.locator('#practice-retry-failed-btn')).toContainText('3');

  await maybeScreenshot(page, 'practice_final_summary.png', true);

  await page.click('#practice-retry-failed-btn');
  await expect(page.locator('#practice-progress-badge')).toContainText('Caso 1 de 3');
  await expect(page.locator('#practice-score-badge')).toContainText('0 pts');

  // 6. Empezar de nuevo borra progreso y regresa a configuración
  page.once('dialog', (dialog) => dialog.accept());
  await page.click('#practice-abandon-btn');
  await expect(page.locator('#practice-setup')).toBeVisible();

  await page.reload();
  await expect(page.locator('#practice-setup')).toBeVisible();

  // 7. Regla de visibilidad de barra superior: visible en #/guia y #/host, oculta en #/play/:code
  await page.goto('/?local=1#/guia');
  await expect(page.locator('#topbar-practice-link')).toBeVisible();

  await page.goto('/?local=1#/host');
  await expect(page.locator('#topbar-practice-link')).toBeVisible();

  await page.goto('/?local=1#/play/ZZZZZ');
  await expect(page.locator('#topbar-practice-link')).toHaveCount(0);
});
