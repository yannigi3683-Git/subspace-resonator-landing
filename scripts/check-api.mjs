// Post-deploy smoke check for the radio API: npm run check:api [url]
//
// The landing page can look perfectly healthy while /api/rtc-session is dead. On 2026-07-26 an
// extensionless ESM import made the function crash on boot, so every phase 500ed and both the
// host and the listeners were down, while the homepage and its og: tags served fine. A deploy
// that touches api/ is not verified until this passes.
//
// 401 is the healthy answer: the request carries no token, so a booting function must reject it.
// A 500 means the function is not booting at all.

const url = process.argv[2] ?? 'https://subspaceresonator.com/api/rtc-session';

let res;
try {
  res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phase: 'subscribe-pull' }),
  });
} catch (err) {
  console.error(`UNREACHABLE  ${url}\n${err.message}`);
  process.exitCode = 2;
}

// Set exitCode rather than calling process.exit(): killing the process while fetch's keep-alive
// socket is still open trips a libuv assert on Windows and reports 127 instead of the verdict.
if (res) {
  const body = (await res.text().catch(() => '')).slice(0, 300);
  if (res.status === 401) {
    console.log(`API ALIVE    ${res.status}  ${url}\n${body}`);
  } else {
    console.error(
      `API BROKEN   ${res.status}  ${url}\n${body}\n\n` +
        'Read the real error: npx vercel logs <deployment-url>, then re-run this in another window\n' +
        '(the log only tails live traffic). Roll back with: npx vercel rollback <last-good-url> --yes',
    );
    process.exitCode = 1;
  }
}
