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
    TEL: { address: TEL },
    ETH: { address: ETH },
  },
} = addressBook.polygon;

const shouldVerifyOnEtherscan = false;

const want = web3.utils.toChecksumAddress("0x7E02A82a9F2b96eE2836c5C64c44e0aB13020f4b"); // LP addr
const BICO = web3.utils.toChecksumAddress("0x91c89A94567980f0e9723b487b0beD586eE96aa7");
// const DQUICK = web3.utils.toChecksumAddress("0xf28164a485b0b2c90639e47b0f377b4a438a16b1")

const vaultParams = {
  mooName: "Moo QuickSwap BICO-ETH",
  mooSymbol: "mooQuickSwapBICO-ETH",
  delay: 21600,
};

const strategyParams = {
  want,
  rewardPool: "0x3C943fB971BCaB9C4919e5FA71612655Ebd663e5",
  unirouter: quickswap.router,
  strategist: "0xc41Caa060d1a95B27D161326aAE1d7d831c5171E", // dev
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  output0ToNativeRoute: [QUICK, MATIC], // ["0x831753DD7087CaC61aB5644b308642cc1c33Dc13", "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270"]
  output1ToNativeRoute: [BICO, ETH, MATIC],
  nativeToLp0Route: [MATIC, ETH],
  nativeToLp1Route: [MATIC, ETH, BICO],
};

const contractNames = {
  vault: "BeefyVaultV6",
  strategy: "StrategyQuickswapDualRewardLP",
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
    strategyParams.output0ToNativeRoute,
    strategyParams.output1ToNativeRoute,
    strategyParams.nativeToLp0Route,
    strategyParams.nativeToLp1Route,
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
  