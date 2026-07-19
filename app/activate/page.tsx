"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { activateTxlineApiToken } from "@/lib/txline/activate";
import { subscribeToTxlineDevnet } from "@/lib/txline/subscribe";

type PhantomWallet = {
  isPhantom?: boolean;
  publicKey: { toString(): string };
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
  signTransaction(transaction: import("@solana/web3.js").Transaction): Promise<import("@solana/web3.js").Transaction>;
};

export default function ActivatePage() {
  const [txSig, setTxSig] = useState("");
  const [wallet, setWallet] = useState<PhantomWallet | null>(null);
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState("");
  const [subscriptionPending, setSubscriptionPending] = useState(false);
  const [approved, setApproved] = useState(false);
  const [result, setResult] = useState<{ apiToken: string; guestJwt: string } | null>(null);

  async function connectWallet() {
    const provider = (window as unknown as { phantom?: { solana?: PhantomWallet } }).phantom?.solana;
    if (!provider?.isPhantom) {
      window.open("https://phantom.app/", "_blank", "noopener,noreferrer");
      return;
    }
    const response = await provider.connect();
    setWallet(provider);
    setAddress(response.publicKey.toString());
  }

  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!wallet) return setStatus("Connect the Phantom wallet that made the devnet subscription first.");
    setResult(null);
    setStatus("Requesting a guest session…");
    try {
      const credentials = await activateTxlineApiToken({ network: "devnet", txSig, wallet });
      setResult(credentials);
      setStatus("Activated. Copy both values into .env.local, then restart the dev server.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "TxLINE activation failed.");
    }
  }

  async function subscribe() {
    if (!wallet || !approved) return;
    setSubscriptionPending(true);
    setStatus("Phantom will show the devnet subscription transaction. Review it, then approve to continue.");
    try {
      const signature = await subscribeToTxlineDevnet(wallet);
      console.log("txSig:", signature);
      setTxSig(signature);
      setStatus("Subscription confirmed. Your txSig is ready—now activate the API token below.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "TxLINE subscription failed.");
    } finally {
      setSubscriptionPending(false);
    }
  }

  return (
    <main className="activation-page">
      <Link className="back" href="/">← Back to TxLIVE</Link>
      <section className="activation-card">
        <span className="label">TXLINE · DEVNET ACTIVATION</span>
        <h1>Get your API token.</h1>
        <p>Subscribe to TxLINE’s free World Cup devnet tier, then sign an activation message to receive your data API token.</p>
        <button className="wallet-button" onClick={connectWallet}>{address ? `Connected: ${address.slice(0, 4)}…${address.slice(-4)}` : "1. Connect Phantom (Devnet)"}</button>
        <div className="transaction-summary"><b>2. Review subscription</b><dl><div><dt>Network</dt><dd>Solana devnet</dd></div><div><dt>Program</dt><dd>TxLINE · 6pW6…wyP2J</dd></div><div><dt>Service</dt><dd>Free World Cup tier · 4 weeks</dd></div><div><dt>Payment</dt><dd>0 TxL; wallet pays normal devnet fees/rent</dd></div><div><dt>Fee payer</dt><dd>{address ? `${address.slice(0, 4)}…${address.slice(-4)}` : "Connect wallet first"}</dd></div></dl><label className="approval"><input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} /> I understand this submits a devnet subscription transaction from my connected wallet.</label><button className="primary activate-button" disabled={!wallet || !approved || subscriptionPending} onClick={subscribe}>{subscriptionPending ? "Simulating subscription…" : "Create devnet subscription"} <span>→</span></button></div>
        <form onSubmit={activate}>
          <label htmlFor="signature">3. Confirmed TxLINE subscription transaction signature</label>
          <textarea id="signature" value={txSig} onChange={(event) => setTxSig(event.target.value)} placeholder="Paste the txSig returned by TxLINE subscribe()" required rows={4} />
          <button className="primary activate-button" disabled={!wallet || !txSig.trim()}>{status.startsWith("Requesting") ? "Activating…" : "4. Sign and activate"} <span>→</span></button>
        </form>
        {status && <p className="status">{status}</p>}
        {result && <div className="credentials"><p>Copy these once into <code>.env.local</code>. Do not commit or share them.</p><label>TXLINE_GUEST_JWT</label><code>{result.guestJwt}</code><label>TXLINE_API_TOKEN</label><code>{result.apiToken}</code></div>}
      </section>
    </main>
  );
}
