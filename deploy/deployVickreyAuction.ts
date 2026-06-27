import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

// Auction duration: 24 hours for testnet deployment
const DURATION_SECONDS = 10 * 60;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // Beneficiary = deployer by default; override via env var BENEFICIARY_ADDRESS
  const beneficiary = process.env.BENEFICIARY_ADDRESS ?? deployer;

  console.log(`Deploying VickreyAuction...`);
  console.log(`  Deployer:    ${deployer}`);
  console.log(`  Beneficiary: ${beneficiary}`);
  console.log(`  Duration:    ${DURATION_SECONDS}s (${DURATION_SECONDS / 3600}h)`);

  const deployed = await deploy("VickreyAuction", {
    from: deployer,
    args: [beneficiary, DURATION_SECONDS],
    log: true,
  });

  console.log(`\nVickreyAuction deployed at: ${deployed.address}`);
  console.log(`\nNext steps:`);
  console.log(`  npx hardhat --network sepolia task:auction-info`);
  console.log(`  npx hardhat --network sepolia task:place-bid --value 100`);
};

export default func;
func.id = "deploy_vickrey_auction";
func.tags = ["VickreyAuction"];
