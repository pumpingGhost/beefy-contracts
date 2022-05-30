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
    BSHARE: { address: BSHARE },
  },
} = addressBook.fantom;

const shouldVerifyOnEtherscan = false;

const want = web3.utils.toChecksumAddress("0x37fb87347BCAd93B12Fd4E43BCf07620d6387A92"); // TODO
const TREEB = web3.utils.toChecksumAddress("0xc60D7067dfBc6f2caf30523a064f416A5Af52963");
const TSHARE = web3.utils.toChecksumAddress("0x4cdF39285D7Ca8eB3f090fDA0C069ba5F4145B37");
const BASED = web3.utils.toChecksumAddress("0x8D7d3409881b51466B483B11Ea1B8A03cdEd89ae");
// const SHA = web3.utils.toChecksumAddress("0xe0654C8e6fd4D733349ac7E09f6f23DA256bF475");


const vaultParams = {
  mooName: "Moo Tomb TREEB-USDC", // TODO
  mooSymbol: "mooTombTREEB-USDC", // TODO
  delay: 21600,
};

const strategyParams = {
  want,
  poolId: 15, // TODO
  chef: "0xcc0a87F7e7c693042a9Cc703661F5060c80ACb43",   // Based masterchef:  0xAc0fa95058616D7539b6Eecb6418A68e7c18A746
  unirouter: "0x6D0176C5ea1e44b08D3dd001b0784cE42F47a3A7",
  strategist: "0xB189ad2658877C4c63E07480CB680AfE8c192412", // some address
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  outputToNativeRoute: [TSHARE, USDC, FTM], // TODO
  outputToLp0Route: [TSHARE, USDC], // TODO
  outputToLp1Route: [TSHARE, USDC, TREEB], // TODO
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
    //   verifyContract(vault.address, vaultConstructorArguments),
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
  