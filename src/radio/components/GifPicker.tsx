import { useEffect, useRef, useState } from 'react';

export interface GifResult {
  id: string;
  url: string;     // tinygif — the posted image
  preview: string; // nanogif — the picker thumbnail
  alt: string;
}

interface GifPickerProps {
  onPick: (gif: GifResult) => void;
}

// Searches the server-side Tenor proxy (/api/tenor-search). Debounced 300ms so keystrokes
// don't fire a request burst; only nanogif thumbnails load in the grid (bandwidth cap so
// GIF traffic never competes with the audio stream).
export function GifPicker({ onPick }: GifPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tenor-search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { results?: GifResult[] };
        setResults(data.results ?? []);
      } catch {
        if (!ctrl.signal.aborted) setResults([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query]);

  return (
    <div
      role="dialog"
      aria-label="GIF picker"
      className="absolute bottom-full left-0 mb-2 z-20 w-[300px] bg-[#12001f] border border-[#333] rounded-lg p-2 shadow-xl"
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search GIFs..."
        aria-label="Search GIFs"
        className="w-full bg-[#1a0030] border border-[#333] text-white text-sm px-2 py-1.5 rounded mb-2 focus:outline-none focus:ring-1 focus:ring-[#7B2FBE] placeholder:text-[#555]"
      />
      <div className="grid grid-cols-3 gap-1 max-h-[220px] overflow-y-auto">
        {results.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => onPick(g)}
            aria-label={g.alt}
            className="aspect-square overflow-hidden rounded hover:ring-2 hover:ring-[#7B2FBE]"
          >
            <img src={g.preview} alt={g.alt} loading="lazy" decoding="async" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      {loading && <p className="text-[#888] text-[11px] mt-1">Searching...</p>}
      {!loading && query.trim() && results.length === 0 && (
        <p className="text-[#888] text-[11px] mt-1">No GIFs found.</p>
      )}
      <p className="text-[#555] text-[9px] mt-1 text-right">via Tenor</p>
    </div>
  );
}
