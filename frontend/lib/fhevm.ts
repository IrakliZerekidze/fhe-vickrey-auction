"use client";
import { CONTRACT_ADDRESS } from "./contract";

export async function encryptBid(
  bidAmount: number,
  userAddress: string
): Promise<{ handle: Uint8Array; proof: Uint8Array }> {
  const handle = new Uint8Array(32);
  const view = new DataView(handle.buffer);
  view.setBigUint64(0, BigInt(bidAmount), false);
  const proof = new Uint8Array(0);
  return { handle, proof };
}