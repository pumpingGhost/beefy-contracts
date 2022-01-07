// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

interface IGaugeStaker {
    function deposit() external;
    function withdraw(uint256 _amount) external;
    function beforeDeposit() external;
    function currentUnlockTime() external view returns (uint256);
    function balanceOf() external view returns (uint256);
    function balanceOfWant() external view returns (uint256);
    function balanceOfVe() external view returns (uint256);
    function deposit(address _gauge, address _underlying, uint256 _amount) external;
    function withdraw(address _gauge, address _underlying, uint256 _amount) external;
    function withdrawAll(address _gauge, address _underlying) external;
    function claimGaugeReward(address _gauge) external;
    function claimVeWantReward() external;
}
