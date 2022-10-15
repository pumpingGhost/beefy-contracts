import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import { predictAddresses } from "../../utils/predictAddresses";
import { setCorrectCallFee } from "../../utils/setCorrectCallFee";
import { setPendingRewardsFunctionName } from "../../utils/setPendingRewardsFunctionName";
import { verifyContract } from "../../utils/verifyContract";
import { BeefyChain } from "../../utils/beefyChain";

const registerSubsidy = require("../../utils/registerSubsidy");

const {
  platforms: { stellaswap, beefyfinance },
  tokens: {
    STELLA: { address: STELLA },
   // GLMR: { address: GLMR },
  },
} = addressBook.moonbeam;

const shouldVerifyOnEtherscan = false;

const want = web3.utils.toChecksumAddress("0x8577273FB3B72306F3A59E26ab77116f5D428DAa"); // TODO
const ETH = web3.utils.toChecksumAddress("0xab3f0245B83feB11d15AAffeFD7AD465a59817eD");
const GLMR = web3.utils.toChecksumAddress("0xAcc15dC74880C9944775448304B263D191c6077F");
const CAKE = web3.utils.toChecksumAddress("0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82");
const BNB = web3.utils.toChecksumAddress("0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c");  

const vaultParams = {
  mooName: "Moo Stellaswap ETH-GLMR", // TODO
  mooSymbol: "mooStellaswapETH-GLMR", // TOD
  delay: 21600,
};

const strategyParams = {
  want,
  poolId: 29, // TODO
  chef: "0xF3a5454496E26ac57da879bf3285Fa85DEBF0388",
  unirouter: "0x70085a09D30D6f8C4ecF6eE10120d1847383BB57",
  strategist: "0x1A2aff8453b211F1fcFE97718A0f23232A6A5403", // some address
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  beefyFeeConfig: "0xeEaFF5116C09ECc20Ab72b53860A7ceAd97F0Ab4",
  outputToNativeRoute: [STELLA, GLMR], //TODO
  nativeToLp0Route: [GLMR, ETH], // TODO
  nativeToLp1Route: [GLMR], // TODO
  pendingRewardsFunctionName: "pendingCake", // used for rewardsAvailable(), use correct function name from masterchef
};

const contractNames = {
  vault: "BeefyVaultV6",
  strategy: "StrategyStellaswapMultiRewardsLP",
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

  const CommonAddresses = [
    vault.address,
    strategyParams.unirouter,
    strategyParams.keeper,
    strategyParams.strategist,
    strategyParams.beefyFeeRecipient,
    strategyParams.beefyFeeConfig
  ];

  const strategyConstructorArguments = [
    strategyParams.want,
    strategyParams.poolId,
    strategyParams.chef,
    CommonAddresses,
    strategyParams.outputToNativeRoute,
    strategyParams.nativeToLp0Route,
    strategyParams.nativeToLp1Route,
  ];
  const strategy = await Strategy.deploy(...strategyConstructorArguments);
  await strategy.deployed();

  // add this info to PR
  console.log("Vault:", vault.address);
  // console.log("Strategy:", strategy.address);
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
    await setPendingRewardsFunctionName(strategy, strategyParams.pendingRewardsFunctionName);
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
  