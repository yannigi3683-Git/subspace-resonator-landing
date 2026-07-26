import { describe, it, expect } from 'vitest';
import { buildChatTranscript, transcriptFilename, type TranscriptRow } from './chatTranscript.js';

const rows: TranscriptRow[] = [
  { display_name: 'Zed', body: 'hi', is_host: false, created_at: '2026-07-19T20:15:03.000Z' },
  { display_name: 'Yanni', body: 'welcome', is_host: true, created_at: '2026-07-19T20:16:00.000Z' },
];

describe('buildChatTranscript', () => {
  it('renders header, host marker, and UTC timestamps; no uid/device fields', () => {
    const out = buildChatTranscript('Friday Set', '2026-07-19T20:14:00.000Z', rows);
    expect(out).toContain('Subspace Radio - Friday Set');
    expect(out).toContain('Messages: 2');
    expect(out).toContain('[2026-07-19 20:15Z] Zed: hi');
    expect(out).toContain('[2026-07-19 20:16Z] Yanni (host): welcome');
    expect(out).not.toMatch(/uid|device/i);
  });

  it('handles an empty broadcast', () => {
    const out = buildChatTranscript('Empty', null, []);
    expect(out).toContain('Messages: 0');
    expect(out).toContain('Broadcast started: unknown');
    expect(out).not.toContain('WARNING');
  });

  // Zero rows because nobody typed, and zero rows because the read failed, must not look alike.
  it('flags a failed chat read instead of passing it off as a silent broadcast', () => {
    const out = buildChatTranscript('Broken', null, [], 'permission denied for table chat_messages');
    expect(out).toContain('Messages: 0');
    expect(out).toContain('WARNING: chat could not be read: permission denied for table chat_messages');
  });
});

describe('transcriptFilename', () => {
  it('derives a stamped filename from the broadcast start', () => {
    expect(transcriptFilename('2026-07-19T20:14:00.000Z')).toBe('subspace-radio-chat-20260719-2014.txt');
  });
});
