/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Connection,
  PublicKey,
  SystemProgram,
  VersionedTransaction,
  TransactionMessage,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { Buffer } from "buffer";

const DEVNET_RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const TXL_MINT = new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG");
const subscribeDiscriminator = new Uint8Array([254, 28, 191, 138, 156, 179, 183, 53]);

export type TransactionSigningWallet = {
  publicKey: { toString(): string };
  signTransaction(transaction: any): Promise<any>;
};

/**
 * Creates and submits TxLINE's free World Cup devnet subscription (level 1,
 * four weeks). The wallet prompts before signing; no TxL payment is included.
 */
export async function subscribeToTxlineDevnet(wallet: TransactionSigningWallet) {
  const user = new PublicKey(wallet.publicKey.toString());
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync([new TextEncoder().encode("token_treasury_v2")], PROGRAM_ID);
  const [pricingMatrixPda] = PublicKey.findProgramAddressSync([new TextEncoder().encode("pricing_matrix")], PROGRAM_ID);
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    TXL_MINT, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const userTokenAccount = getAssociatedTokenAddressSync(
    TXL_MINT, user, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  // Anchor discriminator + service_level_id: u16 little-endian + weeks: u8.
  const data = new Uint8Array([...subscribeDiscriminator, 1, 0, 4]);
  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: pricingMatrixPda, isSigner: false, isWritable: false },
      { pubkey: TXL_MINT, isSigner: false, isWritable: false },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: tokenTreasuryVault, isSigner: false, isWritable: true },
      { pubkey: tokenTreasuryPda, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });

  const connection = new Connection(DEVNET_RPC, "confirmed");
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

  const instructions: TransactionInstruction[] = [];

  const userTokenAccountInfo = await connection.getAccountInfo(userTokenAccount);
  if (!userTokenAccountInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        user,
        userTokenAccount,
        user,
        TXL_MINT,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  instructions.push(instruction);

  const messageV0 = new TransactionMessage({
    payerKey: user,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const transaction = new VersionedTransaction(messageV0);
  const signedTransaction = await wallet.signTransaction(transaction);

  const wireTransaction = signedTransaction.serialize();
  const simulation = await connection.simulateTransaction(signedTransaction);
  if (simulation.value.err) {
    const logs = simulation.value.logs?.join("\n") ?? "No program logs returned.";
    throw new Error(`TxLINE subscription simulation failed: ${logs}`);
  }

  const txSig = await connection.sendRawTransaction(wireTransaction, { skipPreflight: false, preflightCommitment: "confirmed" });
  const confirmation = await connection.confirmTransaction({ signature: txSig, blockhash, lastValidBlockHeight }, "confirmed");
  if (confirmation.value.err) throw new Error(`TxLINE subscription was not confirmed: ${JSON.stringify(confirmation.value.err)}`);
  return txSig;
}
