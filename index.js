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
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    "/opt/render/.cache/puppeteer/chrome/linux-127.0.6533.88/chrome-linux64/chrome",
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

    const data = await page.evaluate(() => ({
      title: document.title,
      description:
        document.querySelector("meta[name='description']")?.content ||
        document.querySelector("meta[property='og:description']")?.content || ""
    }));

    await browser.close();
    res.json(data);
  } catch (err) {
    console.error("Scrape error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => res.send("✅ Puppeteer Service Running"));
app.listen(3000, () => console.log("Server running on port 3000"));


