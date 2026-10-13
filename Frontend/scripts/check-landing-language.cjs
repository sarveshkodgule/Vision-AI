/* Synthetic staff credentials and API responses only; no database writes or email. */
const { createRequire } = require('node:module');
const { chromium } = createRequire(__filename)(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5173';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/auth/google/config', route => route.fulfill({ status: 503, json: { detail: 'Google unavailable for this test.' } }));
    const output = path.resolve(__dirname, '../../reports/ui-preview');
    fs.mkdirSync(output, { recursive: true });
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base);
      await page.getByRole('button', { name: 'English', exact: true }).click();
      await page.getByRole('tab', { name: 'Find my report' }).click();
      await page.getByRole('button', { name: 'मराठी', exact: true }).click();
      await page.getByRole('heading', { name: /तुमच्या डोळ्यांची काळजी/ }).waitFor();
      assert.equal(await page.locator('#main-content').getAttribute('lang'), 'mr');
      assert.equal(await page.getByRole('tab', { name: 'माझा रिपोर्ट पाहायचा आहे' }).getAttribute('aria-selected'), 'true');
      await page.getByRole('tab', { name: 'माझा रिपोर्ट पाहायचा आहे' }).press('Home');
      await page.getByRole('heading', { name: 'एक फोन करा. पुढचं पाऊल ठरवा.' }).waitFor();
      await page.getByText('डॉक्टरांची वेळ कशी घ्यायची?', { exact: true }).click();
      assert.equal(await page.locator('details[open]').count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Marathi overflow at ' + width);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(output, 'home-marathi-' + width + '.png'), fullPage: true });
      await page.reload();
      assert.equal(await page.getByRole('button', { name: 'मराठी', exact: true }).getAttribute('aria-pressed'), 'true');
      await page.getByRole('button', { name: 'डोळ्यांच्या काळजीचा सहाय्यक उघडा' }).click();
      await page.getByRole('textbox', { name: 'तुमचा प्रश्न' }).waitFor();
      await page.getByRole('button', { name: 'सहाय्यक बंद करा', exact: true }).click();
      await page.getByRole('button', { name: 'English', exact: true }).click();
      await page.getByRole('heading', { name: /For every view/ }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'English overflow at ' + width);
    }
    // Existing staff log in using their personal password, not the registration code.
    let captured;
    await page.route('**/auth/login', route => {
      captured = new URLSearchParams(route.request().postData());
      return route.fulfill({ json: { data: { access_token: 'synthetic-only', user: { role: 'doctor' } } } });
    });
    await page.route('**/auth/profile', route => route.fulfill({ json: { data: { name: 'Test Doctor', email: 'doctor@example.com', role: 'doctor' } } }));
    for (const endpoint of ['patients', 'reports', 'analytics']) await page.route('**/doctor/' + endpoint, route => route.fulfill({ json: { data: [] } }));
    await page.goto(base + '/login');
    await page.getByRole('tab', { name: 'Doctor', exact: true }).click();
    await page.getByLabel('Doctor email address', { exact: true }).fill('doctor@example.com');
    await page.getByLabel('Password', { exact: true }).fill('personal-test-password');
    await page.getByRole('button', { name: 'Sign in as Doctor', exact: true }).click();
    await page.waitForURL('**/doctor/dashboard');
    assert.equal(captured.get('password'), 'personal-test-password');
    assert.equal(captured.has('doctor_passcode'), false);
    assert.deepEqual(errors, []);
    console.log('PASS: English/Marathi homepage at 1440/1024/768/390/320px; language persistence; tab state and keyboard; FAQ; translated chat controls; doctor password login.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
