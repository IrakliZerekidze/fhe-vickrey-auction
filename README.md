# FHE Vickrey Auction

A privacy-preserving second-price sealed-bid auction on Ethereum using Fully Homomorphic Encryption (FHE) via Zama's fhEVM. Bids are encrypted client-side before being submitted on-chain. The smart contract computes the winner and the Vickrey price homomorphically — without ever decrypting individual bid amounts.

---

## Overview

Traditional blockchain auctions expose all bids publicly because transaction calldata and contract state are visible to anyone. This enables front-running, bid sniping, and cartel collusion. More critically, it makes the Vickrey mechanism impossible to implement honestly: revealing the second-highest price leaks information about losing bids.

This project solves all of these problems using TFHE (Torus Fully Homomorphic Encryption). The contract maintains the highest bid, second-highest bid, and winning address as encrypted ciphertexts. FHE comparison and selection operations update these values on every bid submission without revealing any plaintext.

The Vickrey (second-price) mechanism is theoretically optimal: bidding your true value is a dominant strategy regardless of what others bid. FHE makes this enforceable on a public blockchain for the first time.

---

## Repository Structure

```
fhe-vickrey-auction/
├── contracts/
│   └── VickreyAuction.sol       # Core FHE smart contract
├── deploy/
│   └── deployVickreyAuction.ts  # Hardhat deploy script
├── tasks/
│   └── VickreyAuction.ts        # CLI interaction tasks
├── test/
│   └── VickreyAuction.ts        # 13-test suite (mock fhEVM)
├── frontend/                    # Next.js frontend application
│   ├── app/
│   │   ├── page.tsx             # Main UI page
│   │   └── components/          # BidForm, Countdown, WalletButton, StatCard
│   └── lib/
│       ├── auction.ts           # Contract interaction hooks
│       ├── contract.ts          # ABI and address config
│       └── fhevm.ts             # FHE encryption client
├── encrypt-server/
│   └── server.js                # Local encryption proxy server
├── hardhat.config.ts
└── README.md
```

---

## How It Works

### Bid Submission

1. The bidder enters a bid amount in the frontend.
2. The frontend sends the amount and signing key to the local encrypt server (localhost:3001).
3. The encrypt server invokes the Hardhat fhEVM plugin, which encrypts the amount using TFHE and generates a ZK input proof.
4. The encrypt server submits the on-chain transaction: `contract.bid(encryptedHandle, inputProof)`.
5. The contract calls `FHE.fromExternal()` to verify the proof and obtain the encrypted bid handle.
6. The contract updates `_highestBid`, `_secondHighestBid`, and `_encryptedWinner` homomorphically using `FHE.gt()` and `FHE.select()`.

### Homomorphic State Update

On every bid, the contract performs O(1) FHE operations:

```solidity
ebool isNewHighest = FHE.gt(newBid, _highestBid);

euint64 newSecond = FHE.select(
    isNewHighest,
    _highestBid,
    FHE.select(FHE.gt(newBid, _secondHighestBid), newBid, _secondHighestBid)
);

euint64 newHighest = FHE.select(isNewHighest, newBid, _highestBid);

eaddress newWinner = FHE.select(
    isNewHighest,
    FHE.asEaddress(msg.sender),
    _encryptedWinner
);
```

The winner's address is tracked as an encrypted `eaddress` — it is never revealed until settlement.

### Settlement

After the auction deadline passes, anyone can call `settle()`. This function calls `FHE.makePubliclyDecryptable()` on the second-highest bid and the encrypted winner address. These are the only two values ever revealed. All losing bids remain permanently encrypted.

---

## Privacy Guarantees

| Information | Visibility | Mechanism |
|---|---|---|
| Individual bid amounts | No one, ever | TFHE encryption + ACL |
| Losing bids | No one, permanently | Handles never granted decryption |
| Leading bidder during auction | No one | eaddress encrypted homomorphically |
| Winner address | Public after settle() | Revealed by design |
| Payment price (2nd bid) | Public after settle() | makePubliclyDecryptable() |

---

## Threat Model

### Trust Assumptions

**Zama Threshold MPC KMS**: The FHE private key is split across multiple independent validators using threshold MPC. No single party can decrypt. Decryption requires collusion of a threshold of validators. This is the primary trust assumption of the system.

**Ethereum consensus**: Transaction integrity and block ordering are guaranteed by Ethereum's proof-of-stake consensus.

**fhEVM Coprocessor**: Zama's coprocessor is assumed to execute homomorphic operations correctly as specified by the Solidity library.

**Encrypt Server**: The local proxy server runs on the bidder's own machine and is within their trust boundary. In production, this should be replaced with a browser-native encryption flow.

### Known Limitations

**KMS threshold collusion**: If a threshold of Zama's KMS validators collude, encrypted bids could be decrypted. This is a known limitation of threshold FHE schemes and is mitigated by the distribution of validators across independent parties.

**Gas cost**: FHE operations cost approximately 370,000 gas per `bid()` call. For auctions with many bidders, `settle()` may approach block gas limits. Mitigation: use `euint32` for smaller bid value ranges.

**Encrypt server private key**: The server receives the bidder's signing key. This is acceptable for a demo but should be replaced in production with MetaMask signing or an MPC wallet.

**Ethereum re-org**: Standard Ethereum risk — bids in a re-organized block may be lost.

---

## Setup

### Prerequisites

- Node.js 22+
- MetaMask browser extension
- Sepolia ETH (available from faucets)
- Infura or Alchemy API key

### Install Dependencies

```bash
# Contract dependencies
npm install

# Frontend dependencies
cd frontend
npm install
cd ..

# Encrypt server dependencies
cd encrypt-server
npm install
cd ..
```

### Configure Environment

```bash
# Set your wallet mnemonic
npx hardhat vars set MNEMONIC

# Set your Infura API key
npx hardhat vars set INFURA_API_KEY
```

Create `frontend/.env.local`:

```
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourDeployedContractAddress
NEXT_PUBLIC_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YourAlchemyKey
```

---

## Running Tests

```bash
npx hardhat test
```

The test suite runs against a local mock fhEVM environment. All 13 tests should pass in approximately 30 seconds.

Test coverage includes:

- Deployment with correct parameters
- Bid submission and owner re-encryption
- Bid rejection after deadline
- 3-bidder Vickrey scenario with correct second-price computation
- Double settlement prevention
- Privacy enforcement: a non-owner cannot decrypt another bidder's handle

---

## Deployment

Deploy a new auction to Sepolia (default duration: 24 hours):

```bash
npx hardhat --network sepolia deploy --tags VickreyAuction --reset
```

To deploy with a custom duration, edit `deploy/deployVickreyAuction.ts` and change `DURATION_SECONDS`.

Update `frontend/.env.local` with the new contract address after each deployment.

---

## CLI Tasks

All tasks interact with the most recently deployed contract unless `--address` is specified.

```bash
# Print current auction state
npx hardhat --network sepolia task:auction-info

# Place an encrypted bid from the default account
npx hardhat --network sepolia task:place-bid --value 250

# Place an encrypted bid from a specific private key
npx hardhat --network sepolia task:place-bid --value 400 --key 0xYourPrivateKey

# Settle the auction after the deadline
npx hardhat --network sepolia task:settle

# Reveal the Vickrey payment price
npx hardhat --network sepolia task:reveal-price
```

---

## Running the Frontend

Start the encrypt server first:

```bash
cd encrypt-server
node server.js
```

Then start the frontend:

```bash
cd frontend
npm run dev -- --webpack
```

Open http://localhost:3000.

The frontend displays live auction state including status, bidder count, countdown timer, and threat model. The bid form sends encryption requests to the local server on port 3001. The settle button calls the contract directly via MetaMask.

---

## Deployed Contract

Network: Ethereum Sepolia Testnet

Contract address: `0x8d92A8BCAC3518854446De3f111aa2376aa476eF`

---

## Cryptographic Design

**Primitive**: TFHE via Zama fhEVM

**Encrypted types used**: `euint64` for bid amounts and running max state, `ebool` for comparison results, `eaddress` for the encrypted winner address

**Why FHE over ZK**: ZK-proofs require the prover to know the plaintext to generate a proof, which breaks bid confidentiality. FHE allows computation directly on ciphertexts.

**Why FHE over TEE**: TEE trusts Intel's SGX hardware as a single point of failure. FHE requires only a threshold of independent KMS validators to collude, which is a stronger security model.

**Why Vickrey over first-price**: Vickrey auctions have a dominant strategy (bid true value), eliminating strategic bid shading. This is only trustlessly implementable on a public chain using FHE to hide the second-highest bid until settlement.

---

## License

MIT
