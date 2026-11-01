import { _electron as electron, expect, test } from '@playwright/test';

for (const mode of ['built', 'development'] as const) {
  test(`${mode} desktop starts with a working, isolated application bridge`, async () => {
    const environment = Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    );
    delete environment.ELECTRON_RUN_AS_NODE;
    delete environment.ELECTRON_RENDERER_URL;
    if (mode === 'development')
      environment.ELECTRON_RENDERER_URL = 'http://127.0.0.1:5173/';
    const application = await electron.launch({
      args: ['.'],
      env: environment,
    });
    try {
      const page = await application.firstWindow();
      await expect(
        page.getByRole('heading', { name: 'Desktop foundation' }),
      ).toBeVisible();
      await expect(page.getByRole('status')).toContainText('Desktop connected');
      const policy = await page
        .locator('meta[http-equiv="Content-Security-Policy"]')
        .getAttribute('content');
      if (mode === 'built') expect(policy).not.toContain('unsafe-inline');
      else {
        expect(policy).toContain("script-src 'self' 'unsafe-inline'");
        expect(policy).toContain('ws://127.0.0.1:*');
      }
      expect(
        await page.evaluate(() => ({
          node: typeof Reflect.get(window, 'require'),
          process: typeof Reflect.get(window, 'process'),
          keys: Object.keys(window.desktop),
        })),
      ).toEqual({
        node: 'undefined',
        process: 'undefined',
        keys: ['getAppInfo'],
      });
      await page.setViewportSize({ width: 390, height: 700 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/${mode}-desktop-narrow.png`,
      });
    } finally {
      await application.close();
    }
  });
}
