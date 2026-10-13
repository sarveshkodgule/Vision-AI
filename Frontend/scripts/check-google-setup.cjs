/* Read-only live setup check. Does not click Google login or create an account. */
const { createRequire } = require('node:module');
const { chromium } = createRequire(__filename)(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5173';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const warnings = new Set();
    const networkFailures = new Set();
    page.on('requestfailed', request => { if (request.url().includes('accounts.google.com')) networkFailures.add(request.failure()?.errorText || 'Google request failed'); });
    page.on('console', message => {
      const text = message.text();
      if (/origin.*not allowed|origin_mismatch/i.test(text)) warnings.add('Google reports an unauthorised origin.');
      if (/invalid_client|client ID.*not found/i.test(text)) warnings.add('Google reports an invalid client ID.');
    });
    const configResponse = page.waitForResponse(response => response.url().endsWith('/auth/google/config'));
    await page.goto(base + '/login');
    const response = await configResponse;
    const config = await response.json();
    console.log('Backend Google configuration HTTP status:', response.status());
    console.log('Client ID configured:', !!config.data?.client_id?.endsWith('.apps.googleusercontent.com'));
    console.log('Login challenge present:', !!config.data?.challenge && !!config.data?.nonce);
    // GIS may render an accessible button in the host DOM instead of a visible iframe.
    const button = page.locator('.google-button').getByRole('button', { name: /continue with google|sign in with google/i }).first();
    try { await button.waitFor({ state: 'visible', timeout: 25000 }); }
    catch {
      const output = path.resolve(__dirname, '../../reports/ui-preview');
      fs.mkdirSync(output, { recursive: true });
      await page.screenshot({ path: path.join(output, 'google-live-setup.png'), fullPage: true });
      console.log('Google library loaded:', await page.evaluate(() => !!window.google?.accounts?.id));
      console.log('Page feedback:', await page.locator('.google-signin').innerText());
      console.log('Google network failures:', [...networkFailures]);
      console.log('Detected configuration warnings:', [...warnings]);
      throw new Error('Google sign-in button did not become visible.');
    }
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    const output = path.resolve(__dirname, '../../reports/ui-preview');
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'google-live-setup.png'), fullPage: true });
    console.log('Google-hosted sign-in button visible:', await button.isVisible());
    console.log('Detected configuration warnings:', [...warnings]);
    console.log('Actual account sign-in was not attempted.');
    if (warnings.size) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error('Setup check failed:', error.message.split('\n')[0]); process.exitCode = 1; });
