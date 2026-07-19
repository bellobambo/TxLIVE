import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const jwt = process.env.TXLINE_GUEST_JWT;
  const apiToken = process.env.TXLINE_API_TOKEN;
  const origin = process.env.TXLINE_ORIGIN ?? "https://txline-dev.txodds.com";

  if (!jwt || !apiToken) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 500 });
  }

  const url = new URL(req.url);
  const fixtureId = url.searchParams.get("fixtureId");
  const seq = url.searchParams.get("seq");
  const statKey = url.searchParams.get("statKey");
  const statKeys = url.searchParams.get("statKeys");

  if (!fixtureId || !seq) {
    return NextResponse.json({ error: "Missing fixtureId or seq" }, { status: 400 });
  }

  const query = new URLSearchParams({
    fixtureId,
    seq,
  });

  if (statKey) query.append("statKey", statKey);
  if (statKeys) query.append("statKeys", statKeys);

  const upstream = await fetch(`${origin}/api/scores/stat-validation?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      "X-Api-Token": apiToken,
    },
    cache: "no-store",
  });

  if (!upstream.ok) {
    const errorText = await upstream.text();
    return NextResponse.json({ error: errorText }, { status: upstream.status });
  }

  const data = await upstream.json();
  return NextResponse.json(data);
}
