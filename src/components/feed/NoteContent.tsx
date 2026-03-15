import { ReactNode, useEffect, useState } from "react";
import { NDKEvent, nip19 } from "@nostr-dev-kit/ndk";
import { useUIStore } from "../../stores/ui";
import { fetchNoteById } from "../../lib/nostr";
import { useProfile } from "../../hooks/useProfile";
import { shortenPubkey } from "../../lib/utils";
import { ImageLightbox } from "../shared/ImageLightbox";

// Regex patterns
const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/g;
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg)(\?[^\s]*)?$/i;
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|ogg|m4v|avi)(\?[^\s]*)?$/i;
const AUDIO_EXTENSIONS = /\.(mp3|wav|flac|aac|m4a|opus|ogg)(\?[^\s]*)?$/i;
const YOUTUBE_REGEX = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const TIDAL_REGEX = /tidal\.com\/(?:browse\/)?(?:track|album|playlist)\/([a-zA-Z0-9-]+)/;
const SPOTIFY_REGEX = /open\.spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/;
const VIMEO_REGEX = /vimeo\.com\/(\d+)/;
const NOSTR_MENTION_REGEX = /nostr:(npub1[a-z0-9]+|note1[a-z0-9]+|nevent1[a-z0-9]+|nprofile1[a-z0-9]+|naddr1[a-z0-9]+)/g;
const HASHTAG_REGEX = /(?<=\s|^)#(\w{2,})/g;

interface ContentSegment {
  type: "text" | "link" | "image" | "video" | "audio" | "youtube" | "vimeo" | "spotify" | "tidal" | "mention" | "hashtag" | "quote";
  value: string;  // for "quote": the hex event ID
  display?: string;
  mediaId?: string;       // video/embed ID for youtube/vimeo
  mediaType?: string;     // e.g. "track", "album" for spotify/tidal
}

function parseContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const allMatches: { index: number; length: number; segment: ContentSegment }[] = [];

  // Find URLs
  let match: RegExpExecArray | null;
  const urlRegex = new RegExp(URL_REGEX.source, "g");
  while ((match = urlRegex.exec(content)) !== null) {
    const url = match[0];
    // Clean trailing punctuation that's likely not part of the URL
    const cleaned = url.replace(/[.,;:!?)]+$/, "");

    if (IMAGE_EXTENSIONS.test(cleaned)) {
      allMatches.push({
        index: match.index,
        length: cleaned.length,
        segment: { type: "image", value: cleaned },
      });
    } else if (VIDEO_EXTENSIONS.test(cleaned)) {
      allMatches.push({
        index: match.index,
        length: cleaned.length,
        segment: { type: "video", value: cleaned },
      });
    } else if (AUDIO_EXTENSIONS.test(cleaned)) {
      allMatches.push({
        index: match.index,
        length: cleaned.length,
        segment: { type: "audio", value: cleaned },
      });
    } else {
      // Check for embeddable media URLs
      const ytMatch = cleaned.match(YOUTUBE_REGEX);
      const vimeoMatch = cleaned.match(VIMEO_REGEX);
      const spotifyMatch = cleaned.match(SPOTIFY_REGEX);
      const tidalMatch = cleaned.match(TIDAL_REGEX);

      if (ytMatch) {
        allMatches.push({
          index: match.index,
          length: cleaned.length,
          segment: { type: "youtube", value: cleaned, mediaId: ytMatch[1] },
        });
      } else if (vimeoMatch) {
        allMatches.push({
          index: match.index,
          length: cleaned.length,
          segment: { type: "vimeo", value: cleaned, mediaId: vimeoMatch[1] },
        });
      } else if (spotifyMatch) {
        allMatches.push({
          index: match.index,
          length: cleaned.length,
          segment: { type: "spotify", value: cleaned, mediaType: spotifyMatch[1], mediaId: spotifyMatch[2] },
        });
      } else if (tidalMatch) {
        // Extract the type (track/album/playlist) from the URL
        const tidalTypeMatch = cleaned.match(/tidal\.com\/(?:browse\/)?(track|album|playlist)\//);
        allMatches.push({
          index: match.index,
          length: cleaned.length,
          segment: { type: "tidal", value: cleaned, mediaType: tidalTypeMatch?.[1] ?? "track", mediaId: tidalMatch[1] },
        });
      } else {
        // Shorten display URL
        let display = cleaned;
        try {
          const u = new URL(cleaned);
          display = u.hostname + (u.pathname !== "/" ? u.pathname : "");
          if (display.length > 50) display = display.slice(0, 47) + "…";
        } catch { /* keep as-is */ }

        allMatches.push({
          index: match.index,
          length: cleaned.length,
          segment: { type: "link", value: cleaned, display },
        });
      }
    }
  }

  // Find nostr: mentions
  const mentionRegex = new RegExp(NOSTR_MENTION_REGEX.source, "g");
  while ((match = mentionRegex.exec(content)) !== null) {
    const raw = match[1];
    let display = raw.slice(0, 12) + "…";

    let isQuote = false;
    let eventId = "";
    try {
      const decoded = nip19.decode(raw);
      if (decoded.type === "npub") {
        display = raw.slice(0, 12) + "…";
      } else if (decoded.type === "note") {
        // Always treat note1 references as inline quotes
        isQuote = true;
        eventId = decoded.data as string;
      } else if (decoded.type === "nevent") {
        const d = decoded.data as { id: string; kind?: number };
        // Only quote kind-1 notes (or unknown kind)
        if (!d.kind || d.kind === 1) {
          isQuote = true;
          eventId = d.id;
        } else {
          display = "event:" + raw.slice(7, 15) + "…";
        }
      }
    } catch { /* keep default */ }

    allMatches.push({
      index: match.index,
      length: match[0].length,
      segment: isQuote
        ? { type: "quote", value: eventId }
        : { type: "mention", value: raw, display },
    });
  }

  // Find hashtags
  const hashtagRegex = new RegExp(HASHTAG_REGEX.source, "g");
  while ((match = hashtagRegex.exec(content)) !== null) {
    allMatches.push({
      index: match.index,
      length: match[0].length,
      segment: { type: "hashtag", value: match[1], display: `#${match[1]}` },
    });
  }

  // Sort matches by index, remove overlaps
  allMatches.sort((a, b) => a.index - b.index);
  const filtered: typeof allMatches = [];
  let lastEnd = 0;
  for (const m of allMatches) {
    if (m.index >= lastEnd) {
      filtered.push(m);
      lastEnd = m.index + m.length;
    }
  }

  // Build segments
  let cursor = 0;
  for (const m of filtered) {
    if (m.index > cursor) {
      segments.push({ type: "text", value: content.slice(cursor, m.index) });
    }
    segments.push(m.segment);
    cursor = m.index + m.length;
  }
  if (cursor < content.length) {
    segments.push({ type: "text", value: content.slice(cursor) });
  }

  return segments;
}

// Returns true if we handled the URL internally (njump.me interception).
function tryHandleUrlInternally(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.hostname === "njump.me") {
      const entity = u.pathname.replace(/^\//, "");
      if (entity) return tryOpenNostrEntity(entity);
    }
  } catch { /* not a valid URL */ }
  return false;
}

// Decodes a NIP-19 bech32 string and navigates internally where possible.
// Returns true if handled, false if the caller should fall back to a browser open.
function tryOpenNostrEntity(raw: string): boolean {
  try {
    const decoded = nip19.decode(raw);
    const { openProfile, openArticle } = useUIStore.getState();
    if (decoded.type === "npub") {
      openProfile(decoded.data as string);
      return true;
    }
    if (decoded.type === "nprofile") {
      openProfile((decoded.data as { pubkey: string }).pubkey);
      return true;
    }
    if (decoded.type === "naddr") {
      const { kind } = decoded.data as { kind: number; pubkey: string; identifier: string };
      if (kind === 30023) {
        openArticle(raw);
        return true;
      }
    }
    // note / nevent / other naddr kinds — fall through to njump.me
  } catch { /* invalid entity */ }
  return false;
}

function QuotePreview({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<NDKEvent | null>(null);
  const { openThread, currentView } = useUIStore();
  const profile = useProfile(event?.pubkey ?? "");

  useEffect(() => {
    if (!eventId) return;
    fetchNoteById(eventId).then(setEvent);
  }, [eventId]);

  if (!event) return null;

  const name = profile?.displayName || profile?.name || shortenPubkey(event.pubkey);
  const preview = event.content.slice(0, 160) + (event.content.length > 160 ? "…" : "");

  return (
    <div
      className="mt-2 border border-border bg-bg-raised px-3 py-2 cursor-pointer hover:bg-bg-hover transition-colors"
      onClick={(e) => { e.stopPropagation(); openThread(event, currentView as "feed" | "profile"); }}
    >
      <div className="flex items-center gap-2 mb-1">
        {profile?.picture && (
          <img src={profile.picture} alt="" className="w-4 h-4 rounded-sm object-cover shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        )}
        <span className="text-text-muted text-[11px] font-medium truncate">{name}</span>
      </div>
      <p className="text-text-dim text-[11px] leading-relaxed whitespace-pre-wrap break-words">{preview}</p>
    </div>
  );
}

interface NoteContentProps {
  content: string;
  /** Render only inline text (no media blocks). Used inside the clickable area. */
  inline?: boolean;
  /** Render only media blocks (videos, embeds, quotes). Used outside the clickable area. */
  mediaOnly?: boolean;
}

export function NoteContent({ content, inline, mediaOnly }: NoteContentProps) {
  const { openSearch } = useUIStore();
  const segments = parseContent(content);
  const images: string[] = segments.filter((s) => s.type === "image").map((s) => s.value);
  const videos: string[] = segments.filter((s) => s.type === "video").map((s) => s.value);
  const audios: string[] = segments.filter((s) => s.type === "audio").map((s) => s.value);
  const youtubes = segments.filter((s) => s.type === "youtube");
  const vimeos = segments.filter((s) => s.type === "vimeo");
  const spotifys = segments.filter((s) => s.type === "spotify");
  const tidals = segments.filter((s) => s.type === "tidal");
  const quoteIds: string[] = segments.filter((s) => s.type === "quote").map((s) => s.value);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // --- Inline text + images (safe inside clickable wrapper) ---
  if (inline) {
    const inlineElements: ReactNode[] = [];
    segments.forEach((seg, i) => {
      switch (seg.type) {
        case "text":
          inlineElements.push(<span key={i}>{seg.value}</span>);
          break;
        case "link":
          inlineElements.push(
            <a
              key={i}
              href={seg.value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-hover underline underline-offset-2 decoration-accent/40"
              onClick={(e) => {
                if (tryHandleUrlInternally(seg.value)) e.preventDefault();
              }}
            >
              {seg.display}
            </a>
          );
          break;
        case "mention":
          inlineElements.push(
            <span
              key={i}
              className="text-accent cursor-pointer hover:text-accent-hover"
              onClick={(e) => { e.stopPropagation(); tryOpenNostrEntity(seg.value); }}
            >
              @{seg.display}
            </span>
          );
          break;
        case "hashtag":
          inlineElements.push(
            <span
              key={i}
              className="text-accent/80 cursor-pointer hover:text-accent"
              onClick={(e) => { e.stopPropagation(); openSearch(`#${seg.value}`); }}
            >
              {seg.display}
            </span>
          );
          break;
        default:
          break;
      }
    });
    return (
      <div>
        <div className="note-content text-text text-[13px] break-words whitespace-pre-wrap leading-relaxed">
          {inlineElements}
        </div>
        {/* Images stay inside the clickable area (they have their own stopPropagation) */}
        {images.length > 0 && (
          <div className={`mt-2 ${images.length > 1 ? "grid grid-cols-2 gap-1" : ""}`}>
            {images.map((src, idx) => (
              <img
                key={idx}
                src={src}
                alt=""
                loading="lazy"
                className="max-w-full max-h-80 rounded-sm object-cover bg-bg-raised border border-border cursor-zoom-in"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(idx); }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ))}
          </div>
        )}
        {lightboxIndex !== null && (
          <ImageLightbox
            images={images}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onNavigate={setLightboxIndex}
          />
        )}
      </div>
    );
  }

  // --- Media blocks only (rendered OUTSIDE the clickable wrapper) ---
  if (mediaOnly) {
    const hasMedia = videos.length > 0 || audios.length > 0 || youtubes.length > 0
      || vimeos.length > 0 || spotifys.length > 0 || tidals.length > 0 || quoteIds.length > 0;
    if (!hasMedia) return null;

    return (
      <div onClick={(e) => e.stopPropagation()}>
        {/* Videos */}
        {videos.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {videos.map((src, i) => (
              <video
                key={i}
                src={src}
                controls
                playsInline
                preload="metadata"
                className="max-w-full max-h-80 rounded-sm bg-bg-raised border border-border"
                onError={(e) => { (e.target as HTMLVideoElement).style.display = "none"; }}
              />
            ))}
          </div>
        )}

        {/* Audio */}
        {audios.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {audios.map((src, i) => {
              const filename = src.split("/").pop()?.split("?")[0] ?? src;
              return (
                <div key={i} className="rounded-sm bg-bg-raised border border-border p-2">
                  <div className="text-[11px] text-text-muted mb-1 truncate">{filename}</div>
                  <audio controls preload="metadata" className="w-full h-8" src={src} />
                </div>
              );
            })}
          </div>
        )}

        {/* YouTube — open in browser (WebKitGTK can't play YouTube iframes) */}
        {youtubes.map((seg, i) => (
          <a
            key={`yt-${i}`}
            href={seg.value}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-3 rounded-sm bg-bg-raised border border-border p-3 hover:bg-bg-hover transition-colors cursor-pointer"
          >
            <img
              src={`https://img.youtube.com/vi/${seg.mediaId}/hqdefault.jpg`}
              alt=""
              className="w-28 h-16 rounded-sm object-cover shrink-0"
              loading="lazy"
            />
            <div className="min-w-0">
              <div className="text-[11px] text-text-muted">YouTube</div>
              <div className="text-[12px] text-accent truncate">{seg.value}</div>
            </div>
          </a>
        ))}

        {/* Vimeo — open in browser */}
        {vimeos.map((seg, i) => (
          <a
            key={`vim-${i}`}
            href={seg.value}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-3 rounded-sm bg-bg-raised border border-border p-3 hover:bg-bg-hover transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="white"><polygon points="6,3 17,10 6,17" /></svg>
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-text-muted">Vimeo</div>
              <div className="text-[12px] text-accent truncate">{seg.value}</div>
            </div>
          </a>
        ))}

        {/* Spotify — open in browser/app */}
        {spotifys.map((seg, i) => (
          <a
            key={`sp-${i}`}
            href={seg.value}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-3 rounded-sm bg-bg-raised border border-border p-3 hover:bg-bg-hover transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-[#1DB954]/20 flex items-center justify-center shrink-0">
              <span className="text-[#1DB954] text-lg font-bold">S</span>
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-text-muted">Spotify · {seg.mediaType}</div>
              <div className="text-[12px] text-accent truncate">{seg.value}</div>
            </div>
          </a>
        ))}

        {/* Tidal — open in browser/app */}
        {tidals.map((seg, i) => (
          <a
            key={`td-${i}`}
            href={seg.value}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-3 rounded-sm bg-bg-raised border border-border p-3 hover:bg-bg-hover transition-colors cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <span className="text-white text-lg font-bold">T</span>
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-text-muted">Tidal · {seg.mediaType}</div>
              <div className="text-[12px] text-accent truncate">{seg.value}</div>
            </div>
          </a>
        ))}

        {/* Quoted notes */}
        {quoteIds.map((id) => (
          <QuotePreview key={id} eventId={id} />
        ))}
      </div>
    );
  }

  // --- Default: full render (used in ThreadView, SearchView, etc.) ---
  const inlineElements: ReactNode[] = [];
  segments.forEach((seg, i) => {
    switch (seg.type) {
      case "text":
        inlineElements.push(<span key={i}>{seg.value}</span>);
        break;
      case "link":
        inlineElements.push(
          <a
            key={i}
            href={seg.value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:text-accent-hover underline underline-offset-2 decoration-accent/40"
            onClick={(e) => {
              if (tryHandleUrlInternally(seg.value)) e.preventDefault();
            }}
          >
            {seg.display}
          </a>
        );
        break;
      case "mention":
        inlineElements.push(
          <span
            key={i}
            className="text-accent cursor-pointer hover:text-accent-hover"
            onClick={(e) => { e.stopPropagation(); tryOpenNostrEntity(seg.value); }}
          >
            @{seg.display}
          </span>
        );
        break;
      case "hashtag":
        inlineElements.push(
          <span
            key={i}
            className="text-accent/80 cursor-pointer hover:text-accent"
            onClick={(e) => { e.stopPropagation(); openSearch(`#${seg.value}`); }}
          >
            {seg.display}
          </span>
        );
        break;
      default:
        break;
    }
  });

  return (
    <div>
      <div className="note-content text-text text-[13px] break-words whitespace-pre-wrap leading-relaxed">
        {inlineElements}
      </div>

      {images.length > 0 && (
        <div className={`mt-2 ${images.length > 1 ? "grid grid-cols-2 gap-1" : ""}`}>
          {images.map((src, idx) => (
            <img
              key={idx}
              src={src}
              alt=""
              loading="lazy"
              className="max-w-full max-h-80 rounded-sm object-cover bg-bg-raised border border-border cursor-zoom-in"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(idx); }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <ImageLightbox
          images={images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}

      {videos.length > 0 && (
        <div className="mt-2 flex flex-col gap-2">
          {videos.map((src, i) => (
            <video
              key={i}
              src={src}
              controls
              playsInline
              preload="metadata"
              className="max-w-full max-h-80 rounded-sm bg-bg-raised border border-border"
              onError={(e) => { (e.target as HTMLVideoElement).style.display = "none"; }}
            />
          ))}
        </div>
      )}

      {audios.length > 0 && (
        <div className="mt-2 flex flex-col gap-2">
          {audios.map((src, i) => {
            const filename = src.split("/").pop()?.split("?")[0] ?? src;
            return (
              <div key={i} className="rounded-sm bg-bg-raised border border-border p-2">
                <div className="text-[11px] text-text-muted mb-1 truncate">{filename}</div>
                <audio controls preload="metadata" className="w-full h-8" src={src} />
              </div>
            );
          })}
        </div>
      )}

      {youtubes.map((seg, i) => (
        <a key={`yt-${i}`} href={seg.value} target="_blank" rel="noopener noreferrer"
          className="mt-2 flex items-center gap-3 rounded-sm bg-bg-raised border border-border p-3 hover:bg-bg-hover transition-colors cursor-pointer">
          <img src={`https://img.youtube.com/vi/${seg.mediaId}/hqdefault.jpg`} alt=""
            className="w-28 h-16 rounded-sm object-cover shrink-0" loading="lazy" />
          <div className="min-w-0">
            <div className="text-[11px] text-text-muted">YouTube</div>
            <div className="text-[12px] text-accent truncate">{seg.value}</div>
          </div>
        </a>
      ))}

      {vimeos.map((seg, i) => (
        <a key={`vim-${i}`} href={seg.value} target="_blank" rel="noopener noreferrer"
          className="mt-2 flex items-center gap-3 rounded-sm bg-bg-raised border border-border p-3 hover:bg-bg-hover transition-colors cursor-pointer">
          <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="white"><polygon points="6,3 17,10 6,17" /></svg>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-text-muted">Vimeo</div>
            <div className="text-[12px] text-accent truncate">{seg.value}</div>
          </div>
        </a>
      ))}

      {spotifys.map((seg, i) => (
        <a key={`sp-${i}`} href={seg.value} target="_blank" rel="noopener noreferrer"
          className="mt-2 flex items-center gap-3 rounded-sm bg-bg-raised border border-border p-3 hover:bg-bg-hover transition-colors cursor-pointer">
          <div className="w-10 h-10 rounded-full bg-[#1DB954]/20 flex items-center justify-center shrink-0">
            <span className="text-[#1DB954] text-lg font-bold">S</span>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-text-muted">Spotify · {seg.mediaType}</div>
            <div className="text-[12px] text-accent truncate">{seg.value}</div>
          </div>
        </a>
      ))}

      {tidals.map((seg, i) => (
        <a key={`td-${i}`} href={seg.value} target="_blank" rel="noopener noreferrer"
          className="mt-2 flex items-center gap-3 rounded-sm bg-bg-raised border border-border p-3 hover:bg-bg-hover transition-colors cursor-pointer">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            <span className="text-white text-lg font-bold">T</span>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-text-muted">Tidal · {seg.mediaType}</div>
            <div className="text-[12px] text-accent truncate">{seg.value}</div>
          </div>
        </a>
      ))}

      {quoteIds.map((id) => (
        <QuotePreview key={id} eventId={id} />
      ))}
    </div>
  );
}
