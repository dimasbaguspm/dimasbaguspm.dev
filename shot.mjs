// Screenshot the real rendered app at several routes. Run with: node shot.mjs
import { chromium } from '/opt/data/profiles/dev/home/.local/lib/node_modules/playwright/index.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';

const EXEC = '/tmp/pw-browsers/chromium-1234/chrome-linux64/chrome';
const OUT = '/opt/data/dimasbaguspm.dev/screenshots';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:4321';

// Forged session cookie (same secret the server uses) so we can screenshot the
// authenticated admin dashboard without a real OIDC provider.
const secret = 'testsecret1234567890abcdef';
const payload = Buffer.from(JSON.stringify({ sub: 'sub-dimas', email: 'me@dimas.dev', exp: Date.now() + 86400000 })).toString('base64url');
const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
const cookie = `dbpm_session=${payload}.${sig}`;

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 1400 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const shots = [];

async function shot(name, path, opts = {}) {
  await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 20000 });
  if (opts.wait) await page.waitForTimeout(opts.wait);
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file, fullPage: opts.full ?? false });
  shots.push(file);
  console.log('captured', name, '->', file);
}

// 1) Public home
await shot('01-home', '/', { full: false });
// 2) An article (public)
await shot('02-article', '/articles/hello-world', { full: false });
// 3) Projects public page
await shot('03-projects', '/projects', { full: false });
// 4) Admin while logged OUT -> should redirect to /admin/login (which then 500s on dummy issuer)
await shot('04-admin-redirect', '/admin', { full: false });
// 5) Admin dashboard WITH forged session cookie
await ctx.addCookies([{ name: 'dbpm_session', value: `${payload}.${sig}`, domain: 'localhost', path: '/' }]);
await shot('05-admin-dashboard', '/admin', { full: false });
// 6) New article editor
await shot('06-admin-new-article', '/admin/articles/new', { full: false });
// 7) Assets manager
await shot('07-admin-assets', '/admin/assets', { full: false });
// 8) Projects admin list
await shot('08-admin-projects', '/admin/projects', { full: false });
// 9) New project form
await shot('09-admin-new-project', '/admin/projects/new', { full: false });

await browser.close();
console.log('ALL DONE:', shots.length, 'screenshots in', OUT);
