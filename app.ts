import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  LinkRecord,
  getLinks,
  saveLinks,
  findLinkBySlug,
  recordClick,
  storagePaths
} from './lib/storage.ts';

const app = express();

// Increase payload limit for base64 image uploads
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Social & search engine crawlers
const BOT_USER_AGENTS = [
  'twitterbot',
  'facebookexternalhit',
  'facebot',
  'linkedinbot',
  'slackbot',
  'telegrambot',
  'discordbot',
  'whatsapp',
  'skypeuripreview',
  'pinterest',
  'googlebot',
  'bingbot',
  'duckduckbot',
  'applebot',
  'yandexbot',
  'redditbot',
  'vkshare',
  'embedly',
  'quora link preview',
  'outbrain',
  'w3c_validator',
];

export function isCrawler(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some((bot) => ua.includes(bot));
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Normalize image URLs (e.g. imgur page -> direct image)
export function normalizeImageUrl(url: string): string {
  if (!url) return '';
  const clean = url.trim();

  // If user pasted imgur page link (e.g. https://imgur.com/abc1234)
  const imgurDirect = clean.match(/^https?:\/\/imgur\.com\/([a-zA-Z0-9]+)$/i);
  if (imgurDirect) {
    return `https://i.imgur.com/${imgurDirect[1]}.jpg`;
  }
  const imgurGallery = clean.match(/^https?:\/\/imgur\.com\/(?:a|gallery)\/([a-zA-Z0-9]+)$/i);
  if (imgurGallery) {
    return `https://i.imgur.com/${imgurGallery[1]}.jpg`;
  }
  return clean;
}

export function getBaseUrl(req: Request): string {
  // 1. Custom domain passed from client header
  const customDomain = req.get('x-custom-domain');
  if (customDomain) {
    return customDomain.replace(/\/$/, '');
  }
  // 2. Vercel deployment URL or custom APP_URL env
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // 3. Fallback to request host
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  return `${protocol}://${host}`;
}

// ==========================================
// LOCAL / TMP IMAGE PROXY
// ==========================================
app.get('/api/images/:filename', (req: Request, res: Response) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(storagePaths.imagesDir, filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Image not found' });
    return;
  }

  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(filePath);
});

// Image upload API - uploads to permanent public CDN so Twitterbot can scrape it from anywhere
app.post('/api/upload', async (req: Request, res: Response) => {
  try {
    const { imageBase64, filename } = req.body;
    if (!imageBase64) {
      res.status(400).json({ error: 'Missing image data' });
      return;
    }

    const matches = imageBase64.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    let ext = 'jpg';
    let mime = 'image/jpeg';
    let buffer: Buffer;

    if (matches && matches.length === 3) {
      mime = matches[1];
      if (mime.includes('png')) ext = 'png';
      else if (mime.includes('webp')) ext = 'webp';
      else if (mime.includes('gif')) ext = 'gif';
      else ext = 'jpg';
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(imageBase64, 'base64');
    }

    // Save locally as temporary backup
    const uniqueName = `img_${crypto.randomBytes(8).toString('hex')}.${ext}`;
    try {
      const filePath = path.join(storagePaths.imagesDir, uniqueName);
      fs.writeFileSync(filePath, buffer);
    } catch {
      // Ignored if serverless filesystem is restricted
    }

    // Upload to permanent public image host (Cloudflare CDN, never expires)
    let publicUrl = '';
    try {
      const formData = new FormData();
      const uint8 = new Uint8Array(buffer);
      const blob = new Blob([uint8], { type: mime });
      formData.append('key', '6d207e02198a847aa98d0a2a901485a5');
      formData.append('action', 'upload');
      formData.append('source', blob, `${filename || 'twitter_card'}.${ext}`);
      formData.append('format', 'json');

      const uploadRes = await fetch('https://freeimage.host/api/1/upload', {
        method: 'POST',
        body: formData,
      });

      if (uploadRes.ok) {
        const uploadJson = (await uploadRes.json()) as {
          status_code?: number;
          image?: { url: string };
        };
        if (uploadJson && uploadJson.status_code === 200 && uploadJson.image?.url) {
          publicUrl = uploadJson.image.url;
        }
      }
    } catch (uploadErr) {
      console.warn('Permanent host upload failed, using local URL:', uploadErr);
    }

    const finalImageUrl = publicUrl || `${getBaseUrl(req)}/api/images/${uniqueName}`;

    res.json({
      success: true,
      imageUrl: finalImageUrl,
      filename: uniqueName,
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: 'Failed to process image upload' });
  }
});

// ==========================================
// LINK MANAGEMENT REST APIS
// ==========================================

// Get all links
app.get('/api/links', async (req: Request, res: Response) => {
  const links = await getLinks();
  res.json({ links });
});

// Create a new shortened link
app.post('/api/links', async (req: Request, res: Response) => {
  try {
    const { destinationUrl, imageUrl, title, description, customSlug } = req.body;

    if (!destinationUrl) {
      res.status(400).json({ error: 'Destination Monetag URL is required' });
      return;
    }

    if (!imageUrl || !imageUrl.trim()) {
      res.status(400).json({ error: 'Twitter card preview image is required' });
      return;
    }

    // Validate URL format
    let validDestUrl = destinationUrl.trim();
    if (!/^https?:\/\//i.test(validDestUrl)) {
      validDestUrl = `https://${validDestUrl}`;
    }

    const cleanImageUrl = normalizeImageUrl(imageUrl);
    const links = await getLinks();

    // Determine slug
    let slug = '';
    if (customSlug && customSlug.trim()) {
      slug = customSlug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-');
      // Check collision
      if (links.some((l) => l.slug.toLowerCase() === slug.toLowerCase())) {
        res.status(409).json({ error: `The custom slug "${slug}" is already in use. Please choose another.` });
        return;
      }
    } else {
      slug = crypto.randomBytes(3).toString('hex');
      while (links.some((l) => l.slug === slug)) {
        slug = crypto.randomBytes(3).toString('hex');
      }
    }

    const newLink: LinkRecord = {
      id: crypto.randomUUID(),
      slug,
      destinationUrl: validDestUrl,
      imageUrl: cleanImageUrl,
      title: (title || 'Exclusive Media & Updates').trim(),
      description: (description || 'Click to view the full details and live media.').trim(),
      createdAt: new Date().toISOString(),
      clicks: 0,
      botHits: 0,
      recentClicks: [],
    };

    links.unshift(newLink);
    await saveLinks(links);

    const baseUrl = getBaseUrl(req);
    res.status(201).json({
      success: true,
      link: newLink,
      shortUrl: `${baseUrl}/s/${newLink.slug}`,
    });
  } catch (err) {
    console.error('Error creating link:', err);
    res.status(500).json({ error: 'Failed to create link' });
  }
});

// Update an existing link's image or details
app.patch('/api/links/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const links = await getLinks();
  const link = links.find((l) => l.slug.toLowerCase() === slug.toLowerCase());

  if (!link) {
    res.status(404).json({ error: 'Link not found' });
    return;
  }

  const { imageUrl, destinationUrl, title, description } = req.body;
  if (imageUrl !== undefined) {
    link.imageUrl = normalizeImageUrl(imageUrl);
  }
  if (destinationUrl !== undefined) {
    let dest = destinationUrl.trim();
    if (!/^https?:\/\//i.test(dest)) dest = `https://${dest}`;
    link.destinationUrl = dest;
  }
  if (title !== undefined) {
    link.title = title.trim();
  }
  if (description !== undefined) {
    link.description = description.trim();
  }

  await saveLinks(links);
  res.json({ success: true, link });
});

// Delete a link
app.delete('/api/links/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;
  let links = await getLinks();
  const initialLength = links.length;
  links = links.filter((l) => l.slug.toLowerCase() !== slug.toLowerCase());

  if (links.length === initialLength) {
    res.status(404).json({ error: 'Link not found' });
    return;
  }

  await saveLinks(links);
  res.json({ success: true });
});

// Inspect Twitterbot SSR output for previewing/debugging
app.get('/api/inspect-card/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const link = await findLinkBySlug(slug);
  if (!link) {
    res.status(404).json({ error: 'Link not found' });
    return;
  }

  const baseUrl = getBaseUrl(req);
  let absoluteImageUrl = normalizeImageUrl(link.imageUrl);
  if (absoluteImageUrl.startsWith('/')) {
    absoluteImageUrl = `${baseUrl}${absoluteImageUrl}`;
  }

  res.json({
    link,
    twitterCardData: {
      card: 'summary_large_image',
      title: link.title,
      description: link.description,
      image: absoluteImageUrl,
      canonicalUrl: `${baseUrl}/s/${link.slug}`,
      destinationUrl: link.destinationUrl,
    },
  });
});

// ==========================================
// SHORT LINK REDIRECT & TWITTERBOT DETECTION
// ==========================================
app.get('/s/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const link = await findLinkBySlug(slug);

  if (!link) {
    res.status(404).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Link Not Found</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: system-ui, sans-serif; background: #0b0f19; color: #fff; text-align: center; padding: 4rem 1rem; }
          a { color: #38bdf8; text-decoration: none; }
        </style>
      </head>
      <body>
        <h1>404 - Link Not Found</h1>
        <p>This shortened link does not exist or has expired.</p>
        <p><a href="/">Go to Home</a></p>
      </body>
      </html>
    `);
    return;
  }

  const userAgent = req.get('user-agent') || '';
  const referer = req.get('referer') || 'Direct';
  const forceBot = req.query.bot === '1' || req.query.preview === '1';
  const isBotDetected = forceBot || isCrawler(userAgent);

  const baseUrl = getBaseUrl(req);
  let absoluteImageUrl = normalizeImageUrl(link.imageUrl);
  if (absoluteImageUrl && absoluteImageUrl.startsWith('/')) {
    absoluteImageUrl = `${baseUrl}${absoluteImageUrl}`;
  }

  const canonicalUrl = `${baseUrl}/s/${link.slug}`;

  // Log visitor or bot
  const clickEntry = {
    timestamp: new Date().toISOString(),
    userAgent: userAgent.slice(0, 150),
    referer: referer.slice(0, 200),
    isBot: isBotDetected,
  };

  await recordClick(link.slug, clickEntry);

  if (isBotDetected) {
    // Serve rich pre-rendered Open Graph & Twitter Card HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(link.title)}</title>
  <meta name="description" content="${escapeHtml(link.description)}">
  
  <!-- Twitter Card Data -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@x">
  <meta name="twitter:title" content="${escapeHtml(link.title)}">
  <meta name="twitter:description" content="${escapeHtml(link.description)}">
  ${absoluteImageUrl ? `<meta name="twitter:image" content="${escapeHtml(absoluteImageUrl)}">` : ''}
  ${absoluteImageUrl ? `<meta name="twitter:image:src" content="${escapeHtml(absoluteImageUrl)}">` : ''}
  ${absoluteImageUrl ? `<meta name="twitter:image:alt" content="${escapeHtml(link.title)}">` : ''}
  
  <!-- Open Graph Data -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:title" content="${escapeHtml(link.title)}">
  <meta property="og:description" content="${escapeHtml(link.description)}">
  ${absoluteImageUrl ? `<meta property="og:image" content="${escapeHtml(absoluteImageUrl)}">` : ''}
  ${absoluteImageUrl ? `<meta property="og:image:secure_url" content="${escapeHtml(absoluteImageUrl)}">` : ''}
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  
  <!-- Crawler directives -->
  <meta name="robots" content="index, follow">
</head>
<body style="font-family: system-ui, sans-serif; background: #000; color: #fff; padding: 2rem;">
  <h1>${escapeHtml(link.title)}</h1>
  <p>${escapeHtml(link.description)}</p>
  ${absoluteImageUrl ? `<img src="${escapeHtml(absoluteImageUrl)}" alt="${escapeHtml(link.title)}" style="max-width: 100%; border-radius: 8px;">` : ''}
  <p>Loading destination: <a href="${escapeHtml(link.destinationUrl)}" style="color: #1d9bf0;">${escapeHtml(link.destinationUrl)}</a></p>
</body>
</html>`);
    return;
  }

  // HUMAN VISITOR:
  // Instant direct 302 redirect with fallback HTML
  res.writeHead(302, {
    Location: link.destinationUrl,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  });
  res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0;url=${escapeHtml(link.destinationUrl)}">
  <script>window.location.replace(${JSON.stringify(link.destinationUrl)});</script>
</head>
<body style="font-family: sans-serif; background: #000; color: #fff; text-align: center; padding-top: 20%;">
  <p>Redirecting to <a href="${escapeHtml(link.destinationUrl)}" style="color: #38bdf8;">destination</a>...</p>
</body>
</html>`);
});

export default app;
