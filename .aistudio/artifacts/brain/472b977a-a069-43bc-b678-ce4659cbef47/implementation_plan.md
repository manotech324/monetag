# Implementation Plan - Twitter Card Monetag Link Shortener

Build a dedicated, high-converting link shortener tailored for Twitter/X campaigns. When a short link is posted on Twitter, Twitter's crawler (`Twitterbot`) automatically detects and displays the custom image in high-resolution (`summary_large_image`), along with custom title and description. When real users click the link, they are instantly routed to your Monetag destination URL.

---

## 1. Architecture & Core Workflow

### A. Full-Stack Express Server (`server.ts` + `vite.middlewares`)
- **Express Backend with Vite Integration**: Serves the React SPA in development & production on port 3000.
- **Short URL Bot Detection & Redirection Route (`GET /s/:slug`)**:
  - Inspects `User-Agent` headers for social crawlers:
    `Twitterbot`, `facebookexternalhit`, `TelegramBot`, `Discordbot`, `Slackbot`, `WhatsApp`, `LinkedInBot`, `Googlebot`, etc.
  - **If Social Crawler / Twitterbot**: Returns clean, pre-rendered HTML with `<meta name="twitter:card" content="summary_large_image">`, `<meta name="twitter:image" content="...">`, `<meta name="twitter:title" ...>`, `<meta property="og:image" ...>`, ensuring Twitter immediately renders the card preview without redirects failing or blocking.
  - **If Human Visitor**: Performs an instant HTTP 302 redirect directly to the Monetag URL (with an HTML fallback containing `<meta http-equiv="refresh">` and a click button for edge cases). Increments click counter and logs visitor metrics (timestamp, referrer, device).
- **Image Upload & Serving Route (`/api/upload` & `/api/images/:id`)**:
  - Allows pasting any external image URL or uploading an image file directly (stored in server memory/persisted store and served directly so Twitter can reliably crawl even if external CDNs block hotlinking).
- **Link Management API (`/api/links`)**:
  - `POST /api/links`: Create a short link with custom slug or auto-generated code, Monetag URL, image, title, description, and redirect mode.
  - `GET /api/links`: List all links with click statistics and created dates.
  - `DELETE /api/links/:slug`: Remove links.
  - `GET /api/links/:slug/stats`: View click counts, recent referral logs, and bot crawl count.

---

## 2. Frontend User Interface & Features

### A. Link Creation Studio
- **Input Fields**:
  - **Monetag URL**: Destination link (validates URL protocol and provides quick presets).
  - **Preview Image**: Enter direct image URL or drag & drop / upload a local image file.
  - **Card Title & Description**: Customize the headline and teaser displayed on Twitter.
  - **Custom Slug (optional)**: e.g. `/s/trending-video` or automatic short code (e.g. `/s/x9k2p`).
  - **Redirect Mode**: Instant direct 302 redirect, or optional 2-second engagement bridge page.

### B. Interactive Twitter/X Feed Simulator
- Real-time side-by-side preview showing **exactly** how the tweet and card will look in Twitter's feed (dark & light mode):
  - Shows avatar, handle, tweet caption, full-bleed card image (`summary_large_image`), domain watermark, and card title.
- One-click "Copy Short Link" with visual toast feedback.
- Direct "Test on Twitter" and "X Card Validator / Inspector" helpers.

### C. Link Management Dashboard & Analytics
- Table/Grid of created links with thumbnail preview, Monetag target, total clicks, crawler hits, and status.
- One-click copy, QR code generator for cross-channel testing, and delete.
- Quick test button to verify the exact HTML Twitterbot receives.

---

## 3. Implementation Steps

1. **Server Setup (`server.ts`)**:
   - Implement Express server with dynamic SSR metadata endpoint `/s/:slug`.
   - Add bot crawler detection logic.
   - Add REST API for link creation, image handling, and analytics.
   - Configure `"dev": "tsx server.ts"` and `"start": "node server.ts"`.
2. **Metadata & Entry Point Configuration**:
   - Update `metadata.json` and `index.html` with title "TweetLink - Monetag Twitter Card Shortener".
3. **Frontend Application (`src/App.tsx` & components)**:
   - Modern Tailwind UI with dark/light styling matching Twitter/X aesthetics.
   - Form inputs with live image preview & upload support.
   - Live Twitter card simulator component.
   - Link history dashboard with click tracking.
4. **Verification & Testing**:
   - Test short link generation and API responses.
   - Test bot user-agent vs regular browser user-agent behavior via curl / automated tests.
   - Verify build compilation (`compile_applet`).
