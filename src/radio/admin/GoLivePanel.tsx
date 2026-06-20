import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { SkipBack, SkipForward, Play, Pause, Rewind, FastForward } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { HostMixer, type MixerAnalysis } from '../rtc/hostMixer';
import { LocalDeck, type DeckTrack } from '../rtc/localDeck';
import { Publisher } from '../rtc/publisher';
import { transition, initialState, type FsmState, type ConnectionEvent } from '../rtc/connectionFsm';
import { shouldStartCrossfade } from '../rtc/crossfade';
import { QUALITY_PRESETS, QUALITY_LABELS, type QualityKey } from '../rtc/audioQuality';
import { formatClock } from '../format';
import { useStation } from '../hooks/useStation';

export type BroadcastStatus = 'idle' | 'starting' | 'live' | 'ending' | 'error';

interface Props {
  supabase: SupabaseClient;
  authToken: () => Promise<string>;
  listenerCount?: number;
  // Lifts broadcast status to the parent so a persistent ON AIR / OFF AIR indicator
  // can show on every tab (the panel itself is hidden when another tab is active).
  onStatusChange?: (status: BroadcastStatus) => void;
}

interface AudioDevice {
  deviceId: string;
  label: string;
}

export default function GoLivePanel({ supabase, authToken, listenerCount = 0, onStatusChange }: Props) {
  const [status, setStatus] = useState<BroadcastStatus>('idle');
  const [title, setTitle] = useState('');
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [deviceGain, setDeviceGain] = useState(1);
  const [fileGain, setFileGain] = useState(1);
  const [queue, setQueue] = useState<DeckTrack[]>([]);
  const [currentTrackName, setCurrentTrackName] = useState('');
  const [currentTrackId, setCurrentTrackId] = useState('');
  const [filePlaying, setFilePlaying] = useState(false);
  const [autoMix, setAutoMix] = useState(true);
  const [crossfadeSec, setCrossfadeSec] = useState(6);
  const [quality, setQuality] = useState<QualityKey>('hq');
  const [autoPilot, setAutoPilot] = useState(true);
  const [stereoMode, setStereoMode] = useState(true);
  const [bufferSec, setBufferSec] = useState(1.5);
  const [currentBitrate, setCurrentBitrate] = useState(0);
  const [position, setPosition] = useState<{ cur: number; dur: number }>({ cur: 0, dur: 0 });
  const [deviceConnected, setDeviceConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  // Browsers hide audio-input device names until microphone permission is granted,
  // so the dropdown is empty until the host unlocks access once.
  const [audioReady, setAudioReady] = useState(false);
  const [requestingAccess, setRequestingAccess] = useState(false);

  const mixerRef = useRef<HostMixer | null>(null);
  const publisherRef = useRef<Publisher | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const deckRef = useRef<LocalDeck>(new LocalDeck());
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const fsmRef = useRef<FsmState>(initialState());
  const titleRef = useRef('');
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deviceSourceIdRef = useRef<string | null>(null);
  const fileSourceIdRef = useRef<string | null>(null);
  const micSourceIdRef = useRef<string | null>(null);
  // Auto-mix uses a second "deck" element/source, created lazily on the first crossfade.
  // audioElRef/fileSourceIdRef always point at the ACTIVE deck; alt* is the incoming deck.
  const altElRef = useRef<HTMLAudioElement | null>(null);
  const altIdRef = useRef<string | null>(null);
  const crossfadingRef = useRef(false);
  const crossfadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirror gain/auto-mix state into refs so the audio element's persistent event handlers
  // (set once at GO LIVE) always read the latest values.
  // Control channel to listeners (jitter buffer setting; now-playing later). Re-broadcast on
  // an interval so late joiners pick up the current buffer.
  const npChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const npLastSentRef = useRef(0);
  const controlHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bufferSecRef = useRef(1.5);
  bufferSecRef.current = bufferSec;
  const autoMixRef = useRef(false);
  autoMixRef.current = autoMix;
  const crossfadeRef = useRef(6);
  crossfadeRef.current = crossfadeSec;
  const fileGainRef = useRef(1);
  fileGainRef.current = fileGain;
  // Cached for the pagehide beacon: the unload handler must build the request synchronously,
  // so the auth token is captured at GO LIVE time rather than awaited during unload.
  const tokenRef = useRef('');
  const statusRef = useRef<BroadcastStatus>('idle');
  statusRef.current = status;

  // The DB station row. Used only to detect a station left 'live' by a previous session
  // (e.g. the host pressed F5 mid-broadcast, which kills the connection but not the DB flag).
  const station = useStation(supabase);
  const orphanedLive = status === 'idle' && station?.mode === 'live';

  // Read audio inputs. Before mic permission, entries have a deviceId but a blank label;
  // returns true if at least one device has a real (non-empty) label.
  const refreshDevices = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices?.enumerateDevices) return false;
    const infos = await navigator.mediaDevices.enumerateDevices();
    const audioIn = infos
      .filter((d) => d.kind === 'audioinput' && d.deviceId)
      .map((d) => ({ deviceId: d.deviceId, label: d.label || 'Microphone' }));
    setDevices(audioIn);
    setSelectedDeviceId((prev) => prev || (audioIn[0]?.deviceId ?? ''));
    return infos.some((d) => d.kind === 'audioinput' && d.label !== '');
  }, []);

  async function requestAudioAccess() {
    setRequestingAccess(true);
    setErrorMsg('');
    try {
      // One getUserMedia call grants permission, which unlocks the real device names.
      const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of tmp.getTracks()) track.stop();
      await refreshDevices();
      setAudioReady(true);
    } catch {
      setErrorMsg('Microphone access was blocked. Allow it in your browser, then try again.');
    } finally {
      setRequestingAccess(false);
    }
  }

  useEffect(() => {
    audioElRef.current = new Audio();
    // navigator.mediaDevices is undefined in non-secure contexts / some embedded views;
    // guard so a missing API doesn't crash the whole console.
    if (!navigator.mediaDevices?.enumerateDevices) return;
    refreshDevices().then((labelled) => setAudioReady(labelled)).catch(() => {});
    const onChange = () => { refreshDevices().catch(() => {}); };
    navigator.mediaDevices.addEventListener?.('devicechange', onChange);
    return () => navigator.mediaDevices.removeEventListener?.('devicechange', onChange);
  }, [refreshDevices]);

  // Mirror status up to the parent (AdminConsole) for the cross-tab live indicator.
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;
  useEffect(() => { onStatusChangeRef.current?.(status); }, [status]);

  // A page reload/close (F5, tab close) destroys the WebRTC connection but leaves the DB
  // station 'live', stranding listeners on a silent room. Best-effort take it off air on
  // unload. keepalive lets the request outlive the page; the token is pre-cached because the
  // handler can't await during unload. If this misses, the recovery banner is the backstop.
  useEffect(() => {
    const handler = () => {
      const s = statusRef.current;
      if ((s === 'live' || s === 'starting') && tokenRef.current) {
        fetch('/api/rtc-session', {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenRef.current}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ phase: 'end-broadcast' }),
          keepalive: true,
        }).catch(() => {});
      }
    };
    window.addEventListener('pagehide', handler);
    return () => window.removeEventListener('pagehide', handler);
  }, []);

  const dispatchFsm = useCallback((event: ConnectionEvent) => {
    const { next, effects } = transition(fsmRef.current, event);
    fsmRef.current = next;
    // Retry budget exhausted: stop showing CONNECTING forever — surface a real error
    // so the host can act instead of staring at a spinner.
    if (next.status === 'lost') {
      setStatus('error');
      setErrorMsg('Connection lost. Check your network and press GO LIVE to try again.');
    }
    for (const effect of effects) {
      if (effect.type === 'SCHEDULE_RETRY') {
        retryTimerRef.current = setTimeout(
          () => dispatchFsm({ type: 'RETRY_TIMER_FIRED' }),
          effect.delayMs,
        );
      } else if (effect.type === 'CANCEL_RETRY') {
        if (retryTimerRef.current !== null) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
      } else if (effect.type === 'CONNECT_RTC') {
        reconnectPublisher().catch(() => dispatchFsm({ type: 'ERROR' }));
      } else if (effect.type === 'DISCONNECT_RTC') {
        publisherRef.current?.disconnect();
      }
    }
  }, []);

  async function reconnectPublisher() {
    const stream = streamRef.current;
    const publisher = publisherRef.current;
    if (!stream || !publisher) return;
    await publisher.connect(stream, titleRef.current);
  }

  // Tear down the audio graph after a failed/ended session so a retry starts clean.
  // A leaked AudioContext (and its file source node) is what makes the second GO LIVE
  // throw createMediaElementSource errors.
  function teardownMixer() {
    mixerRef.current?.stop();
    mixerRef.current = null;
    streamRef.current = null;
    deviceSourceIdRef.current = null;
    fileSourceIdRef.current = null;
    micSourceIdRef.current = null;
    audioElRef.current?.pause();
    resetCrossfade();
    closeControlChannel();
  }

  function closeControlChannel() {
    if (controlHeartbeatRef.current !== null) {
      clearInterval(controlHeartbeatRef.current);
      controlHeartbeatRef.current = null;
    }
    if (npChannelRef.current) {
      supabase.removeChannel(npChannelRef.current);
      npChannelRef.current = null;
    }
  }

  function resetCrossfade() {
    if (crossfadeTimerRef.current !== null) {
      clearTimeout(crossfadeTimerRef.current);
      crossfadeTimerRef.current = null;
    }
    crossfadingRef.current = false;
    altElRef.current?.pause();
    altElRef.current = null;
    altIdRef.current = null;
  }

  async function handleGoLive() {
    setStatus('starting');
    setErrorMsg('');
    titleRef.current = title || 'Subspace Radio Live';
    authToken().then((t) => { tokenRef.current = t; }).catch(() => {});

    // AudioContext must be created in the gesture handler for iOS compatibility
    const mixer = new HostMixer();
    mixerRef.current = mixer;

    const publisher = new Publisher(
      {
        onFatal: (reason) => {
          setErrorMsg(reason);
          setStatus('error');
          dispatchFsm({ type: 'RESET' });
          teardownMixer();
        },
        onSessionReady: () => {
          // The server set the station live during publish-offer (using the admin's
          // own token), so there is nothing to write here — just reflect the state.
          setStatus('live');
          dispatchFsm({ type: 'CONNECTED' });
        },
        onDispatch: dispatchFsm,
        onQualityChange: (degraded) => {
          dispatchFsm(degraded ? { type: 'QUALITY_DEGRADED' } : { type: 'QUALITY_RECOVERED' });
        },
        onBitrate: (kbps) => setCurrentBitrate(kbps),
      },
      '/api/rtc-session',
      authToken,
      autoPilot ? QUALITY_PRESETS.hq : QUALITY_PRESETS[quality],
      autoPilot ? true : stereoMode,
    );
    publisherRef.current = publisher;

    try {
      const stream = await mixer.start();
      streamRef.current = stream;

      // Control channel: push the listener jitter-buffer setting (and re-push periodically
      // so late joiners get it).
      const channel = supabase.channel('room:control', { config: { broadcast: { self: false } } });
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') publishBuffer(Math.round(bufferSecRef.current * 1000));
      });
      npChannelRef.current = channel;
      controlHeartbeatRef.current = setInterval(
        () => publishBuffer(Math.round(bufferSecRef.current * 1000)),
        4000,
      );

      // Add selected line-in / virtual device (Traktor / Rekordbox virtual cable).
      // Track whether a device is actually in the mix so DISCONNECT INPUT reflects reality
      // (a file-only broadcast has no input device to disconnect).
      if (selectedDeviceId && audioReady) {
        const id = await mixer.addAudioDevice(selectedDeviceId, 'device');
        deviceSourceIdRef.current = id;
        mixer.setGain(id, deviceGain);
        setDeviceConnected(true);
      } else {
        setDeviceConnected(false);
      }

      // Add local file deck source if there are files queued.
      // A fresh <audio> element is created each session: an HTMLMediaElement can back
      // only ONE MediaElementSourceNode for its lifetime, so reusing it across GO LIVE
      // attempts throws "already connected to a different MediaElementSourceNode".
      // One <audio> element per session backs the file deck. We swap its .src to change
      // tracks (createMediaElementSource may run only once per element), so prev/next/jump
      // never create a second source node.
      const deck = deckRef.current;
      if (!deck.isEmpty) {
        const audioEl = new Audio();
        audioEl.onended = handleDeckNext; // auto-advance (no-op while a crossfade is running)
        audioEl.ontimeupdate = () => handleTimeUpdate(audioEl); // drives auto-mix
        audioElRef.current = audioEl;
        const id = mixer.addFileElement(audioEl);
        fileSourceIdRef.current = id;
        mixer.setGain(id, fileGain);
        loadAndPlayCurrent(true);
      }

      // FSM CONNECT triggers CONNECT_RTC effect → reconnectPublisher() → publisher.connect(stream)
      dispatchFsm({ type: 'CONNECT' });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not start broadcast');
      setStatus('error');
      dispatchFsm({ type: 'ERROR' });
      teardownMixer();
    }
  }

  async function handleEnd() {
    setStatus('ending');
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    // End sequence: cut off new subscribers FIRST (server takes the station off the air
    // using the admin token), then tear down locally.
    try {
      await fetch('/api/rtc-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await authToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'end-broadcast' }),
      });
    } catch {
      // Best-effort: even if the off-write fails, tear down the local broadcast below.
    }
    publisherRef.current?.disconnect();
    mixerRef.current?.stop();
    mixerRef.current = null;
    publisherRef.current = null;
    streamRef.current = null;
    audioElRef.current?.pause();
    resetCrossfade();
    closeControlChannel();
    setStatus('idle');
    setCurrentTrackName('');
    setCurrentTrackId('');
    setFilePlaying(false);
    setCurrentBitrate(0);
    setPosition({ cur: 0, dur: 0 });
    setDeviceConnected(false);
    dispatchFsm({ type: 'RESET' });
  }

  // ── File deck transport ──────────────────────────────────────────────
  // All transport swaps the .src of the single mixer-attached <audio> element; it never
  // creates a second MediaElementSource (forbidden per element by the Web Audio API).
  function publishNowPlaying(name: string, cur: number, dur: number) {
    npChannelRef.current?.send({ type: 'broadcast', event: 'np', payload: { name, cur, dur } });
    npLastSentRef.current = Date.now();
  }

  function publishBuffer(ms: number) {
    npChannelRef.current?.send({ type: 'broadcast', event: 'buffer', payload: { bufferMs: ms } });
  }

  function handleBufferChange(sec: number) {
    setBufferSec(sec);
    publishBuffer(Math.round(sec * 1000));
  }

  function handleAutoPilot(on: boolean) {
    setAutoPilot(on);
    // Auto-pilot rides the full range up to HQ; manual pins the chosen ceiling.
    publisherRef.current?.setQualityCeiling(on ? QUALITY_PRESETS.hq : QUALITY_PRESETS[quality]);
  }

  function loadAndPlayCurrent(autoplay: boolean) {
    const cur = deckRef.current.current;
    const el = audioElRef.current;
    if (!cur || !el) return;
    el.src = cur.url;
    setCurrentTrackName(cur.name);
    setCurrentTrackId(cur.id);
    publishNowPlaying(cur.name, 0, 0); // duration follows once metadata loads via timeupdate
    if (autoplay) {
      el.play().catch(() => {});
      setFilePlaying(true);
    }
  }

  function handleDeckNext() {
    if (crossfadingRef.current) return; // a crossfade already owns the transition
    const deck = deckRef.current;
    if (deck.advance()) {
      setQueue([...deck.state.queue]);
      loadAndPlayCurrent(true);
    } else {
      // End of the queue: stop the file deck (live inputs keep going).
      audioElRef.current?.pause();
      setFilePlaying(false);
    }
  }

  function handleDeckPrev() {
    if (crossfadingRef.current) return;
    if (deckRef.current.previous()) {
      setQueue([...deckRef.current.state.queue]);
      loadAndPlayCurrent(true);
    }
  }

  // ── Auto-mix crossfade ────────────────────────────────────────────────
  // Driven by the active element's timeupdate. When the track nears its end, fade into
  // the next one on a second deck, then swap which deck is active.
  function handleTimeUpdate(el: HTMLAudioElement) {
    if (el !== audioElRef.current) return;
    setPosition({ cur: el.currentTime || 0, dur: Number.isFinite(el.duration) ? el.duration : 0 });
    const fire = shouldStartCrossfade({
      currentTime: el.currentTime,
      duration: el.duration,
      crossfadeSec: crossfadeRef.current,
      autoMix: autoMixRef.current,
      hasNext: !!deckRef.current.next,
      alreadyFading: crossfadingRef.current,
    });
    if (fire) startCrossfade();
  }

  function startCrossfade() {
    const mixer = mixerRef.current;
    const nextTrack = deckRef.current.next;
    const outId = fileSourceIdRef.current;
    if (!mixer || !nextTrack || !outId) return;

    // Lazily create the second deck the first time we ever crossfade. A given
    // HTMLMediaElement can back only one MediaElementSource, so we keep two for the session.
    if (!altElRef.current) {
      const el = new Audio();
      el.ontimeupdate = () => handleTimeUpdate(el);
      el.onended = () => handleDeckNext();
      altElRef.current = el;
      altIdRef.current = mixer.addFileElement(el);
    }
    const inEl = altElRef.current;
    const inId = altIdRef.current;
    if (!inEl || !inId) return;

    crossfadingRef.current = true;
    const sec = crossfadeRef.current;
    inEl.src = nextTrack.url;
    inEl.currentTime = 0;
    inEl.play().catch(() => {});
    mixer.rampGain(outId, 0, sec);
    mixer.rampGain(inId, fileGainRef.current, sec);

    crossfadeTimerRef.current = setTimeout(() => finalizeCrossfade(), sec * 1000);
  }

  function finalizeCrossfade() {
    const deck = deckRef.current;
    deck.advance();
    setQueue([...deck.state.queue]);

    const oldEl = audioElRef.current;
    const oldId = fileSourceIdRef.current;
    oldEl?.pause();
    if (oldId) mixerRef.current?.setGain(oldId, 0);

    // The incoming deck is now active; swap the active/alt pointers.
    audioElRef.current = altElRef.current;
    fileSourceIdRef.current = altIdRef.current;
    altElRef.current = oldEl;
    altIdRef.current = oldId;

    const cur = deck.current;
    if (cur) {
      setCurrentTrackName(cur.name);
      setCurrentTrackId(cur.id);
    }
    setFilePlaying(true);
    crossfadingRef.current = false;
  }

  function handleDeckPlayPause() {
    const el = audioElRef.current;
    if (!el) return;
    if (filePlaying) {
      el.pause();
      setFilePlaying(false);
    } else if (!el.src) {
      loadAndPlayCurrent(true);
    } else {
      el.play().catch(() => {});
      setFilePlaying(true);
    }
  }

  function handleSeek(deltaSeconds: number) {
    const el = audioElRef.current;
    if (!el) return;
    const dur = Number.isFinite(el.duration) ? el.duration : Infinity;
    el.currentTime = Math.max(0, Math.min(el.currentTime + deltaSeconds, dur));
  }

  function handleJumpTo(id: string) {
    if (deckRef.current.jumpTo(id)) {
      setQueue([...deckRef.current.state.queue]);
      loadAndPlayCurrent(statusRef.current === 'live');
    }
  }

  function handleFileAdd(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    deckRef.current.add(e.target.files);
    setQueue([...deckRef.current.state.queue]);
    e.target.value = '';
  }

  // Folder picker (webkitdirectory) returns every file in the folder tree; keep only audio.
  function handleFolderAdd(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    const audio = Array.from(e.target.files).filter(
      (f) => f.type.startsWith('audio/') || /\.(mp3|wav|flac|m4a|aac|ogg|aiff?)$/i.test(f.name),
    );
    if (audio.length) {
      deckRef.current.add(audio);
      setQueue([...deckRef.current.state.queue]);
    }
    e.target.value = '';
  }

  // Drop / re-acquire the live input device (mic / virtual cable) mid-broadcast.
  async function handleToggleInput() {
    const mixer = mixerRef.current;
    if (!mixer) return;
    if (deviceConnected) {
      if (deviceSourceIdRef.current) mixer.removeSource(deviceSourceIdRef.current);
      deviceSourceIdRef.current = null;
      setDeviceConnected(false);
      return;
    }
    // (Re)connect the input device mid-broadcast.
    if (!selectedDeviceId || !audioReady) {
      setErrorMsg('Enable audio access and pick an input device first.');
      return;
    }
    try {
      const id = await mixer.addAudioDevice(selectedDeviceId, 'device');
      deviceSourceIdRef.current = id;
      mixer.setGain(id, deviceGain);
      setDeviceConnected(true);
      setErrorMsg('');
    } catch {
      setErrorMsg('Could not connect the input device. Check the browser mic permission.');
    }
  }

  function handleRemoveTrack(id: string) {
    deckRef.current.remove(id);
    setQueue([...deckRef.current.state.queue]);
  }

  function handleTrackGainChange(source: 'device' | 'file' | 'mic', value: number) {
    if (source === 'device') {
      setDeviceGain(value);
      if (deviceSourceIdRef.current) mixerRef.current?.setGain(deviceSourceIdRef.current, value);
    } else if (source === 'file') {
      setFileGain(value);
      if (fileSourceIdRef.current) mixerRef.current?.setGain(fileSourceIdRef.current, value);
    } else {
      if (micSourceIdRef.current) mixerRef.current?.setGain(micSourceIdRef.current, value);
    }
  }

  function handleQualityChange(key: QualityKey) {
    setQuality(key);
    publisherRef.current?.setQualityCeiling(QUALITY_PRESETS[key]);
  }

  const isBusy = status === 'starting' || status === 'ending';

  return (
    <section data-testid="go-live-panel" className="flex flex-col gap-6 p-6 section-border">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] tracking-[0.35em] text-muted-foreground">
          // BROADCAST CONTROL
        </p>
        {status === 'live' && (
          <span className="font-mono text-[11px] tracking-widest text-red-400 animate-pulse">
            ON AIR
          </span>
        )}
      </div>

      {errorMsg && (
        <p role="alert" className="font-mono text-xs text-destructive">
          {errorMsg}
        </p>
      )}

      {orphanedLive && (
        <div role="alert" className="flex flex-col gap-3 border border-amber-500/60 bg-amber-500/10 p-4">
          <p className="font-mono text-xs text-amber-300 leading-relaxed">
            This station is still marked LIVE from a previous session, but this device is not
            broadcasting (a refresh or closed tab can cause this). End it to clear the signal,
            then GO LIVE again.
          </p>
          <button
            onClick={handleEnd}
            data-testid="force-end-btn"
            className="font-mono text-xs tracking-widest border border-amber-500 px-4 min-h-[44px] hover:bg-amber-500/20 transition-colors self-start"
          >
            END PREVIOUS BROADCAST
          </button>
        </div>
      )}

      {/* Broadcast title */}
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[11px] tracking-widest text-muted-foreground">
          BROADCAST TITLE
        </span>
        <input
          type="text"
          maxLength={80}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Subspace Radio Live"
          disabled={status === 'live' || isBusy}
          className="bg-transparent border border-border rounded px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px] disabled:opacity-50"
        />
      </label>

      {/* Device select */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[11px] tracking-widest text-muted-foreground">
          AUDIO INPUT (YOUR MICROPHONE, OR TRAKTOR / REKORDBOX VIRTUAL DEVICE)
        </span>
        {!audioReady ? (
          <button
            type="button"
            onClick={requestAudioAccess}
            disabled={requestingAccess}
            data-testid="enable-audio-btn"
            className="font-mono text-xs tracking-widest border border-primary px-4 min-h-[44px] hover:bg-primary/10 disabled:opacity-40 transition-colors"
          >
            {requestingAccess ? 'REQUESTING...' : 'ENABLE AUDIO ACCESS'}
          </button>
        ) : (
          <div className="flex gap-2">
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              disabled={status === 'live' || isBusy}
              aria-label="Audio input device"
              className="flex-1 bg-transparent border border-border rounded px-3 font-mono text-xs min-h-[44px] disabled:opacity-50"
            >
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
            <GainSlider
              label="GAIN"
              value={deviceGain}
              onChange={(v) => handleTrackGainChange('device', v)}
            />
          </div>
        )}
        {status === 'live' && (deviceConnected || (audioReady && selectedDeviceId)) && (
          <button
            type="button"
            onClick={handleToggleInput}
            data-testid="toggle-input-btn"
            className={[
              'font-mono text-[10px] tracking-widest px-3 min-h-[44px] border w-fit transition-colors',
              deviceConnected
                ? 'border-destructive text-destructive hover:bg-destructive/10'
                : 'border-primary text-primary hover:bg-primary/10',
            ].join(' ')}
          >
            {deviceConnected ? 'DISCONNECT INPUT' : 'CONNECT INPUT'}
          </button>
        )}
      </div>

      {/* Broadcast tuning: auto-pilot, manual quality/channels, listener buffer */}
      <div className="flex flex-col gap-3">
        <span className="font-mono text-[11px] tracking-widest text-muted-foreground">
          BROADCAST TUNING
        </span>

        <label className="flex items-center gap-2 font-mono text-[11px] cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={autoPilot}
            onChange={(e) => handleAutoPilot(e.target.checked)}
            className="w-5 h-5 accent-primary"
          />
          AUTO-PILOT
          <span className="text-[10px] text-muted-foreground">(auto-tunes quality to your line)</span>
        </label>

        {!autoPilot && (
          <>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground">QUALITY</span>
              <div className="flex border border-border w-fit" role="group" aria-label="Audio quality">
                {(['stable', 'balanced', 'hq'] as QualityKey[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleQualityChange(k)}
                    aria-pressed={quality === k}
                    className={[
                      'font-mono text-[10px] tracking-widest px-3 min-h-[44px] transition-colors',
                      quality === k
                        ? 'bg-primary/20 text-foreground'
                        : 'text-muted-foreground hover:bg-primary/10',
                    ].join(' ')}
                  >
                    {QUALITY_LABELS[k]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground">CHANNELS</span>
              <div className="flex border border-border w-fit" role="group" aria-label="Channels">
                {([['STEREO', true], ['MONO', false]] as const).map(([label, val]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setStereoMode(val)}
                    aria-pressed={stereoMode === val}
                    className={[
                      'font-mono text-[10px] tracking-widest px-3 min-h-[44px] transition-colors',
                      stereoMode === val
                        ? 'bg-primary/20 text-foreground'
                        : 'text-muted-foreground hover:bg-primary/10',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {status === 'live' && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  Channel change applies on next GO LIVE.
                </span>
              )}
            </div>
          </>
        )}

        {/* Listener buffer — always available; the main anti-cut lever */}
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
            LISTENER BUFFER {bufferSec.toFixed(1)}s
          </span>
          <input
            type="range"
            min={0.5}
            max={5}
            step={0.5}
            value={bufferSec}
            onChange={(e) => handleBufferChange(Number(e.target.value))}
            className="min-h-[44px]"
            aria-label="Listener buffer seconds"
          />
          <span className="font-mono text-[10px] text-muted-foreground">
            Higher = smoother for listeners (more delay). Raise it if listeners report cuts.
          </span>
        </label>
      </div>

      {/* File deck */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] tracking-widest text-muted-foreground">
            FILE DECK {queue.length > 0 && `(${queue.length})`}
          </span>
          <div className="flex items-center gap-2">
            <label className="flex items-center cursor-pointer">
              <span className="font-mono text-[11px] border border-border px-3 py-2 hover:bg-primary/10 transition-colors min-h-[44px] flex items-center">
                ADD FILES
              </span>
              <input
                type="file"
                accept="audio/*"
                multiple
                className="sr-only"
                onChange={handleFileAdd}
              />
            </label>
            <label className="flex items-center cursor-pointer">
              <span className="font-mono text-[11px] border border-border px-3 py-2 hover:bg-primary/10 transition-colors min-h-[44px] flex items-center">
                ADD FOLDER
              </span>
              <input
                type="file"
                className="sr-only"
                onChange={handleFolderAdd}
                {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
              />
            </label>
          </div>
        </div>

        {queue.length > 0 ? (
          <ul className="flex flex-col gap-1 max-h-44 overflow-y-auto" aria-label="Playlist">
            {queue.map((t, i) => {
              const isCurrent = t.id === currentTrackId;
              return (
                <li key={t.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleJumpTo(t.id)}
                    aria-current={isCurrent ? 'true' : undefined}
                    className={[
                      'flex-1 flex items-center gap-2 text-left min-h-[40px] px-2 rounded font-mono text-xs transition-colors',
                      isCurrent
                        ? 'bg-primary/20 text-foreground'
                        : 'text-muted-foreground hover:bg-primary/10',
                    ].join(' ')}
                  >
                    <span className="w-5 shrink-0 flex items-center justify-center text-[10px] tabular-nums text-muted-foreground">
                      {isCurrent && filePlaying ? (
                        <Play className="w-3 h-3 fill-current text-primary" aria-hidden="true" />
                      ) : (
                        String(i + 1).padStart(2, '0')
                      )}
                    </span>
                    <span className="truncate">{t.name}</span>
                  </button>
                  <button
                    onClick={() => handleRemoveTrack(t.id)}
                    className="font-mono text-[10px] text-muted-foreground hover:text-destructive min-w-[44px] min-h-[44px]"
                    aria-label={`Remove ${t.name}`}
                  >
                    REMOVE
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="font-mono text-[11px] text-muted-foreground">
            Add audio files to build a set, or broadcast a live input only.
          </p>
        )}
        <p className="font-mono text-[10px] text-muted-foreground/70">
          Files play from your device only. Folder upload triggers a browser confirmation, but
          nothing is uploaded to any server.
        </p>

        {/* Transport: live deck control */}
        {status === 'live' && queue.length > 0 && (
          <div className="flex items-center gap-2 pt-1" role="group" aria-label="Playback controls">
            <TransportBtn onClick={handleDeckPrev} label="Previous track">
              <SkipBack className="w-4 h-4" aria-hidden="true" />
            </TransportBtn>
            <TransportBtn onClick={handleDeckPlayPause} label={filePlaying ? 'Pause' : 'Play'}>
              {filePlaying ? (
                <Pause className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Play className="w-4 h-4" aria-hidden="true" />
              )}
            </TransportBtn>
            <TransportBtn onClick={handleDeckNext} label="Next track">
              <SkipForward className="w-4 h-4" aria-hidden="true" />
            </TransportBtn>
            <TransportBtn onClick={() => handleSeek(-10)} label="Back 10 seconds">
              <Rewind className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="text-[10px] ml-0.5">10</span>
            </TransportBtn>
            <TransportBtn onClick={() => handleSeek(10)} label="Forward 10 seconds">
              <FastForward className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="text-[10px] ml-0.5">10</span>
            </TransportBtn>
          </div>
        )}

        {queue.length > 0 && (
          <div className="flex flex-col gap-2 pt-1">
            <label className="flex items-center gap-2 font-mono text-[11px] tracking-widest text-muted-foreground cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={autoMix}
                onChange={(e) => setAutoMix(e.target.checked)}
                className="w-5 h-5 accent-primary"
              />
              AUTO-MIX (CROSSFADE)
            </label>
            {autoMix && (
              <label className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                <span className="w-20 shrink-0 tabular-nums">FADE {crossfadeSec}s</span>
                <input
                  type="range"
                  min={1}
                  max={12}
                  step={1}
                  value={crossfadeSec}
                  onChange={(e) => setCrossfadeSec(Number(e.target.value))}
                  className="flex-1 min-h-[44px]"
                  aria-label="Crossfade seconds"
                />
              </label>
            )}
          </div>
        )}

        {queue.length > 0 && (
          <GainSlider
            label="FILE GAIN"
            value={fileGain}
            onChange={(v) => handleTrackGainChange('file', v)}
          />
        )}
      </div>

      {/* Pre-live input level: shows as soon as mic access is granted */}
      {audioReady && status === 'idle' && (
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] tracking-widest text-muted-foreground">
            INPUT LEVEL
          </span>
          <PreviewMeter deviceId={selectedDeviceId} />
        </div>
      )}

      {/* Live status: what's going out + output level + listener count */}
      {status === 'live' && (
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] tracking-widest text-muted-foreground">
            WHAT&apos;S GOING OUT
          </span>
          {currentTrackName ? (
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-xs text-primary truncate min-w-0">
                <span className="text-muted-foreground">NOW </span>
                {currentTrackName}
              </p>
              {position.dur > 0 && (
                <p className="font-mono text-[11px] text-muted-foreground tabular-nums shrink-0">
                  {formatClock(position.cur)} / -{formatClock(position.dur - position.cur)}
                </p>
              )}
            </div>
          ) : (
            <p className="font-mono text-xs text-muted-foreground">Live input (mic / device)</p>
          )}
          {deckRef.current.next && (
            <p className="font-mono text-[11px] text-muted-foreground truncate">
              <span>NEXT </span>
              {deckRef.current.next.name}
            </p>
          )}
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground mt-1">
            OUTPUT LEVEL
          </span>
          <LevelMeter getAnalysis={() => mixerRef.current?.analysis ?? null} />
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs text-muted-foreground">
              LISTENERS: {listenerCount}
            </p>
            <p className="font-mono text-xs text-muted-foreground tabular-nums">
              {currentBitrate ? `${currentBitrate} kbps` : '— kbps'}
              {currentBitrate > 0 && currentBitrate < QUALITY_PRESETS[quality] && (
                <span className="text-amber-400"> (adapting)</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* GO LIVE / END */}
      {(status === 'idle' || status === 'starting' || status === 'error') ? (
        <button
          onClick={handleGoLive}
          disabled={isBusy}
          data-testid="go-live-btn"
          className="font-mono text-sm tracking-widest border border-primary px-6 min-h-[44px] hover:bg-primary/10 disabled:opacity-40 transition-colors"
        >
          {status === 'starting' ? 'CONNECTING...' : 'GO LIVE'}
        </button>
      ) : (
        <button
          onClick={handleEnd}
          disabled={isBusy}
          data-testid="end-btn"
          className="font-mono text-sm tracking-widest border border-destructive px-6 min-h-[44px] hover:bg-destructive/10 disabled:opacity-40 transition-colors"
        >
          {status === 'ending' ? 'ENDING...' : 'END BROADCAST'}
        </button>
      )}

    </section>
  );
}

// Pre-broadcast monitor: opens the selected device to show input level before going live.
// Stops automatically when unmounted (before HostMixer opens the same device).
function PreviewMeter({ deviceId }: { deviceId: string }) {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!deviceId || !navigator.mediaDevices?.getUserMedia) return;
    let cancelled = false;
    let raf = 0;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: deviceId }, echoCancellation: false, autoGainControl: false, noiseSuppression: false },
        });
        if (cancelled || !stream) { stream?.getTracks().forEach((t) => t.stop()); return; }
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        source.connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        const tick = () => {
          if (cancelled) return;
          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 2.5));
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => { cancelAnimationFrame(raf); stream.getTracks().forEach((t) => t.stop()); ctx.close(); };
      } catch {
        // getUserMedia blocked or unavailable — show flat bar
      }
    })();

    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [deviceId]);

  return (
    <div
      className="h-3 w-full bg-muted/30 border border-border rounded overflow-hidden"
      role="meter"
      aria-label="Input level"
      aria-valuenow={Math.round(level * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full w-full bg-primary origin-left" style={{ transform: `scaleX(${level})` }} />
    </div>
  );
}

function LevelMeter({ getAnalysis }: { getAnalysis: () => MixerAnalysis | null }) {
  const [level, setLevel] = useState(0);
  const getRef = useRef(getAnalysis);
  getRef.current = getAnalysis;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const analysis = getRef.current();
      if (analysis) {
        const data = analysis.getTimeDomainData();
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length);
        setLevel(Math.min(1, rms * 2.5));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="h-3 w-full bg-muted/30 border border-border rounded overflow-hidden"
      role="meter"
      aria-label="Output level"
      aria-valuenow={Math.round(level * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full w-full bg-primary origin-left"
        style={{ transform: `scaleX(${level})` }}
      />
    </div>
  );
}

function TransportBtn({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] px-2 border border-border rounded text-foreground hover:bg-primary/10 active:scale-95 transition-all"
    >
      {children}
    </button>
  );
}

function GainSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-2">
      <span className="font-mono text-[10px] tracking-widest text-muted-foreground w-16 shrink-0">
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={2}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 min-h-[44px]"
        aria-label={label}
      />
      <span className="font-mono text-[10px] w-8 text-right">
        {Math.round(value * 100)}%
      </span>
    </label>
  );
}
