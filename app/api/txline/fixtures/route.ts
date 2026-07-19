export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const jwt = process.env.TXLINE_GUEST_JWT;
  const apiToken = process.env.TXLINE_API_TOKEN;
  const origin = process.env.TXLINE_ORIGIN ?? "https://txline-dev.txodds.com";

  if (!jwt || !apiToken) {
    return Response.json({ error: "Missing TxLINE credentials" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "";

  try {
    const upstream = await fetch(`${origin}/api/fixtures/snapshot${status ? `?status=${status}` : ""}`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "X-Api-Token": apiToken,
        "Content-Type": "application/json",
      },
      next: { revalidate: 60 },
    });

    if (!upstream.ok) {
      const errorText = await upstream.text();
      console.error(`TxLINE API returned ${upstream.status}: ${errorText}`);
      throw new Error(`TxLINE API returned ${upstream.status}`);
    }

    const data = await upstream.json();
    console.log("TxLINE Fixtures API success, data length:", Array.isArray(data) ? data.length : "not an array");
    return Response.json(data);
  } catch (error) {
    console.error("TxLINE proxy error:", error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
