import type { SupabaseClient } from '@supabase/supabase-js';
import type { Identity, Station } from '../types';
import { useChat } from '../hooks/useChat';
import { usePresence } from '../hooks/usePresence';
import { DanceFloor } from './DanceFloor';
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
  const { messages, sendMessage, sending, sendError } = useChat(supabase, identity, uid);
  const { presenceList, count, isKicked } = usePresence(supabase, identity, uid);

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
      <div className="flex-1 min-h-[40vh] md:min-h-0">
        <DanceFloor presenceList={presenceList} station={station} uid={uid} />
      </div>

      <div className="w-full md:w-80 flex flex-col border-t md:border-t-0 md:border-l border-[#1a1a2e] bg-[#0a0010]">
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
