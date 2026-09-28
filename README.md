# TweetLink - Monetag Twitter Card Shortener

Shorten Monetag links with auto-detecting Twitter/X image preview cards, custom titles, bot scraper handling, and real-time click tracking.

---

## ⚡ Deploying to Vercel

The project is fully configured for **Vercel** with Serverless Functions and global CDN caching.

### Option 1: Deploy via Vercel Web Dashboard (Recommended)

1. **Push your code to GitHub / GitLab / Bitbucket**.
2. Go to [Vercel Dashboard](https://vercel.com/new).
3. Import your repository.
4. Framework Preset: **Vite** (detected automatically).
5. (Optional) In **Environment Variables**, add:
   - `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL` & `KV_REST_API_TOKEN`) if you want persistent database storage across serverless instances.
   - `APP_URL`: Your custom domain (e.g., `https://yourdomain.com`).
6. Click **Deploy**.

---

### Option 2: Deploy via Vercel CLI

```bash
# 1. Install Vercel CLI (if not already installed)
npm i -g vercel

# 2. Deploy to preview
vercel

# 3. Deploy to production
vercel --prod
```

---

## 🗄️ Persistent Database Storage (Free Upstash / Vercel KV)

On Vercel serverless functions, the file system is ephemeral. TweetLink works out-of-the-box with in-memory + `/tmp` caching, but for **100% persistent storage across all regions**:

1. Create a free database at [Upstash](https://upstash.com) (or Vercel KV Marketplace).
2. Copy the **REST URL** and **REST Token**.
3. Add these two Environment Variables in your Vercel Project Settings:
   - `UPSTASH_REDIS_REST_URL` = `https://...`
   - `UPSTASH_REDIS_REST_TOKEN` = `...`

---

## 💻 Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run local server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.
