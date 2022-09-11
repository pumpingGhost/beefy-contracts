// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin-4/contracts/token/ERC20/ERC20.sol";

interface IVVSRewarder {
    function pendingToken(uint256 _pid, address _user) external view returns (address token, uint256 amount);
}