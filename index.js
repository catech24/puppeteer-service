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
// === NEW Generic JS-rendered HTML endpoint ===
app.post("/render-html", async (req, res) => {
  const { url, secret, waitForSelector = "body", waitForTimeout = 5000 } = req.body;

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

    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout: 15000 });
    }

    if (waitForTimeout) {
      await page.waitForTimeout(waitForTimeout);
    }

    // Return the rendered HTML OR extracted links
    const html = await page.content();

    // Extract product URLs automatically
    const productLinks = await page.$$eval("a[href*='/product/']", (as) =>
      as.map((a) => a.href)
    );

    await browser.close();

    res.json({
      ok: true,
      url,
      productLinks,
      htmlLength: html.length,
      html
    });
  } catch (err) {
    console.error("render-html error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

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

  const soldOnEl = document.querySelector(
    ".ux-layout-section__textual-display--statusMessage span.ux-textspans--BOLD"
  );
  const rawSoldOn = soldOnEl?.innerText?.trim() || "";

  const priceEl =
    document.querySelector(".x-item-condensed-card__price .ux-textspans--BOLD") ||
    document.querySelector(".x-price .ux-textspans--BOLD") ||
    document.querySelector(".x-price-approx__price") ||
    document.querySelector(".notranslate");
  const rawPrice = priceEl?.innerText?.trim() || "";

  // --- Normalize fields ---
  // price → numeric string
  const priceMatch = rawPrice.match(/[\d,.]+/g);
  const priceValue = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, "")) : null;

  // sold date → ISO (e.g. 2025-10-01)
  const dateMatch = rawSoldOn.match(
    /(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+([A-Za-z]+)\s+(\d{1,2})/i
  );
  let soldDateISO = "";
  if (dateMatch) {
    const monthMap = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };
    const now = new Date();
    const m = monthMap[dateMatch[2].substring(0, 3)];
    const d = parseInt(dateMatch[3]);
    const y = now.getFullYear(); // eBay rarely shows year, assume current
    const iso = new Date(y, m, d);
    soldDateISO = iso.toISOString().split("T")[0];
  }

  return {
    title: document.title.trim(),
    description:
      getMeta("description") ||
      getMeta("og:description") ||
      document.querySelector("p")?.innerText?.slice(0, 160) ||
      "",
    soldOnRaw: rawSoldOn,
    soldOnISO: soldDateISO,
    priceRaw: rawPrice,
    priceValue
  };
});





    await browser.close();
    res.json(data);
  } catch (err) {
    console.error("eBay scrape error:", err.message);
    res.status(500).json({ error: err.message });
  }
});






