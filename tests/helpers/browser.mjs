import { chromium } from "playwright-core";

export const BASE = process.env.BASE_URL ?? "http://localhost:3217";
export const ADMIN = { email: "admin@sanapati.id", password: process.env.ADMIN_PASSWORD ?? "admin123" };
/** Akun contoh dari seed demo (SEED_DEMO=1). */
export const PLAYER = { email: "raka@contoh.id", password: "tenis123" };

let browser;
export async function launch() {
  browser ??= await chromium.launch({ channel: "chrome", headless: process.env.HEADED !== "1" });
  return browser;
}
export async function close() {
  await browser?.close();
  browser = undefined;
}

/** Konteks browser baru = sesi/cookie terpisah. Error halaman dikumpulkan supaya suite bisa gagal karenanya. */
export async function newPage(errors = []) {
  const ctx = await (await launch()).newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${page.url()} — ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/404|401|403/.test(m.text())) errors.push(`${page.url()} — ${m.text()}`);
  });
  return page;
}

export async function login(page, { email, password }) {
  await page.goto(`${BASE}/masuk`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("main form button[type=submit]");
  await page.waitForLoadState("networkidle");
}

/** Pelapor hasil: satu baris per pemeriksaan, plus kode keluar supaya bisa dipakai di CI. */
export function reporter(title) {
  let failed = 0;
  console.log(`\n=== ${title}`);
  return {
    ok(condition, message) {
      console.log(condition ? `  ok    ${message}` : `  GAGAL ${message}`);
      if (!condition) failed++;
    },
    section: (name) => console.log(`\n  -- ${name}`),
    finish(extraErrors = []) {
      for (const e of extraErrors) {
        console.log(`  GAGAL error di halaman: ${e}`);
        failed++;
      }
      console.log(failed ? `\n${title}: ${failed} GAGAL\n` : `\n${title}: semua lolos\n`);
      return failed;
    },
  };
}
