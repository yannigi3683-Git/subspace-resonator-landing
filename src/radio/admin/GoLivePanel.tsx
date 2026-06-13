import { useState, useRef, useEffect, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { HostMixer } from '../rtc/hostMixer';
import { LocalDeck, type DeckTrack } from '../rtc/localDeck';
import { Publisher } from '../rtc/publisher';
import { transition, initialState, type FsmState, type ConnectionEvent } from '../rtc/connectionFsm';

interface Props {
  supabase: SupabaseClient;
  authToken: () => string;
}

type BroadcastStatus = 'idle' | 'starting' | 'live' | 'ending' | 'error';

interface AudioDevice {
  deviceId: string;
  label: string;
}

export default function GoLivePanel({ supabase, authToken }: Props) {
  const [status, setStatus] = useState<BroadcastStatus>('idle');
  const [title, setTitle] = useState('');
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [deviceGain, setDeviceGain] = useState(1);
  const [fileGain, setFileGain] = useState(1);
  const [queue, setQueue] = useState<DeckTrack[]>([]);
  const [currentTrackName, setCurrentTrackName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [listenerCount, setListenerCount] = useState(0);

  const mixerRef = useRef<HostMixer | null>(null);
  const publisherRef = useRef<Publisher | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const deckRef = useRef<LocalDeck>(new LocalDeck());
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const fsmRef = useRef<FsmState>(initialState());
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deviceSourceIdRef = useRef<string | null>(null);
  const fileSourceIdRef = useRef<string | null>(null);
  const micSourceIdRef = useRef<string | null>(null);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((infos) => {
      const audioIn = infos
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || d.deviceId }));
      setDevices(audioIn);
      if (audioIn.length) setSelectedDeviceId(audioIn[0].deviceId);
    }).catch(() => {});
    audioElRef.current = new Audio();
  }, []);

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
    await publisher.connect(stream);
  }

  async function handleGoLive() {
    setStatus('starting');
    setErrorMsg('');

    // AudioContext must be created in the gesture handler for iOS compatibility
    const mixer = new HostMixer();
    mixerRef.current = mixer;

    const publisher = new Publisher(
      {
        onSessionReady: async (cfSessionId) => {
          // CRITICAL: update station only after CF session exists
          const { error } = await supabase
            .from('station')
            .update({
              mode: 'live',
              live_title: title || 'Subspace Radio Live',
              live_session: { cfSessionId },
            })
            .eq('id', true);

          if (error) {
            setErrorMsg('Failed to update station. Check Supabase connection.');
            setStatus('error');
          } else {
            setStatus('live');
            dispatchFsm({ type: 'CONNECTED' });
          }
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

      // Add local file deck source if there are files queued
      const deck = deckRef.current;
      if (!deck.isEmpty && audioElRef.current) {
        const current = deck.current;
        if (current) {
          audioElRef.current.src = current.url;
          audioElRef.current.play().catch(() => {});
          const id = mixer.addFileElement(audioElRef.current);
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
    }
  }

  async function handleEnd() {
    setStatus('ending');
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    // End sequence: cut off new subscribers FIRST, then tear down locally
    await supabase.from('station').update({ mode: 'off', live_session: null }).eq('id', true);
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
          AUDIO INPUT (TRAKTOR / REKORDBOX VIRTUAL DEVICE)
        </span>
        <div className="flex gap-2">
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            disabled={status === 'live' || isBusy}
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

      {/* Listener count */}
      {status === 'live' && (
        <p className="font-mono text-xs text-muted-foreground">
          LISTENERS: {listenerCount}
        </p>
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

      {/* Listener count setter — wired via M5 presence */}
      <input
        type="hidden"
        data-testid="listener-count-setter"
        value={listenerCount}
        onChange={(e) => setListenerCount(Number(e.target.value))}
      />
    </section>
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
