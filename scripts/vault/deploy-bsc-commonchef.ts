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
   // USDC: { address: USDC },
    //USDT: { address: USDT },
  },
} = addressBook.bsc;

const shouldVerifyOnEtherscan = false;

const want = web3.utils.toChecksumAddress("0xbe6A4f74fdDc88853612C50D7404E059b37692D8"); // TODO
const GAL = web3.utils.toChecksumAddress("0xe4Cc45Bb5DBDA06dB6183E8bf016569f40497Aa5");
const BUSD = web3.utils.toChecksumAddress("0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56");
const CAKE = web3.utils.toChecksumAddress("0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82");
const BNB = web3.utils.toChecksumAddress("0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c");  

const vaultParams = {
  mooName: "Moo CakeV2 GAL-BNB", // TODO
  mooSymbol: "MooCakeV2GAL-BNB", // TODO
  delay: 21600,
};

const strategyParams = {
  want,
  poolId: 98, // TODO
  chef: "0xa5f8C5Dbd5F286960b9d90548680aE5ebFf07652",
  boostStaker: "0xD7C0C12C91750A6ef37580d44B0FD6af1068e615",
  unirouter: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
  strategist: "0x22e3709Cf6476d67F468F29E4dE2051ED53747A4", // some address
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  outputToNativeRoute: [CAKE, BNB], //TODO
  outputToLp0Route: [CAKE, BNB], // TODO
  outputToLp1Route: [CAKE, BNB, GAL], // TODO
  pendingRewardsFunctionName: "pendingCake", // used for rewardsAvailable(), use correct function name from masterchef
};

const contractNames = {
  vault: "BeefyVaultV6",
  strategy: "StrategyCakeBoostedLP",
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
    strategyParams.boostStaker,
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
  