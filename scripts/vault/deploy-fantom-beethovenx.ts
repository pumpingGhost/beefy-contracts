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
    },
} = addressBook.fantom;

const shouldVerifyOnEtherscan = false;

// TODO
const vaultParams = {
    mooName: "Moo Beet Boomer Beets",
    mooSymbol: "mooBeetBoomerBeets",
    delay: 21600,
};

const strategyParams = {
    // TODO: wantPoolId(hex), nativeSwapPoolId, inputSwapPoolId
    balancerPoolIds: ["0x8fdd16a23aebe95b928f1863760618e9ec29e72d000100000000000000000166", "0xcde5a11a4acb4ee4c805352cec57e236bdbc3837000200000000000000000019", "0xcde5a11a4acb4ee4c805352cec57e236bdbc3837000200000000000000000019"],
    chefPoolId: 50, // TODO
    chef: "0x8166994d9ebBe5829EC86Bd81258149B87faCfd3",
    input: FTM, // TODO: choose either FTM, UDSC or BEETS as input token(You can provide the full amount in the same currency, no need for equal shares between the tokens)
    unirouter: "0x20dd72Ed959b6147912C2e529F0a0C651c33c9ce", // Beethoven master vault
    keeper: beefyfinance.keeper,
    strategist: "0xc41Caa060d1a95B27D161326aAE1d7d831c5171E",
    beefyFeeRecipient: beefyfinance.beefyFeeRecipient
};

// Boomer: 0x8DBB92ca6c399792AC07510a0996C59902cD75a1, 62

// FTM-BEETS: 0xcde5a11a4acb4ee4c805352cec57e236bdbc3837000200000000000000000019
// ["0x8dbb92ca6c399792ac07510a0996c59902cd75a1000200000000000000000299", "0xcde5a11a4acb4ee4c805352cec57e236bdbc3837000200000000000000000019", "0xcde5a11a4acb4ee4c805352cec57e236bdbc3837000200000000000000000019"]

const contractNames = {
    vault: "BeefyVaultV6",
    strategy: "StrategyBeethovenx",
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

    //const predictedAddresses = await predictAddresses({ creator: deployer.address });
    
    const predeployedStrategy = web3.utils.toChecksumAddress("0xceb6d118640FF21ED47de296669Ba7A74752942b");

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
        strategyParams.input,
        vault.address,
        strategyParams.unirouter,
        strategyParams.keeper,
        strategyParams.strategist,
        strategyParams.beefyFeeRecipient,
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
