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
// const VVS = web3.utils.toChecksumAddress("0x2D03bECE6747ADC00E1a131BBA1469C15fD11e03");
const FER = web3.utils.toChecksumAddress("0x39bC1e38c842C60775Ce37566D03B41A7A66C782");
const WBTC = web3.utils.toChecksumAddress("0x33284f95ccb7B948d9D352e1439561CF83d8d00d");
const WETH = web3.utils.toChecksumAddress("0xa722c13135930332Eb3d749B2F0906559D2C5b99");
const UST = web3.utils.toChecksumAddress("0x0D58a44be3dCA0aB449965dcc2c46932547Fea2f");


const want = web3.utils.toChecksumAddress("0x72eFd454bBFEca458e909B99FAACBC116880b54D"); // TODO

// TODO
const vaultParams = {
  mooName: "Moo VVS FER-VVS",
  mooSymbol: "mooVvsFER-VVS",
  delay: 21600,
};

const strategyParams = {
  want,
  poolId: 36, // TODO
  chef: "0xbc149c62EFe8AFC61728fC58b1b66a0661712e76",
  unirouter: vvs.router,
  strategist: "0x494c13B1729B95a1df383B88340c414E34a57B45", // some address
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  outputToNativeRoute: [VVS, CRO], // TODO
  secondOutputToNativeRoute: [FER, VVS, CRO], // TODO
  nativeToLp0Route: [CRO, VVS], // TODO
  nativeToLp1Route: [CRO, VVS, FER], // TODO
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
  