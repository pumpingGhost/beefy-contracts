// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

import "../../interfaces/common/gauge/IGauge.sol";
import "../../interfaces/common/gauge/IGaugeStrategy.sol";
import "../../interfaces/common/gauge/IVeWantFeeDistributor.sol";

contract GaugeManager is Initializable, OwnableUpgradeable, PausableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /**
     * @dev Beefy Contracts:
     * {feeDistributor} - Address of the fee distributor for veWant rewards.
     * {gaugeProxy} - Address for voting on gauge weightings.
     * {keeper} - Address to manage a few lower risk features of the strat.
     * {vault} - Address of the vault that controls the strategy's funds.
     */
    IVeWantFeeDistributor public feeDistributor;
    IGauge public gaugeProxy;
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
    function managerInitialize(
        address _feeDistributor,
        address _gaugeProxy,
        address _keeper,
        address _vault
    ) internal initializer {
        __Ownable_init();

        feeDistributor = IVeWantFeeDistributor(_feeDistributor);
        gaugeProxy = IGauge(_gaugeProxy);
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
        feeDistributor = IVeWantFeeDistributor(_feeDistributor);
    }

    /**
     * @dev Updates address where gauge weighting votes will be placed.
     * @param _gaugeProxy new gauge proxy address.
     */
    function setGaugeProxy(address _gaugeProxy) external onlyOwner {
        gaugeProxy = IGauge(_gaugeProxy);
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
            IERC20Upgradeable _want = IGaugeStrategy(_strategy).want();
            address _gauge = IGaugeStrategy(_strategy).gauge();
            _want.safeApprove(_gauge, 0);
            _want.safeApprove(_gauge, type(uint256).max);
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
            IERC20Upgradeable _want = IGaugeStrategy(_strategy).want();
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
