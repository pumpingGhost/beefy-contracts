import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import { predictAddresses } from "../../utils/predictAddresses";
import { setCorrectCallFee } from "../../utils/setCorrectCallFee";
import { setPendingRewardsFunctionName } from "../../utils/setPendingRewardsFunctionName";
import { verifyContract } from "../../utils/verifyContract";
import { BeefyChain } from "../../utils/beefyChain";

const registerSubsidy = require("../../utils/registerSubsidy");

const {
  platforms: { biswap, beefyfinance },
  tokens: {
   // USDC: { address: USDC },
    //USDT: { address: USDT },
  },
} = addressBook.bsc;

const shouldVerifyOnEtherscan = false;

const want = web3.utils.toChecksumAddress("0x8eA4875469e8Fd7ad3790b4c7DEeF768ca1e806f"); // TODO
const pBNB = web3.utils.toChecksumAddress("0xA2315cC5A1e4aE3D0a491ED4Fe45EBF8356fEaC7");
const PAE = web3.utils.toChecksumAddress("0x6c7fc3Fd4a9f1Cfa2a69B83F92b9DA7EC26240A2");
const CAKE = web3.utils.toChecksumAddress("0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82");
const BNB = web3.utils.toChecksumAddress("0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c");  

const vaultParams = {
  mooName: "Moo Ripae PAE-BNB", // TODO
  mooSymbol: "MooRipaepPAE-BNB", // TODO
  delay: 21600,
};

const strategyParams = {
  want,
  poolId: 1, // TODO
  chef: "0x18A5aefA5a6B20FeEeF0a3AabF876c813b04dB3d",
  unirouter: "0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8",
  strategist: "0x22e3709Cf6476d67F468F29E4dE2051ED53747A4", // some address
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  outputToNativeRoute: [PAE, BNB], //TODO
  outputToLp0Route: [PAE], // TODO
  outputToLp1Route: [PAE, BNB], // TODO
  pendingRewardsFunctionName: "pendingPAE", // used for rewardsAvailable(), use correct function name from masterchef
};

const contractNames = {
  vault: "BeefyVaultV6",
  strategy: "StrategyCommonChefLP",
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

  //add this info to PR
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
      // verifyContract(strategy.address, strategyConstructorArguments)
    );
  }
    // await setPendingRewardsFunctionName(strategy, strategyParams.pendingRewardsFunctionName);
 // await setCorrectCallFee(strategy, hardhat.network.name as BeefyChain);
  console.log();

  await Promise.all(verifyContractsPromises);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
  