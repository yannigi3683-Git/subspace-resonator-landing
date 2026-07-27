import { useState, useEffect, useRef } from 'react';
import type { SubscriberStats } from '../rtc/subscriber';
import { Volume2, Music2, MessageSquare, Lock } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatMessage, Identity, Station } from '../types';
import { useChat } from '../hooks/useChat';
import { useReactions } from '../hooks/useReactions';
import { usePresence } from '../hooks/usePresence';
import { useModeration } from '../hooks/useModeration';
import { useListenerTransport } from '../hooks/useListenerTransport';
import { useNowPlaying } from '../hooks/useNowPlaying';
import { DanceFloor } from './DanceFloor';
import { Chat } from './Chat';
import { ChatInput } from './ChatInput';
import { PresenceList } from './PresenceList';
import { HostLoginSheet } from './HostLoginSheet';

const SLOW_MODE_CHOICES = [0, 3, 10, 30];

interface LiveRoomProps {
  supabase: SupabaseClient;
  identity: Identity;
  uid: string;
  station: Station;
  onIdentityChange: (identity: Identity) => void;
  onRemoved: (reason: 'kicked' | 'banned') => void;
}

export function LiveRoom({ supabase, identity, uid, station, onIdentityChange, onRemoved }: LiveRoomProps) {
  const { messages, sendMessage, sending, sendError } = useChat(supabase, identity, uid, station.live_session?.startedAt);
  const { reactions, toggleReaction } = useReactions(supabase, identity, uid, station.live_session?.startedAt);
  const { presenceList, count, isKicked, isBanned, rename } = usePresence(supabase, identity, uid);
  const moderation = useModeration(supabase);
  const [hostLoginOpen, setHostLoginOpen] = useState(false);

  // Presence carries the stable deviceId; a chat message does not (the server resolves it
  // instead), so a ban issued from the crowd list is the more precise one.
  const deviceOf = (targetUid: string) => presenceList.find((e) => e.uid === targetUid)?.deviceId;

  // A pencil avatar/name edit must reach chat too: rename updates presence + localStorage, but the
  // chat send uses the `identity` prop, so lift the new values up to re-render the whole room.
  const handleRename = (name: string, avatarId: string) => {
    rename(name, avatarId);
    onIdentityChange({ ...identity, name, avatarId });
  };
  const { playing, ready, connectionError, playbackBlocked, resume, retry, volume, setVolume, getStats, stalls, transportInfo } =
    useListenerTransport(supabase, station);
  const nowPlaying = useNowPlaying(supabase);

  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const handleSend = (body: string) => sendMessage(body, { replyTo }).then(() => setReplyTo(null));

  const [mobileTab, setMobileTab] = useState<'stage' | 'chat'>('stage');
  const [unread, setUnread] = useState(0);
  const prevMsgCount = useRef(messages.length);
  const [rtcStats, setRtcStats] = useState<SubscriberStats | null>(null);
  const showDebug = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('debug');

  useEffect(() => {
    const newCount = messages.length;
    if (newCount > prevMsgCount.current && mobileTab === 'stage') {
      setUnread((n) => n + (newCount - prevMsgCount.current));
    }
    prevMsgCount.current = newCount;
  }, [messages.length, mobileTab]);

  useEffect(() => {
    if (!ready || !showDebug) { setRtcStats(null); return; }
    const id = setInterval(async () => {
      const s = await getStats();
      setRtcStats(s);
    }, 2000);
    return () => clearInterval(id);
  }, [ready, getStats, showDebug]);

  // Removal has to unmount this component, not swap its screen. Rendering a "you were removed"
  // panel from inside LiveRoom left every hook above still running: presence kept tracking (the
  // kicked listener never left the host's room list, so a kick looked like it did nothing) and
  // the audio transport kept playing. Handing removal to the parent tears all of it down.
  useEffect(() => {
    if (isBanned) onRemoved('banned');
    else if (isKicked) onRemoved('kicked');
  }, [isBanned, isKicked, onRemoved]);

  if (isBanned || isKicked) return null;

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-[#0a0010]">
      {/* Stage panel */}
      <div className={`${mobileTab === 'stage' ? 'flex' : 'hidden'} md:flex flex-1 min-h-0 relative flex-col`}>
        <div className="flex-1 relative min-h-0">
          <DanceFloor
            presenceList={presenceList}
            station={station}
            uid={uid}
            nowPlaying={{ name: nowPlaying.name, visible: nowPlaying.visible && playing }}
          />

          {/* Audio overlay: connecting / ready / error states */}
          {!playing && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              {connectionError ? (
                <div className="flex flex-col items-center gap-3">
                  <span className="font-mono text-sm text-[#ff6b6b] tracking-[0.2em]">CONNECTION FAILED</span>
                  <button
                    type="button"
                    onClick={retry}
                    data-testid="retry-listen"
                    className="font-mono text-sm tracking-[0.3em] text-white border border-white/40 px-6 py-3 hover:bg-white/10 transition-colors"
                  >
                    TRY AGAIN
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 px-6 text-center">
                  <button
                    type="button"
                    onClick={resume}
                    disabled={!ready}
                    data-testid="tap-to-listen"
                    className="font-mono text-sm tracking-[0.3em] text-white border border-white/40 px-6 py-3 disabled:opacity-50"
                  >
                    {ready ? '▶  TAP TO LISTEN' : 'CONNECTING AUDIO…'}
                  </button>
                  {playbackBlocked && (
                    <p className="font-mono text-[11px] leading-relaxed text-[#ffcc66] max-w-[240px]">
                      Playback was blocked. Tap again, and check your phone's silent switch.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {playing && (
            <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 max-w-[calc(100%-2rem)] rounded-full border border-white/10 bg-black/60 backdrop-blur-md pl-3 pr-4 py-2">
              <span className="w-2 h-2 bg-[#FF0033] pixel-blink shrink-0" aria-hidden="true" />
              <Volume2 className="w-4 h-4 text-white/70 shrink-0" aria-hidden="true" strokeWidth={1.5} />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                aria-label="Volume"
                className="w-24 sm:w-32 accent-primary"
              />
            </div>
          )}

          {/* Debug stats pill: only on /radio?debug (hidden from end users) */}
          {showDebug && (
            <div className="absolute top-3 right-3 z-30 font-mono text-[10px] text-white/80 bg-black/70 border border-white/15 px-2.5 py-1.5 rounded-md whitespace-nowrap pointer-events-none">
              <div>
                <span className="text-white/50">TRANSPORT: </span>
                <span className={
                  transportInfo.phase === 'hls' ? 'text-green-400'
                    : transportInfo.phase === 'crossfading' ? 'text-yellow-300'
                      : 'text-cyan-300'
                }>
                  {transportInfo.phase === 'hls' ? 'HLS (deep buffer)'
                    : transportInfo.phase === 'crossfading' ? 'CROSSFADING…'
                      : transportInfo.hlsAvailable ? 'WEBRTC → HLS' : 'WEBRTC'}
                </span>
                {transportInfo.hlsAvailable && (
                  <>&nbsp;&nbsp;<span className="text-white/50">HLS-BUF:</span> {transportInfo.hlsBufferedAhead.toFixed(1)}s {transportInfo.hlsReady ? '✓' : '…'}</>
                )}
              </div>
              <div>
                {rtcStats ? (
                  <>
                    BUFFER: {Math.round(rtcStats.effectiveBufferMs)}ms&nbsp;&nbsp;
                    LOST: {rtcStats.packetsLost}&nbsp;&nbsp;
                    STALLS: {stalls}&nbsp;&nbsp;
                    JITTER: {Math.round(rtcStats.jitterMs)}ms&nbsp;&nbsp;
                    RTT: {Math.round(rtcStats.rttMs)}ms
                    {rtcStats.candidateType && (
                      <>&nbsp;&nbsp;<span className={rtcStats.candidateType === 'relay' ? 'text-green-400' : 'text-white/40'}>{rtcStats.candidateType === 'relay' ? 'RELAY' : 'DIRECT'}</span></>
                    )}
                  </>
                ) : (
                  'rtc: connecting…'
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat sidebar — full screen on mobile when chat tab active */}
      <div className={`${mobileTab === 'chat' ? 'flex' : 'hidden'} md:flex w-full md:w-80 flex-1 md:flex-none min-h-0 flex-col border-t md:border-t-0 md:border-l border-[#1a1a2e] bg-[#0a0010]`}>
        <div className="px-3 py-2 border-b border-[#1a1a2e] flex items-center gap-2">
          <p className="font-mono text-[#555] text-[10px] uppercase tracking-widest flex-1">Chat</p>
          {!moderation.canModerate && (
            <button
              type="button"
              onClick={() => setHostLoginOpen(true)}
              aria-label="Host sign in"
              data-testid="host-login-trigger"
              className="w-11 h-11 -my-2 flex items-center justify-center text-[#2a2a3e] hover:text-[#555] transition-colors"
            >
              <Lock size={12} />
            </button>
          )}
        </div>
        <Chat
          messages={messages}
          onReply={setReplyTo}
          reactions={reactions}
          onToggleReaction={toggleReaction}
          moderation={moderation.canModerate ? {
            onDelete: (msg) => moderation.deleteMessage(msg.id),
            onKick: (msg) => moderation.kick(msg.uid, deviceOf(msg.uid)),
            onBan: (msg) => moderation.ban(msg.uid, deviceOf(msg.uid)),
          } : undefined}
        />
        {moderation.canModerate && (
          <div className="px-3 py-2 border-t border-[#ff6b6b]/20 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] tracking-widest text-[#ff6b6b]/70">SLOW</span>
            {SLOW_MODE_CHOICES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => moderation.setChat({ slowModeS: s })}
                aria-pressed={station.slow_mode_s === s}
                className={`px-2 min-h-[44px] font-mono text-[10px] tracking-widest transition-colors ${
                  station.slow_mode_s === s ? 'text-white border border-white/40' : 'text-[#888] hover:text-white'
                }`}
              >
                {s === 0 ? 'OFF' : `${s}s`}
              </button>
            ))}
            <button
              type="button"
              onClick={() => moderation.setChat({ locked: !station.locked })}
              aria-pressed={station.locked}
              className={`px-2 min-h-[44px] font-mono text-[10px] tracking-widest border transition-colors ${
                station.locked
                  ? 'text-[#ff6b6b] border-[#ff6b6b]/60'
                  : 'text-[#888] border-white/15 hover:text-white'
              }`}
            >
              {station.locked ? 'CHAT LOCKED' : 'LOCK CHAT'}
            </button>
          </div>
        )}
        {moderation.error && (
          <p role="alert" className="px-3 py-1 font-mono text-[10px] text-[#ff6b6b]">
            {moderation.error}
          </p>
        )}
        <PresenceList
          presenceList={presenceList}
          count={count}
          uid={uid}
          onRename={handleRename}
          moderation={moderation.canModerate ? {
            onKick: (entry) => moderation.kick(entry.uid, entry.deviceId),
            onBan: (entry) => moderation.ban(entry.uid, entry.deviceId),
          } : undefined}
        />
        <ChatInput
          onSend={handleSend}
          sending={sending}
          sendError={sendError}
          // A locked room still lets the host speak (chat_allowed exempts admins).
          disabled={station.locked && !moderation.canModerate}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      </div>

      {/* Mobile bottom tab bar — hidden on md+ */}
      <div
        className="flex md:hidden shrink-0 border-t border-[#1a1a2e] bg-[#0a0010]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <button
          type="button"
          onClick={() => setMobileTab('stage')}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 font-mono text-[10px] tracking-widest transition-colors ${
            mobileTab === 'stage' ? 'text-[#26C6DA]' : 'text-white/40'
          }`}
        >
          <Music2 className="w-5 h-5" aria-hidden="true" strokeWidth={1.5} />
          STAGE
        </button>
        <button
          type="button"
          onClick={() => { setMobileTab('chat'); setUnread(0); }}
          className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 font-mono text-[10px] tracking-widest transition-colors relative ${
            mobileTab === 'chat' ? 'text-[#7B2FBE]' : 'text-white/40'
          }`}
        >
          <span className="relative">
            <MessageSquare className="w-5 h-5" aria-hidden="true" strokeWidth={1.5} />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#7B2FBE] text-white text-[9px] flex items-center justify-center font-bold">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </span>
          CHAT
        </button>
      </div>

      {hostLoginOpen && <HostLoginSheet supabase={supabase} onClose={() => setHostLoginOpen(false)} />}
    </div>
  );
}
