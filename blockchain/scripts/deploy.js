const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying Anchors from ${deployer.address}`);

  const Anchors = await ethers.getContractFactory("Anchors");
  const anchors = await Anchors.deploy();
  await anchors.waitForDeployment();

  console.log(`ANCHOR_CONTRACT_ADDRESS=${await anchors.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
