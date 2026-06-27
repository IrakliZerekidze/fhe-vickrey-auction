export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "0x0000000000000000000000000000000000000000";
export const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? "11155111");
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "";

export const AUCTION_ABI = [
  "function beneficiary() view returns (address)",
  "function endTime() view returns (uint256)",
  "function settled() view returns (bool)",
  "function bidderCount() view returns (uint256)",
  "function hasBid(address) view returns (bool)",
  "function timeRemaining() view returns (uint256)",
  "function getMyBid() view returns (bytes32)",
  "function getEncryptedWinner() view returns (bytes32)",
  "function getEncryptedWinnerPrice() view returns (bytes32)",
  "function bid(bytes32 encryptedBid, bytes calldata inputProof) external",
  "function settle() external",
  "event BidPlaced(address indexed bidder, uint256 totalBidders)",
  "event AuctionSettled()",
] as const;
