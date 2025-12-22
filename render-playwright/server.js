import express from 'express';
import { chromium, devices } from 'playwright-chromium';

const app = express();
app.use(express.json({ limit: '1mb' }));

const AUTH = process.env.RENDER_AUTH_TOKEN || '';

app.post('/render', async (req, res) => {
  try {
    if (AUTH && req.headers['x-render-auth'] !== AUTH) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const { url, mobile = true } = req.body || {};
    if (!url) return res.status(400).json({ error: 'missing url' });

    console.log('[render] request', { url, mobile });

    const browser = await chromium.launch({ args: ['--no-sandbox'], headless: true });
    const context = await browser.newContext(mobile ? devices['iPhone 12'] : {});
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    const html = await page.content();
    const title = await page.title();
    const screenshot = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 60 });
    await browser.close();

    res.json({
      title,
      html,
      screenshotBase64: Buffer.from(screenshot).toString('base64'),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'render_failed' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Render proxy listening on ${port}`);
});
