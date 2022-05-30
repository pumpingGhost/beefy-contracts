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
    USDC: { address: USDC },
    DAIe: { address: DAIe },
    TIME: { address: TIME },
    SPELL: { address: SPELL },
    XAVA: { address: XAVA },
    JOE: { address: JOE },
  },
} = addressBook.avax;

const shouldVerifyOnEtherscan = true;

const want = web3.utils.toChecksumAddress("0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd"); // TODO

// TODO
const vaultParams = {
  mooName: "Moo sJoe", 
  mooSymbol: "mooSJoe",
  delay: 21600,
};

const strategyParams = {
  want,
  rewardPool: "0x1a731B2299E22FbAC282E7094EdA41046343Cb51", // TODO
  unirouter: joe.router,
  strategist: "0x494c13B1729B95a1df383B88340c414E34a57B45", // some address
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  outputToNativeRoute: [USDC, AVAX],
  outputToWantRoute: [USDC, USDCe, JOE]
};

const contractNames = {
  vault: "BeefyVaultV6",
  strategy: "StrategyTraderJoeSingleStake",
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

  // const Vault = await ethers.getContractFactory(contractNames.vault);
  const Strategy = await ethers.getContractFactory(contractNames.strategy);

  const [deployer] = await ethers.getSigners();

  console.log("Deploying:", vaultParams.mooName);

  // const predictedAddresses = await predictAddresses({ creator: deployer.address });

  // const vaultConstructorArguments = [
  //   predictedAddresses.strategy,
  //   vaultParams.mooName,
  //   vaultParams.mooSymbol,
  //   vaultParams.delay,
  // ];
  // const vault = await Vault.deploy(...vaultConstructorArguments);
  // await vault.deployed();

  const strategyConstructorArguments = [
    strategyParams.want,
    strategyParams.rewardPool,
    "0xD24Aa3822934596D8700a93b95E0e54fE509dC12",
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
  console.log();
  console.log("Vault:", "0xD24Aa3822934596D8700a93b95E0e54fE509dC12");
  console.log("Strategy:", strategy.address);
  console.log("Want:", strategyParams.want);
  console.log("stakingContract:", strategyParams.rewardPool);

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
 // await setPendingRewardsFunctionName(strategy, strategyParams.pendingRewardsFunctionName);
  // await setCorrectCallFee(strategy, hardhat.network.name as BeefyChain); // prefer to do it manually
  console.log();

  await Promise.all(verifyContractsPromises);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
  