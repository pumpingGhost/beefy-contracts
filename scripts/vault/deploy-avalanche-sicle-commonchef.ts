import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import { predictAddresses } from "../../utils/predictAddresses";
import { setCorrectCallFee } from "../../utils/setCorrectCallFee";
import { setPendingRewardsFunctionName } from "../../utils/setPendingRewardsFunctionName";
import { verifyContract } from "../../utils/verifyContract";
import { BeefyChain } from "../../utils/beefyChain";

const registerSubsidy = require("../../utils/registerSubsidy");

const {
  platforms: { joe, beefyfinance },
  tokens: {
    AVAX: { address: AVAX },
    ETH: { address: ETH },
  },
} = addressBook.avax;

const shouldVerifyOnEtherscan = false;

const want = web3.utils.toChecksumAddress("0x2C10416Cc050fD446c7Ab595b28DEE8C71F18d2A"); // TODO
const POPS = web3.utils.toChecksumAddress("0x240248628B7B6850352764C5dFa50D1592A033A8");
const USDC = web3.utils.toChecksumAddress("0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E");
const LINKe = web3.utils.toChecksumAddress("0x5947BB275c521040051D82396192181b413227A3");
const TOMB = web3.utils.toChecksumAddress("0x6c021Ae822BEa943b2E66552bDe1D2696a53fbB7");

const vaultParams = {
  mooName: "Moo Sicle LINK.e-WAVAX", // TODO
  mooSymbol: "mooSicleLINK.e-WAVAX", // TODO
  delay: 21600,
};

const strategyParams = {
  want,
  poolId: 10, // TODO
  chef: "0xd3344E9a4Bc67de0dF101CEe5B047fe2dc5AF354",
  unirouter: "0xC7f372c62238f6a5b79136A9e5D16A2FD7A3f0F5",
  strategist: "0x135ED183a23b1C45F8134f5E0053077940EE0D3D", // some address
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  outputToNativeRoute: [POPS, AVAX], // TODO
  outputToLp0Route: [POPS, AVAX, LINKe], // TODO
  outputToLp1Route: [POPS, AVAX], // TODO
  pendingRewardsFunctionName: "pendingPops", // used for rewardsAvailable(), use correct function name from masterchef
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
  