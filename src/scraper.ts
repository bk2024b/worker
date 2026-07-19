import { chromium, Page } from "playwright";

export type ScrapedProspect = {
  name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  mapsUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  raw: Record<string, unknown>;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (base: number) => base + Math.random() * base * 0.6;

// Scroll le panneau de résultats jusqu'à ce qu'aucun nouveau résultat
// n'apparaisse (ou qu'on atteigne maxResults). Google charge les résultats
// au fur et à mesure du scroll, comme un feed infini.
async function scrollResultsFeed(page: Page, maxResults: number) {
  const feedSelector = 'div[role="feed"]';
  await page.waitForSelector(feedSelector, { timeout: 15000 });

  let previousCount = 0;
  let stableRounds = 0;

  while (stableRounds < 3) {
    const cards = await page.locator(`${feedSelector} div[role="article"]`).count();
    if (cards >= maxResults) break;

    await page.evaluate((sel) => {
      const feed = document.querySelector(sel);
      if (feed) feed.scrollTop = feed.scrollHeight;
    }, feedSelector);

    await sleep(jitter(1200));

    if (cards === previousCount) {
      stableRounds++;
    } else {
      stableRounds = 0;
      previousCount = cards;
    }
  }
}

async function extractFromDetailPane(page: Page): Promise<Partial<ScrapedProspect>> {
  // Google change régulièrement ces sélecteurs — data-item-id est le plus
  // stable dans le temps car il décrit le rôle du champ, pas son style.
  const getText = async (selector: string) => {
    const el = page.locator(selector).first();
    return (await el.count()) ? (await el.innerText()).trim() : null;
  };

  const address = await getText('button[data-item-id="address"]');
  const website = await page
    .locator('a[data-item-id="authority"]')
    .first()
    .getAttribute("href")
    .catch(() => null);
  const phone = await getText('button[data-item-id^="phone:tel:"]');
  const category = await getText('button[jsaction*="category"]');

  const ratingText = await getText('div.F7nice span[aria-hidden="true"]');
  const reviewText = await getText('span[aria-label*="avis"], span[aria-label*="reviews"]');

  const rating = ratingText ? parseFloat(ratingText.replace(",", ".")) : null;
  const reviewCount = reviewText
    ? parseInt(reviewText.replace(/[^\d]/g, ""), 10) || null
    : null;

  return { address, website, phone, category, rating, reviewCount };
}

export async function scrapeGoogleMaps(
  niche: string,
  city: string,
  maxResults = 60
): Promise<ScrapedProspect[]> {
  const browser = await chromium.launch({
  headless: true,
  args: ["--disable-dev-shm-usage", "--no-sandbox"],
});
  const context = await browser.newContext({
    locale: "fr-FR",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  });
  const page = await context.newPage();

  const results: ScrapedProspect[] = [];

  try {
    const query = encodeURIComponent(`${niche} à ${city}`);
    await page.goto(`https://www.google.com/maps/search/${query}`, {
      waitUntil: "domcontentloaded",
    });
    await sleep(jitter(2000));

    await scrollResultsFeed(page, maxResults);

    const cards = page.locator('div[role="feed"] div[role="article"]');
    const count = Math.min(await cards.count(), maxResults);

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const name = (await card.getAttribute("aria-label")) ?? `Résultat ${i + 1}`;

      await card.click();
      await sleep(jitter(1500)); // laisser le panneau détail se charger

      const details = await extractFromDetailPane(page);
      const mapsUrl = page.url();

      results.push({
        name,
        category: details.category ?? null,
        address: details.address ?? null,
        phone: details.phone ?? null,
        website: details.website ?? null,
        mapsUrl,
        rating: details.rating ?? null,
        reviewCount: details.reviewCount ?? null,
        raw: { ...details },
      });
    }
  } finally {
    await browser.close();
  }

  return results;
}
