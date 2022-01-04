// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../../interfaces/common/gauge/IGaugeStrategy.sol";

contract GaugeManager is Ownable, Pausable {
    using SafeERC20 for IERC20;

    /**
     * @dev Beefy Contracts:
     * {feeDistributor} - Address of the fee distributor for veWant rewards.
     * {gaugeProxy} - Address for voting on gauge weightings.
     * {keeper} - Address to manage a few lower risk features of the strat.
     * {vault} - Address of the vault that controls the strategy's funds.
     */
    address public feeDistributor;
    address public gaugeProxy;
    address public keeper;
    address public vault;

    mapping(address => bool) isStrategy;
    bool public extendLockTime;

    /**
     * @dev Initializes the base strategy.
     * @param _feeDistributor address of veWant fee distributor.
     * @param _gaugeProxy address of gauge proxy to vote on.
     * @param _keeper address to use as alternative owner.
     * @param _vault address of parent vault.
     */
    constructor(
        address _feeDistributor,
        address _gaugeProxy,
        address _keeper,
        address _vault
    ) public {
        feeDistributor = _feeDistributor;
        gaugeProxy = _gaugeProxy;
        keeper = _keeper;
        vault = _vault;
        extendLockTime = true;
    }

    // checks that caller is either owner or keeper.
    modifier onlyManager() {
        require(msg.sender == owner() || msg.sender == keeper, "!manager");
        _;
    }

    // checks that caller is the vault.
    modifier onlyVault {
        require(msg.sender == vault, "!vault");
        _;
    }

    // checks that caller is the strategy.
    modifier onlyStrategy {
        require(isStrategy[msg.sender], "!strategy");
        _;
    }

    /**
     * @dev Updates address of the fee distributor.
     * @param _feeDistributor new fee distributor address.
     */
    function setFeeDistributor(address _feeDistributor) external onlyOwner {
        feeDistributor = _feeDistributor;
    }

    /**
     * @dev Updates address where gauge weighting votes will be placed.
     * @param _gaugeProxy new gauge proxy address.
     */
    function setGaugeProxy(address _gaugeProxy) external onlyOwner {
        gaugeProxy = _gaugeProxy;
    }

    /**
     * @dev Updates address of the strat keeper.
     * @param _keeper new keeper address.
     */
    function setKeeper(address _keeper) external onlyManager {
        keeper = _keeper;
    }

    /**
     * @dev Updates parent vault.
     * @param _vault new vault address.
     */
    function setVault(address _vault) external onlyOwner {
        vault = _vault;
    }

    /**
     * @dev Turns on or off extending lock time for veWant.
     * @param _extendLockTime boolean for extending locks.
     */
    function setExtendLockTime(bool _extendLockTime) external onlyManager {
        extendLockTime = _extendLockTime;
    }

     /**
     * @dev Whitelists a strategy address to interact with the Gauge Staker and gives approvals.
     * @param _strategy new strategy address.
     * @param _approveGauge boolean for giving approvals for the gauge.
     */
    function whitelistStrategy(address _strategy, bool _approveGauge) external onlyOwner {
        isStrategy[_strategy] = true;

        if (_approveGauge) {
            IERC20 _want = IGaugeStrategy(_strategy).want();
            address _gauge = IGaugeStrategy(_strategy).gauge();
            _want.safeApprove(_gauge, 0);
            _want.safeApprove(_gauge, uint256(-1));
        }
    }

    /**
     * @dev Removes a strategy address from the whitelist and remove approvals.
     * @param _strategy remove strategy address from whitelist.
     * @param _disapproveGauge boolean for removing approvals for the gauge.
     */
    function blacklistStrategy(address _strategy, bool _disapproveGauge) external onlyManager {
        isStrategy[_strategy] = false;

        if (_disapproveGauge) {
            IERC20 _want = IGaugeStrategy(_strategy).want();
            address _gauge = IGaugeStrategy(_strategy).gauge();
            _want.safeApprove(_gauge, 0);
        }
    }

    /**
     * @dev Function to synchronize balances before new user deposit.
     * Can be overridden in the strategy.
     */
    function beforeDeposit() external virtual {}
}
