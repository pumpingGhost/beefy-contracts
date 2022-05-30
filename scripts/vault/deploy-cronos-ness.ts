import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import { predictAddresses } from "../../utils/predictAddresses";
import { setCorrectCallFee } from "../../utils/setCorrectCallFee";
import { setPendingRewardsFunctionName } from "../../utils/setPendingRewardsFunctionName";
import { verifyContract } from "../../utils/verifyContract";
import { BeefyChain } from "../../utils/beefyChain";

const registerSubsidy = require("../../utils/registerSubsidy");

const {
  platforms: { beefyfinance },
  tokens: {
    CRO: { address: CRO },
  },
} = addressBook.cronos;

const shouldVerifyOnEtherscan = false;

const want = web3.utils.toChecksumAddress("0xbfAAB211C3ea99A2Db682fbc1D9a999861dCba2D"); // TODO
const NESS = web3.utils.toChecksumAddress("0xE727240728C1a5f95437b8b50AFDd0EA4AE5F0c8");
const MSHARE = web3.utils.toChecksumAddress("0xb011EC534d9175cD7a69aFBfc1bcc9990862c462");
// const USDC = web3.utils.toChecksumAddress("0x04068DA6C83AFCFA0e13ba15A6696662335D5B75");
const BASED = web3.utils.toChecksumAddress("0x8D7d3409881b51466B483B11Ea1B8A03cdEd89ae");
const BSHARE = web3.utils.toChecksumAddress("0x49C290Ff692149A4E16611c694fdED42C954ab7a");
const TOMB = web3.utils.toChecksumAddress("0x6c021Ae822BEa943b2E66552bDe1D2696a53fbB7");

const vaultParams = {
  mooName: "Moo Dark NESS-CRO", // TODO
  mooSymbol: "mooDarkNESS-CRO", // TODO
  delay: 21600,
};

const strategyParams = {
  want,
  poolId: 0, // TODO
  chef: "0x63Df75d039f7d7A8eE4A9276d6A9fE7990D7A6C5",   // Proxy Ness Rewarder
  unirouter: "0x145677FC4d9b8F19B5D56d1820c48e0443049a30",
  strategist: "0x494c13B1729B95a1df383B88340c414E34a57B45", // some address
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  outputToNativeRoute: [NESS, CRO], // TODO
  outputToLp0Route: [NESS, CRO], // TODO
  outputToLp1Route: [NESS], // TODO
  pendingRewardsFunctionName: "pendingReward", // used for rewardsAvailable(), use correct function name from masterchef
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
  