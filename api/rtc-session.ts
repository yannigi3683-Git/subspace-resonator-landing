export function POST(): Response {
  return new Response(JSON.stringify({ error: 'not_implemented' }), {
    status: 501,
    headers: { 'content-type': 'application/json' },
  });
}
