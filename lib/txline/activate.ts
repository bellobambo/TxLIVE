export type TxlineNetwork = "devnet" | "mainnet";

type MessageSigningWallet = {
  publicKey: { toString(): string };
  signMessage?(message: Uint8Array): Promise<Uint8Array>;
};

const apiOrigins: Record<TxlineNetwork, string> = {
  devnet: "https://txline-dev.txodds.com",
  mainnet: "https://txline.txodds.com",
};

import { Buffer } from "buffer";

function toBase64(bytes: any) {
  // Phantom sometimes returns an object with a signature property
  const actualBytes = bytes.signature ? bytes.signature : bytes;
  // Convert to Buffer and then base64 to avoid forEach issues on array-like objects
  return Buffer.from(actualBytes).toString("base64");
}

/**
 * Activates a TxLINE data API token for an existing TxLINE subscription.
 *
 * `txSig` MUST be the confirmed subscription transaction made by `wallet` on
 * the chosen network. This only signs TxLINE's activation message; it does not
 * create a transaction or move any SOL.
 */
export async function activateTxlineApiToken({
  network,
  txSig,
  wallet,
  leagues = [],
}: {
  network: TxlineNetwork;
  txSig: string;
  wallet: MessageSigningWallet;
  leagues?: number[];
}): Promise<{ apiToken: string; guestJwt: string }> {
  if (!txSig.trim()) throw new Error("Enter the confirmed TxLINE subscription transaction signature.");
  if (!wallet.signMessage) throw new Error("This wallet does not support message signing. Use a wallet such as Phantom.");

  const apiOrigin = apiOrigins[network];
  const guestResponse = await fetch(`${apiOrigin}/auth/guest/start`, { method: "POST" });
  if (!guestResponse.ok) throw new Error(`Could not create TxLINE guest session (${guestResponse.status}).`);

  const guestData = (await guestResponse.json()) as { token?: unknown };
  if (typeof guestData.token !== "string" || !guestData.token) throw new Error("TxLINE did not return a guest JWT.");
  const guestJwt = guestData.token;

  // Standard World Cup bundle uses an empty array, producing `${txSig}::${guestJwt}`.
  const message = new TextEncoder().encode(`${txSig}:${leagues.join(",")}:${guestJwt}`);
  const signedBytes = await wallet.signMessage(message);

  const activationResponse = await fetch(`${apiOrigin}/api/token/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${guestJwt}` },
    body: JSON.stringify({ txSig, walletSignature: toBase64(signedBytes), leagues }),
  });
  if (!activationResponse.ok) {
    const reason = await activationResponse.text();
    throw new Error(`TxLINE activation failed (${activationResponse.status}): ${reason || "Unknown error"}`);
  }

  const rawResponse = await activationResponse.text();
  let apiToken = rawResponse;
  try {
    const data = JSON.parse(rawResponse);
    if (data && data.token) {
      apiToken = data.token;
    }
  } catch (e) {
    // If it's not valid JSON, it's likely the raw string token itself
  }

  if (typeof apiToken !== "string" || !apiToken.trim()) throw new Error("TxLINE activation succeeded but returned no API token.");

  return { apiToken: apiToken.trim(), guestJwt };
}
