import fs from 'fs';
import path from 'path';
import os from 'os';

export interface ClickEntry {
  timestamp: string;
  userAgent: string;
  referer: string;
  isBot: boolean;
}

export interface LinkRecord {
  id: string;
  slug: string;
  destinationUrl: string;
  imageUrl: string;
  title: string;
  description: string;
  createdAt: string;
  clicks: number;
  botHits: number;
  lastClickedAt?: string;
  recentClicks: ClickEntry[];
}

// Default initial links to bootstrap fresh deployments
const INITIAL_DEFAULT_LINKS: LinkRecord[] = [
  {
    id: 'b2bb0afc-d4b2-497c-ad51-674314c00cc1',
    slug: 'diy-videos',
    destinationUrl: 'https://omg10.com/4/11800191',
    imageUrl: 'https://iili.io/n7IHDGI.jpg',
    title: 'mydiyvideos',
    description: 'Click to view the full details and live media.',
    createdAt: new Date().toISOString(),
    clicks: 0,
    botHits: 0,
    recentClicks: []
  }
];

// Determine data directory (safe for local & Vercel serverless /tmp)
function getStoragePaths() {
  const localDataDir = path.join(process.cwd(), 'data');
  const tmpDataDir = path.join(os.tmpdir(), 'tweetlink-data');

  let chosenDir = localDataDir;
  let isReadOnlyFs = false;

  try {
    if (!fs.existsSync(localDataDir)) {
      fs.mkdirSync(localDataDir, { recursive: true });
    }
  } catch {
    isReadOnlyFs = true;
    chosenDir = tmpDataDir;
    try {
      if (!fs.existsSync(tmpDataDir)) {
        fs.mkdirSync(tmpDataDir, { recursive: true });
      }
    } catch {
      // Ignore tmpdir error
    }
  }

  const linksFile = isReadOnlyFs
    ? path.join(tmpDataDir, 'links.json')
    : path.join(localDataDir, 'links.json');
  
  const imagesDir = isReadOnlyFs
    ? path.join(tmpDataDir, 'images')
    : path.join(localDataDir, 'images');

  try {
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
  } catch {
    // Ignore error
  }

  return { dataDir: chosenDir, linksFile, imagesDir, isReadOnlyFs };
}

export const storagePaths = getStoragePaths();

// In-memory cache
let inMemoryLinks: LinkRecord[] = [];
let isInitialized = false;

function getKvConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return { url: url?.replace(/\/$/, ''), token };
}

/**
 * Fetch links from Upstash/Vercel KV or Local File / In-memory
 */
export async function getLinks(): Promise<LinkRecord[]> {
  const { url, token } = getKvConfig();

  // If KV is configured, fetch from cloud KV store
  if (url && token) {
    try {
      const res = await fetch(`${url}/get/tweetlink_links`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = (await res.json()) as { result?: string | LinkRecord[] };
        if (data && data.result) {
          if (typeof data.result === 'string') {
            const parsed = JSON.parse(data.result);
            if (Array.isArray(parsed)) {
              inMemoryLinks = parsed;
              return inMemoryLinks;
            }
          } else if (Array.isArray(data.result)) {
            inMemoryLinks = data.result;
            return inMemoryLinks;
          }
        }
      }
    } catch (kvErr) {
      console.warn('KV fetch failed, falling back to local/cache:', kvErr);
    }
  }

  // If not initialized yet, try reading from disk
  if (!isInitialized) {
    try {
      const { linksFile } = storagePaths;
      const primaryLinksFile = path.join(process.cwd(), 'data', 'links.json');

      if (fs.existsSync(primaryLinksFile)) {
        const content = fs.readFileSync(primaryLinksFile, 'utf-8');
        inMemoryLinks = JSON.parse(content);
      } else if (fs.existsSync(linksFile)) {
        const content = fs.readFileSync(linksFile, 'utf-8');
        inMemoryLinks = JSON.parse(content);
      } else {
        inMemoryLinks = [...INITIAL_DEFAULT_LINKS];
        await saveLinks(inMemoryLinks);
      }
    } catch {
      if (inMemoryLinks.length === 0) {
        inMemoryLinks = [...INITIAL_DEFAULT_LINKS];
      }
    }
    isInitialized = true;
  }

  return inMemoryLinks;
}

/**
 * Persist links to Upstash/Vercel KV and/or Local File
 */
export async function saveLinks(links: LinkRecord[]): Promise<boolean> {
  inMemoryLinks = links;
  isInitialized = true;

  let savedSuccessfully = false;
  const { url, token } = getKvConfig();

  // 1. Save to KV if configured
  if (url && token) {
    try {
      const res = await fetch(`${url}/set/tweetlink_links`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(JSON.stringify(links))
      });
      if (res.ok) {
        savedSuccessfully = true;
      }
    } catch (kvErr) {
      console.warn('Failed to save to KV:', kvErr);
    }
  }

  // 2. Save to disk as local fallback
  try {
    const { linksFile } = storagePaths;
    const dir = path.dirname(linksFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(linksFile, JSON.stringify(links, null, 2), 'utf-8');
    savedSuccessfully = true;
  } catch (fsErr) {
    // If local dir is read-only, try writing to /tmp
    try {
      const tmpFile = path.join(os.tmpdir(), 'tweetlink_links.json');
      fs.writeFileSync(tmpFile, JSON.stringify(links, null, 2), 'utf-8');
      savedSuccessfully = true;
    } catch {
      // In-memory array is updated anyway
    }
  }

  return savedSuccessfully;
}

/**
 * Find single link by slug
 */
export async function findLinkBySlug(slug: string): Promise<LinkRecord | undefined> {
  const allLinks = await getLinks();
  return allLinks.find((l) => l.slug.toLowerCase() === slug.toLowerCase());
}

/**
 * Record a click or bot hit
 */
export async function recordClick(
  slug: string,
  entry: ClickEntry
): Promise<LinkRecord | undefined> {
  const allLinks = await getLinks();
  const link = allLinks.find((l) => l.slug.toLowerCase() === slug.toLowerCase());
  if (!link) return undefined;

  if (entry.isBot) {
    link.botHits = (link.botHits || 0) + 1;
  } else {
    link.clicks = (link.clicks || 0) + 1;
    link.lastClickedAt = entry.timestamp;
  }

  link.recentClicks = [entry, ...(link.recentClicks || [])].slice(0, 30);
  await saveLinks(allLinks);
  return link;
}
