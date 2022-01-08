How to find LP addr & rewards pool addr from scratch:
1) Brew the LP token manually
2) Look up the LP token addr on the respective chain explorer
3) Navigate to the contract factory of the LP token contract
4) In the read section of the contract details do a reverse look up query for the rewards token addr

Rewards addr to LP addr:
1) Look up rewards contract addr on block explorer
2) Find the property "stakingToken" in the read section of the contract details