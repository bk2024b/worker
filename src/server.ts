import express from "express";
import { scrapeGoogleMaps } from "./scraper.js";
import { supabase } from "./supabase.js";
import { scoreProspect } from "./scoring.js";

const app = express();
app.use(express.json());

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.WORKER_SECRET}`) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

app.post("/scrape", requireAuth, async (req, res) => {
  const { searchId, niche, city, userId } = req.body ?? {};

  if (!searchId || !niche || !city || !userId) {
    return res.status(400).json({ error: "searchId, niche, city, userId requis" });
  }

  // On répond tout de suite : le scraping tourne en tâche de fond, l'app
  // Next.js interroge Supabase pour connaître l'avancement (status).
  res.status(202).json({ accepted: true });

  try {
    await supabase.from("searches").update({ status: "running" }).eq("id", searchId);

    const prospects = await scrapeGoogleMaps(niche, city);

    for (const p of prospects) {
      const { data: inserted, error } = await supabase
        .from("prospects")
        .insert({
          search_id: searchId,
          user_id: userId,
          name: p.name,
          category: p.category,
          address: p.address,
          phone: p.phone,
          website: p.website,
          maps_url: p.mapsUrl,
          rating: p.rating,
          review_count: p.reviewCount,
          raw: p.raw,
        })
        .select()
        .single();

      if (error || !inserted) continue;

      // Scoring immédiat à partir des seuls signaux du scraping — l'audit
      // Lighthouse (étape suivante) viendra affiner ce score plus tard.
      const score = scoreProspect({
        reviewCount: p.reviewCount,
        rating: p.rating,
        hasWebsite: Boolean(p.website),
        hasHttps: p.website ? p.website.startsWith("https://") : null,
        isResponsive: null,
        loadTimeMs: null,
        hasSeoTitle: null,
        hasMetaDescription: null,
        lastSocialPostDaysAgo: null,
      });

      await supabase.from("scores").insert({
        prospect_id: inserted.id,
        total: score.total,
        reasons: score.reasons,
      });
    }

    await supabase
      .from("searches")
      .update({ status: "done", result_count: prospects.length })
      .eq("id", searchId);
  } catch (err) {
    console.error("Scrape job failed", err);
    await supabase.from("searches").update({ status: "failed" }).eq("id", searchId);
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

const port = process.env.PORT ?? 3001;
app.listen(port, () => console.log(`ProspectIQ worker listening on ${port}`));
