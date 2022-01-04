// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "../../interfaces/common/gauge/IGauge.sol";
import "../../interfaces/common/gauge/IVeWant.sol";
import "../../interfaces/common/gauge/IVeWantFeeDistributor.sol";
import "./GaugeManager.sol";

contract GaugeStaker is GaugeManager {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // Tokens used
    address public want;
    address public veWant;

    uint256 private constant MAXTIME = 4 * 364 * 86400;
    uint256 private constant WEEK = 7 * 86400;

    // Locked balance in the contract
    uint256 public lockedWant;

    event DepositWant(uint256 tvl);
    event WithdrawWant(uint256 tvl);
    event Vote(address[] tokenVote, uint256[] weights);
    event RecoverTokens(address token, uint256 amount);

    constructor(
        address _veWant,
        address _feeDistributor,
        address _gaugeProxy,
        address _keeper,
        address _vault
    ) GaugeManager(_feeDistributor, _gaugeProxy, _keeper, _vault) public {
        veWant = _veWant;
        want = IVeWant(veWant).token();

        IERC20(want).safeApprove(veWant, uint256(-1));
    }

    // vote on boosted farms
    function vote(address[] calldata _tokenVote, uint256[] calldata _weights) external onlyManager {
        IGauge(gaugeProxy).vote(_tokenVote, _weights);
        emit Vote(_tokenVote, _weights);
    }

    // deposit 'want' and lock
    function deposit() external whenNotPaused {
        uint256 wantBal = balanceOfWant();
        if (wantBal > 0) {
            if (balanceOfVe() > 0) {
                lockedWant += wantBal;
                IVeWant(veWant).increase_amount(wantBal);
            } else if (extendLockTime) {
                IVeWant(veWant).withdraw();
                lockedWant = balanceOfWant();
                IVeWant(veWant).create_lock(lockedWant, newUnlockTime());
            }
            emit DepositWant(balanceOf());
        }
    }

    // withdraw 'want' after lock has expired
    function withdraw(uint256 _amount) external onlyVault {
        require(balanceOfVe() == 0, "lock not expired");
        uint256 wantBal = balanceOfWant();

        if (wantBal < _amount) {
            IVeWant(veWant).withdraw();
            lockedWant = 0;
            wantBal = balanceOfWant();
        }

        if (wantBal > _amount) {
            wantBal = _amount;
        }

        IERC20(want).safeTransfer(vault, wantBal);

        emit WithdrawWant(balanceOf());
    }

    // extend lock time before deposit
    function beforeDeposit() external override onlyVault {
        uint256 _newUnlockTime = newUnlockTime();
        if (_newUnlockTime > currentUnlockTime() && extendLockTime) {
            IVeWant(veWant).increase_unlock_time(_newUnlockTime);
        }
    }

    // timestamp at which 'want' is unlocked
    function currentUnlockTime() public view returns (uint256) {
        return IVeWant(veWant).locked__end(address(this));
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
        return IERC20(want).balanceOf(address(this));
    }

    // calculate how much 'veWant' is held by this contract
    function balanceOfVe() public view returns (uint256) {
        return IVeWant(veWant).balanceOf(address(this));
    }

    // prevent any further 'want' deposits and remove approval
    function pause() public onlyManager {
        _pause();
        IERC20(want).safeApprove(veWant, 0);
    }

    // allow 'want' deposits again and reinstate approval
    function unpause() external onlyManager {
        _unpause();
        IERC20(want).safeApprove(veWant, uint256(-1));
    }

    // pass through a deposit to a gauge
    function deposit(address _gauge, address _underlying, uint256 _amount) external onlyStrategy {
        IERC20(_underlying).safeTransferFrom(msg.sender, address(this), _amount);
        IGauge(_gauge).deposit(_amount);
    }

    // pass through a withdrawal from a gauge
    function withdraw(address _gauge, address _underlying, uint256 _amount) external onlyStrategy {
        IGauge(_gauge).withdraw(_amount);
        IERC20(_underlying).safeTransfer(msg.sender, _amount);
    }

    // pass through a full withdrawal from a gauge
    function withdrawAll(address _gauge, address _underlying) external onlyStrategy {
        uint256 _before = IERC20(_underlying).balanceOf(address(this));
        IGauge(_gauge).withdrawAll();
        uint256 _balance = IERC20(_underlying).balanceOf(address(this)).sub(_before);
        IERC20(_underlying).safeTransfer(msg.sender, _balance);
    }

    // pass through rewards from a gauge
    function claimGaugeReward(address _gauge) external onlyStrategy {
        uint256 _before = balanceOfWant();
        IGauge(_gauge).getReward();
        uint256 _balance = balanceOfWant().sub(_before);
        IERC20(want).safeTransfer(msg.sender, _balance);
    }

    // pass through rewards from the fee distributor
    function claimVeWantReward() external onlyStrategy {
        uint256 _before = balanceOfWant();
        IVeWantFeeDistributor(feeDistributor).claim();
        uint256 _balance = balanceOfWant().sub(_before);
        IERC20(want).safeTransfer(msg.sender, _balance);
    }

    // recover any unknown tokens
    function inCaseTokensGetStuck(address _token) external onlyOwner {
        require(_token != want, "!token");

        uint256 _amount = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransfer(msg.sender, _amount);

        emit RecoverTokens(_token, _amount);
    }
}
