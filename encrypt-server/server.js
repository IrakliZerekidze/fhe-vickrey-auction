const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");

const app = express();
app.use(cors());
app.use(express.json());

const RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/R9ByZE45cr5rV1Bo-j73v";
const CONTRACT_ADDRESS = "0xD231FBA8BD00Be2f263A14F8Ca5b43Dd77b29bb4";

const ABI = [
  "function bid(bytes32 encryptedBid, bytes calldata inputProof) external",
];

// Hardhat fhevm plugin path
const HARDHAT_PATH = "C:\\Users\\Zero\\Block\\fhevm-hardhat-template";

app.post("/bid", async (req, res) => {
  try {
    const { amount, privateKey } = req.body;
    if (!amount || !privateKey) {
      return res.status(400).json({ error: "amount and privateKey required" });
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Use hardhat fhevm plugin via child process
    const { execSync } = require("child_process");
    
    const result = execSync(
      `npx hardhat --network sepolia task:place-bid --value ${amount} --key ${privateKey}`,
      { cwd: HARDHAT_PATH, encoding: "utf8" }
    );

    res.json({ success: true, hash: result.match(/Tx sent: (0x[a-f0-9]+)/i)?.[1] || "" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(3001, () => console.log("Encrypt server running on http://localhost:3001"));