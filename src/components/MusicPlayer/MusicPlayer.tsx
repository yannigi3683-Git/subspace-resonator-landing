import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, Music2, Video } from 'lucide-react';
import SpectrumAnalyzer from './SpectrumAnalyzer';
import FloodlightSet from './FloodlightSet';
import Knob from './Knob';
import artFallback from '../../assets/art-subspace-theory.jpg';

const FILTER_PATTERNS = [
  /return to goa/i,
  /old school night/i,
  /al\s*titosh|sukkot\s*2024/i,
];

const ALL_TRACKS = [
  { id: '1', title: 'Subspace Resonator', artist: 'Subspace Resonator', url: 'https://soundcloud.com/subspaceresonance/subspace-resonator' },
  { id: '2', title: 'Goa Frequency', artist: 'Subspace Resonator', url: 'https://soundcloud.com/subspaceresonance' },
  { id: '3', title: 'Psychedelic Signal', artist: 'Subspace Resonator', url: 'https://soundcloud.com/subspaceresonance' },
];

const TRACKS = ALL_TRACKS.filter((t) => !FILTER_PATTERNS.some((p) => p.test(t.title)));

const PLAYLIST_DEFS = [
  { key: '1998-2025',   label: '1998-2025',   url: 'https://soundcloud.com/subspaceresonance/sets/subspace-resonator-1998-2025' },
  { key: 'dj-sets',     label: 'DJ SETS',     url: 'https://soundcloud.com/subspaceresonance/sets/dj-sets' },
  { key: 'geomagnetic', label: 'GEOMAGNETIC', url: 'https://soundcloud.com/subspaceresonance/sets/geomagnetic-label-group' },
];

const EXTERNAL_LINKS = [
  { label: 'SoundCloud', url: 'https://soundcloud.com/subspaceresonance',                    icon: <Music2 size={12} /> },
  { label: 'Bandcamp',   url: 'https://yannig.bandcamp.com/',                                icon: <Music2 size={12} /> },
  { label: 'YouTube',    url: 'https://www.youtube.com/@SubspaceResonator',                  icon: <Video size={12} /> },
  { label: 'Spotify',    url: 'https://open.spotify.com/artist/0UQWUdUuQ3NhMCACj4UXlk',     icon: <Music2 size={12} /> },
];

export default function MusicPlayer() {
  const [playing, setPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<'tracks' | 'playlists'>('tracks');
  const [trackIndex, setTrackIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(80);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval>>();

  const currentTrack = TRACKS[trackIndex];

  const togglePlay = useCallback(() => setPlaying((v) => !v), []);

  const prevTrack = useCallback(() => {
    setTrackIndex((i) => (i - 1 + TRACKS.length) % TRACKS.length);
    setProgress(0);
  }, []);

  const nextTrack = useCallback(() => {
    setTrackIndex((i) => (i + 1) % TRACKS.length);
    setProgress(0);
  }, []);

  const handleProgressKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); setProgress((p) => Math.min(100, p + 5)); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); setProgress((p) => Math.max(0, p - 5)); }
  }, []);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setProgress(((e.clientX - rect.left) / rect.width) * 100);
  }, []);

  useEffect(() => {
    if (playing) {
      progressIntervalRef.current = setInterval(() => {
        setProgress((p) => (p >= 100 ? 0 : p + 0.1));
      }, 100);
    } else {
      clearInterval(progressIntervalRef.current);
    }
    return () => clearInterval(progressIntervalRef.current);
  }, [playing]);

  return (
    <section id="music">
      {/* Hidden SoundCloud iframe */}
      <iframe
        src="https://soundcloud.com/subspaceresonance/tracks"
        className="hidden"
        title="SoundCloud tracks"
        allow="autoplay"
      />

      {/* Mobile: fixed bottom bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 w-full bg-card border-t border-border flex items-center px-3 gap-3">
        <img
          src={artFallback}
          alt={currentTrack?.title ?? ''}
          className="w-10 h-10 rounded-sm object-cover flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">{currentTrack?.title}</p>
          <p className="text-xs text-muted-foreground">{currentTrack?.artist}</p>
        </div>
        <button
          onClick={togglePlay}
          className="w-11 h-11 flex items-center justify-center text-primary hover:text-primary/80 transition-colors"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={20} /> : <Play size={20} />}
        </button>
      </div>

      {/* Desktop: full player */}
      <div className="hidden md:block container py-8">
        <p className="text-xs font-mono tracking-widest text-primary mb-6">// SIGNAL SOURCE</p>

        <div className="flex gap-6 items-stretch min-h-[200px] p-6 border border-border bg-card">
          {/* Left: FloodlightSet */}
          <div className="w-48 flex items-end">
            <FloodlightSet />
          </div>

          {/* Center: Analyzer + transport */}
          <div className="flex-1 flex flex-col justify-between">
            <div className="h-16">
              <SpectrumAnalyzer />
            </div>

            {/* Progress bar */}
            <div
              role="slider"
              tabIndex={0}
              aria-label="Track progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
              className="w-full h-1 bg-muted rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary my-4"
              onKeyDown={handleProgressKey}
              onClick={handleProgressClick}
            >
              <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
            </div>

            {/* Transport controls */}
            <div className="flex items-center gap-4">
              <button onClick={prevTrack} aria-label="Previous track" className="text-muted-foreground hover:text-primary transition-colors">
                <SkipBack size={18} />
              </button>
              <button
                onClick={togglePlay}
                aria-label={playing ? 'Pause' : 'Play'}
                className="w-11 h-11 flex items-center justify-center border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors rounded-full"
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button onClick={nextTrack} aria-label="Next track" className="text-muted-foreground hover:text-primary transition-colors">
                <SkipForward size={18} />
              </button>
              <p className="text-xs text-muted-foreground ml-2 truncate flex-1">
                {currentTrack?.title}
              </p>
            </div>
          </div>

          {/* Right: tab switcher + track list + knob */}
          <div className="w-64 flex flex-col">
            <div role="tablist" className="flex gap-1 mb-3">
              {(['tracks', 'playlists'] as const).map((tab) => (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-xs tracking-widest uppercase px-3 py-1 transition-colors ${
                    activeTab === tab
                      ? 'text-primary border-b border-primary'
                      : 'text-muted-foreground hover:text-primary'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto space-y-1">
              {activeTab === 'tracks'
                ? TRACKS.map((t, i) => (
                    <button
                      key={t.id}
                      onClick={() => { setTrackIndex(i); setProgress(0); }}
                      className={`w-full text-left text-xs px-2 py-2 truncate hover:text-primary transition-colors ${
                        i === trackIndex ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      {t.title}
                    </button>
                  ))
                : PLAYLIST_DEFS.map((pl) => (
                    <a
                      key={pl.key}
                      href={pl.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs px-2 py-2 text-muted-foreground hover:text-primary transition-colors"
                    >
                      {pl.label}
                    </a>
                  ))}
            </div>

            <div className="flex justify-end mt-3">
              <Knob value={volume} onChange={setVolume} label="Volume" />
            </div>
          </div>
        </div>

        {/* External streaming links */}
        <div className="flex flex-wrap gap-4 mt-4">
          {EXTERNAL_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.label}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              {link.icon}
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
