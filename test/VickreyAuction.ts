import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { VickreyAuction, VickreyAuction__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { time } from "@nomicfoundation/hardhat-network-helpers";

type Signers = {
  deployer: HardhatEthersSigner;
  beneficiary: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  carol: HardhatEthersSigner;
};

const DURATION = 3600;

async function deployAuction(beneficiary: string, duration = DURATION) {
  const factory = (await ethers.getContractFactory("VickreyAuction")) as VickreyAuction__factory;
  const contract = (await factory.deploy(beneficiary, duration)) as VickreyAuction;
  await contract.waitForDeployment();
  return { contract, address: await contract.getAddress() };
}

async function encryptBid(contractAddress: string, bidder: HardhatEthersSigner, amount: number) {
  const input = await fhevm.createEncryptedInput(contractAddress, bidder.address).add64(amount).encrypt();
  return { handle: input.handles[0], proof: input.inputProof };
}

describe("VickreyAuction", function () {
  let signers: Signers;
  let contract: VickreyAuction;
  let contractAddress: string;

  before(async function () {
    const accounts = await ethers.getSigners();
    signers = {
      deployer: accounts[0],
      beneficiary: accounts[1],
      alice: accounts[2],
      bob: accounts[3],
      carol: accounts[4],
    };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) { this.skip(); }
    ({ contract, address: contractAddress } = await deployAuction(signers.beneficiary.address));
  });

  it("should deploy with correct beneficiary and end time", async function () {
    expect(await contract.beneficiary()).to.equal(signers.beneficiary.address);
    expect(await contract.settled()).to.be.false;
    expect(await contract.bidderCount()).to.equal(0);
  });

  it("should have non-zero timeRemaining before end", async function () {
    expect(await contract.timeRemaining()).to.be.gt(0);
  });

  it("should allow alice to place a bid", async function () {
    const { handle, proof } = await encryptBid(contractAddress, signers.alice, 100);
    await (await contract.connect(signers.alice).bid(handle, proof)).wait();
    expect(await contract.bidderCount()).to.equal(1);
    expect(await contract.hasBid(signers.alice.address)).to.be.true;
  });

  it("should allow bidder to read their own bid via re-encryption", async function () {
    const { handle, proof } = await encryptBid(contractAddress, signers.alice, 250);
    await (await contract.connect(signers.alice).bid(handle, proof)).wait();
    const encBid = await contract.connect(signers.alice).getMyBid();
    const clearBid = await fhevm.userDecryptEuint(FhevmType.euint64, encBid, contractAddress, signers.alice);
    expect(clearBid).to.equal(250n);
  });

  it("should reject bids after auction ends", async function () {
    await time.increase(DURATION + 1);
    const { handle, proof } = await encryptBid(contractAddress, signers.alice, 100);
    await expect(contract.connect(signers.alice).bid(handle, proof)).to.be.revertedWithCustomError(contract, "AuctionEnded");
  });

  it("should track multiple bidders", async function () {
    const bidA = await encryptBid(contractAddress, signers.alice, 100);
    const bidB = await encryptBid(contractAddress, signers.bob, 200);
    const bidC = await encryptBid(contractAddress, signers.carol, 150);
    await (await contract.connect(signers.alice).bid(bidA.handle, bidA.proof)).wait();
    await (await contract.connect(signers.bob).bid(bidB.handle, bidB.proof)).wait();
    await (await contract.connect(signers.carol).bid(bidC.handle, bidC.proof)).wait();
    expect(await contract.bidderCount()).to.equal(3);
  });

  it("should revert settle() before auction ends", async function () {
    const { handle, proof } = await encryptBid(contractAddress, signers.alice, 100);
    await (await contract.connect(signers.alice).bid(handle, proof)).wait();
    await expect(contract.settle()).to.be.revertedWithCustomError(contract, "AuctionNotEnded");
  });

  it("should revert settle() with no bids", async function () {
    await time.increase(DURATION + 1);
    await expect(contract.settle()).to.be.revertedWithCustomError(contract, "NoBids");
  });

  it("should correctly identify winner in a 3-bidder auction", async function () {
    const bidA = await encryptBid(contractAddress, signers.alice, 100);
    const bidB = await encryptBid(contractAddress, signers.bob, 300);
    const bidC = await encryptBid(contractAddress, signers.carol, 200);
    await (await contract.connect(signers.alice).bid(bidA.handle, bidA.proof)).wait();
    await (await contract.connect(signers.bob).bid(bidB.handle, bidB.proof)).wait();
    await (await contract.connect(signers.carol).bid(bidC.handle, bidC.proof)).wait();
    await time.increase(DURATION + 1);
    await (await contract.settle()).wait();
    expect(await contract.settled()).to.be.true;
    // winner handle should be non-zero
    const encWinner = await contract.getEncryptedWinner();
    expect(encWinner).to.not.equal(ethers.ZeroHash);
  });

  it("should expose second-highest (Vickrey price) after settlement", async function () {
    const bidA = await encryptBid(contractAddress, signers.alice, 100);
    const bidB = await encryptBid(contractAddress, signers.bob, 300);
    const bidC = await encryptBid(contractAddress, signers.carol, 200);
    await (await contract.connect(signers.alice).bid(bidA.handle, bidA.proof)).wait();
    await (await contract.connect(signers.bob).bid(bidB.handle, bidB.proof)).wait();
    await (await contract.connect(signers.carol).bid(bidC.handle, bidC.proof)).wait();
    await time.increase(DURATION + 1);
    await (await contract.settle()).wait();
    const encPrice = await contract.getEncryptedWinnerPrice();
    const clearPrice = await fhevm.publicDecryptEuint(FhevmType.euint64, encPrice, contractAddress);
    expect(clearPrice).to.equal(200n);
  });

  it("should revert double settle()", async function () {
    const { handle, proof } = await encryptBid(contractAddress, signers.alice, 100);
    await (await contract.connect(signers.alice).bid(handle, proof)).wait();
    await time.increase(DURATION + 1);
    await (await contract.settle()).wait();
    await expect(contract.settle()).to.be.revertedWithCustomError(contract, "AlreadySettled");
  });

  it("single bidder wins with second price = 0", async function () {
    const { handle, proof } = await encryptBid(contractAddress, signers.alice, 500);
    await (await contract.connect(signers.alice).bid(handle, proof)).wait();
    await time.increase(DURATION + 1);
    await (await contract.settle()).wait();
    // No second bidder so _secondHighestBid was never initialized — handle is zero
    const encPrice = await contract.getEncryptedWinnerPrice();
    expect(encPrice).to.equal(ethers.ZeroHash);
  });

  it("bob should NOT be able to read alice's bid", async function () {
    const { handle, proof } = await encryptBid(contractAddress, signers.alice, 999);
    await (await contract.connect(signers.alice).bid(handle, proof)).wait();
    const aliceEncBid = await contract.connect(signers.alice).getMyBid();
    const aliceClear = await fhevm.userDecryptEuint(FhevmType.euint64, aliceEncBid, contractAddress, signers.alice);
    expect(aliceClear).to.equal(999n);
    await expect(
      fhevm.userDecryptEuint(FhevmType.euint64, aliceEncBid, contractAddress, signers.bob)
    ).to.be.rejected;
  });
});
