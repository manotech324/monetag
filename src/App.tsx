import React, { useState, useEffect, useRef } from 'react';
import {
  Link2,
  Copy,
  Check,
  ExternalLink,
  Image as ImageIcon,
  Upload,
  Trash2,
  Eye,
  BarChart3,
  Bot,
  Share2,
  HelpCircle,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Globe,
  Edit2,
  Download,
  Code,
  CheckCircle2,
  Info,
  X
} from 'lucide-react';

interface LinkRecord {
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
  recentClicks?: Array<{
    timestamp: string;
    userAgent: string;
    referer: string;
    isBot: boolean;
  }>;
}

interface InspectData {
  link: LinkRecord;
  twitterCardData: {
    card: string;
    title: string;
    description: string;
    image: string;
    canonicalUrl: string;
    destinationUrl: string;
  };
}

export default function App() {
  const [links, setLinks] = useState<LinkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successLink, setSuccessLink] = useState<{ shortUrl: string; slug: string; imageUrl: string } | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [copiedHtmlSlug, setCopiedHtmlSlug] = useState<string | null>(null);

  // Form input state
  const [destinationUrl, setDestinationUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [customSlug, setCustomSlug] = useState('');

  // Public shared domain
  const publicSharedOrigin = 'https://ais-pre-23jeda7ltowriuhfwtpogt-409802964747.asia-southeast1.run.app';

  // Domain selection mode: 'shared' | 'current' | 'custom'
  const [domainMode, setDomainMode] = useState<'shared' | 'current' | 'custom'>(() => {
    return (localStorage.getItem('domain_mode') as 'shared' | 'current' | 'custom') || 'shared';
  });

  const [customBaseDomain, setCustomBaseDomain] = useState<string>(() => {
    return localStorage.getItem('custom_base_domain') || '';
  });
  const [showDomainSettings, setShowDomainSettings] = useState(false);

  // Determine current active origin
  const getActiveOrigin = () => {
    if (domainMode === 'shared') return publicSharedOrigin;
    if (domainMode === 'custom' && customBaseDomain) return customBaseDomain;
    return typeof window !== 'undefined' ? window.location.origin : '';
  };

  // Image mode: 'url' or 'upload'
  const [imageMode, setImageMode] = useState<'url' | 'upload'>('url');
  const [imageLoadedSuccess, setImageLoadedSuccess] = useState<boolean | null>(null);

  // Simulator Tweet text
  const [tweetText, setTweetText] = useState('Check this out! 👇');

  // Modal inspection state
  const [inspectModalLink, setInspectModalLink] = useState<InspectData | null>(null);
  const [showHtmlModal, setShowHtmlModal] = useState<LinkRecord | null>(null);

  // Edit Link Modal
  const [editingLink, setEditingLink] = useState<LinkRecord | null>(null);
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch links from backend
  const fetchLinks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/links');
      const data = await res.json();
      if (data.links) {
        setLinks(data.links);
      }
    } catch (err) {
      console.error('Failed to load links:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const saveCustomDomain = (val: string) => {
    const trimmed = val.trim().replace(/\/$/, '');
    setCustomBaseDomain(trimmed);
    localStorage.setItem('custom_base_domain', trimmed);
  };

  // Helper to normalize Imgur & common URLs
  const formatInputImageUrl = (raw: string) => {
    let clean = raw.trim();
    const imgurMatch = clean.match(/^https?:\/\/imgur\.com\/([a-zA-Z0-9]+)$/i);
    if (imgurMatch) {
      return `https://i.imgur.com/${imgurMatch[1]}.jpg`;
    }
    const imgurGalleryMatch = clean.match(/^https?:\/\/imgur\.com\/(?:a|gallery)\/([a-zA-Z0-9]+)$/i);
    if (imgurGalleryMatch) {
      return `https://i.imgur.com/${imgurGalleryMatch[1]}.jpg`;
    }
    return clean;
  };

  const handleImageUrlChange = (val: string) => {
    const formatted = formatInputImageUrl(val);
    setImageUrl(formatted);
    setImageLoadedSuccess(null);
  };

  // Local File Upload with public direct CDN
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEditing = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG, WEBP, GIF).');
      return;
    }

    setError(null);
    setUploadingImage(true);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64Data,
            filename: file.name
          })
        });

        const data = await res.json();
        if (data.success && data.imageUrl) {
          if (isEditing) {
            setEditImageUrl(data.imageUrl);
          } else {
            setImageUrl(data.imageUrl);
            setImageLoadedSuccess(true);
            if (!title) {
              setTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
            }
          }
        } else {
          setError(data.error || 'Failed to upload image.');
        }
      } catch (err) {
        console.error('Upload failed:', err);
        setError('Network error while processing image upload.');
      } finally {
        setUploadingImage(false);
      }
    };
    reader.onerror = () => {
      setError('Could not read image file.');
      setUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  // Create Short Link
  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destinationUrl.trim()) {
      setError('Please provide your Monetag destination URL.');
      return;
    }

    if (!imageUrl.trim()) {
      setError('Please provide your preview image URL or upload an image file.');
      return;
    }

    setError(null);
    setCreating(true);

    try {
      const finalImage = formatInputImageUrl(imageUrl);
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(customBaseDomain ? { 'x-custom-domain': customBaseDomain } : {})
        },
        body: JSON.stringify({
          destinationUrl: destinationUrl.trim(),
          imageUrl: finalImage,
          title: title.trim() || 'Exclusive Media & Updates',
          description: description.trim() || 'Click to view the full details and live media.',
          customSlug: customSlug.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const effectiveBase = customBaseDomain || (typeof window !== 'undefined' ? window.location.origin : '');
        setSuccessLink({
          shortUrl: `${effectiveBase}/s/${data.link.slug}`,
          slug: data.link.slug,
          imageUrl: data.link.imageUrl
        });
        setDestinationUrl('');
        setImageUrl('');
        setTitle('');
        setDescription('');
        setCustomSlug('');
        setImageLoadedSuccess(null);
        fetchLinks();
      } else {
        setError(data.error || 'Failed to create short link.');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to connect to server.');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = (text: string, slugKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSlug(slugKey);
    setTimeout(() => {
      setCopiedSlug(null);
    }, 2500);
  };

  const handleDelete = async (slug: string) => {
    if (!confirm(`Delete short link /s/${slug}?`)) return;
    try {
      const res = await fetch(`/api/links/${slug}`, { method: 'DELETE' });
      if (res.ok) {
        setLinks((prev) => prev.filter((l) => l.slug !== slug));
        if (successLink?.slug === slug) setSuccessLink(null);
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingLink) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/links/${editingLink.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: formatInputImageUrl(editImageUrl),
          title: editTitle,
          description: editDesc,
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEditingLink(null);
        fetchLinks();
      } else {
        alert(data.error || 'Failed to update link');
      }
    } catch (err) {
      console.error(err);
      alert('Network error updating link');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleInspect = async (slug: string) => {
    try {
      const res = await fetch(`/api/inspect-card/${slug}`);
      const data = await res.json();
      if (data.twitterCardData) {
        setInspectModalLink(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Generate Standalone HTML Card file content
  const generateStandaloneHtml = (link: LinkRecord) => {
    const rawImage = formatInputImageUrl(link.imageUrl);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${link.title.replace(/"/g, '&quot;')}</title>
  <meta name="description" content="${link.description.replace(/"/g, '&quot;')}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@x">
  <meta name="twitter:title" content="${link.title.replace(/"/g, '&quot;')}">
  <meta name="twitter:description" content="${link.description.replace(/"/g, '&quot;')}">
  <meta name="twitter:image" content="${rawImage}">
  <meta name="twitter:image:src" content="${rawImage}">

  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${link.title.replace(/"/g, '&quot;')}">
  <meta property="og:description" content="${link.description.replace(/"/g, '&quot;')}">
  <meta property="og:image" content="${rawImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Instant Monetag Redirect for Visitors -->
  <meta http-equiv="refresh" content="0;url=${link.destinationUrl}">
  <script>
    window.location.replace(${JSON.stringify(link.destinationUrl)});
  </script>
</head>
<body style="font-family: system-ui, sans-serif; background: #000; color: #fff; text-align: center; padding-top: 15%;">
  <h2>Redirecting to destination...</h2>
  <p><a href="${link.destinationUrl}" style="color: #38bdf8;">Click here if not redirected automatically</a></p>
</body>
</html>`;
  };

  // Download standalone HTML file
  const downloadHtmlFile = (link: LinkRecord) => {
    const content = generateStandaloneHtml(link);
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${link.slug}-twitter-card.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const currentOrigin = getActiveOrigin();
  const activeShortUrl = successLink?.shortUrl || `${currentOrigin}/s/${customSlug || 'xyz123'}`;

  // Check if current URL is internal ais-dev
  const isAiStudioDevUrl = typeof window !== 'undefined' && window.location.hostname.includes('ais-dev');

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-[#0b0e17]/90 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Link2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white tracking-tight">TweetLink</span>
                <span className="text-xs text-sky-400 font-mono tracking-wider font-semibold">CUSTOM IMAGE ENGINE</span>
              </div>
              <p className="text-xs text-slate-400">Strictly uses your image for Twitter/X cards + Direct Monetag redirect</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            {/* Quick Domain Selector */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
              <button
                type="button"
                onClick={() => {
                  setDomainMode('shared');
                  localStorage.setItem('domain_mode', 'shared');
                }}
                className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                  domainMode === 'shared' ? 'bg-sky-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}
                title="Use public shared URL (ais-pre) with zero Google login requirement"
              >
                Public Domain (ais-pre)
              </button>
              <button
                type="button"
                onClick={() => {
                  setDomainMode('custom');
                  localStorage.setItem('domain_mode', 'custom');
                  setShowDomainSettings(true);
                }}
                className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                  domainMode === 'custom' ? 'bg-sky-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}
                title="Use custom domain (e.g. your-domain.com)"
              >
                Custom Domain
              </button>
            </div>

            <a
              href="#dashboard"
              className="text-slate-300 hover:text-white transition-colors flex items-center gap-1 font-medium"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Links ({links.length})</span>
            </a>
          </div>
        </div>
      </header>

      {/* Domain Settings Bar */}
      {showDomainSettings && (
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-sky-400" />
                Public Base Domain for Short Links
              </span>
              <p className="text-slate-400">
                Set your public custom domain, Cloudflare worker, or published URL (e.g. <code className="text-sky-300 font-mono">https://yourdomain.com</code>)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="url"
                placeholder="https://your-public-domain.com"
                value={customBaseDomain}
                onChange={(e) => saveCustomDomain(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 font-mono w-64 focus:outline-none focus:border-sky-500"
              />
              {customBaseDomain && (
                <button
                  onClick={() => saveCustomDomain('')}
                  className="text-xs text-slate-400 hover:text-rose-400 px-2 py-1"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* CRITICAL NOTICE: Explaining the exact screenshot (Google banner) */}
        <div className="rounded-2xl border border-sky-500/40 bg-sky-950/20 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div className="space-y-2 text-xs text-slate-200">
              <div className="font-bold text-sm text-sky-300">
                Why Facebook & Twitter Showed the Green/Yellow Google Wave Banner:
              </div>
              <p className="leading-relaxed">
                The green, blue, and yellow wave image you saw on Facebook is the <strong className="text-white">Google AI Studio login screen banner</strong>. Because the link you pasted started with <code className="text-amber-200 font-mono font-semibold bg-amber-950/80 px-1 py-0.5 rounded">ais-dev-*.run.app</code>, Facebook's crawler was blocked by Google's developer login and scraped Google's sign-in graphic instead of your image.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Option 1: Click "Share" in AI Studio (Top-Right)
                  </span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Click the <strong className="text-white">Share</strong> button in the top-right toolbar of Google AI Studio. This activates your public shared URL (<code className="text-sky-300 font-mono">ais-pre-*</code>) which has NO Google login requirement, allowing Facebook & Twitter to read your image directly!
                  </p>
                </div>

                <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                  <span className="font-bold text-indigo-400 flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-indigo-400" />
                    Option 2: 1-Click Free Hosting (Works 100% Anywhere)
                  </span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Click <strong className="text-white">Download .html</strong> on your link below and drop it onto free hosting like <a href="https://tiiny.host" target="_blank" rel="noreferrer" className="text-sky-400 underline font-semibold">tiiny.host</a> or <a href="https://app.netlify.com/drop" target="_blank" rel="noreferrer" className="text-sky-400 underline font-semibold">netlify drop</a>. It gives you a clean link that always displays your image on Facebook & Twitter!
                  </p>
                </div>
              </div>

              <div className="pt-1 flex items-center gap-3 text-[11px] text-slate-400">
                <span>Want to test any link?</span>
                <a
                  href="https://developers.facebook.com/tools/debug/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open Facebook Sharing Debugger</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Creator & Simulator Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT: Shortener Creation Form (7 cols) */}
          <div className="lg:col-span-7 bg-[#0d111d] border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-xl shadow-black/40 space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Link2 className="w-5 h-5 text-sky-400" />
                Create New Short Link
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Attach your Monetag link and your exact preview image</p>
            </div>

            {error && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm animate-in fade-in">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">{error}</div>
                <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Success Box if created */}
            {successLink && (
              <div className="p-5 rounded-xl bg-sky-950/50 border border-sky-500/40 text-sky-100 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                    <Check className="w-5 h-5 text-emerald-400" />
                    <span>Short Link Ready with Your Exact Image!</span>
                  </div>
                  <button
                    onClick={() => setSuccessLink(null)}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    Dismiss
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={successLink.shortUrl}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-sky-300 focus:outline-none"
                  />
                  <button
                    onClick={() => handleCopy(successLink.shortUrl, 'success-box')}
                    className="flex items-center gap-1.5 px-4 py-2 bg-sky-500 hover:bg-sky-400 active:scale-95 text-slate-950 font-bold rounded-lg text-sm transition-all shrink-0 cursor-pointer shadow"
                  >
                    {copiedSlug === 'success-box' ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-950" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="font-semibold text-sky-400 shrink-0">Bound Image:</span>
                  <span className="font-mono truncate text-amber-300" title={successLink.imageUrl}>
                    {successLink.imageUrl}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(successLink.shortUrl)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition-colors font-medium cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Post on Twitter / X</span>
                  </a>
                  <button
                    onClick={() => handleInspect(successLink.slug)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors font-medium border border-slate-700 cursor-pointer"
                  >
                    <Bot className="w-3.5 h-3.5 text-amber-400" />
                    <span>Verify Twitterbot HTML</span>
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateLink} className="space-y-6">
              {/* Destination URL */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <span>1. Monetag Destination URL</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Visitors will be redirected here</span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="https://omg10.com/4/11800191 or your Monetag Smartlink"
                    value={destinationUrl}
                    onChange={(e) => setDestinationUrl(e.target.value)}
                    className="w-full bg-[#121726] border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors font-mono"
                  />
                  {destinationUrl && (
                    <button
                      type="button"
                      onClick={() => setDestinationUrl('')}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Exact Image Input Section */}
              <div className="space-y-2.5 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4" />
                    <span>2. Your Exact Twitter Card Image</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[11px] text-emerald-400 font-semibold">Strictly Used on Twitter</span>
                </div>

                {/* Mode Selector Tabs */}
                <div className="flex gap-2 border-b border-slate-800 pb-2">
                  <button
                    type="button"
                    onClick={() => setImageMode('url')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      imageMode === 'url'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Paste Image URL (Imgur, PostImages, direct link)
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageMode('upload')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      imageMode === 'upload'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Upload Image File
                  </button>
                </div>

                {imageMode === 'url' ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="url"
                        required={imageMode === 'url'}
                        placeholder="Paste image URL (e.g. https://i.imgur.com/xyz.jpg, postimages, etc.)"
                        value={imageUrl}
                        onChange={(e) => handleImageUrlChange(e.target.value)}
                        className="w-full bg-[#121726] border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                      />
                      {imageUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setImageUrl('');
                            setImageLoadedSuccess(null);
                          }}
                          className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => handleFileUpload(e, false)}
                      accept="image/*"
                      className="hidden"
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-700 hover:border-sky-500 rounded-xl p-5 text-center cursor-pointer bg-[#121726]/60 transition-colors"
                    >
                      {uploadingImage ? (
                        <div className="flex flex-col items-center gap-2 text-sky-400">
                          <RefreshCw className="w-6 h-6 animate-spin" />
                          <span className="text-xs font-semibold">Uploading to public image host...</span>
                        </div>
                      ) : imageUrl ? (
                        <div className="flex items-center justify-center gap-3">
                          <Check className="w-5 h-5 text-emerald-400" />
                          <span className="text-xs font-semibold text-emerald-300">Image Uploaded Successfully! Click to replace.</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5">
                          <Upload className="w-6 h-6 text-sky-400" />
                          <span className="text-xs font-semibold text-slate-200">Click to browse or drop an image file</span>
                          <span className="text-[11px] text-slate-400">PNG, JPG, WEBP, GIF (Max 15MB)</span>
                        </div>
                      )}
                    </div>
                    {imageUrl && (
                      <p className="text-[11px] text-slate-400 font-mono truncate">
                        Public Image URL: <span className="text-amber-300">{imageUrl}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Live validation indicator for provided image */}
                {imageUrl && (
                  <div className="flex items-center gap-3 pt-2 text-xs">
                    <div className="w-14 h-10 rounded border border-slate-700 overflow-hidden bg-black shrink-0">
                      <img
                        src={imageUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onLoad={() => setImageLoadedSuccess(true)}
                        onError={() => setImageLoadedSuccess(false)}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      {imageLoadedSuccess === true && (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          Image verified & ready for Twitter card
                        </span>
                      )}
                      {imageLoadedSuccess === false && (
                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Warning: Image could not be loaded from this URL
                        </span>
                      )}
                      {imageLoadedSuccess === null && (
                        <span className="text-slate-400">Checking image URL...</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Title & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Twitter Card Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Exclusive Video & Full Breakdown"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-[#121726] border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Twitter Card Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Watch now before it gets taken down"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-[#121726] border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                  />
                </div>
              </div>

              {/* Custom Slug (Optional) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Custom Short Slug (Optional)
                  </label>
                  <span className="text-[11px] text-slate-400">Leave blank for auto-generated 6-char code</span>
                </div>
                <div className="flex items-center">
                  <span className="bg-slate-800 text-slate-400 text-xs px-3 py-2.5 rounded-l-xl border border-r-0 border-slate-700 font-mono">
                    /s/
                  </span>
                  <input
                    type="text"
                    placeholder="amazon-deal"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))}
                    className="flex-1 bg-[#121726] border border-slate-700/80 rounded-r-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors font-mono"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={creating || uploadingImage}
                className="w-full py-3.5 px-6 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 active:scale-[0.99] text-white font-bold rounded-xl shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {creating ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Generating Short Link...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    <span>Generate Short Link with This Image</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* RIGHT: Live Twitter/X Feed Simulator (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-sky-400 font-bold text-xs">
                  𝕏
                </div>
                <h3 className="text-sm font-bold text-slate-200">Live Twitter Card Appearance</h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">summary_large_image</span>
            </div>

            {/* Tweet Editable Caption */}
            <div className="bg-[#0d111d] border border-slate-800 rounded-xl p-3 space-y-1">
              <label className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                Tweet Caption Preview:
              </label>
              <input
                type="text"
                value={tweetText}
                onChange={(e) => setTweetText(e.target.value)}
                className="w-full bg-[#121726] border border-slate-700/60 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Mock Twitter Post Card */}
            <div className="rounded-2xl border border-slate-800 bg-black text-white p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-400 to-indigo-600 flex items-center justify-center font-bold text-white text-sm shrink-0 shadow">
                  M
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="font-bold truncate">Media Publisher</span>
                    <span className="text-sky-400 text-xs">✓</span>
                    <span className="text-slate-500 text-xs truncate">@publisher</span>
                    <span className="text-slate-500 text-xs">·</span>
                    <span className="text-slate-500 text-xs">Now</span>
                  </div>

                  <p className="mt-1 text-sm text-slate-200 leading-normal break-words">
                    {tweetText}
                  </p>

                  <p className="mt-1 text-xs text-sky-400 font-mono hover:underline cursor-pointer break-all">
                    {activeShortUrl}
                  </p>

                  {/* Large Twitter Card */}
                  <div className="mt-3 rounded-2xl border border-slate-800 overflow-hidden bg-slate-950 hover:border-slate-700 transition-all group cursor-pointer shadow-md">
                    <div className="relative aspect-[1.91/1] w-full bg-slate-900 overflow-hidden flex items-center justify-center">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt="Twitter Preview"
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500 space-y-1">
                          <ImageIcon className="w-8 h-8 text-slate-600" />
                          <span className="text-xs font-semibold text-slate-400">Your image will appear here</span>
                          <span className="text-[10px] text-slate-600">Provide an image URL or upload a file</span>
                        </div>
                      )}
                      {imageUrl && (
                        <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-white/90 font-mono flex items-center gap-1">
                          <Bot className="w-3 h-3 text-sky-400" />
                          <span>Scraped Image</span>
                        </div>
                      )}
                    </div>

                    <div className="p-3 border-t border-slate-800 bg-[#080b12]">
                      <div className="text-[11px] text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1">
                        <Globe className="w-3 h-3 text-slate-500" />
                        <span>{typeof window !== 'undefined' ? window.location.hostname : 'tweetlink.app'}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-white mt-1 line-clamp-1 group-hover:text-sky-300 transition-colors">
                        {title || 'Exclusive Media & Updates'}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                        {description || 'Click to view the full details and live media.'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between mt-3 text-slate-500 text-xs px-2">
                    <span className="hover:text-sky-400 cursor-pointer">💬 18</span>
                    <span className="hover:text-emerald-400 cursor-pointer">🔁 64</span>
                    <span className="hover:text-rose-400 cursor-pointer">❤️ 412</span>
                    <span className="hover:text-sky-400 cursor-pointer">📊 8.9K</span>
                    <span className="hover:text-sky-400 cursor-pointer">📤</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Test Helper */}
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
                <HelpCircle className="w-4 h-4 text-sky-400" />
                <span>What Twitter's Crawler Will Receive:</span>
              </div>
              <p className="leading-relaxed">
                When you share your link, Twitterbot requests <code className="text-sky-300 font-mono text-[11px]">/s/:slug</code> and receives your exact image URL:
              </p>
              <pre className="text-[10px] bg-slate-950 p-2 rounded border border-slate-800 text-amber-300 font-mono overflow-x-auto">
{`<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${imageUrl || 'https://your-exact-image-url.com'}">`}
              </pre>
            </div>
          </div>

        </div>

        {/* SECTION: Created Links Dashboard */}
        <section id="dashboard" className="space-y-4 pt-6 border-t border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-sky-400" />
                Your Short Links ({links.length})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Each link below uses your specific image with instant Monetag redirect
              </p>
            </div>
            <button
              onClick={fetchLinks}
              disabled={loading}
              className="self-start sm:self-auto px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
              <span>Refresh Stats</span>
            </button>
          </div>

          {loading && links.length === 0 ? (
            <div className="text-center py-16 bg-[#0d111d] rounded-2xl border border-slate-800 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-sky-400 mx-auto mb-2" />
              <p className="text-sm">Loading your shortened links...</p>
            </div>
          ) : links.length === 0 ? (
            <div className="text-center py-16 bg-[#0d111d] rounded-2xl border border-slate-800 text-slate-400 space-y-2">
              <Link2 className="w-8 h-8 text-slate-600 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-300">No short links created yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Paste your Monetag URL and image above to generate your first Twitter card link.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {links.map((link) => {
                const shortUrl = `${currentOrigin}/s/${link.slug}`;
                const isCopied = copiedSlug === link.slug;
                const isCopiedHtml = copiedHtmlSlug === link.slug;

                return (
                  <div
                    key={link.id || link.slug}
                    className="bg-[#0d111d] border border-slate-800 hover:border-slate-700/80 rounded-2xl overflow-hidden shadow-lg transition-all flex flex-col group"
                  >
                    {/* Card Image Banner */}
                    <div className="relative aspect-[16/9] bg-slate-900 overflow-hidden">
                      <img
                        src={link.imageUrl}
                        alt={link.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).alt = 'Image not available';
                        }}
                      />
                      <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-mono text-sky-400 font-bold border border-slate-800">
                        /s/{link.slug}
                      </div>

                      <div className="absolute top-2 right-2 flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingLink(link);
                            setEditImageUrl(link.imageUrl);
                            setEditTitle(link.title);
                            setEditDesc(link.description);
                          }}
                          title="Change Image / Edit Link"
                          className="p-1.5 bg-slate-950/80 hover:bg-sky-900/80 text-slate-300 hover:text-sky-200 rounded-lg transition-colors cursor-pointer border border-slate-800"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(link.slug)}
                          title="Delete Link"
                          className="p-1.5 bg-slate-950/80 hover:bg-rose-900/80 text-slate-400 hover:text-rose-200 rounded-lg transition-colors cursor-pointer border border-slate-800"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="text-sm font-bold text-white line-clamp-1" title={link.title}>
                          {link.title}
                        </h4>
                        <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                          {link.description}
                        </p>
                      </div>

                      {/* Attached Image URL */}
                      <div className="text-[11px] text-slate-400 bg-slate-900/80 p-2 rounded-lg border border-slate-800/80 space-y-1">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase">Preview Image:</span>
                        <p className="font-mono text-amber-300 text-[10px] truncate" title={link.imageUrl}>
                          {link.imageUrl}
                        </p>
                      </div>

                      {/* Destination Monetag URL */}
                      <div className="text-[11px] text-slate-400 bg-slate-900/80 p-2 rounded-lg border border-slate-800/80 space-y-1">
                        <div className="flex items-center justify-between text-slate-500">
                          <span className="text-[10px] font-semibold uppercase">Target Monetag:</span>
                          <a
                            href={link.destinationUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sky-400 hover:underline flex items-center gap-0.5 text-xs"
                          >
                            <span>Visit</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                        <p className="font-mono text-slate-300 truncate" title={link.destinationUrl}>
                          {link.destinationUrl}
                        </p>
                      </div>

                      {/* Analytics */}
                      <div className="pt-1 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 font-bold">{link.clicks} clicks</span>
                          <span aria-hidden="true" className="text-slate-600">·</span>
                          <span className="text-amber-400 font-medium">{link.botHits} bot crawls</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {new Date(link.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      {/* Primary Actions */}
                      <div className="pt-2 flex items-center gap-2">
                        <button
                          onClick={() => handleCopy(shortUrl, link.slug)}
                          className="flex-1 py-2 px-3 bg-sky-500 hover:bg-sky-400 active:scale-95 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-950" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleInspect(link.slug)}
                          title="Inspect Twitterbot OpenGraph SSR"
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors cursor-pointer"
                        >
                          <Bot className="w-4 h-4 text-sky-400" />
                        </button>

                        <a
                          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Trending update 👇')}&url=${encodeURIComponent(shortUrl)}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Share to Twitter"
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors"
                        >
                          <Share2 className="w-4 h-4 text-sky-400" />
                        </a>
                      </div>

                      {/* Standalone HTML File Tools (Guaranteed 100% bypass of AI Studio Auth) */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
                        <button
                          onClick={() => downloadHtmlFile(link)}
                          className="flex-1 py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          title="Download standalone HTML file with your image & redirect to host anywhere"
                        >
                          <Download className="w-3 h-3 text-indigo-400" />
                          <span>Download .html</span>
                        </button>

                        <button
                          onClick={() => setShowHtmlModal(link)}
                          className="py-1.5 px-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          title="View and copy standalone HTML tag code"
                        >
                          <Code className="w-3 h-3 text-sky-400" />
                          <span>Code</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </main>

      {/* Standalone HTML Code Modal */}
      {showHtmlModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1320] border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Code className="w-5 h-5 text-sky-400" />
                <h3 className="text-base font-bold text-white">Standalone Twitter Card HTML Code</h3>
              </div>
              <button onClick={() => setShowHtmlModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              This self-contained HTML page has your image bound in the Twitter meta tags and instantly forwards users to your Monetag destination. You can host this file on <strong className="text-white">Netlify Drop, GitHub Pages, Vercel, Tiiny Host, or any website</strong>:
            </p>

            <pre className="text-[11px] bg-slate-950 p-4 rounded-xl border border-slate-800 text-sky-300 font-mono overflow-x-auto max-h-72">
              {generateStandaloneHtml(showHtmlModal)}
            </pre>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => downloadHtmlFile(showHtmlModal)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download as {showHtmlModal.slug}.html</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generateStandaloneHtml(showHtmlModal));
                    alert('Copied HTML code to clipboard!');
                  }}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer"
                >
                  Copy Code
                </button>
                <button
                  onClick={() => setShowHtmlModal(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Image Modal */}
      {editingLink && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1320] border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-sky-400" />
                Change Image for /s/{editingLink.slug}
              </h3>
              <button onClick={() => setEditingLink(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-300">New Image URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={editImageUrl}
                    onChange={(e) => setEditImageUrl(e.target.value)}
                    className="flex-1 bg-[#121726] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                    placeholder="https://..."
                  />
                  <input
                    type="file"
                    ref={editFileInputRef}
                    onChange={(e) => handleFileUpload(e, true)}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 font-semibold cursor-pointer shrink-0"
                  >
                    {uploadingImage ? '...' : 'Upload'}
                  </button>
                </div>
              </div>

              {editImageUrl && (
                <div className="aspect-[1.91/1] rounded-lg overflow-hidden border border-slate-800 bg-black">
                  <img src={editImageUrl} alt="New Preview" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-[#121726] border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-300">Description</label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full bg-[#121726] border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingLink(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-lg cursor-pointer"
                >
                  {savingEdit ? 'Saving...' : 'Update Image & Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Twitterbot Modal */}
      {inspectModalLink && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1320] border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-sky-400" />
                <h3 className="text-base font-bold text-white">Twitterbot Inspection Report</h3>
              </div>
              <button
                onClick={() => setInspectModalLink(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300">
                Below is the exact OpenGraph and Twitter Card metadata that TweetLink sends to Twitterbot for <code className="text-sky-300 font-mono font-semibold">/s/{inspectModalLink.link.slug}</code>:
              </p>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2 font-mono text-[11px]">
                <div className="flex items-center justify-between text-slate-400 border-b border-slate-800/80 pb-1.5">
                  <span className="text-sky-400">twitter:card</span>
                  <span className="text-emerald-400">{inspectModalLink.twitterCardData.card}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 border-b border-slate-800/80 pb-1.5">
                  <span className="text-sky-400">twitter:title</span>
                  <span className="text-white truncate max-w-xs">{inspectModalLink.twitterCardData.title}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400 border-b border-slate-800/80 pb-1.5">
                  <span className="text-sky-400">twitter:description</span>
                  <span className="text-slate-300 truncate max-w-xs">{inspectModalLink.twitterCardData.description}</span>
                </div>
                <div className="space-y-1 text-slate-400 border-b border-slate-800/80 pb-1.5">
                  <span className="text-sky-400">twitter:image (YOUR EXACT PROVIDED IMAGE)</span>
                  <p className="text-amber-300 text-[10px] break-all">{inspectModalLink.twitterCardData.image}</p>
                </div>
                <div className="space-y-1 text-slate-400">
                  <span className="text-sky-400">destination:monetag</span>
                  <p className="text-slate-300 text-[10px] break-all">{inspectModalLink.twitterCardData.destinationUrl}</p>
                </div>
              </div>

              {/* Image Preview */}
              <div className="rounded-xl overflow-hidden border border-slate-800 aspect-[1.91/1] bg-black">
                <img
                  src={inspectModalLink.twitterCardData.image}
                  alt="Scraped Preview"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <a
                  href={`/s/${inspectModalLink.link.slug}?bot=1`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-sky-400 hover:underline flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Raw Bot HTML in New Tab</span>
                </a>
                <button
                  onClick={() => setInspectModalLink(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-[#06080d] py-6 text-center text-xs text-slate-500">
        <p>TweetLink · Guaranteed User Image Twitter Card Binding · Built for High-CTR Monetag Campaigns</p>
      </footer>
    </div>
  );
}
