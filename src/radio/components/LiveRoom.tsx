import { Volume2 } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Identity, Station } from '../types';
import { useChat } from '../hooks/useChat';
import { usePresence } from '../hooks/usePresence';
import { useListenerAudio } from '../hooks/useListenerAudio';
import { useHeatMeter } from '../hooks/useHeatMeter';
import { useNowPlaying } from '../hooks/useNowPlaying';
import { DanceFloor } from './DanceFloor';
import { NowPlayingCard } from './NowPlayingCard';
import { Chat } from './Chat';
import { ChatInput } from './ChatInput';
import { PresenceList } from './PresenceList';
import { HeatMeter } from './HeatMeter';

interface LiveRoomProps {
  supabase: SupabaseClient;
  identity: Identity;
  uid: string;
  station: Station;
}

export function LiveRoom({ supabase, identity, uid, station }: LiveRoomProps) {
  const { messages, sendMessage, sending, sendError } = useChat(supabase, identity, uid, station.live_session?.cfSessionId);
  const { presenceList, count, isKicked } = usePresence(supabase, identity, uid);
  const { playing, ready, resume, volume, setVolume } =
    useListenerAudio(supabase, station);
  const { heat, myVote, vote } = useHeatMeter(supabase, uid);
  const nowPlaying = useNowPlaying(supabase);

  if (isKicked) {
    return (
      <div className="min-h-screen bg-[#0a0010] flex flex-col items-center justify-center p-6">
        <p className="font-mono text-white text-lg mb-2">REMOVED FROM ROOM</p>
        <p className="font-mono text-[#888] text-sm">You were removed by the host.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#0a0010]">
      <div className="flex-1 min-h-[40vh] md:min-h-0 relative">
        <DanceFloor
          presenceList={presenceList}
          station={station}
          uid={uid}
        />

        <NowPlayingCard name={nowPlaying.name} art={nowPlaying.art} visible={nowPlaying.visible && playing} />

        {/* Browsers block autoplay until the listener interacts, so surface an explicit
            control. Shows "connecting" until the host stream attaches. */}
        {!playing && (
          <button
            type="button"
            onClick={resume}
            disabled={!ready}
            data-testid="tap-to-listen"
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <span className="font-mono text-sm tracking-[0.3em] text-white border border-white/40 px-6 py-3">
              {ready ? '▶  TAP TO LISTEN' : 'CONNECTING AUDIO…'}
            </span>
          </button>
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
      </div>

      <div className="w-full md:w-80 flex flex-col border-t md:border-t-0 md:border-l border-[#1a1a2e] bg-[#0a0010]">
        <HeatMeter heat={heat} myVote={myVote} vote={vote} />
        <div className="px-3 py-2 border-b border-[#1a1a2e]">
          <p className="font-mono text-[#555] text-[10px] uppercase tracking-widest">
            Chat
          </p>
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
    </div>
  );
}
