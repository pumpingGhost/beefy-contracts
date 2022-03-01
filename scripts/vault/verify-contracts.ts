import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import { predictAddresses } from "../../utils/predictAddresses";
import { setCorrectCallFee } from "../../utils/setCorrectCallFee";
import { verifyContract } from "../../utils/verifyContract";
import { BeefyChain } from "../../utils/beefyChain";



async function main() {
    const verifyContractsPromises: Promise<any>[] = [];

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
    
    const shouldVerifyOnEtherscan = true;
    
    const want = web3.utils.toChecksumAddress("0x939D6eD8a0f7FC90436BA6842D7372250a03fA7c"); // TODO
    const FIEF = web3.utils.toChecksumAddress("0xeA068Fba19CE95f12d252aD8Cb2939225C4Ea02D")
    
    // TODO
    const vaultParams = {
      mooName: "Moo Joe AVAX-FIEF", 
      mooSymbol: "mooJoeAVAX-FIEF",
      delay: 21600,
    };
    
    const strategyParams = {
      want,
      poolId: 52, // TODO
      chef: joe.masterchefV3,
      unirouter: joe.router,
      strategist: "0xc41Caa060d1a95B27D161326aAE1d7d831c5171E", // some address
      keeper: beefyfinance.keeper,
      beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
      outputToNativeRoute: [JOE, AVAX],
      nativeToLp0Route: [AVAX], // TODO
      nativeToLp1Route: [AVAX, FIEF], // TODO
    };


    const vault = web3.utils.toChecksumAddress("0x87267285Bd7990B05950703f7bA6b24dF88aa302");
    const strategy = web3.utils.toChecksumAddress("0x3CeC1409d3a1de52bB566a7d006AbDb37c31Eea9");  

    const strategyConstructorArguments = [
      strategyParams.want,
      strategyParams.poolId,
      strategyParams.chef,
      vault,
      strategyParams.unirouter,
      strategyParams.keeper,
      strategyParams.strategist,
      strategyParams.beefyFeeRecipient,
      strategyParams.outputToNativeRoute,
      strategyParams.nativeToLp0Route,
      strategyParams.nativeToLp1Route,
    ];

    verifyContractsPromises.push(
        // verifyContract(vault, vaultConstructorArguments),
        verifyContract(strategy, strategyConstructorArguments)
    );

    console.log();

    await Promise.all(verifyContractsPromises);

    console.log("Successfully verified!");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });