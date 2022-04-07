import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import { predictAddresses } from "../../utils/predictAddresses";
import { setCorrectCallFee } from "../../utils/setCorrectCallFee";
import { setPendingRewardsFunctionName } from "../../utils/setPendingRewardsFunctionName";
import { verifyContract } from "../../utils/verifyContract";
import { BeefyChain } from "../../utils/beefyChain";

const registerSubsidy = require("../../utils/registerSubsidy");

const {
  platforms: { pancake, beefyfinance },
  tokens: {
    BNB: { address: BNB },
  },
} = addressBook.bsc;

const shouldVerifyOnEtherscan = false;

const want = web3.utils.toChecksumAddress("0x9aA83081AA06AF7208Dcc7A4cB72C94d057D2cda"); // TODO
const BUSD = web3.utils.toChecksumAddress("0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56");
const STG = web3.utils.toChecksumAddress("0xB0D502E938ed5f4df2E681fE6E419ff29631d62b");
const USDT = web3.utils.toChecksumAddress("0x55d398326f99059fF775485246999027B3197955");


const vaultParams = {
  mooName: "Moo Stargate USDT", // TODO
  mooSymbol: "mooStargateUSDT", // TODO
  delay: 21600,
};

const strategyParams = {
  want,
  farmPoolId: 0, // TODO
  routerPoolId: 2,
  chef: "0x3052A0F6ab15b4AE1df39962d5DdEFacA86DaB47",   // Stargate Rewarder
  unirouter: pancake.router,
  stargaterouter: "0x4a364f8c717cAAD9A442737Eb7b8A55cc6cf18D8",
  strategist: "0x494c13B1729B95a1df383B88340c414E34a57B45", // some address
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  outputToNativeRoute: [STG, BUSD, BNB], // TODO
  outputToLp0Route: [STG, BUSD, USDT], // TODO
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
  