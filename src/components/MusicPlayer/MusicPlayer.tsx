import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, SkipForward, SkipBack, ExternalLink, Rewind, FastForward } from "lucide-react";
import artFallback from "@/assets/art-subspace-theory.jpg";
import SpectrumAnalyzer from "./SpectrumAnalyzer";
import FloodlightSet from "./FloodlightSet";
import Knob from "./Knob";

type Track = {
  title: string;
  art: string;
  permalink_url: string;
};

const SC_BASE = "https://soundcloud.com/subspaceresonance";
const SC_USER_URL = "https://soundcloud.com/subspaceresonance/tracks";

type PlaylistDef = { key: string; label: string; url: string };
const PLAYLIST_DEFS: PlaylistDef[] = [
  { key: "1998-2025", label: "1998-2025", url: "https://soundcloud.com/subspaceresonance/sets/subspace-resonator-1998-2025" },
  { key: "dj-sets", label: "DJ SETS", url: "https://soundcloud.com/subspaceresonance/sets/dj-sets" },
  { key: "geomagnetic", label: "GEOMAGNETIC", url: "https://soundcloud.com/subspaceresonance/sets/geomagnetic-label-group" },
];
const DEFAULT_PLAYLIST_KEY = "1998-2025";
const SC_PLAYLIST_URL = PLAYLIST_DEFS[0].url;

const upgradeArt = (url: string | null | undefined) =>
  url ? url.replace("-large", "-t500x500") : artFallback;

const MusicPlayer = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [activeSource, setActiveSource] = useState<"tracks" | "playlist">("tracks");
  const [activeTab, setActiveTab] = useState<"tracks" | "playlist">("tracks");
  const [playing, setPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [currentPlaylistTrack, setCurrentPlaylistTrack] = useState(0);
  const [progress, setProgress] = useState(0);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [activePlaylistKey, setActivePlaylistKey] = useState<string>(DEFAULT_PLAYLIST_KEY);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistMounted, setPlaylistMounted] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playlistIframeRef = useRef<HTMLIFrameElement>(null);
  const scWidgetRef = useRef<any>(null);
  const scPlaylistWidgetRef = useRef<any>(null);
  const trackIndexMapRef = useRef<number[]>([]);
  const progressInterval = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const getActiveWidget = useCallback(() => {
    return activeSource === "tracks" ? scWidgetRef.current : scPlaylistWidgetRef.current;
  }, [activeSource]);

  const activeSourceRef = useRef(activeSource);
  useEffect(() => { activeSourceRef.current = activeSource; }, [activeSource]);
  const getActiveWidgetRef = () =>
    activeSourceRef.current === "tracks" ? scWidgetRef.current : scPlaylistWidgetRef.current;

  useEffect(() => {
    const widget = getActiveWidget();
    if (playing && widget) {
      progressInterval.current = setInterval(() => {
        widget.getPosition((pos: number) => setPosition(pos));
        widget.getDuration((dur: number) => {
          if (dur > 0) {
            setDuration(dur);
            widget.getPosition((pos: number) => {
              setProgress((pos / dur) * 100);
            });
          }
        });
      }, 500);
    } else {
      if (progressInterval.current) clearInterval(progressInterval.current);
    }
    return () => { if (progressInterval.current) clearInterval(progressInterval.current); };
  }, [playing, currentTrack, currentPlaylistTrack, activeSource, getActiveWidget]);

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const widget = getActiveWidget();
    if (!widget || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    widget.seekTo(pct * duration);
    setProgress(pct * 100);
  };

  useEffect(() => {
    if (document.getElementById("sc-widget-api")) return;
    const script = document.createElement("script");
    script.id = "sc-widget-api";
    script.src = "https://w.soundcloud.com/player/api.js";
    document.body.appendChild(script);
  }, []);

  const embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(SC_USER_URL)}&color=%23007FFF&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=false`;
  const playlistEmbedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(SC_PLAYLIST_URL)}&color=%23007FFF&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=false`;

  const initWidget = useCallback(() => {
    const SC = (window as any).SC;
    if (!SC || !iframeRef.current) return;
    const widget = SC.Widget(iframeRef.current);
    scWidgetRef.current = widget;
    widget.bind(SC.Widget.Events.READY, () => {
      widget.setVolume(volume);
      widget.getSounds((sounds: any[]) => {
        if (sounds && sounds.length) {
          const map: number[] = [];
          const list: Track[] = [];
          sounds.forEach((s, scIdx) => {
            if (!s || !s.title || !s.permalink_url) return;
            if (/return to goa/i.test(s.title)) return;
            if (/old school night/i.test(s.title)) return;
            if (/al\s*titosh|sukkot\s*2024/i.test(s.title)) return;
            map.push(scIdx);
            list.push({
              title: s.title,
              art: upgradeArt(s.artwork_url || s.user?.avatar_url),
              permalink_url: s.permalink_url,
            });
          });
          trackIndexMapRef.current = map;
          if (list.length) setTracks(list);
        }
      });
      widget.bind(SC.Widget.Events.PLAY, () => {
        if (scPlaylistWidgetRef.current) scPlaylistWidgetRef.current.pause();
        setActiveSource("tracks");
        setPlaying(true);
        widget.getCurrentSoundIndex((idx: number) => {
          if (typeof idx !== "number") return;
          const displayIdx = trackIndexMapRef.current.indexOf(idx);
          if (displayIdx === -1) { widget.next(); return; }
          setCurrentTrack(displayIdx);
        });
      });
      widget.bind(SC.Widget.Events.PAUSE, () => {
        if (scWidgetRef.current === getActiveWidgetRef()) setPlaying(false);
      });
      widget.bind(SC.Widget.Events.FINISH, () => widget.next());
    });
  }, [volume]);

  const refillPlaylistTracks = useCallback(() => {
    const widget = scPlaylistWidgetRef.current;
    if (!widget) return;
    setPlaylistLoading(true);
    widget.getSounds((sounds: any[]) => {
      if (sounds && sounds.length) {
        const list: Track[] = sounds
          .filter((s) => s && s.title && s.permalink_url)
          .map((s) => ({
            title: s.title,
            art: upgradeArt(s.artwork_url || s.user?.avatar_url),
            permalink_url: s.permalink_url,
          }));
        setPlaylistTracks(list);
      } else {
        setPlaylistTracks([]);
      }
      setPlaylistLoading(false);
    });
  }, []);

  const initPlaylistWidget = useCallback(() => {
    const SC = (window as any).SC;
    if (!SC || !playlistIframeRef.current) return;
    const widget = SC.Widget(playlistIframeRef.current);
    scPlaylistWidgetRef.current = widget;
    widget.bind(SC.Widget.Events.READY, () => {
      widget.setVolume(volume);
      refillPlaylistTracks();
      widget.bind(SC.Widget.Events.PLAY, () => {
        if (scWidgetRef.current) scWidgetRef.current.pause();
        setActiveSource("playlist");
        setPlaying(true);
        widget.getCurrentSoundIndex((idx: number) => {
          if (typeof idx === "number") setCurrentPlaylistTrack(idx);
        });
      });
      widget.bind(SC.Widget.Events.PAUSE, () => {
        if (scPlaylistWidgetRef.current === getActiveWidgetRef()) setPlaying(false);
      });
      widget.bind(SC.Widget.Events.FINISH, () => widget.next());
    });
  }, [volume, refillPlaylistTracks]);

  const switchPlaylist = useCallback((key: string) => {
    if (key === activePlaylistKey) return;
    const def = PLAYLIST_DEFS.find((p) => p.key === key);
    if (!def) return;
    setActivePlaylistKey(key);
    setCurrentPlaylistTrack(0);
    setPlaylistTracks([]);
    setPlaylistLoading(true);
    if (scPlaylistWidgetRef.current) scPlaylistWidgetRef.current.pause();
    if (activeSource === "playlist") setPlaying(false);
    const widget = scPlaylistWidgetRef.current;
    if (!widget) return;
    widget.load(def.url, {
      auto_play: false,
      callback: () => {
        widget.setVolume(volume);
        refillPlaylistTracks();
      },
    });
  }, [activePlaylistKey, activeSource, volume, refillPlaylistTracks]);

  const scPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scPlaylistPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (scPollRef.current) clearInterval(scPollRef.current);
      if (scPlaylistPollRef.current) clearInterval(scPlaylistPollRef.current);
    };
  }, []);

  const handleIframeLoad = useCallback(() => {
    if ((window as any).SC) { initWidget(); }
    else {
      scPollRef.current = setInterval(() => {
        if ((window as any).SC) {
          clearInterval(scPollRef.current!);
          scPollRef.current = null;
          initWidget();
        }
      }, 200);
    }
  }, [initWidget]);

  const handlePlaylistIframeLoad = useCallback(() => {
    if ((window as any).SC) { initPlaylistWidget(); }
    else {
      scPlaylistPollRef.current = setInterval(() => {
        if ((window as any).SC) {
          clearInterval(scPlaylistPollRef.current!);
          scPlaylistPollRef.current = null;
          initPlaylistWidget();
        }
      }, 200);
    }
  }, [initPlaylistWidget]);

  const togglePlay = useCallback(() => {
    const widget = getActiveWidget();
    if (!widget) return;
    if (playing) widget.pause(); else widget.play();
  }, [playing, getActiveWidget]);

  const selectTrack = useCallback((index: number) => {
    setCurrentTrack(index);
    setActiveSource("tracks");
    if (scPlaylistWidgetRef.current) scPlaylistWidgetRef.current.pause();
    if (scWidgetRef.current) {
      const scIdx = trackIndexMapRef.current[index] ?? index;
      scWidgetRef.current.skip(scIdx);
      scWidgetRef.current.play();
    }
    setPlaying(true);
  }, []);

  const selectPlaylistTrack = useCallback((index: number) => {
    setCurrentPlaylistTrack(index);
    setActiveSource("playlist");
    if (scWidgetRef.current) scWidgetRef.current.pause();
    if (scPlaylistWidgetRef.current) {
      scPlaylistWidgetRef.current.skip(index);
      scPlaylistWidgetRef.current.play();
    }
    setPlaying(true);
  }, []);

  const nextTrack = useCallback(() => {
    const widget = getActiveWidget();
    if (widget) widget.next();
    setPlaying(true);
  }, [getActiveWidget]);

  const prevTrack = useCallback(() => {
    const widget = getActiveWidget();
    if (widget) widget.prev();
    setPlaying(true);
  }, [getActiveWidget]);

  const seekBy = useCallback((seconds: number) => {
    const widget = getActiveWidget();
    if (!widget) return;
    widget.getPosition((pos: number) => {
      widget.seekTo(Math.max(0, pos + seconds * 1000));
    });
  }, [getActiveWidget]);

  const handleVolumeChange = useCallback((v: number) => {
    setVolume(v);
    if (scWidgetRef.current) scWidgetRef.current.setVolume(v);
    if (scPlaylistWidgetRef.current) scPlaylistWidgetRef.current.setVolume(v);
  }, []);

  const transportBtnStyle = { background: "linear-gradient(180deg, hsl(0,0%,14%), hsl(0,0%,6%))" };
  const currentList = activeSource === "tracks" ? tracks : playlistTracks;
  const currentIdx = activeSource === "tracks" ? currentTrack : currentPlaylistTrack;
  const current: Track = currentList[currentIdx] || { title: "LOADING TRANSMISSION…", art: artFallback, permalink_url: SC_BASE };

  return (
    <>
      <iframe ref={iframeRef} src={embedUrl} onLoad={handleIframeLoad}
        width="0" height="0" allow="autoplay" className="hidden" title="SoundCloud Player" />
      {playlistMounted && (
        <iframe ref={playlistIframeRef} src={playlistEmbedUrl} onLoad={handlePlaylistIframeLoad}
          width="0" height="0" allow="autoplay" className="hidden" title="SoundCloud Playlist Player" />
      )}

      {/* Track List */}
      <section id="music" className="pt-2 pb-8 sm:pt-4 sm:pb-12">
        <div className="container px-4 sm:px-6">
          <h2 className="text-xs tracking-[0.3em] text-primary mb-4 sm:mb-6 uppercase">
            // MUSIC ARCHIVE
          </h2>

          {/* Tab strip */}
          <div className="flex border border-border border-b-0">
            {([
              { key: "tracks" as const, label: "TRACKS" },
              { key: "playlist" as const, label: "PLAYLISTS" },
            ]).map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button key={tab.key} onClick={() => {
                  setActiveTab(tab.key);
                  if (tab.key === "playlist") setPlaylistMounted(true);
                }}
                  className={`px-4 py-2 text-[10px] sm:text-xs tracking-[0.25em] uppercase border-r border-border last:border-r-0 transition-colors min-h-[44px] ${
                    isActive ? "text-primary bg-secondary/40" : "text-muted-foreground hover:text-primary"
                  }`}
                  style={{ borderBottom: isActive ? "2px solid hsl(var(--primary))" : "2px solid transparent" }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === "playlist" && (
            <div className="flex border-x border-border overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {PLAYLIST_DEFS.map((p) => {
                const isActive = activePlaylistKey === p.key;
                return (
                  <button key={p.key} onClick={() => switchPlaylist(p.key)}
                    className={`shrink-0 px-3 py-2 text-[10px] tracking-[0.2em] uppercase border-r border-border last:border-r-0 transition-colors min-h-[40px] ${
                      isActive ? "text-primary bg-secondary/40" : "text-muted-foreground hover:text-primary"
                    }`}
                    style={{ borderBottom: isActive ? "1px solid hsl(var(--primary))" : "1px solid transparent" }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="section-border overflow-hidden border-t-0">
            <div className="overflow-y-auto" style={{ maxHeight: "calc(5 * 56px)", scrollbarWidth: "thin", scrollbarColor: "hsl(var(--primary)) transparent" }}>
              {(() => {
                const list = activeTab === "tracks" ? tracks : playlistTracks;
                const idx = activeTab === "tracks" ? currentTrack : currentPlaylistTrack;
                const isActiveSource = activeSource === activeTab;
                const onSelect = activeTab === "tracks" ? selectTrack : selectPlaylistTrack;
                const isPlaylistTab = activeTab === "playlist";

                if (list.length === 0) {
                  return (
                    <div className="flex items-center justify-center h-[56px] text-[10px] text-muted-foreground tracking-[0.25em] uppercase">
                      {isPlaylistTab && !playlistLoading ? "EMPTY PLAYLIST" : "LOADING…"}
                    </div>
                  );
                }

                return list.map((track, i) => {
                  const isCurrent = i === idx && isActiveSource;
                  return (
                    <button key={i} onClick={() => onSelect(i)}
                      className={`w-full flex items-center justify-between p-2 sm:p-3 border-b border-border last:border-b-0 h-[56px] cursor-pointer transition-colors hover:bg-secondary text-left ${
                        isCurrent ? "text-primary bg-secondary/50" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                        <div className="relative w-8 h-8 sm:w-9 sm:h-9 shrink-0 border border-border overflow-hidden" style={{ background: "hsl(0,0%,4%)" }}>
                          <img src={track.art} alt={track.title}
                            className={`w-full h-full object-cover transition-all duration-300 ${isCurrent ? "opacity-100" : "opacity-50 grayscale"}`}
                          />
                          {isCurrent && playing && (
                            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "hsl(210 100% 50% / 0.15)" }}>
                              <div className="flex gap-[2px] items-end h-3">
                                {[0, 1, 2].map(b => (
                                  <div key={b} className="w-[2px] bg-primary"
                                    style={{ animation: `eq-bar 0.${4 + b * 2}s ease-in-out infinite alternate`, height: `${6 + b * 3}px` }}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs sm:text-sm truncate block">{track.title}</span>
                        </div>
                      </div>
                    </button>
                  );
                });
              })()}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            {[
              { label: "FULL PLAYLIST ON SOUNDCLOUD", url: (PLAYLIST_DEFS.find(p => p.key === activePlaylistKey) || PLAYLIST_DEFS[0]).url },
              { label: "BANDCAMP", url: "https://yannig.bandcamp.com/" },
              { label: "YOUTUBE", url: "https://www.youtube.com/@SubspaceResonator" },
              { label: "SPOTIFY", url: "https://open.spotify.com/artist/0UQWUdUuQ3NhMCACj4UXlk" },
              { label: "DISCOGS", url: "https://www.discogs.com/artist/15101171-Subspace-Resonator" },
            ].map(link => (
              <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[10px] sm:text-xs text-primary hover:text-primary/80 transition-colors min-h-[44px]"
              >
                <ExternalLink size={14} />
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Desktop/Tablet: Vintage Hi-Fi Rack Player */}
      <div className="fixed bottom-0 left-0 right-0 z-40 hidden md:block">
        <div style={{ background: "linear-gradient(180deg, hsl(0,0%,10%) 0%, hsl(0,0%,4%) 40%, hsl(0,0%,2%) 100%)", borderTop: "2px solid hsl(0,0%,20%)" }}>
          <div className="h-1" style={{ background: "linear-gradient(90deg, hsl(0,0%,25%), hsl(0,0%,40%), hsl(0,0%,25%))" }} />

          <div className="container flex items-center gap-2 lg:gap-4 py-2 lg:py-3">
            {/* Transport */}
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={prevTrack} className="min-w-[34px] min-h-[34px] lg:min-w-[40px] lg:min-h-[40px] flex items-center justify-center border border-border hover:border-primary hover:text-primary transition-colors" style={transportBtnStyle} aria-label="Previous track"><SkipBack size={14} /></button>
              <button onClick={() => seekBy(-10)} className="hidden lg:flex min-w-[36px] min-h-[36px] items-center justify-center border border-border hover:border-primary hover:text-primary transition-colors" style={transportBtnStyle} aria-label="Rewind 10s"><Rewind size={12} /></button>
              <button onClick={togglePlay} className="min-w-[40px] min-h-[40px] lg:min-w-[48px] lg:min-h-[48px] flex items-center justify-center border-2 border-border hover:border-primary hover:text-primary transition-colors"
                style={{ background: playing ? "linear-gradient(180deg, hsl(210,100%,15%), hsl(210,100%,8%))" : "linear-gradient(180deg, hsl(0,0%,14%), hsl(0,0%,6%))", boxShadow: playing ? "inset 0 0 12px hsl(210 100% 50% / 0.15)" : "none" }}
                aria-label={playing ? "Pause" : "Play"}>
                {playing ? <Pause size={16} className="lg:w-[18px] lg:h-[18px]" /> : <Play size={16} className="lg:w-[18px] lg:h-[18px]" />}
              </button>
              <button onClick={() => seekBy(10)} className="hidden lg:flex min-w-[36px] min-h-[36px] items-center justify-center border border-border hover:border-primary hover:text-primary transition-colors" style={transportBtnStyle} aria-label="Forward 10s"><FastForward size={12} /></button>
              <button onClick={nextTrack} className="min-w-[34px] min-h-[34px] lg:min-w-[40px] lg:min-h-[40px] flex items-center justify-center border border-border hover:border-primary hover:text-primary transition-colors" style={transportBtnStyle} aria-label="Next track"><SkipForward size={14} /></button>
            </div>

            <div className="hidden lg:block shrink-0"><FloodlightSet playing={playing} side="left" /></div>

            {/* Track info — fills available space */}
            <div className="flex items-center gap-2 lg:gap-3 flex-1 min-w-0">
              <a href={current.permalink_url} target="_blank" rel="noopener noreferrer"
                className="relative shrink-0 border border-border hover:border-primary transition-all group overflow-hidden"
                style={{ width: 44, height: 44 }} aria-label="View on SoundCloud">
                <img src={current.art} alt={current.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 pointer-events-none" style={{ background: playing ? "linear-gradient(135deg, hsl(210 100% 50% / 0.12), hsl(210 100% 50% / 0.04))" : "hsl(0 0% 0% / 0.3)" }} />
              </a>
              <div className="min-w-0 border border-border p-2 flex-1" style={{ background: "hsl(0,0%,2%)" }}>
                <p className="text-[10px] lg:text-xs text-primary truncate font-medium tracking-wider">{current.title}</p>
                <p className="text-[10px] text-muted-foreground tracking-[0.2em] mt-1">SUBSPACE RESONATOR</p>
                <div className="mt-1.5">
                  <div className="w-full h-[3px] bg-border cursor-pointer relative group" onClick={handleProgressClick}>
                    <div className="absolute left-0 top-0 h-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
                    <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `${progress}%`, transform: "translateX(-50%) translateY(-50%)" }} />
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[10px] text-muted-foreground tracking-widest">{formatTime(position)}</span>
                    <span className="text-[10px] text-muted-foreground tracking-widest">{duration > 0 ? formatTime(duration) : "--:--"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden lg:block shrink-0"><FloodlightSet playing={playing} side="right" /></div>

            {/* Channel strip — spectrum only on lg+, knob always */}
            <div className="flex items-center shrink-0"
              style={{ background: "linear-gradient(180deg, hsl(0,0%,6%) 0%, hsl(0,0%,3%) 50%, hsl(0,0%,5%) 100%)", border: "1px solid hsl(0,0%,12%)", boxShadow: "inset 0 1px 3px hsl(0,0%,0%/0.6)", padding: "4px 3px", gap: "2px" }}>
              <div className="hidden lg:flex items-center justify-center shrink-0"
                style={{ width: 28, height: "100%", minHeight: 60, background: "linear-gradient(180deg, hsl(0,0%,8%), hsl(0,0%,4%))", borderRight: "1px solid hsl(0,0%,12%)" }}>
                <span style={{ fontSize: "10px", color: "hsl(0,0%,30%)", fontFamily: "monospace", letterSpacing: "0.05em" }}>1/0</span>
              </div>

              {/* Spectrum analyzers — lg+ only */}
              {["CH-L", "CH-R"].map((label) => (
                <div key={label} className="hidden lg:flex flex-col items-center"
                  style={{ background: "hsl(0,0%,2%)", padding: "3px 4px 2px" }}>
                  <SpectrumAnalyzer playing={playing} label={label} trackIndex={currentTrack} volume={volume} />
                  <div className="w-full mt-1 flex items-center justify-center"
                    style={{ background: "linear-gradient(180deg, hsl(0,0%,7%), hsl(0,0%,4%))", border: "1px solid hsl(0,0%,10%)", padding: "2px 6px" }}>
                    <span style={{ fontSize: "10px", color: "hsl(0,0%,35%)", fontFamily: "monospace", letterSpacing: "0.2em", textTransform: "uppercase" }}>{label}</span>
                  </div>
                </div>
              ))}

              {/* VOL knob — always visible, compact at md */}
              <div className="flex flex-col items-center" style={{ background: "hsl(0,0%,2%)", padding: "3px 4px 2px", borderLeft: "1px solid hsl(0,0%,10%)" }}>
                <Knob label="" value={volume} onChange={handleVolumeChange} ariaLabel="Volume" />
                <div className="w-full mt-1 flex items-center justify-center"
                  style={{ background: "linear-gradient(180deg, hsl(0,0%,7%), hsl(0,0%,4%))", border: "1px solid hsl(0,0%,10%)", padding: "2px 6px" }}>
                  <span style={{ fontSize: "10px", color: "hsl(0,0%,35%)", fontFamily: "monospace", letterSpacing: "0.2em", textTransform: "uppercase" }}>VOL</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile bottom bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40"
        style={{ background: "linear-gradient(180deg, hsl(0,0%,8%), hsl(0,0%,3%))", borderTop: "1px solid hsl(0,0%,18%)" }}>
        {/* Progress bar — full width, tappable to seek */}
        <div className="w-full h-[3px] bg-border cursor-pointer relative" onClick={handleProgressClick}
          role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
          <div className="absolute left-0 top-0 h-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        {/* Controls */}
        <div className="flex items-center gap-0.5 px-3"
          style={{ minHeight: 68, paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}>
          <img src={current.art} alt={current.title} className="w-8 h-8 object-cover border border-border shrink-0" />
          <div className="flex-1 min-w-0 px-1">
            <p className="text-[10px] text-primary truncate font-medium">{current.title}</p>
            <p className="text-[10px] text-muted-foreground tracking-widest truncate">SUBSPACE RESONATOR</p>
          </div>
          <button onClick={() => seekBy(-10)} className="w-11 h-11 flex items-center justify-center border border-border hover:border-primary hover:text-primary transition-colors shrink-0"
            style={transportBtnStyle} aria-label="Rewind 10 seconds">
            <Rewind size={12} />
          </button>
          <button onClick={prevTrack} className="w-11 h-11 flex items-center justify-center border border-border hover:border-primary hover:text-primary transition-colors shrink-0"
            style={transportBtnStyle} aria-label="Previous track">
            <SkipBack size={13} />
          </button>
          <button onClick={togglePlay} className="w-11 h-11 flex items-center justify-center border-2 border-border hover:border-primary hover:text-primary transition-colors shrink-0"
            style={{ background: playing ? "linear-gradient(180deg, hsl(210,100%,15%), hsl(210,100%,8%))" : "linear-gradient(180deg, hsl(0,0%,14%), hsl(0,0%,6%))", boxShadow: playing ? "inset 0 0 12px hsl(210 100% 50% / 0.15)" : "none" }}
            aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button onClick={nextTrack} className="w-11 h-11 flex items-center justify-center border border-border hover:border-primary hover:text-primary transition-colors shrink-0"
            style={transportBtnStyle} aria-label="Next track">
            <SkipForward size={13} />
          </button>
          <button onClick={() => seekBy(10)} className="w-11 h-11 flex items-center justify-center border border-border hover:border-primary hover:text-primary transition-colors shrink-0"
            style={transportBtnStyle} aria-label="Forward 10 seconds">
            <FastForward size={12} />
          </button>
        </div>
      </div>
    </>
  );
};

export default MusicPlayer;
