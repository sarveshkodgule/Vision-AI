/* Smoke checks use synthetic API responses; never submit real screenings or mail. */
const { createRequire } = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const load = createRequire(__filename);
const { chromium } = load(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:5173';
const output = path.resolve(__dirname, '../../reports/ui-preview');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [];
  const settle = () => page.waitForFunction(() => [...document.querySelectorAll('[style*="opacity"]')].every(element => Number(getComputedStyle(element).opacity) > .98));
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/chatbot/general', route => route.fulfill({ json: { status: 'success', data: { response: 'Sample assistant reply for the UI check.' } } }));
  for (const route of ['/', '/about', '/contact', '/login', '/signup', '/forgot-password']) {
    await page.goto(base + route);
    await page.locator('.hospital-brand:visible').first().waitFor();
    assert.equal(await page.evaluate(() => document.compatMode), 'CSS1Compat', 'Page must use standards mode');
    await settle();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Desktop overflow: ${route}`);
    await page.screenshot({ path: path.join(output, `${route.replaceAll('/', '') || 'home'}-desktop.png`), fullPage: true });
  }
  await page.goto(base);
  await page.getByRole('tab', { name: 'Start a screening' }).click();
  await page.getByRole('heading', { name: 'Understand your result. Know your next step.' }).waitFor();
  await page.getByRole('tab', { name: 'Start a screening' }).press('ArrowRight');
  assert.equal(await page.getByRole('tab', { name: 'Find my report' }).getAttribute('aria-selected'), 'true');
  await page.getByRole('tab', { name: 'Find my report' }).press('Home');
  assert.equal(await page.getByRole('tab', { name: 'Visit the hospital' }).getAttribute('aria-selected'), 'true');
  await page.getByText('How do I arrange an appointment?', { exact: true }).click();
  assert.equal(await page.locator('details[open]').count(), 1);
  await page.getByRole('button', { name: 'Open eye-care assistant' }).click();
  await page.getByRole('textbox', { name: 'Your question' }).fill('How do I find my report?');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page.getByText('Sample assistant reply for the UI check.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close assistant', exact: true }).click();
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.copiedTestAddress = value; } } }));
  await page.goto(base + '/contact');
  await page.getByRole('button', { name: 'Copy hospital address' }).click();
  await page.getByText('Address copied', { exact: true }).waitFor();
  assert.ok((await page.evaluate(() => window.copiedTestAddress)).includes('Mitra Nagar'));
  for (const checkbox of await page.locator('.packing-checklist input').all()) await checkbox.check();
  await page.getByText('All set. Remember to confirm your appointment with the hospital.', { exact: true }).waitFor();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ['/', '/about', '/contact', '/login', '/signup', '/forgot-password']) {
      await page.goto(base + route);
      await page.locator('.hospital-brand').first().waitFor({ state: 'attached' });
      await page.locator('.hospital-brand:visible').first().waitFor();
      await settle();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Mobile overflow (${width}): ${route}`);
      if (width === 390) await page.screenshot({ path: path.join(output, `${route.replaceAll('/', '') || 'home'}-mobile.png`), fullPage: true });
    }
  }
  await page.goto(base);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: 'Open navigation' }).getAttribute('aria-expanded'), 'false');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Our hospital' }).click();
  await page.getByRole('heading', { name: 'Here for your eyes. Here for you.' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Open navigation' }).getAttribute('aria-expanded'), 'false');
  await page.route('**/auth/profile', route => route.fulfill({ json: { data: { name: 'Sample Patient', email: 'sample@example.com', role: 'patient' } } }));
  for (const endpoint of ['patient/history', 'patient/reports', 'auth/doctors', 'doctor/patients', 'doctor/reports', 'doctor/analytics']) {
    await page.route(`**/${endpoint}`, route => route.fulfill({ json: { data: [] } }));
  }
  await page.evaluate(() => { localStorage.setItem('token', 'ui-test-only'); localStorage.setItem('role', 'patient'); });
  await page.goto(base + '/patient/dashboard');
  await page.getByRole('heading', { name: 'Your eye-health screening', exact: true }).waitFor();
  await settle();
  await page.getByRole('button', { name: 'Open patient assistant', exact: true }).filter({ visible: true }).click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Patient chat mobile overflow');
  await page.getByRole('button', { name: 'Open patient assistant', exact: true }).filter({ visible: true }).click();
  await page.locator('.patient-chat-panel').waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Patient portal mobile overflow');
  await page.screenshot({ path: path.join(output, 'patient-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: path.join(output, 'patient-desktop.png'), fullPage: true });
  await page.evaluate(() => localStorage.setItem('role', 'doctor'));
  await page.goto(base + '/doctor/dashboard');
  await page.getByRole('heading', { name: 'Patient Management', exact: true }).waitFor();
  await settle();
  await page.getByRole('heading', { name: 'Your patient registry starts here' }).waitFor();
  await page.getByRole('searchbox', { name: 'Search patients' }).fill('unmatched');
  await page.getByRole('button', { name: 'Clear search' }).click();
  assert.equal(await page.getByRole('searchbox', { name: 'Search patients' }).inputValue(), '');
  await page.screenshot({ path: path.join(output, 'doctor-desktop.png'), fullPage: true });
  await page.route('**/doctor/patients', route => route.fulfill({ json: { data: [
    { id: 'sample-one', name: 'Sample Asha', myopia_probability: .25, risk_level: 'Low' },
    { id: 'sample-two', name: 'Sample Ravi', myopia_probability: .75, risk_level: 'High' },
  ] } }));
  await page.reload();
  await page.getByText('Sample Asha', { exact: true }).waitFor();
  await page.getByRole('searchbox', { name: 'Search patients' }).fill('ASHA');
  assert.equal(await page.getByText('Sample Asha', { exact: true }).count(), 1);
  assert.equal(await page.getByText('Sample Ravi', { exact: true }).count(), 0);
  await page.getByRole('searchbox', { name: 'Search patients' }).fill('sample-two');
  await page.getByText('Sample Ravi', { exact: true }).waitFor();
  assert.equal(await page.getByText('Sample Asha', { exact: true }).count(), 0);
  await page.getByRole('searchbox', { name: 'Search patients' }).fill('unmatched');
  await page.getByRole('heading', { name: 'No matching patients' }).waitFor();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.setViewportSize({ width: 320, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Doctor portal mobile overflow');
  await page.screenshot({ path: path.join(output, 'doctor-mobile.png'), fullPage: true });
  assert.deepEqual(errors, [], 'Browser runtime errors');
  await browser.close();
  console.log('PASS: public pages at 1440/390/320px; mobile navigation/Escape; care tabs/keyboard; checklist; copy address; FAQ; mocked chat; patient/doctor portal rendering and search empty state.');
  console.log(`Screenshots: ${output}`);
})().catch(error => { console.error(error); process.exit(1); });
