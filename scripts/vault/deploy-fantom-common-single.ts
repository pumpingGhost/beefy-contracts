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
    PAE: { address: PAE },
    pFTM: { address: pFTM },
  },
} = addressBook.fantom;

const shouldVerifyOnEtherscan = false;

const want = web3.utils.toChecksumAddress("0x112df7e3b4b7ab424f07319d4e92f41e6608c48b"); // TODO
const MvDollar = web3.utils.toChecksumAddress("0x57976c467608983513c9355238dc6de1B1aBbcCA");
const MSHARE = web3.utils.toChecksumAddress("0xb011EC534d9175cD7a69aFBfc1bcc9990862c462");
// const USDC = web3.utils.toChecksumAddress("0x04068DA6C83AFCFA0e13ba15A6696662335D5B75");
const BASED = web3.utils.toChecksumAddress("0x8D7d3409881b51466B483B11Ea1B8A03cdEd89ae");
const BSHARE = web3.utils.toChecksumAddress("0x49C290Ff692149A4E16611c694fdED42C954ab7a");
const TOMB = web3.utils.toChecksumAddress("0x6c021Ae822BEa943b2E66552bDe1D2696a53fbB7");

const vaultParams = {
  mooName: "Moo Ripae pFTM", // TODO
  mooSymbol: "mooRipaepFTM", // TODO
  delay: 21600,
};

const strategyParams = {
  want,
  poolId: 3, // TODO
  chef: "0xa058316Af6275137B3450C9C9A4022dE6482BaC2",   // Ripae Rewarder
  unirouter: spookyswap.router,
  strategist: "0xc41Caa060d1a95B27D161326aAE1d7d831c5171E", // some address
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  outputToNativeRoute: [PAE, FTM], // TODO
  outputToWantRoute: [PAE, FTM, pFTM], // TODO
  pendingRewardsFunctionName: "pendingPAE", // used for rewardsAvailable(), use correct function name from masterchef
};

const contractNames = {
  vault: "BeefyVaultV6",
  strategy: "StrategyCommonChefSingle",
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
    strategyParams.outputToWantRoute,
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
  