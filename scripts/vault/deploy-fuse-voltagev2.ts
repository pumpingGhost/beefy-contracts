import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import { predictAddresses } from "../../utils/predictAddresses";
import { setCorrectCallFee } from "../../utils/setCorrectCallFee";
import { setPendingRewardsFunctionName } from "../../utils/setPendingRewardsFunctionName";
import { verifyContract } from "../../utils/verifyContract";
import { BeefyChain } from "../../utils/beefyChain";

const registerSubsidy = require("../../utils/registerSubsidy");

const {
  platforms: { fusefi, beefyfinance },
  tokens: {
    FUSE: { address: FUSE },
  },
} = addressBook.fuse;

const shouldVerifyOnEtherscan = false;

const VOLT = web3.utils.toChecksumAddress("0x34Ef2Cc892a88415e9f02b91BfA9c91fC0bE6bD4");
const BNB = web3.utils.toChecksumAddress("0x6acb34b1Df86E254b544189Ec32Cf737e2482058");
const fUSD = web3.utils.toChecksumAddress("0x249BE57637D8B013Ad64785404b24aeBaE9B098B");
const WBTC = web3.utils.toChecksumAddress("0x33284f95ccb7B948d9D352e1439561CF83d8d00d");
const WETH = web3.utils.toChecksumAddress("0xa722c13135930332Eb3d749B2F0906559D2C5b99");
const UST = web3.utils.toChecksumAddress("0x0D58a44be3dCA0aB449965dcc2c46932547Fea2f");
const GoodDollar = web3.utils.toChecksumAddress("0x495d133B938596C9984d462F007B676bDc57eCEC");
const BUSD = web3.utils.toChecksumAddress("0x6a5F6A8121592BeCd6747a38d67451B310F7f156");
const USDC = web3.utils.toChecksumAddress("0x620fd5fa44BE6af63715Ef4E65DDFA0387aD13F5");
const agEUR = web3.utils.toChecksumAddress("0xeFAeeE334F0Fd1712f9a8cc375f427D9Cdd40d73");

const want = web3.utils.toChecksumAddress("0xeeD7A28eEd4E768fCD46dE3642AB73488De77e11");


const vaultParams = {
  mooName: "Moo Voltage agEUR-FUSE",
  mooSymbol: "mooVoltageagEUR-FUSE",
  delay: 21600,
};

const strategyParams = {
  want,
  poolId: 12,
  chef: "0xE3e184a7b75D0Ae6E17B58F5283b91B4E0A2604F",
  unirouter: "0xE3F85aAd0c8DD7337427B9dF5d0fB741d65EEEB5",
  strategist: "0xc41Caa060d1a95B27D161326aAE1d7d831c5171E", // some address
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  outputToNativeRoute: [VOLT, FUSE],
  secondOutputToNativeRoute: [FUSE],
  nativeToLp0Route: [FUSE],
  nativeToLp1Route: [FUSE, VOLT],
};

const contractNames = {
  vault: "BeefyVaultV6",
  strategy: "StrategyVoltageMultiRewards",
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
    strategyParams.secondOutputToNativeRoute,
    strategyParams.nativeToLp0Route,
    strategyParams.nativeToLp1Route,
  ];
  const strategy = await Strategy.deploy(...strategyConstructorArguments);
  await strategy.deployed();

  // add this info to PR
  console.log("Vault:", vault.address);
  console.log("Strategy:", strategy.address);
  console.log("Want:", strategyParams.want);
  console.log("poolId:", strategyParams.poolId);

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
//   await setPendingRewardsFunctionName(strategy, strategyParams.pendingRewardsFunctionName);
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
  