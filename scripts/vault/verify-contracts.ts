import hardhat, { ethers, web3 } from "hardhat";
import { addressBook } from "blockchain-addressbook";
import { predictAddresses } from "../../utils/predictAddresses";
import { setCorrectCallFee } from "../../utils/setCorrectCallFee";
import { verifyContract } from "../../utils/verifyContract";
import { BeefyChain } from "../../utils/beefyChain";



async function main() {
    const verifyContractsPromises: Promise<any>[] = [];

    const {
        platforms: { pangolin, beefyfinance },
        tokens: {
          PNG: { address: PNG },
          MIM: { address: MIM },
          AVAX: { address: AVAX },
          USDCe: { address: USDCe },
          DAIe: { address: DAIe },
          TIME: { address: TIME },
          SPELL: { address: SPELL },
          XAVA: { address: XAVA },
          USDC: { address: USDC },
        },
      } = addressBook.avax;
      

      const vault = web3.utils.toChecksumAddress("0x5508222678C5337e76D93A3005dC008056715655"); // TODO
      const strategy = web3.utils.toChecksumAddress("0x7cd5A83891c42aE7dDD3eaAea9D9D54CF4bCb472"); // TODO

      const want = web3.utils.toChecksumAddress("0x40e747f27E6398b1f7C017c5ff5c31a2Ab69261c"); // TODO
      const LUNA = web3.utils.toChecksumAddress("0x120AD3e5A7c796349e591F1570D9f7980F4eA9cb");

    const strategyParams = {
        want,
        poolId: 76,
        chef: pangolin.minichef,
        unirouter: pangolin.router,
        strategist: "0xc41Caa060d1a95B27D161326aAE1d7d831c5171E", // some address
        keeper: beefyfinance.keeper,
        beefyFeeRecipient: beefyfinance.beefyFeeRecipient,
        outputToNativeRoute: [PNG, AVAX],
        outputToLp0Route: [PNG, AVAX, LUNA],
        outputToLp1Route: [PNG, AVAX],
      };

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
        strategyParams.outputToLp0Route,
        strategyParams.outputToLp1Route,
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