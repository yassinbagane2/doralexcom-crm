import type { Browser } from "puppeteer"

/*
 * Prints web pages to PDF with a headless Chrome. Knows nothing about what it
 * prints: callers hand it a URL and the selector that page sets once it is
 * fully drawn.
 */

const TIMEOUT_MS = 60_000

/** One Chrome for the whole server, started on first use. */
let browser: Promise<Browser> | null = null

function getBrowser() {
  if (!browser) {
    browser = import("puppeteer").then(({ default: puppeteer }) =>
      puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      })
    )
    browser
      .then((b) => b.on("disconnected", () => (browser = null)))
      .catch(() => (browser = null))
  }
  return browser
}

export async function renderPdf(
  url: string,
  { readySelector }: { readySelector: string }
): Promise<Uint8Array> {
  const page = await (await getBrowser()).newPage()
  try {
    await page.goto(url, { waitUntil: "networkidle0", timeout: TIMEOUT_MS })
    await page.waitForSelector(readySelector, { timeout: TIMEOUT_MS })
    // A string: evaluated in the page, where `document` is the DOM.
    await page.evaluate("document.fonts.ready")
    return await page.pdf({ preferCSSPageSize: true, printBackground: true })
  } finally {
    await page.close().catch(() => {})
  }
}
