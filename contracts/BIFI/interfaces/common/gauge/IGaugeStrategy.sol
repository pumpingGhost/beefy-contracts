// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IGaugeStrategy {
    function want() external view returns (IERC20);
    function gauge() external view returns (address);
}
