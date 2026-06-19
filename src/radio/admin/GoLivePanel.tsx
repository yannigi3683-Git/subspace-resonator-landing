import { useState, useRef, useEffect, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { HostMixer, type MixerAnalysis } from '../rtc/hostMixer';
import { LocalDeck, type DeckTrack } from '../rtc/localDeck';
import { Publisher } from '../rtc/publisher';
import { transition, initialState, type FsmState, type ConnectionEvent } from '../rtc/connectionFsm';

interface Props {
  supabase: SupabaseClient;
  authToken: () => Promise<string>;
  listenerCount?: number;
}

type BroadcastStatus = 'idle' | 'starting' | 'live' | 'ending' | 'error';

interface AudioDevice {
  deviceId: string;
  label: string;
}

export default function GoLivePanel({ authToken, listenerCount = 0 }: Props) {
  const [status, setStatus] = useState<BroadcastStatus>('idle');
  const [title, setTitle] = useState('');
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [deviceGain, setDeviceGain] = useState(1);
  const [fileGain, setFileGain] = useState(1);
  const [queue, setQueue] = useState<DeckTrack[]>([]);
  const [currentTrackName, setCurrentTrackName] = useState('');
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

  const dispatchFsm = useCallback((event: ConnectionEvent) => {
    const { next, effects } = transition(fsmRef.current, event);
    fsmRef.current = next;
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
  }

  async function handleGoLive() {
    setStatus('starting');
    setErrorMsg('');
    titleRef.current = title || 'Subspace Radio Live';

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
      },
      '/api/rtc-session',
      authToken,
    );
    publisherRef.current = publisher;

    try {
      const stream = await mixer.start();
      streamRef.current = stream;

      // Add selected line-in / virtual device (Traktor / Rekordbox virtual cable)
      if (selectedDeviceId) {
        const id = await mixer.addAudioDevice(selectedDeviceId, 'device');
        deviceSourceIdRef.current = id;
        mixer.setGain(id, deviceGain);
      }

      // Add local file deck source if there are files queued.
      // A fresh <audio> element is created each session: an HTMLMediaElement can back
      // only ONE MediaElementSourceNode for its lifetime, so reusing it across GO LIVE
      // attempts throws "already connected to a different MediaElementSourceNode".
      const deck = deckRef.current;
      if (!deck.isEmpty) {
        const current = deck.current;
        if (current) {
          const audioEl = new Audio();
          audioEl.src = current.url;
          audioElRef.current = audioEl;
          audioEl.play().catch(() => {});
          const id = mixer.addFileElement(audioEl);
          fileSourceIdRef.current = id;
          mixer.setGain(id, fileGain);
          setCurrentTrackName(current.name);
        }
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
    setStatus('idle');
    setCurrentTrackName('');
    dispatchFsm({ type: 'RESET' });
  }

  function handleFileAdd(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    deckRef.current.add(e.target.files);
    setQueue([...deckRef.current.state.queue]);
    e.target.value = '';
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
      </div>

      {/* File deck */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[11px] tracking-widest text-muted-foreground">
          FILE DECK
        </span>
        {currentTrackName && (
          <p className="font-mono text-xs text-primary truncate">NOW: {currentTrackName}</p>
        )}
        <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
          <span className="font-mono text-[11px] border border-border px-3 py-2 hover:bg-primary/10 transition-colors">
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
        {queue.length > 0 && (
          <ul className="flex flex-col gap-1 max-h-32 overflow-y-auto">
            {queue.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs truncate">{t.name}</span>
                <button
                  onClick={() => handleRemoveTrack(t.id)}
                  className="font-mono text-[10px] text-muted-foreground hover:text-destructive min-w-[44px] min-h-[44px]"
                  aria-label={`Remove ${t.name}`}
                >
                  REMOVE
                </button>
              </li>
            ))}
          </ul>
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

      {/* Live status: output level + listener count */}
      {status === 'live' && (
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] tracking-widest text-muted-foreground">
            OUTPUT LEVEL
          </span>
          <LevelMeter getAnalysis={() => mixerRef.current?.analysis ?? null} />
          <p className="font-mono text-xs text-muted-foreground">
            LISTENERS: {listenerCount}
          </p>
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
