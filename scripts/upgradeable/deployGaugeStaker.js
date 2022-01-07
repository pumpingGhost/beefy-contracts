const hardhat = require("hardhat");
const { getImplementationAddress } = require("@openzeppelin/upgrades-core");
const { addressBook } = require("blockchain-addressbook");
import { predictAddresses } from "../../utils/predictAddresses";

const ethers = hardhat.ethers;

const chain = "fantom";

const config = {
  veWant: '0x2FBFf41a9efAEAE77538bd63f1ea489494acdc08',
  feeDistributor: '0x18CeF75C2b032D7060e9Cf96F29aDF74a9a17ce6',
  gaugeProxy: '0x420b17f69618610DE18caCd1499460EFb29e1d8f',
  keeper: '0x10aee6B5594942433e7Fc2783598c979B030eF3D',
};

const vaultParams = {
  mooName: "binSPIRIT",
  mooSymbol: "binSPIRIT",
  delay: 21600,
};

async function main() {
  await hardhat.run("compile");

  const [deployer] = await ethers.getSigners();
  const provider = deployer.provider;

  const contractNames = {
    vault: "BeefyVaultV6Locking",
    gaugeStaker: "GaugeStaker",
  };

  const Vault = await ethers.getContractFactory(contractNames.vault);
  const GaugeStaker = await ethers.getContractFactory(contractNames.gaugeStaker);

  const predictedAddresses = await predictAddresses({ creator: deployer.address });

  console.log(predictedAddresses);

  const staker = await upgrades.deployProxy(GaugeStaker, [
    config.veWant,
    config.feeDistributor,
    config.gaugeProxy,
    config.keeper,
    predictedAddresses.vault,
  ]);

  await staker.deployed();

  const vaultConstructorArguments = [
    staker.address,
    vaultParams.mooName,
    vaultParams.mooSymbol,
    vaultParams.delay,
  ];

  const vault = await Vault.deploy(...vaultConstructorArguments);
  await vault.deployed();

  const implementationAddr = await getImplementationAddress(provider, staker.address);

  console.log(`Deployed proxy at ${staker.address}`);
  console.log(`Deployed implementation at ${implementationAddr}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
