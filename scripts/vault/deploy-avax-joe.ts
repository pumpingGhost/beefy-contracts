import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import { predictAddresses } from "../../utils/predictAddresses";
import { setCorrectCallFee } from "../../utils/setCorrectCallFee";
import { verifyContract } from "../../utils/verifyContract";
import { BeefyChain } from "../../utils/beefyChain";

const registerSubsidy = require("../../utils/registerSubsidy");

const {
  platforms: { joe, beefyfinance },
  tokens: {
    PNG: { address: PNG },
    MIM: { address: MIM },
    AVAX: { address: AVAX },
    USDCe: { address: USDCe },
    DAIe: { address: DAIe },
    TIME: { address: TIME },
    SPELL: { address: SPELL },
    XAVA: { address: XAVA },
    JOE: { address: JOE },
  },
} = addressBook.avax;

const shouldVerifyOnEtherscan = false;

const want = web3.utils.toChecksumAddress("0x5B9Faf0feA95df4D4cB894Ef920704daFf656f3E"); // TODO
const DOMI = web3.utils.toChecksumAddress("0xFc6Da929c031162841370af240dEc19099861d3B")

// TODO
const vaultParams = {
  mooName: "Moo Joe AVAX-DOMI", 
  mooSymbol: "mooJoeAVAX-DOMI",
  delay: 21600,
};

const strategyParams = {
  want,
  poolId: 47, // TODO
  chef: joe.masterchefV3,
  unirouter: joe.router,
  strategist: "0xc41Caa060d1a95B27D161326aAE1d7d831c5171E", // some address
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  outputToNativeRoute: [JOE, AVAX],
  secondOutputToNativeRoute: [DOMI, AVAX],
  nativeToLp0Route: [AVAX], // TODO
  nativeToLp1Route: [AVAX, DOMI], // TODO
};

const contractNames = {
  vault: "BeefyVaultV6",
  strategy: "StrategyTraderJoeDualNonNativeLP",
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
  console.log();
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
  