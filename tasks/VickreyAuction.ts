import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

async function getContract(hre: any, address?: string) {
  const { ethers, deployments } = hre;
  const deployment = address ? { address } : await deployments.get("VickreyAuction");
  return ethers.getContractAt("VickreyAuction", deployment.address);
}

task("task:auction-info", "Print current auction state")
  .addOptionalParam("address", "Contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const contract = await getContract(hre, taskArguments.address);
    const addr = await contract.getAddress();
    const beneficiary = await contract.beneficiary();
    const endTime = await contract.endTime();
    const settled = await contract.settled();
    const bidderCount = await contract.bidderCount();
    const timeLeft = await contract.timeRemaining();
    console.log(`\n── VickreyAuction ──────────────────────────────`);
    console.log(`Address:      ${addr}`);
    console.log(`Beneficiary:  ${beneficiary}`);
    console.log(`End time:     ${new Date(Number(endTime) * 1000).toISOString()}`);
    console.log(`Time left:    ${Number(timeLeft)}s`);
    console.log(`Bidders:      ${bidderCount}`);
    console.log(`Settled:      ${settled}`);
    console.log(`────────────────────────────────────────────────\n`);
  });

task("task:place-bid", "Encrypt and submit a bid")
  .addOptionalParam("address", "Contract address")
  .addParam("value", "Bid amount")
  .addOptionalParam("signer", "Signer index (default 0)", "0")
  .addOptionalParam("key", "Private key to use instead of signer index")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, fhevm } = hre;
    const value = parseInt(taskArguments.value);
    await fhevm.initializeCLIApi();
    const contract = await getContract(hre, taskArguments.address);
    const contractAddress = await contract.getAddress();

    let bidder;
    if (taskArguments.key) {
      const provider = ethers.provider;
      bidder = new ethers.Wallet(taskArguments.key, provider);
    } else {
      const signers = await ethers.getSigners();
      bidder = signers[parseInt(taskArguments.signer || "0")];
    }

    console.log(`\nEncrypting bid of ${value} from ${bidder.address}...`);
    const encryptedBid = await fhevm.createEncryptedInput(contractAddress, bidder.address).add64(value).encrypt();
    const tx = await contract.connect(bidder).bid(encryptedBid.handles[0], encryptedBid.inputProof);
    console.log(`Tx sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✓ Bid placed! Gas used: ${receipt?.gasUsed}`);
    console.log(`Bidders now: ${await contract.bidderCount()}\n`);
  });

task("task:settle", "Settle the auction after end time")
  .addOptionalParam("address", "Contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    const contract = await getContract(hre, taskArguments.address);
    const timeLeft = await contract.timeRemaining();
    if (timeLeft > 0n) { console.log(`\nAuction not ended yet. ${timeLeft}s remaining.\n`); return; }
    const signers = await ethers.getSigners();
    const tx = await contract.connect(signers[0]).settle();
    const receipt = await tx.wait();
    console.log(`✓ Settled! Gas: ${receipt?.gasUsed}`);
  });

task("task:reveal-price", "Reveal the winner payment price")
  .addOptionalParam("address", "Contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { fhevm } = hre;
    await fhevm.initializeCLIApi();
    const contract = await getContract(hre, taskArguments.address);
    const contractAddress = await contract.getAddress();
    const settled = await contract.settled();
    if (!settled) { console.log(`\nNot settled yet.\n`); return; }
    const encPrice = await contract.getEncryptedWinnerPrice();
    const clearPrice = await fhevm.publicDecryptEuint(FhevmType.euint64, encPrice, contractAddress);
    console.log(`Payment price: ${clearPrice} (second-highest bid)\n`);
  });
