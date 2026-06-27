export type StationMode = 'off' | 'live';

export interface Station {
  mode: StationMode;
  live_title: string | null;
  live_session: { cfSessionId: string; startedAt?: string } | null;
  slow_mode_s: number;
  locked: boolean;
}

export interface Identity {
  name: string;       // 1-24 chars, user-chosen
  avatarId: string;   // key from AVATARS
  deviceId: string;   // crypto.randomUUID(), persisted in localStorage
  position: { x: number; y: number }; // 0-100 within crowd area, derived from deviceId
}

export interface ChatMessage {
  id: string;
  uid: string;
  display_name: string;
  avatar_id: string;
  body: string;
  is_host: boolean;
  created_at: string;
}

export interface PresenceEntry {
  uid: string;
  name: string;
  avatarId: string;
  // Stable per-browser id (localStorage), survives anonymous re-auth. Used to collapse a stale
  // presence ghost (old uid) and the current entry from the same device into one avatar.
  deviceId?: string;
  position: { x: number; y: number };
}
