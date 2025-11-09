import express from "express";
import puppeteer from "puppeteer";

const app = express();
app.use(express.json());

app.post("/scrape", async (req, res) => {
  const { url, secret } = req.body;
  if (secret !== process.env.PUPPETEER_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath:
        "./node_modules/.cache/puppeteer/chrome/linux-127.0.6533.88/chrome-linux64/chrome",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--no-zygote",
        "--single-process"
      ]
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36"
    );
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
    await page.waitForFunction(() => document.title && document.title.trim().length > 0, {
      timeout: 20000
    });

    const data = await page.evaluate(() => {
      const getMeta = (name) =>
        document.querySelector(`meta[name='${name}']`)?.content ||
        document.querySelector(`meta[property='${name}']`)?.content ||
        document.querySelector(`meta[name='twitter:${name}']`)?.content ||
        document.querySelector(`meta[itemprop='${name}']`)?.content ||
        "";

      // === 🆕 Clean content extraction ===
      const unwanted = document.querySelectorAll(
        "script, style, nav, header, footer, iframe, noscript"
      );
      unwanted.forEach((el) => el.remove());

      const main =
        document.querySelector("main, article, [role='main'], .content, .main-content") ||
        document.body;

      let text = main.innerText || main.textContent || "";
      text = text.replace(/\s+/g, " ").trim();
      const content = text.substring(0, 5000);
      // ================================

      return {
        title: document.title.trim(),
        description:
          getMeta("description") ||
          getMeta("og:description") ||
          getMeta("twitter:description") ||
          document.querySelector("p")?.innerText?.slice(0, 160) ||
          "",
        content // 🆕 include page content
      };
    });

    await browser.close();
    res.json(data);
  } catch (err) {
    console.error("Scrape error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => res.send("✅ Puppeteer Service Running"));
app.listen(3000, () => console.log("Server running on port 3000"));

// === NEW eBay endpoint ===
app.post("/ebay", async (req, res) => {
  const { url, secret } = req.body;
  if (secret !== process.env.PUPPETEER_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: "./node_modules/.cache/puppeteer/chrome/linux-127.0.6533.88/chrome-linux64/chrome",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--no-zygote",
        "--single-process"
      ]
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36"
    );
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });

const data = await page.evaluate(() => {
  const getMeta = (name) =>
    document.querySelector(`meta[name='${name}']`)?.content ||
    document.querySelector(`meta[property='${name}']`)?.content ||
    document.querySelector(`meta[name='twitter:${name}']`)?.content ||
    "";

  // SOLD DATE – very specific to eBay sold pages
  const soldOnEl = document.querySelector(
    ".ux-layout-section__textual-display--statusMessage span.ux-textspans--BOLD"
  );
  const soldOn = soldOnEl?.innerText?.trim() || "";

  // PRICE – condensed card or price element
  const priceEl =
    document.querySelector(".x-item-condensed-card__price .ux-textspans--BOLD") ||
    document.querySelector(".x-price .ux-textspans--BOLD") ||
    document.querySelector(".x-price-approx__price") ||
    document.querySelector(".notranslate");
  const price = priceEl?.innerText?.trim() || "";

  return {
    title: document.title.trim(),
    description:
      getMeta("description") ||
      getMeta("og:description") ||
      document.querySelector("p")?.innerText?.slice(0, 160) ||
      "",
    soldOn,
    price
  };
});




    await browser.close();
    res.json(data);
  } catch (err) {
    console.error("eBay scrape error:", err.message);
    res.status(500).json({ error: err.message });
  }
});




