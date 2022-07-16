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

const want = web3.utils.toChecksumAddress("0xAA9BE68D990d5e56870B2E0544f96ffb0B1dA8F7"); // TODO
const TOMB = web3.utils.toChecksumAddress("0x6c021Ae822BEa943b2E66552bDe1D2696a53fbB7");
const LSHARE = web3.utils.toChecksumAddress("0xCbE0CA46399Af916784cADF5bCC3aED2052D6C45");
const MIM = web3.utils.toChecksumAddress("0x82f0B8B456c1A451378467398982d4834b6829c1");
// const SHA = web3.utils.toChecksumAddress("0xe0654C8e6fd4D733349ac7E09f6f23DA256bF475");


const vaultParams = {
  mooName: "Moo Dummy TOMB-USDC", // TODO
  mooSymbol: "mooDummyTOMB-USDC", // TODO
  delay: 21600,
};

const strategyParams = {
  want,
  poolId: 1, // TODO 
  chef: "0x1F832dfBA15346D25438Cf7Ac683b013Ed03E32f",   // Based masterchef:  0xAc0fa95058616D7539b6Eecb6418A68e7c18A746; TshareRewarder: 0xcc0a87F7e7c693042a9Cc703661F5060c80ACb43; LshareRewarder: 0x1F832dfBA15346D25438Cf7Ac683b013Ed03E32f
  unirouter: "0x6D0176C5ea1e44b08D3dd001b0784cE42F47a3A7",
  strategist: "0xB189ad2658877C4c63E07480CB680AfE8c192412", // some address
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  outputToNativeRoute: [LSHARE, USDC, FTM], // TODO
  outputToLp0Route: [LSHARE, USDC], // TODO
  outputToLp1Route: [LSHARE, USDC, TOMB], // TODO
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
  