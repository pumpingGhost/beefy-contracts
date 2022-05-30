import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import { predictAddresses } from "../../utils/predictAddresses";
import { setCorrectCallFee } from "../../utils/setCorrectCallFee";
import { setPendingRewardsFunctionName } from "../../utils/setPendingRewardsFunctionName";
import { verifyContract } from "../../utils/verifyContract";
import { BeefyChain } from "../../utils/beefyChain";

const registerSubsidy = require("../../utils/registerSubsidy");

const {
  platforms: { spookyswap, beefyfinance },
  tokens: {
    BTC: { address: BTC },
    ETH: { address: ETH },
    BOO: { address: BOO },
    FTM: { address: FTM },
    USDC: { address: USDC },
  },
} = addressBook.fantom;

const shouldVerifyOnEtherscan = false;

const want = web3.utils.toChecksumAddress("0xeaa3C87135eE1140E1D60FC8B577fbb41163D840"); // TODO
const sFTMx = web3.utils.toChecksumAddress("0xd7028092c830b5C8FcE061Af2E593413EbbC1fc1");
const UST = web3.utils.toChecksumAddress("0x846e4D51d7E2043C1a87E0Ab7490B93FB940357b");
const SD = web3.utils.toChecksumAddress("0x412a13C109aC30f0dB80AD3Bd1DeFd5D0A6c0Ac6");

const vaultParams = {
  mooName: "Moo Boo USDC-SD", // TODO
  mooSymbol: "mooBooUSDC-SD", // TODO
  delay: 21600,
};

const strategyParams = {
  want,
  poolId: 3, // TODO
  chef: "0x18b4f774fdC7BF685daeeF66c2990b1dDd9ea6aD", // TODO
  unirouter: spookyswap.router,
  strategist: "0xB189ad2658877C4c63E07480CB680AfE8c192412", // some address
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  outputToNativeRoute: [BOO, FTM], // TODO
  secondOutputToNativeRoute: [FTM], // TODO
  nativeToLp0Route: [FTM, USDC], // TODO
  nativeToLp1Route: [FTM, USDC, SD], // TODO
  //pendingRewardsFunctionName: "pendingBOO", // used for rewardsAvailable(), use correct function name from masterchef
};

const contractNames = {
  vault: "BeefyVaultV6",
  strategy: "StrategySpookyV2LP",
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
    strategyParams.secondOutputToNativeRoute,
    strategyParams.nativeToLp0Route,
    strategyParams.nativeToLp1Route,
  ];
  const strategy = await Strategy.deploy(...strategyConstructorArguments);
  await strategy.deployed();

  // add this info to PR
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
      // verifyContract(vault.address, vaultConstructorArguments),
      verifyContract(strategy.address, strategyConstructorArguments)
    );
  }
 //   await setPendingRewardsFunctionName(strategy, strategyParams.pendingRewardsFunctionName);
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
  