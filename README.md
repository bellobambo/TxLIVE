# ✦ TxLIVE

**Winner-takes-all, peer-to-peer sports predictions powered by Solana Smart Contracts and the TxLINE Oracle.**

*Built for the TxODDS World Cup Hackathon 2026.*

---

## 📖 Overview

**TxLIVE** is a decentralized, trustless sports prediction platform that completely eliminates the concept of a centralized "house." Instead of betting against a sportsbook with manipulated odds and counterparty risk, users lock stakes directly against their friends in a zero-sum, winner-takes-all Solana smart contract.

The core of TxLIVE relies on **TxLINE** by TxODDS. The platform uses TxLINE's cryptographically signed match data and Merkle proofs to autonomously determine match outcomes and execute payouts on-chain without human intervention.

## 🎯 The End-to-End Flow

1. **Oracle Synchronization:** TxLIVE continuously pulls live Match Fixtures and cryptographically signed Match Events via the TxLINE Oracle API.
2. **Create a Challenge (Escrow Initiation):** User A (The Challenger) selects an upcoming match, picks a winning team, and locks their stake (e.g., 2.5 SOL) into the decentralized escrow contract. The protocol generates a unique, shareable challenge link.
3. **Match the Challenge (P2P Lock):** User A sends the link to a friend (User B). User B connects their wallet, is forced to take the opposing side of the prediction, and matches the 2.5 SOL stake. The contract is now locked with 5.0 SOL.
4. **Trustless Resolution:** As the match plays out, live events stream directly to the dashboard. Once the final whistle blows, TxLINE broadcasts the final score alongside a cryptographic Merkle root. The smart contract validates this proof on-chain and instantly distributes the entire 5.0 SOL pool to the winner.

## ✨ Key Features

- **No House Edge:** Because wagers are strictly peer-to-peer, there is no "house" taking a cut. Winner takes 100% of the combined escrow.
- **Stateless URL Sharing:** The platform bypasses the need for traditional Web2 databases (like Supabase) by utilizing base64 URL-encoded challenge links, maintaining full decentralization.
- **TxLINE Merkle Proof Verification:** Every event in the timeline features a built-in cryptographic proof inspector, showcasing exactly how the data traces back to the on-chain Merkle root.
- **Premium SPA UX:** Built as a lightning-fast Single Page Application (SPA) using Next.js. Features a custom high-contrast Navy & Cream UI, interactive state switching, and native FlagCDN integration.

## 🛠️ Technology Stack

- **Frontend Framework:** Next.js 16.2 (React)
- **Styling:** Vanilla CSS (Custom Design System & Theme Tokens)
- **Oracle / Data Feed:** TxLINE by TxODDS (Real-time SSE & REST Snapshot)
- **Blockchain:** Solana (Simulated Escrow Logic for Demo)
- **Assets:** FlagCDN for native team flags

## 🚀 Getting Started

First, install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🧪 Testing the Flow (Golden Path)

1. Click **Connect Wallet** in the top right.
2. Scroll to the **FEATURED MATCH** or click **Fixtures** to select an upcoming game.
3. Choose a team and click **Lock SOL**. 
4. Copy the generated invite link and open it in an Incognito Window (or send it to a friend).
5. In the new window, click **Match Challenge** to lock the opposing side.
6. Check the **Verified Timeline** on the dashboard to view the TxLINE Merkle proofs!

---
*Disclaimer: The current build utilizes a frontend-mocked escrow contract for hackathon demonstration purposes. The architecture is designed to be directly plugged into a deployed Anchor/Solana program.*
