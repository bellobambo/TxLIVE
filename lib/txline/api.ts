export const TXLINE_API_BASE = "https://txline-dev.txodds.com/api";

export function getTxlineHeaders() {
  const jwt = process.env.NEXT_PUBLIC_TXLINE_GUEST_JWT || process.env.TXLINE_GUEST_JWT;
  const apiToken = process.env.NEXT_PUBLIC_TXLINE_API_TOKEN || process.env.TXLINE_API_TOKEN;

  if (!jwt || !apiToken) {
    throw new Error("TxLINE environment variables are missing.");
  }

  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${jwt}`,
    "X-Api-Token": apiToken,
  };
}

/**
 * Fetches World Cup fixtures (matches)
 * You can pass query params like ?status=IN_PLAY or ?status=FINISHED
 */
export async function getFixtures(queryParams = "") {
  const response = await fetch(`${TXLINE_API_BASE}/fixtures${queryParams}`, {
    headers: getTxlineHeaders(),
    next: { revalidate: 60 } // Cache for 60 seconds
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch fixtures: ${response.statusText}`);
  }
  
  return response.json();
}
