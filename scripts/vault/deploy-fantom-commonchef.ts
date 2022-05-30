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
    BSHARE: { address: BSHARE}
  },
} = addressBook.fantom;

const shouldVerifyOnEtherscan = false;

const want = web3.utils.toChecksumAddress("0x7c849a7E2cb08f09cf37482cc0A04ecB5891844a"); // TODO
const BASED = web3.utils.toChecksumAddress("0x8D7d3409881b51466B483B11Ea1B8A03cdEd89ae");
const MSHARE = web3.utils.toChecksumAddress("0xb011EC534d9175cD7a69aFBfc1bcc9990862c462");
// const USDC = web3.utils.toChecksumAddress("0x04068DA6C83AFCFA0e13ba15A6696662335D5B75");
const LUNA = web3.utils.toChecksumAddress("0x593AE1d34c8BD7587C11D539E4F42BFf242c82Af");
const UST = web3.utils.toChecksumAddress("0x846e4D51d7E2043C1a87E0Ab7490B93FB940357b");
const TOMB = web3.utils.toChecksumAddress("0x6c021Ae822BEa943b2E66552bDe1D2696a53fbB7");

const vaultParams = {
  mooName: "Moo Based BASED-USDC", // TODO
  mooSymbol: "mooBasedBASED-USDC", // TODO
  delay: 21600,
};

const strategyParams = {
  want,
  poolId: 8, // TODO
  chef: "0xAc0fa95058616D7539b6Eecb6418A68e7c18A746",
  unirouter: spookyswap.router,
  strategist: "0xB189ad2658877C4c63E07480CB680AfE8c192412", // some address
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  outputToNativeRoute: [BSHARE, FTM], // TODO
  outputToLp0Route: [BSHARE, FTM, USDC], // TODO
  outputToLp1Route: [BSHARE, FTM, USDC, BASED], // TODO
  pendingRewardsFunctionName: "pendingShare", // used for rewardsAvailable(), use correct function name from masterchef
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
  