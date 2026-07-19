export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

/**
 * Keeps TxLINE credentials on the server. Set these in .env.local after
 * completing TxLINE's Solana subscription and API-token activation flow.
 */
export async function GET(req: Request) {
  const jwt = process.env.TXLINE_GUEST_JWT;
  const apiToken = process.env.TXLINE_API_TOKEN;
  const origin = process.env.TXLINE_ORIGIN ?? "https://txline-dev.txodds.com";

  if (!jwt || !apiToken) {
    return new Response(encoder.encode("event: status\ndata: demo\n\n"), {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" },
    });
  }

  const url = new URL(req.url);
  const fixtureId = url.searchParams.get("fixtureId");
  const targetPath = fixtureId ? `/api/scores/historical/${fixtureId}` : `/api/scores/stream`;

  const upstream = await fetch(`${origin}${targetPath}`, {
    headers: { Authorization: `Bearer ${jwt}`, "X-Api-Token": apiToken, Accept: "text/event-stream", "Cache-Control": "no-cache" },
    cache: "no-store",
  });
  if (!upstream.ok || !upstream.body) {
    return new Response(encoder.encode(`event: status\ndata: unavailable\n\n`), { status: 502, headers: { "Content-Type": "text/event-stream" } });
  }
  return new Response(upstream.body, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
