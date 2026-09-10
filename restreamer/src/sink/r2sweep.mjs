// Reclaim old HLS objects from R2. Nothing else ever deletes them: each broadcast writes a fresh
// <cfSessionId>/ prefix and they accumulate forever (98,460 objects / 7.15 GB by 2026-09-09, 71%
// of the 10 GB free tier, purged by hand that day). A bucket lifecycle rule is the tidier answer
// but needs a Cloudflare Admin Read/Write token, and the object-scoped token this service holds is
// refused (AccessDenied) - so the sweep rides the boot that already happens before every show,
// alongside sweepStaleTempDirs. If a lifecycle rule is ever set in the dashboard, delete this.
const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH = 1000; // S3 DeleteObjects ceiling

export const HLS_RETENTION_DAYS = 7;

// Objects from the broadcast currently on air are minutes old, so the retention window is what
// protects them - there is deliberately no "is this session live?" check to get out of step with.
// Never throws: this runs on the boot that precedes a broadcast, and housekeeping must not be able
// to stop a show from starting. Returns { deleted, bytes, error? } for the caller to log.
export async function sweepOldObjects({
  r2, olderThanDays = HLS_RETENTION_DAYS, now = Date.now(), _s3, _cmds,
}) {
  let deleted = 0;
  let bytes = 0;
  try {
    let s3 = _s3;
    let cmds = _cmds;
    if (!s3 || !cmds) {
      const aws = await import('@aws-sdk/client-s3');
      cmds = { List: aws.ListObjectsV2Command, Delete: aws.DeleteObjectsCommand };
      s3 = new aws.S3Client({
        region: 'auto',
        endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
        maxAttempts: 3,
      });
    }
    const cutoff = now - olderThanDays * DAY_MS;
    let batch = [];
    const flush = async () => {
      if (!batch.length) return;
      const out = await s3.send(new cmds.Delete({ Bucket: r2.bucket, Delete: { Objects: batch.map((k) => ({ Key: k })), Quiet: true } }));
      deleted += batch.length - (out?.Errors?.length ?? 0);
      batch = [];
    };
    let token;
    do {
      const page = await s3.send(new cmds.List({ Bucket: r2.bucket, ContinuationToken: token }));
      for (const o of page?.Contents ?? []) {
        if (+o.LastModified >= cutoff) continue;
        batch.push(o.Key);
        bytes += o.Size ?? 0;
        if (batch.length === BATCH) await flush();
      }
      token = page?.IsTruncated ? page.NextContinuationToken : null;
    } while (token);
    await flush();
    return { deleted, bytes };
  } catch (e) {
    return { deleted, bytes, error: e.message };
  }
}
