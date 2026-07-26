// Plain-text transcript of one broadcast's chat, built server-side and handed to the host
// for download on END BROADCAST. Only nickname + message are included; no uid/device_id.

export interface TranscriptRow {
  display_name: string;
  body: string;
  is_host: boolean;
  created_at: string; // ISO
}

function utcStamp(iso: string): string {
  // "2026-07-19T20:15:03.123Z" -> "2026-07-19 20:15Z". Falls back to the raw value.
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
  return m ? `${m[1]} ${m[2]}Z` : iso;
}

export function transcriptFilename(startedAt: string | null | undefined): string {
  const iso = startedAt ?? new Date().toISOString();
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  const tag = m ? `${m[1]}${m[2]}${m[3]}-${m[4]}${m[5]}` : 'broadcast';
  return `subspace-radio-chat-${tag}.txt`;
}

export function buildChatTranscript(
  title: string,
  startedAt: string | null | undefined,
  rows: TranscriptRow[],
  readError?: string | null,
): string {
  const header = [
    `Subspace Radio - ${title}`,
    `Broadcast started: ${startedAt ?? 'unknown'}`,
    `Messages: ${rows.length}`,
    // A silent broadcast and a failed read both produce zero rows. Saying which one it was
    // turns the file into evidence instead of another ambiguous "nothing happened".
    ...(readError ? [`WARNING: chat could not be read: ${readError}`] : []),
    '================================',
  ];
  const lines = rows.map((r) => {
    const who = r.is_host ? `${r.display_name} (host)` : r.display_name;
    return `[${utcStamp(r.created_at)}] ${who}: ${r.body}`;
  });
  return [...header, ...lines, ''].join('\n');
}
