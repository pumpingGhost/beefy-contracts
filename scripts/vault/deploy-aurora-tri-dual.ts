import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import { predictAddresses } from "../../utils/predictAddresses";
import { setCorrectCallFee } from "../../utils/setCorrectCallFee";
import { verifyContract } from "../../utils/verifyContract";
import { BeefyChain } from "../../utils/beefyChain";

const registerSubsidy = require("../../utils/registerSubsidy");

const {
  platforms: { trisolaris, beefyfinance },
  tokens: {
    ETH: { address: ETH },
  },
} = addressBook.aurora;

const shouldVerifyOnEtherscan = false;

const want = web3.utils.toChecksumAddress("0x5913f644A10d98c79F2e0b609988640187256373"); // TODO
const TRI = web3.utils.toChecksumAddress("0xFa94348467f64D5A457F75F8bc40495D33c65aBB");
const NEAR = web3.utils.toChecksumAddress("0xC42C30aC6Cc15faC9bD938618BcaA1a1FaE8501d");
const xTRI = web3.utils.toChecksumAddress("0x802119e4e253D5C19aA06A5d567C5a41596D6803");
const stNEAR = web3.utils.toChecksumAddress("0x07F9F7f963C5cD2BBFFd30CcfB964Be114332E30");
const META = web3.utils.toChecksumAddress("0xc21Ff01229e982d7c8b8691163B0A3Cb8F357453");


// TODO
const vaultParams = {
  mooName: "Moo Tri stNEAR-xTRI", 
  mooSymbol: "mooTristNEAR-xTRI",
  delay: 21600,
};

const strategyParams = {
  want,
  poolId: 11, // TODO
  chef: trisolaris.minichef,
  unirouter: trisolaris.router,
  strategist: "0x494c13B1729B95a1df383B88340c414E34a57B45", // some address
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  outputToNativeRoute: [TRI, NEAR , ETH],
  rewardToOutputRoute: [META, NEAR, TRI],
  outputToLp0Route: [TRI, NEAR, stNEAR], // TODO
  outputToLp1Route: [TRI, NEAR, stNEAR, xTRI], // TODO
};

const contractNames = {
  vault: "BeefyVaultV6",
  strategy: "StrategyTriMiniChefDualLP",
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
    strategyParams.rewardToOutputRoute,
    strategyParams.outputToLp0Route,
    strategyParams.outputToLp1Route,
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
  