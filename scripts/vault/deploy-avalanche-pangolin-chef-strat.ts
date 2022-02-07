import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import { predictAddresses } from "../../utils/predictAddresses";
import { setCorrectCallFee } from "../../utils/setCorrectCallFee";
import { verifyContract } from "../../utils/verifyContract";
import { BeefyChain } from "../../utils/beefyChain";

const registerSubsidy = require("../../utils/registerSubsidy");

const {
  platforms: { pangolin, beefyfinance },
  tokens: {
    PNG: { address: PNG },
    MIM: { address: MIM },
    AVAX: { address: AVAX },
    USDCe: { address: USDCe },
    DAIe: { address: DAIe },
    TIME: { address: TIME },
    SPELL: { address: SPELL },
    XAVA: { address: XAVA },
  },
} = addressBook.avax;

const shouldVerifyOnEtherscan = false;

const want = web3.utils.toChecksumAddress("0xdeaBb6e80141F5E557EcBDD7e9580F37D7BBc371"); // TODO
const UST = web3.utils.toChecksumAddress("0x260Bbf5698121EB85e7a74f2E45E16Ce762EbE11");
const LUNA = web3.utils.toChecksumAddress("0x120AD3e5A7c796349e591F1570D9f7980F4eA9cb");

// TODO
const vaultParams = {
  mooName: "Moo PangolinV2 UST-AVAX", 
  mooSymbol: "mooPangolinV2UST-AVAX",
  delay: 21600,
};

const strategyParams = {
  want,
  poolId: 74, // TODO
  chef: pangolin.minichef,
  unirouter: pangolin.router,
  strategist: "0xc41Caa060d1a95B27D161326aAE1d7d831c5171E", // some address
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  outputToNativeRoute: [PNG, AVAX],
  outputToLp0Route: [PNG, AVAX, UST], // TODO
  outputToLp1Route: [PNG, AVAX], // TODO
  // rewardsToOutputRoute: [LOOT, AVAX, PNG] //TODO
};
// luna -> avax -> png: 
// [0x120AD3e5A7c796349e591F1570D9f7980F4eA9cb, 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7, 0x60781C2586D68229fde47564546784ab3fACA982]

// avax -> png: 
// [0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7, 0x60781C2586D68229fde47564546784ab3fACA982]

const contractNames = {
  vault: "BeefyVaultV6",
  strategy: "StrategyPangolinMiniChefLP",
};

async function main() {
  if (
    Object.values(vaultParams).some(v => v === undefined) ||
    Object.values(strategyParams).some(v => v === undefined) ||
    Object.values(contractNames).some(v => v === undefined)
  ) {
    console.error("one of config values undefined");
    return;
  }

  await hardhat.run("compile");

  const Vault = await ethers.getContractFactory(contractNames.vault);
  const Strategy = await ethers.getContractFactory(contractNames.strategy);

  const [deployer] = await ethers.getSigners();

  console.log("Deploying:", vaultParams.mooName);

  const predictedAddresses = await predictAddresses({ creator: deployer.address });

  const vaultConstructorArguments = [
    predictedAddresses.strategy,
    vaultParams.mooName,
    vaultParams.mooSymbol,
    vaultParams.delay,
  ];
  const vault = await Vault.deploy(...vaultConstructorArguments);
  await vault.deployed();

  const strategyConstructorArguments = [
    strategyParams.want,
    strategyParams.poolId,
    strategyParams.chef,
    vault.address,
    strategyParams.unirouter,
    strategyParams.keeper,
    strategyParams.strategist,
    strategyParams.beefyFeeRecipient,
    strategyParams.outputToNativeRoute,
    strategyParams.outputToLp0Route,
    strategyParams.outputToLp1Route,
  ];
  const strategy = await Strategy.deploy(...strategyConstructorArguments);
  await strategy.deployed();

  // add this info to PR
  console.log();
  console.log("Vault:", vault.address);
  console.log("Strategy:", strategy.address);
  console.log("Want:", strategyParams.want);
  console.log("PoolId:", strategyParams.poolId);

  console.log();
  console.log("Running post deployment");

  const verifyContractsPromises: Promise<any>[] = [];
  if (shouldVerifyOnEtherscan) {
    // skip await as this is a long running operation, and you can do other stuff to prepare vault while this finishes
    verifyContractsPromises.push(
      verifyContract(vault.address, vaultConstructorArguments),
      verifyContract(strategy.address, strategyConstructorArguments)
    );
  }
 // await setPendingRewardsFunctionName(strategy, strategyParams.pendingRewardsFunctionName);
  // await setCorrectCallFee(strategy, hardhat.network.name as BeefyChain); // prefer to do it manually
  console.log();

  await Promise.all(verifyContractsPromises);

  if (hardhat.network.name === "bsc") {
    await registerSubsidy(vault.address, deployer);
    await registerSubsidy(strategy.address, deployer);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
  