import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import { predictAddresses } from "../../utils/predictAddresses";
import { setCorrectCallFee } from "../../utils/setCorrectCallFee";
import { setPendingRewardsFunctionName } from "../../utils/setPendingRewardsFunctionName";
import { verifyContract } from "../../utils/verifyContract";
import { BeefyChain } from "../../utils/beefyChain";

const registerSubsidy = require("../../utils/registerSubsidy");

const {
  platforms: { quickswap, beefyfinance },
  tokens: {
    MATIC: { address: MATIC },
    QUICK: { address: QUICK },
    ETH: { address: ETH },
    USDC: { address: USDC },
    USDT: { address: USDT },
  },
} = addressBook.polygon;

const shouldVerifyOnEtherscan = false;

const want = web3.utils.toChecksumAddress("0x369582d2010B6eD950B571F4101e3bB9b554876F"); // TODO
const SAND = web3.utils.toChecksumAddress("0xBbba073C31bF03b8ACf7c28EF0738DeCF3695683");

// TODO
const vaultParams = {
  mooName: "Moo QuickSwap SAND-MATIC",
  mooSymbol: "mooQuickSwapSAND-MATIC",
  delay: 21600,
};

const strategyParams = {
  want,
  rewardPool: "0x411b772B9eb19a33E7af5fCD9B1629D2015DC886", // TODO
  unirouter: quickswap.router,
  strategist: "0x494c13B1729B95a1df383B88340c414E34a57B45", // dev
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  outputToNativeRoute: [QUICK, MATIC],
  outputToLp0Route: [QUICK, MATIC], // TODO
  outputToLp1Route: [QUICK, MATIC, SAND], // TODO
};

const contractNames = {
  vault: "BeefyVaultV6",
  strategy: "StrategyPolygonQuickLP", // TODO
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
    strategyParams.rewardPool,
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
  console.log("RewardPool:", strategyParams.rewardPool);

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
  // await setCorrectCallFee(strategy, hardhat.network.name as BeefyChain);
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
  