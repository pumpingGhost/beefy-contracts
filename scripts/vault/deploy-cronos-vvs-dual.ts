import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import { predictAddresses } from "../../utils/predictAddresses";
import { setCorrectCallFee } from "../../utils/setCorrectCallFee";
import { setPendingRewardsFunctionName } from "../../utils/setPendingRewardsFunctionName";
import { verifyContract } from "../../utils/verifyContract";
import { BeefyChain } from "../../utils/beefyChain";

const registerSubsidy = require("../../utils/registerSubsidy");

const {
  platforms: { vvs, beefyfinance },
  tokens: {
    CRO: { address: CRO },
    VVS: { address: VVS },
  },
} = addressBook.cronos;

const shouldVerifyOnEtherscan = false;

const ALI = web3.utils.toChecksumAddress("0x45C135C1CDCE8d25A3B729A28659561385C52671");
const BNB = web3.utils.toChecksumAddress("0x6acb34b1Df86E254b544189Ec32Cf737e2482058");
const fUSD = web3.utils.toChecksumAddress("0x249BE57637D8B013Ad64785404b24aeBaE9B098B");
const WBTC = web3.utils.toChecksumAddress("0x33284f95ccb7B948d9D352e1439561CF83d8d00d");
const WETH = web3.utils.toChecksumAddress("0xa722c13135930332Eb3d749B2F0906559D2C5b99");
const UST = web3.utils.toChecksumAddress("0x0D58a44be3dCA0aB449965dcc2c46932547Fea2f");
const GoodDollar = web3.utils.toChecksumAddress("0x495d133B938596C9984d462F007B676bDc57eCEC");
const BUSD = web3.utils.toChecksumAddress("0x6a5F6A8121592BeCd6747a38d67451B310F7f156");
const USDC = web3.utils.toChecksumAddress("0x620fd5fa44BE6af63715Ef4E65DDFA0387aD13F5");
const agEUR = web3.utils.toChecksumAddress("0xeFAeeE334F0Fd1712f9a8cc375f427D9Cdd40d73");

const want = web3.utils.toChecksumAddress("0x78082d9Dee5FDD53dF3b16292077Ee2F6D31F7DE"); // TODO

// TODO
const vaultParams = {
  mooName: "Moo VVS CRO-ALI",
  mooSymbol: "mooVvsCRO-ALI",
  delay: 21600,
};

const strategyParams = {
  want,
  poolId: 22, // TODO
  chef: "0xbc149c62EFe8AFC61728fC58b1b66a0661712e76",
  unirouter: vvs.router,
  strategist: "0x494c13B1729B95a1df383B88340c414E34a57B45", // some address
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  outputToNativeRoute: [VVS, CRO], // TODO
  secondOutputToNativeRoute: [ALI, CRO], // TODO
  nativeToLp0Route: [CRO, ALI], // TODO
  nativeToLp1Route: [CRO], // TODO
};

const contractNames = {
  vault: "BeefyVaultV6",
  strategy: "StrategyVVSDualRewards",
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
  