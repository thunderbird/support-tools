// Headless-browser fetch. The SUMO API host is behind a JS/TLS-fingerprint bot
// challenge that plain HTTP clients can't pass (see docs/DECISIONS.md, O1/D7), so
// we drive a real Chromium to solve the challenge and read the JSON it returns.
// This engine is also the basis for the later semi-automated publish path.

import { chromium } from "playwright";

const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// Headless Chromium gets fingerprinted by the SUMO bot wall and is shown a CAPTCHA;
// a headed browser passes the challenge cleanly. Default to headed. Set SUMO_HEADLESS=1
// to experiment with headless (e.g. once a stealth/allowlist path exists). See D7.
const HEADLESS = process.env.SUMO_HEADLESS === "1";

/**
 * Navigate to a JSON endpoint in a real browser, wait for any bot challenge to
 * resolve, then parse the resulting JSON body.
 */
export async function fetchJson<T>(url: string, timeoutMs = 45000): Promise<T> {
  const browser = await chromium.launch({ headless: HEADLESS });
  try {
    const context = await browser.newContext({ userAgent: CHROME_UA });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });

    // The challenge page is HTML; the real response is a JSON document. Wait until
    // the body text looks like JSON (handles the challenge's reload to content).
    try {
      await page.waitForFunction(
        () => {
          const t = document.body?.innerText?.trim() ?? "";
          return t.startsWith("{") || t.startsWith("[");
        },
        { timeout: timeoutMs },
      );
    } catch {
      throw new Error(
        `Timed out waiting for JSON from ${url}. The bot challenge may not have ` +
          `resolved, or the URL is wrong (e.g. an unknown slug returns an HTML page).`,
      );
    }

    const text = await page.evaluate(() => document.body.innerText);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Response from ${url} was not valid JSON.`);
    }
  } finally {
    await browser.close();
  }
}

/** Fetch a web page's rendered HTML (for generic-URL sources). */
export async function fetchPageHtml(url: string, timeoutMs = 45000): Promise<string> {
  const browser = await chromium.launch({ headless: HEADLESS });
  try {
    const context = await browser.newContext({ userAgent: CHROME_UA });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForTimeout(1500); // let JS-rendered content settle
    return await page.content();
  } finally {
    await browser.close();
  }
}
