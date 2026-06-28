import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ArrowsClockwise,
  ArrowSquareOut,
  BookOpen,
  CheckCircle,
  CircleNotch,
  Gear,
  Minus,
  Plus,
  Sparkle,
  TextAa,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  fetchArticleFullContent,
  getArticleFullContent,
  isContentStale,
  type FeedItem,
  type FullContentResponse,
} from "../../api/rss";
import { sanitizeHtml } from "../common/RichContentRenderer";
import { useUIStore } from "../../stores/uiStore";

interface RSSFullContentViewProps {
  item: FeedItem;
}

function SafeHTML({ html, fontFamily, lineHeight, fontSize }: { html: string; fontFamily: 'sans' | 'serif' | 'mono'; lineHeight: 'normal' | 'relaxed' | 'loose'; fontSize: number }) {
  const fontClasses = {
    sans: "font-sans",
    serif: "font-serif",
    mono: "font-mono"
  };

  const heightClasses = {
    normal: "leading-normal",
    relaxed: "leading-relaxed",
    loose: "leading-loose"
  };

  return (
    <div
      className={`prose prose-slate dark:prose-invert max-w-none transition-all duration-150
        ${fontClasses[fontFamily]} 
        ${heightClasses[lineHeight]}
        prose-headings:font-bold prose-headings:text-current
        prose-p:text-current prose-p:mb-5
        prose-a:text-blue-500 dark:prose-a:text-blue-400 hover:prose-a:underline prose-a:font-medium
        prose-img:rounded-2xl prose-img:shadow-lg prose-img:my-8 prose-img:mx-auto prose-img:border prose-img:border-black/5 dark:prose-img:border-white/5
        prose-strong:text-current prose-strong:font-bold
        prose-code:text-current prose-code:bg-black/10 dark:prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
        prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:italic prose-blockquote:pl-4 prose-blockquote:text-current/80
      `}
      style={{ fontSize: `${fontSize}px` }}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}

/**
 * Intelligent client-side de-cluttering utility to strip out promotional garbage,
 * ad containers, newsletter subscriptions, and social call-to-actions.
 */
export function cleanArticleHtml(rawHtml: string): string {
  if (!rawHtml) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, "text/html");

    // Elements to remove based on tag names
    const tagsToRemove = ["script", "style", "form", "iframe", "button", "input", "noscript", "svg"];
    tagsToRemove.forEach(tag => {
      doc.querySelectorAll(tag).forEach(el => el.remove());
    });

    // Selectors targeting ads, newsletter signups, sharing bars, and promos
    const promoSelectors = [
      "[class*='ad-']", "[class*='adsense']", "[class*='banner']", "[id*='ad-']", ".advertisement",
      "[class*='subscribe']", "[id*='subscribe']", "[class*='newsletter']", "[id*='newsletter']",
      ".newsletter-signup", ".promo", ".cta", ".subscription",
      "[class*='share-']", "[class*='social-']", ".social-share", ".social-buttons", ".share-bar",
      "footer", ".post-footer", ".article-footer", ".related-posts", ".comments"
    ];

    promoSelectors.forEach(selector => {
      try {
        doc.querySelectorAll(selector).forEach(el => {
          el.remove();
        });
      } catch (_err) { /* ignore invalid selectors */ }
    });

    // Filter elements containing promotional text (case-insensitive)
    const promoKeywords = [
      "subscribe free", "don't miss the next", "newsletter", "sign up for", "follow us on", 
      "read more", "related articles", "advertisement", "support our work", "become a member"
    ];
    
    const textContainers = doc.querySelectorAll("p, div, section, h1, h2, h3, span, a");
    textContainers.forEach(el => {
      const text = (el.textContent || "").toLowerCase().trim();
      
      // If it contains a promo keyword and is relatively short (to avoid deleting entire paragraphs containing a word)
      if (text.length < 150) {
        const matchesKeyword = promoKeywords.some(keyword => text.includes(keyword));
        if (matchesKeyword) {
          el.remove();
        }
      }
    });

    // Remove empty paragraphs/divs created after cleaning
    doc.querySelectorAll("p, div").forEach(el => {
      if ((el.textContent || "").trim() === "" && el.children.length === 0) {
        el.remove();
      }
    });

    return doc.body.innerHTML;
  } catch (err) {
    console.warn("De-clutter parsing failed, falling back to raw html", err);
    return rawHtml;
  }
}

/**
 * RSS Full Content View Component
 * Displays extracted full article content with fetching, caching, and error states
 */
export function RSSFullContentView({ item }: RSSFullContentViewProps) {
  const [content, setContent] = useState<string | null>(item.fullContent || null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(item.fullContentFetchedAt || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  // Global theme from UI Store
  const globalTheme = useUIStore((state) => state.theme);

  // Reader Customization States (with localStorage persistence)
  const [theme, setTheme] = useState<'system' | 'light' | 'sepia' | 'slate' | 'oled'>(() => {
    return (localStorage.getItem("reader_theme") as any) || "system";
  });
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans' | 'mono'>(() => {
    return (localStorage.getItem("reader_font_family") as any) || "serif";
  });
  const [fontSize, setFontSize] = useState<number>(() => {
    return Number(localStorage.getItem("reader_font_size")) || 16;
  });
  const [maxWidth, setMaxWidth] = useState<'narrow' | 'normal' | 'wide'>(() => {
    return (localStorage.getItem("reader_max_width") as any) || "normal";
  });
  const [lineHeight, setLineHeight] = useState<'normal' | 'relaxed' | 'loose'>(() => {
    return (localStorage.getItem("reader_line_height") as any) || "relaxed";
  });
  const [isCleanMode, setIsCleanMode] = useState<boolean>(() => {
    return localStorage.getItem("reader_clean_mode") !== "false";
  });
  const [showSettings, setShowSettings] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Sync controls to localStorage
  useEffect(() => { localStorage.setItem("reader_theme", theme); }, [theme]);
  useEffect(() => { localStorage.setItem("reader_font_family", fontFamily); }, [fontFamily]);
  useEffect(() => { localStorage.setItem("reader_font_size", String(fontSize)); }, [fontSize]);
  useEffect(() => { localStorage.setItem("reader_max_width", maxWidth); }, [maxWidth]);
  useEffect(() => { localStorage.setItem("reader_line_height", lineHeight); }, [lineHeight]);
  useEffect(() => { localStorage.setItem("reader_clean_mode", String(isCleanMode)); }, [isCleanMode]);

  useEffect(() => {
    const loadCachedContent = async () => {
      if (!content && !item.fullContent) {
        const cached = await getArticleFullContent(item.id);
        if (cached?.content) {
          setContent(cached.content);
          setFetchedAt(cached.fetchedAt || null);
        }
      }
    };
    loadCachedContent();
  }, [item.id, content, item.fullContent]);

  useEffect(() => {
    if (fetchedAt) {
      setIsStale(isContentStale(fetchedAt));
    }
  }, [fetchedAt]);

  const handleFetchContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result: FullContentResponse = await fetchArticleFullContent(item.id, item.link);

      if (result.success && result.fullContent) {
        setContent(result.fullContent);
        setFetchedAt(result.fetchedAt);
        setIsStale(false);
      } else {
        setError(result.error || "Failed to fetch content");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [item.id, item.link]);

  // Refresh stale content
  const handleRefresh = useCallback(async () => {
    await handleFetchContent();
  }, [handleFetchContent]);

  // Open original article in new tab
  const handleOpenOriginal = useCallback(() => {
    window.open(item.link, "_blank", "noopener,noreferrer");
  }, [item.link]);

  // Handle scroll progress
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const totalHeight = target.scrollHeight - target.clientHeight;
    if (totalHeight > 0) {
      setScrollProgress((target.scrollTop / totalHeight) * 100);
    } else {
      setScrollProgress(0);
    }
  };

  // Compute clean text vs original text
  const cleanedHtml = useMemo(() => {
    if (!content) return "";
    return isCleanMode ? cleanArticleHtml(content) : content;
  }, [content, isCleanMode]);

  // Estimate reading statistics
  const stats = useMemo(() => {
    const text = content ? content.replace(/<[^>]*>/g, "") : "";
    const words = text.split(/\s+/).filter(Boolean).length;
    const readingTime = Math.max(1, Math.ceil(words / 225)); // average reading speed 225 wpm
    return { words, readingTime };
  }, [content]);

  // Resolve the active theme to apply
  const activeTheme = useMemo(() => {
    if (theme === "system") {
      return globalTheme === "light" ? "light" : "slate";
    }
    return theme;
  }, [theme, globalTheme]);

  // Color theme classes for viewport
  const themeClasses = {
    light: "bg-[#fdfdfd] text-[#1e293b] border-gray-200",
    sepia: "bg-[#fbf6ec] text-[#433422] border-[#e8dfcf]",
    slate: "bg-slate-950 text-slate-100 border-slate-900",
    oled: "bg-black text-gray-200 border-gray-900"
  };

  // Color theme classes for sticky header
  const headerThemeClasses = {
    light: "bg-[#fdfdfd]/80 border-gray-200 text-[#1e293b]",
    sepia: "bg-[#fbf6ec]/80 border-[#e8dfcf] text-[#433422]",
    slate: "bg-slate-950/80 border-slate-900 text-slate-100",
    oled: "bg-black/80 border-gray-900 text-gray-200"
  };

  const widthClasses = {
    narrow: "max-w-[620px]",
    normal: "max-w-[780px]",
    wide: "max-w-[980px]"
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <CircleNotch className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Fetching full article content...</p>
      </div>
    );
  }

  if (error && !content) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4 p-6">
        <WarningCircle className="w-10 h-10 text-red-500" />
        <div className="text-center">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
            Failed to load full content
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{error}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleFetchContent}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium shadow-md shadow-blue-500/20"
          >
            <ArrowsClockwise className="w-4 h-4" />
            Retry
          </button>
          <button
            onClick={handleOpenOriginal}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            <ArrowSquareOut className="w-4 h-4" />
            Open Original
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col transition-colors duration-200 relative ${themeClasses[activeTheme]}`}>
      {/* Header with actions */}
      <div className={`flex items-center justify-between px-4 py-3 border-b backdrop-blur-md z-10 transition-colors duration-200 ${headerThemeClasses[activeTheme]}`}>
        <div className="flex items-center gap-3">
          {content && (
            <>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-semibold">
                  Full content
                </span>
              </div>
              <span className="opacity-30">•</span>
              <div className="flex items-center gap-1 text-xs opacity-75">
                <BookOpen className="w-3.5 h-3.5" />
                <span>{stats.readingTime} min read</span>
                <span className="opacity-30 ml-1">•</span>
                <span>{stats.words} words</span>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {content && isStale && (
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-lg transition-all font-medium"
            >
              <ArrowsClockwise className="w-3.5 h-3.5" />
              Refresh
            </button>
          )}
          {!content && !error && (
            <button
              onClick={handleFetchContent}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-600 dark:text-blue-400 rounded-lg transition-all font-medium"
            >
              <ArrowSquareOut className="w-3.5 h-3.5" />
              Fetch Full Content
            </button>
          )}

          {/* Clean View Toggle */}
          {content && (
            <button
              onClick={() => setIsCleanMode(!isCleanMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                isCleanMode
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "bg-gray-100 dark:bg-gray-800 border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
              title={isCleanMode ? "Clean View active (hiding ads/promos)" : "Clean View inactive"}
            >
              <Sparkle className="w-3.5 h-3.5" />
              <span>{isCleanMode ? "Clean View" : "Original"}</span>
            </button>
          )}

          {/* Reader Preferences Toggle */}
          {content && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1.5 rounded-lg border transition-all ${
                showSettings
                  ? "bg-blue-500/15 border-blue-500/30 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "bg-gray-100 dark:bg-gray-800 border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
              title="Reader preferences"
            >
              <Gear className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleOpenOriginal}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 border-transparent text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all font-medium"
          >
            <ArrowSquareOut className="w-3.5 h-3.5" />
            Original Link
          </button>
        </div>
      </div>

      {/* Floating Reader Settings Dropdown */}
      {showSettings && (
        <div className="absolute right-16 top-14 z-50 w-72 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md p-4 shadow-xl animate-in fade-in slide-in-from-top-2 duration-150 text-gray-900 dark:text-gray-100">
          <div className="space-y-4">
            {/* Font Family */}
            <div>
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-2">Typography</span>
              <div className="grid grid-cols-3 gap-1 bg-gray-100 dark:bg-gray-900 p-0.5 rounded-lg">
                {(["sans", "serif", "mono"] as const).map((font) => (
                  <button
                    key={font}
                    onClick={() => setFontFamily(font)}
                    className={`py-1 text-xs font-medium rounded-md capitalize transition-all ${
                      fontFamily === font
                        ? "bg-white dark:bg-gray-800 shadow text-blue-600 dark:text-blue-400"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                    }`}
                  >
                    {font}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Size */}
            <div>
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-2">Text Size</span>
              <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-900 p-1 rounded-lg">
                <button
                  onClick={() => setFontSize((s) => Math.max(12, s - 1))}
                  className="p-1 rounded-md hover:bg-white dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold">{fontSize}px</span>
                <button
                  onClick={() => setFontSize((s) => Math.min(28, s + 1))}
                  className="p-1 rounded-md hover:bg-white dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Line Height & Width */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-2">Width</span>
                <div className="grid grid-cols-3 gap-0.5 bg-gray-100 dark:bg-gray-900 p-0.5 rounded-lg">
                  {(["narrow", "normal", "wide"] as const).map((w) => (
                    <button
                      key={w}
                      onClick={() => setMaxWidth(w)}
                      className={`py-1 text-[10px] font-bold uppercase rounded-md transition-all ${
                        maxWidth === w
                          ? "bg-white dark:bg-gray-800 shadow text-blue-600 dark:text-blue-400"
                          : "text-gray-600 dark:text-gray-400"
                      }`}
                      title={`${w} width`}
                    >
                      {w[0]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-2">Spacing</span>
                <div className="grid grid-cols-3 gap-0.5 bg-gray-100 dark:bg-gray-900 p-0.5 rounded-lg">
                  {(["normal", "relaxed", "loose"] as const).map((h) => (
                    <button
                      key={h}
                      onClick={() => setLineHeight(h)}
                      className={`py-1 text-[10px] font-bold uppercase rounded-md transition-all ${
                        lineHeight === h
                          ? "bg-white dark:bg-gray-800 shadow text-blue-600 dark:text-blue-400"
                          : "text-gray-600 dark:text-gray-400"
                      }`}
                      title={`${h} line height`}
                    >
                      {h[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Color Themes */}
            <div>
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block mb-2">Theme</span>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  onClick={() => setTheme("system")}
                  className={`flex items-center justify-center h-8 rounded-lg border text-xs font-medium bg-gray-100 dark:bg-gray-900 transition-all ${
                    theme === "system"
                      ? "border-blue-500 ring-2 ring-blue-500/20 font-bold"
                      : "border-transparent"
                  }`}
                >
                  💻 Auto (System)
                </button>
                <button
                  onClick={() => setTheme("light")}
                  className={`flex items-center justify-center h-8 rounded-lg border text-xs font-medium bg-[#fdfdfd] text-[#1e293b] transition-all ${
                    theme === "light"
                      ? "border-blue-500 ring-2 ring-blue-500/20 font-bold"
                      : "border-gray-200 dark:border-gray-800"
                  }`}
                >
                  Light
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setTheme("sepia")}
                  className={`flex items-center justify-center h-8 rounded-lg border text-xs font-medium bg-[#fbf6ec] text-[#433422] transition-all ${
                    theme === "sepia"
                      ? "border-amber-500 ring-2 ring-amber-500/20 font-bold"
                      : "border-gray-200 dark:border-gray-800"
                  }`}
                >
                  Sepia
                </button>
                <button
                  onClick={() => setTheme("slate")}
                  className={`flex items-center justify-center h-8 rounded-lg border text-xs font-medium bg-slate-950 text-slate-100 transition-all ${
                    theme === "slate"
                      ? "border-blue-500 ring-2 ring-blue-500/20 font-bold"
                      : "border-slate-800"
                  }`}
                >
                  Slate
                </button>
                <button
                  onClick={() => setTheme("oled")}
                  className={`flex items-center justify-center h-8 rounded-lg border text-xs font-medium bg-black text-gray-200 transition-all ${
                    theme === "oled"
                      ? "border-purple-500 ring-2 ring-purple-500/20 font-bold"
                      : "border-gray-800"
                  }`}
                >
                  OLED
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scroll Progress Bar */}
      <div className="h-[3px] w-full bg-gray-200 dark:bg-gray-800 overflow-hidden z-10 transition-colors duration-200">
        <div
          className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-75 ease-out"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-6" onScroll={handleScroll}>
        <div className={`mx-auto ${widthClasses[maxWidth]} transition-all duration-150`}>
          {content ? (
            <SafeHTML 
              html={cleanedHtml} 
              fontFamily={fontFamily} 
              lineHeight={lineHeight} 
              fontSize={fontSize} 
            />
          ) : (
            <div className="prose prose-slate dark:prose-invert max-w-none">
              {/* Show original RSS content as fallback */}
              <div
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(item.content || item.description || ""),
                }}
              />
              {!item.content && !item.description && (
                <div className="flex flex-col items-center justify-center h-64 space-y-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No content available. Click "Fetch Full Content" to load the complete article.
                  </p>
                  <button
                    onClick={handleFetchContent}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium shadow-md shadow-blue-500/20"
                  >
                    <ArrowSquareOut className="w-4 h-4" />
                    Fetch Full Content
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
