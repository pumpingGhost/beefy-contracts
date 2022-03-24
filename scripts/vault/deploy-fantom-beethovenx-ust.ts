import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import { predictAddresses } from "../../utils/predictAddresses";
import { setCorrectCallFee } from "../../utils/setCorrectCallFee";
import { verifyContract } from "../../utils/verifyContract";
import { BeefyChain } from "../../utils/beefyChain";

const registerSubsidy = require("../../utils/registerSubsidy");

const {
    platforms: { beets, beefyfinance },
    tokens: {
        FTM: { address: FTM },
        BEETS: { address: BEETS },
        USDC: { address: USDC },
    },
} = addressBook.fantom;

const shouldVerifyOnEtherscan = false;

const DEUS = web3.utils.toChecksumAddress("0xDE5ed76E7c05eC5e4572CfC88d1ACEA165109E44");

// TODO
const vaultParams = {
    mooName: "Moo Beet UST (Axelar) - UST (Wormhole)",
    mooSymbol: "mooBeetUST(Axelar)-UST(Wormhole)",
    delay: 21600,
};

const strategyParams = {
    // TODO: wantPoolId(hex), nativeSwapPoolId, inputSwapPoolId
    balancerPoolIds: ["0x8b858eaf095a7337de6f9bc212993338773ca34e00020000000000000000023c", "0xcde5a11a4acb4ee4c805352cec57e236bdbc3837000200000000000000000019"],
    chefPoolId: 67, // TODO
    chef: "0x8166994d9ebBe5829EC86Bd81258149B87faCfd3",
    unirouter: "0x20dd72Ed959b6147912C2e529F0a0C651c33c9ce", // Beethoven master vault
    keeper: beefyfinance.keeper,
    strategist: "0xc41Caa060d1a95B27D161326aAE1d7d831c5171E",
    beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
    secondOutputToNativeRoute: [DEUS, FTM], // ["0xDE5ed76E7c05eC5e4572CfC88d1ACEA165109E44", "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83"]
    nativeToInputRoute: [FTM, USDC], // ["0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83", "0x04068DA6C83AFCFA0e13ba15A6696662335D5B75"]
};


// FTM-BEETS: 0xcde5a11a4acb4ee4c805352cec57e236bdbc3837000200000000000000000019
// ["0x66bcb58cf9754f421c268990b280e4462e10aac8000200000000000000000339", "0xcde5a11a4acb4ee4c805352cec57e236bdbc3837000200000000000000000019", "0xcde5a11a4acb4ee4c805352cec57e236bdbc3837000200000000000000000019"]

const contractNames = {
    vault: "BeefyVaultV6",
    strategy: "StrategyBeethovenxSpiritRouter",
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

    // const predictedAddresses = await predictAddresses({ creator: deployer.address });
    
    const predeployedStrategy = web3.utils.toChecksumAddress("0x62159EAae3Cec9a447AEf1d0400c8596AC9FDA27");

    const vaultConstructorArguments = [
        predeployedStrategy,
        vaultParams.mooName,
        vaultParams.mooSymbol,
        vaultParams.delay,
    ];
    const vault = await Vault.deploy(...vaultConstructorArguments);
    await vault.deployed();

    const strategyConstructorArguments = [
        strategyParams.balancerPoolIds,
        strategyParams.chefPoolId,
        strategyParams.chef,
        vault.address,
        strategyParams.unirouter,
        strategyParams.keeper,
        strategyParams.strategist,
        strategyParams.beefyFeeRecipient,
        strategyParams.secondOutputToNativeRoute,
        strategyParams.nativeToInputRoute,
    ];

    // const strategy = await Strategy.deploy(...strategyConstructorArguments);
    // await strategy.deployed();

    // add this info to PR
    console.log("Vault:", vault.address);
    console.log("Strategy:", predeployedStrategy);
    console.log("ChefPoolId:", strategyParams.chefPoolId);
    console.log("WantPoolId:", strategyParams.balancerPoolIds[0]);

    console.log();
    console.log("Running post deployment");

    const verifyContractsPromises: Promise<any>[] = [];
    if (shouldVerifyOnEtherscan) {
        // skip await as this is a long running operation, and you can do other stuff to prepare vault while this finishes
        verifyContractsPromises.push(
            verifyContract(vault.address, vaultConstructorArguments),
            // verifyContract(strategy.address, strategyConstructorArguments)
        );
    }
    // await setPendingRewardsFunctionName(strategy, strategyParams.pendingRewardsFunctionName);
    // await setCorrectCallFee(strategy, hardhat.network.name as BeefyChain); // prefer to do it manually
    console.log();

    await Promise.all(verifyContractsPromises);

    if (hardhat.network.name === "bsc") {
        await registerSubsidy(vault.address, deployer);
        // await registerSubsidy(strategy.address, deployer);
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
