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
    mooName: "Moo Beet A Dai-abolical Balance",
    mooSymbol: "mooBeetDaiabolicalBalance",
    delay: 21600,
};

const strategyParams = {
    // TODO: wantPoolId(hex), nativeSwapPoolId, inputSwapPoolId
    balancerPoolIds: ["0xd5e946b5619fff054c40d38c976f1d06c1e2fa820002000000000000000003ac", "0xcde5a11a4acb4ee4c805352cec57e236bdbc3837000200000000000000000019", "0xcde5a11a4acb4ee4c805352cec57e236bdbc3837000200000000000000000019"],
    chefPoolId: 80, // TODO
    chef: "0x8166994d9ebBe5829EC86Bd81258149B87faCfd3",
    input: FTM, // TODO: choose either FTM, UDSC or BEETS as input token(You can provide the full amount in the same currency, no need for equal shares between the tokens)
    unirouter: "0x20dd72Ed959b6147912C2e529F0a0C651c33c9ce", // Beethoven master vault
    keeper: beefyfinance.keeper, //0x340465d9D2EbDE78F15a3870884757584F97aBB4
    strategist: "0xB189ad2658877C4c63E07480CB680AfE8c192412",
    beefyFeeRecipient: beefyfinance.beefyFeeRecipient //0x502C107ae28d300fDAedE1CBd7ee8096C1ab4a3C
};

// Boomer: 0x8DBB92ca6c399792AC07510a0996C59902cD75a1, 62

// FTM-BEETS: 0xcde5a11a4acb4ee4c805352cec57e236bdbc3837000200000000000000000019
// ["0xd5e946b5619fff054c40d38c976f1d06c1e2fa820002000000000000000003ac", "0xcde5a11a4acb4ee4c805352cec57e236bdbc3837000200000000000000000019", "0x63386ef152e1ddef96c065636d6cc0165ff332910002000000000000000000a1"]
//seconoutput: ["0xfa1fbb8ef55a4855e5688c0ee13ac3f202486286","0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e", "0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83"]
//native: ["0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83", "0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e"]

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
    
    const predeployedStrategy = web3.utils.toChecksumAddress("0x6300574CD6d142fE3115fBA7217f71E02878618E");

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
