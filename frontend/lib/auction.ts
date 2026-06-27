"use client";

import { useState, useEffect, useCallback } from "react";
import { BrowserProvider, Contract, JsonRpcProvider } from "ethers";
import { AUCTION_ABI, CONTRACT_ADDRESS, RPC_URL } from "./contract";

export type AuctionState = {
  beneficiary: string;
  endTime: number;
  settled: boolean;
  bidderCount: number;
  timeRemaining: number;
  userHasBid: boolean;
};

const ZERO_STATE: AuctionState = {
  beneficiary: "",
  endTime: 0,
  settled: false,
  bidderCount: 0,
  timeRemaining: 0,
  userHasBid: false,
};

export function useAuction(userAddress: string | null) {
  const [state, setState] = useState<AuctionState>(ZERO_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const readContract = useCallback(async () => {
    try {
      const provider = new JsonRpcProvider(RPC_URL);
      const contract = new Contract(CONTRACT_ADDRESS, AUCTION_ABI, provider);

      const [beneficiary, endTime, settled, bidderCount, timeRemaining] = await Promise.all([
        contract.beneficiary(),
        contract.endTime(),
        contract.settled(),
        contract.bidderCount(),
        contract.timeRemaining(),
      ]);

      let userHasBid = false;
      if (userAddress) {
        userHasBid = await contract.hasBid(userAddress);
      }

      setState({
        beneficiary: beneficiary as string,
        endTime: Number(endTime),
        settled: settled as boolean,
        bidderCount: Number(bidderCount),
        timeRemaining: Number(timeRemaining),
        userHasBid,
      });
      setError(null);
    } catch (e) {
      setError("Failed to load auction state. Is the contract deployed?");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [userAddress]);

  useEffect(() => {
    readContract();
    const interval = setInterval(readContract, 10_000);
    return () => clearInterval(interval);
  }, [readContract]);

  return { state, loading, error, refresh: readContract };
}

export async function placeBid(bidAmount: number, userAddress: string): Promise<string> {
  if (!window.ethereum) throw new Error("MetaMask not found");
  
  // Get private key from MetaMask signer
  const { BrowserProvider } = await import("ethers");
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  
  // Call local encryption server
  const response = await fetch("http://localhost:3001/bid", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: bidAmount,
      privateKey: "cb8ee6333cc46b900fee9d5469ce9618ab9959c2c808c25197fb984af0a66b9f"
    })
  });
  
  if (!response.ok) throw new Error("Server error");
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.output;
}

export async function settleAuction(): Promise<string> {
  if (!window.ethereum) throw new Error("MetaMask not found");
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new Contract(CONTRACT_ADDRESS, AUCTION_ABI, signer);
  const tx = await contract.settle();
  const receipt = await tx.wait();
  return receipt.hash as string;
}
