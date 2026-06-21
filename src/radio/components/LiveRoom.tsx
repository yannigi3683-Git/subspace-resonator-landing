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
            className="absolute inset-0 z-10 flex items-center justify-center bg-[#0A000F]/85"
          >
            <span className="pixel text-[10px] text-[#00FFEE] border-2 border-[#00FFEE] px-6 py-4" style={{ boxShadow: '4px 4px 0 #8800FF' }}>
              {ready ? '> TAP TO LISTEN' : '> CONNECTING...'}
            </span>
          </button>
        )}

        {playing && (
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 max-w-[calc(100%-2rem)] border-2 border-[#8800FF] bg-[#220033] pl-3 pr-4 py-2" style={{ boxShadow: '2px 2px 0 #FF00AA' }}>
            <span className="w-2 h-2 bg-[#FF0033] pixel-blink shrink-0" aria-hidden="true" />
            <Volume2 className="w-4 h-4 text-[#00FFEE] shrink-0" aria-hidden="true" strokeWidth={1.5} />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volume"
              className="w-24 sm:w-32 accent-[#FF00AA]"
            />
          </div>
        )}
      </div>

      <div className="w-full md:w-80 flex flex-col border-t md:border-t-0 md:border-l border-[#8800FF] bg-[#0A000F]">
        <HeatMeter heat={heat} myVote={myVote} vote={vote} />
        <div className="px-3 py-2 border-b border-[#8800FF]">
          <p className="pixel text-[10px] text-[#888899]">
            // CHAT
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
