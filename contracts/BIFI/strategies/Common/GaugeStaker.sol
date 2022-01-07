// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

import "../../interfaces/common/gauge/IVeWant.sol";
import "./GaugeManager.sol";

contract GaugeStaker is GaugeManager {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using SafeMathUpgradeable for uint256;

    // Tokens used
    IERC20Upgradeable public want;
    IVeWant public veWant;

    uint256 private constant MAXTIME = 4 * 364 * 86400;
    uint256 private constant WEEK = 7 * 86400;
    bool private lockInitialized;

    // Locked balance in the contract
    uint256 public lockedWant;

    event DepositWant(uint256 tvl);
    event WithdrawWant(uint256 tvl);
    event Vote(address[] tokenVote, uint256[] weights);
    event RecoverTokens(address token, uint256 amount);

    function initialize(
        address _veWant,
        address _feeDistributor,
        address _gaugeProxy,
        address _keeper,
        address _vault
    ) public initializer {
        managerInitialize(_feeDistributor, _gaugeProxy, _keeper, _vault);
        veWant = IVeWant(_veWant);
        want = IERC20Upgradeable(veWant.token());

        want.safeApprove(address(veWant), type(uint256).max);
    }

    // vote on boosted farms
    function vote(address[] calldata _tokenVote, uint256[] calldata _weights) external onlyManager {
        gaugeProxy.vote(_tokenVote, _weights);
        emit Vote(_tokenVote, _weights);
    }

    // deposit 'want' and lock
    function deposit() external whenNotPaused {
        uint256 wantBal = balanceOfWant();
        if (wantBal > 0) {
            if (balanceOfVe() > 0) {
                lockedWant += wantBal;
                veWant.increase_amount(wantBal);
            } else {
                _createLock();
            }
            emit DepositWant(balanceOf());
        }
    }

    // withdraw 'want' after lock has expired
    function withdraw(uint256 _amount) external onlyVault {
        require(balanceOfVe() == 0, "lock not expired");
        uint256 wantBal = balanceOfWant();

        if (wantBal < _amount) {
            veWant.withdraw();
            lockedWant = 0;
            lockInitialized = false;
            wantBal = balanceOfWant();
        }

        if (wantBal > _amount) {
            wantBal = _amount;
        }

        want.safeTransfer(vault, wantBal);

        emit WithdrawWant(balanceOf());
    }

    // extend lock time before deposit
    function beforeDeposit() external override onlyVault {
        uint256 _newUnlockTime = newUnlockTime();
        if (_newUnlockTime > currentUnlockTime() && extendLockTime && lockInitialized) {
            veWant.increase_unlock_time(_newUnlockTime);
        }
    }

    function _createLock() internal {
        if (extendLockTime) {
            veWant.withdraw();
            lockedWant = balanceOfWant();
            lockInitialized = true;
            veWant.create_lock(lockedWant, newUnlockTime());
        }
    }

    // timestamp at which 'want' is unlocked
    function currentUnlockTime() public view returns (uint256) {
        return veWant.locked__end(address(this));
    }

    // new unlock timestamp rounded down to start of the week
    function newUnlockTime() internal view returns (uint256) {
        return block.timestamp.add(MAXTIME).div(WEEK).mul(WEEK);
    }

    // calculate how much total 'want' is held by the staker
    function balanceOf() public view returns (uint256) {
        return lockedWant.add(balanceOfWant());
    }

    // calculate how much 'want' is held by this contract
    function balanceOfWant() public view returns (uint256) {
        return want.balanceOf(address(this));
    }

    // calculate how much 'veWant' is held by this contract
    function balanceOfVe() public view returns (uint256) {
        return veWant.balanceOf(address(this));
    }

    // prevent any further 'want' deposits and remove approval
    function pause() public onlyManager {
        _pause();
        want.safeApprove(address(veWant), 0);
    }

    // allow 'want' deposits again and reinstate approval
    function unpause() external onlyManager {
        _unpause();
        want.safeApprove(address(veWant), type(uint256).max);
    }

    // pass through a deposit to a gauge
    function deposit(address _gauge, address _underlying, uint256 _amount) external onlyStrategy {
        IERC20Upgradeable(_underlying).safeTransferFrom(msg.sender, address(this), _amount);
        IGauge(_gauge).deposit(_amount);
    }

    // pass through a withdrawal from a gauge
    function withdraw(address _gauge, address _underlying, uint256 _amount) external onlyStrategy {
        IGauge(_gauge).withdraw(_amount);
        IERC20Upgradeable(_underlying).safeTransfer(msg.sender, _amount);
    }

    // pass through a full withdrawal from a gauge
    function withdrawAll(address _gauge, address _underlying) external onlyStrategy {
        uint256 _before = IERC20Upgradeable(_underlying).balanceOf(address(this));
        IGauge(_gauge).withdrawAll();
        uint256 _balance = IERC20Upgradeable(_underlying).balanceOf(address(this)).sub(_before);
        IERC20Upgradeable(_underlying).safeTransfer(msg.sender, _balance);
    }

    // pass through rewards from a gauge
    function claimGaugeReward(address _gauge) external onlyStrategy {
        uint256 _before = balanceOfWant();
        IGauge(_gauge).getReward();
        uint256 _balance = balanceOfWant().sub(_before);
        want.safeTransfer(msg.sender, _balance);
    }

    // pass through rewards from the fee distributor
    function claimVeWantReward() external onlyStrategy {
        uint256 _before = balanceOfWant();
        feeDistributor.claim();
        uint256 _balance = balanceOfWant().sub(_before);
        want.safeTransfer(msg.sender, _balance);
    }

    // recover any unknown tokens
    function inCaseTokensGetStuck(address _token) external onlyOwner {
        require(_token != address(want), "!token");

        uint256 _amount = IERC20Upgradeable(_token).balanceOf(address(this));
        IERC20Upgradeable(_token).safeTransfer(msg.sender, _amount);

        emit RecoverTokens(_token, _amount);
    }
}
