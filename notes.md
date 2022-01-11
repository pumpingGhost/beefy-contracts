How to find LP addr & rewards pool addr from scratch:
1) Brew the LP token manually
2) Look up the LP token addr on the respective chain explorer
3) Navigate to the contract factory of the LP token contract
4) In the read section of the contract details do a reverse look up query for the rewards token addr

Rewards addr to LP addr:
1) Look up rewards contract addr on block explorer
2) Find the property "stakingToken" in the read section of the contract details

Verifying a contract:
1) Change the path for the flat-hardhat command in package.json to current contract
2) Use yarn flat-hardhat to generate a flattened file including all sources of all interfaces and parent classes of the contract.
3) Remove all but the first license comment
4) Submit flattened source code on block explorer with solidity version 0.6.12
5) Get abi encoded constructor arguments from bytecode of deployment tx -> starts with multiple zeroes
6) Make sure to enable optimization, so that redundant characters like newlines are removed to allow for a bytecode match

General rules:
* Take token swapping routes from native dex of the LP (router is linked in strat arguments anyway)
