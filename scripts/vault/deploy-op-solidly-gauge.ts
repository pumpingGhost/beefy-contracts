import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import { predictAddresses } from "../../utils/predictAddresses";
import { setCorrectCallFee } from "../../utils/setCorrectCallFee";
import { verifyContract } from "../../utils/verifyContract";
import { BeefyChain } from "../../utils/beefyChain";

const registerSubsidy = require("../../utils/registerSubsidy");

const {
  platforms: {  velodrome, beefyfinance },
  tokens: {
    OP: { address: OP },
    ETH: { address: ETH },
    VELO: { address: VELO },
    USDC: { address: USDC },
    MAI: {address: MAI },
  },
} = addressBook.optimism;

const shouldVerifyOnEtherscan = false;

const want = web3.utils.toChecksumAddress("0x050D6Dbc73F6993A29e1327846117C4F5Fc7D68E");     //TODO
const gauge = web3.utils.toChecksumAddress("0x1d7334f6c718EB1956B31F0E292AaE69D0E65a05");    //TODO
const agEUR = web3.utils.toChecksumAddress("0x9485aca5bbBE1667AD97c7fE7C4531a624C8b1ED");
const jEUR = web3.utils.toChecksumAddress("0x79AF5dd14e855823FA3E9ECAcdF001D99647d043");
//const ensId = ethers.utils.formatBytes32String("cake.eth");

const vaultParams = {
  mooName: "Moo Velodrome jEUR-agEUR",
  mooSymbol: "mooVelodromejEUR-agEUR",
  delay: 21600,
};

const strategyParams = {
  want: want,
  gauge: gauge,
  unirouter: velodrome.router,
  strategist: "0xD340e02a1174696f77Df3c9ca043c809453c5C83", // Distributor
  keeper: beefyfinance.keeper,
  beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
  beefyFeeConfig: beefyfinance.beefyFeeConfig,
  outputToNativeRoute: [[VELO, ETH, false]],
  outputToLp0Route: [[VELO, USDC, false], [USDC, agEUR, false], [agEUR, jEUR, true]],
  outputToLp1Route: [[VELO, USDC, false], [USDC, agEUR, false]],
};

// stable Swap: true
// volatile Swap: false


const contractNames = {
  vault: "BeefyVaultV6",
  strategy: "StrategyCommonSolidlyGaugeLP",
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

  const CommonAddresses = [
    vault.address,
    strategyParams.unirouter,
    strategyParams.keeper,
    strategyParams.strategist,
    strategyParams.beefyFeeRecipient,
    strategyParams.beefyFeeConfig
  ];

  const strategyConstructorArguments = [
    strategyParams.want,
    strategyParams.gauge,
    CommonAddresses,
    strategyParams.outputToNativeRoute,
    strategyParams.outputToLp0Route,
    strategyParams.outputToLp1Route,
  ];

  const strategy = await Strategy.deploy(...strategyConstructorArguments);
  await strategy.deployed();

  // add this info to PR
  console.log();
  console.log("Vault:", vault.address);
  console.log("Strategy:", strategy.address);
  console.log("Want:", strategyParams.want);
  console.log("gauge:", strategyParams.gauge);

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

  await Promise.all(verifyContractsPromises);

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });