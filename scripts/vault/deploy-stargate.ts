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
  },
} = addressBook.fantom;

const shouldVerifyOnEtherscan = false;

const want = web3.utils.toChecksumAddress("0x12edeA9cd262006cC3C4E77c90d2CD2DD4b1eb97"); // TODO
const USDC = web3.utils.toChecksumAddress("0x04068DA6C83AFCFA0e13ba15A6696662335D5B75");
const STG = web3.utils.toChecksumAddress("0x2F6F07CDcf3588944Bf4C42aC74ff24bF56e7590");

const vaultParams = {
  mooName: "Moo Stargate USDC", // TODO
  mooSymbol: "mooStargateUSDC", // TODO
  delay: 21600,
};

const strategyParams = {
  want,
  farmPoolId: 0, // TODO
  routerPoolId: 1,
  chef: "0x224D8Fd7aB6AD4c6eb4611Ce56EF35Dec2277F03",   // Stargate Rewarder
  unirouter: spookyswap.router,
  stargaterouter: "0xAf5191B0De278C7286d6C7CC6ab6BB8A73bA2Cd6",
  strategist: "0x494c13B1729B95a1df383B88340c414E34a57B45", // some address
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  outputToNativeRoute: [STG, USDC, FTM], // TODO
  outputToLp0Route: [STG, USDC], // TODO
  pendingRewardsFunctionName: "pendingStargate", // used for rewardsAvailable(), use correct function name from masterchef
};

const contractNames = {
  vault: "BeefyVaultV6",
  strategy: "StrategyStargateStaking",
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
    strategyParams.farmPoolId,
    strategyParams.routerPoolId,
    strategyParams.chef,
    vault.address,
    strategyParams.unirouter,
    strategyParams.stargaterouter,
    strategyParams.keeper,
    strategyParams.strategist,
    strategyParams.beefyFeeRecipient,
    strategyParams.outputToNativeRoute,
    strategyParams.outputToLp0Route,
  ];
  const strategy = await Strategy.deploy(...strategyConstructorArguments);
  await strategy.deployed();

  // add this info to PR
  console.log("Vault:", vault.address);
  console.log("Strategy:", strategy.address);
  console.log("Want:", strategyParams.want);
  console.log("PoolId:", strategyParams.farmPoolId);

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
    await setPendingRewardsFunctionName(strategy, strategyParams.pendingRewardsFunctionName);
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
  