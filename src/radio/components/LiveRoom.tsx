import { useState, useEffect, useRef } from 'react';
import type { SubscriberStats } from '../rtc/subscriber';
import { Volume2, Music2, MessageSquare } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Identity, Station } from '../types';
import { useChat } from '../hooks/useChat';
import { usePresence } from '../hooks/usePresence';
import { useListenerAudio } from '../hooks/useListenerAudio';
import { useNowPlaying } from '../hooks/useNowPlaying';
import { DanceFloor } from './DanceFloor';
import { NowPlayingCard } from './NowPlayingCard';
import { Chat } from './Chat';
import { ChatInput } from './ChatInput';
import { PresenceList } from './PresenceList';

interface LiveRoomProps {
  supabase: SupabaseClient;
  identity: Identity;
  uid: string;
  station: Station;
}

export function LiveRoom({ supabase, identity, uid, station }: LiveRoomProps) {
  const { messages, sendMessage, sending, sendError } = useChat(supabase, identity, uid, station.live_session?.cfSessionId);
  const { presenceList, count, isKicked } = usePresence(supabase, identity, uid);
  const { playing, ready, connectionError, resume, retry, volume, setVolume, getStats } =
    useListenerAudio(supabase, station);
  const nowPlaying = useNowPlaying(supabase);

  const [mobileTab, setMobileTab] = useState<'stage' | 'chat'>('stage');
  const [unread, setUnread] = useState(0);
  const prevMsgCount = useRef(messages.length);
  const [rtcStats, setRtcStats] = useState<SubscriberStats | null>(null);

  useEffect(() => {
    const newCount = messages.length;
    if (newCount > prevMsgCount.current && mobileTab === 'stage') {
      setUnread((n) => n + (newCount - prevMsgCount.current));
    }
    prevMsgCount.current = newCount;
  }, [messages.length, mobileTab]);

  useEffect(() => {
    if (!ready) { setRtcStats(null); return; }
    const id = setInterval(async () => {
      const s = await getStats();
      setRtcStats(s);
    }, 2000);
    return () => clearInterval(id);
  }, [ready, getStats]);

  if (isKicked) {
    return (
      <div className="min-h-screen bg-[#0a0010] flex flex-col items-center justify-center p-6">
        <p className="font-mono text-white text-lg mb-2">REMOVED FROM ROOM</p>
        <p className="font-mono text-[#888] text-sm">You were removed by the host.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-[#0a0010]">
      {/* Stage panel */}
      <div className={`${mobileTab === 'stage' ? 'flex' : 'hidden'} md:flex flex-1 min-h-0 relative flex-col`}>
        <div className="flex-1 relative min-h-0">
          <DanceFloor
            presenceList={presenceList}
            station={station}
            uid={uid}
          />

          <NowPlayingCard name={nowPlaying.name} art={nowPlaying.art} visible={nowPlaying.visible && playing} />

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
                <button
                  type="button"
                  onClick={resume}
                  disabled={!ready}
                  data-testid="tap-to-listen"
                  className="font-mono text-sm tracking-[0.3em] text-white border border-white/40 px-6 py-3 disabled:opacity-50"
                >
                  {ready ? '▶  TAP TO LISTEN' : 'CONNECTING AUDIO…'}
                </button>
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

          {/* Debug stats: always-on readable pill (temporary, for cut diagnosis) */}
          <div className="absolute top-3 right-3 z-30 font-mono text-[10px] text-white/80 bg-black/70 border border-white/15 px-2.5 py-1.5 rounded-md whitespace-nowrap pointer-events-none">
            {rtcStats ? (
              <>
                BUFFER: {Math.round(rtcStats.effectiveBufferMs)}ms&nbsp;&nbsp;
                LOST: {rtcStats.packetsLost}&nbsp;&nbsp;
                JITTER: {Math.round(rtcStats.jitterMs)}ms&nbsp;&nbsp;
                RTT: {Math.round(rtcStats.rttMs)}ms
              </>
            ) : (
              'connecting…'
            )}
          </div>
        </div>
      </div>

      {/* Chat sidebar — full screen on mobile when chat tab active */}
      <div className={`${mobileTab === 'chat' ? 'flex' : 'hidden'} md:flex w-full md:w-80 flex-1 md:flex-none min-h-0 flex-col border-t md:border-t-0 md:border-l border-[#1a1a2e] bg-[#0a0010]`}>
        <div className="px-3 py-2 border-b border-[#1a1a2e]">
          <p className="font-mono text-[#555] text-[10px] uppercase tracking-widest">Chat</p>
        </div>
        <Chat messages={messages} />
        <PresenceList presenceList={presenceList} count={count} />
        <ChatInput
          onSend={sendMessage}
          sending={sending}
          sendError={sendError}
          disabled={station.locked}
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
    </div>
  );
}
