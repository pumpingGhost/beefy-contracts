// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin-4/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin-4/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../interfaces/common/IComptroller.sol";
import "../../interfaces/common/ISolidlyRouter.sol";
import "./StrategyCompoundV2.sol";


//Lending Strategy 
contract StrategyCompoundV2Solidly is StrategyCompoundV2 {
    using SafeERC20 for IERC20;

    // Routes
    ISolidlyRouter.Routes[] public outputToNativeRoute;
    ISolidlyRouter.Routes[] public outputToWantRoute;

    constructor(
        uint256 _borrowRate,
        uint256 _borrowRateMax,
        uint256 _borrowDepth,
        uint256 _minLeverage,
        ISolidlyRouter.Routes[] memory _outputToNativeRoute,
        ISolidlyRouter.Routes[] memory _outputToWantRoute,
        address[] memory _markets,
        address _comptroller,
        CommonAddresses memory _commonAddresses
    ) StrategyCompoundV2(_borrowRate, _borrowRateMax, _borrowDepth, _minLeverage, _markets, _comptroller, _commonAddresses) {
        for (uint i; i < _outputToNativeRoute.length;) {
            outputToNativeRoute.push(_outputToNativeRoute[i]);
            unchecked { ++i; }
        }

        for (uint i; i < _outputToWantRoute.length;) {
            outputToWantRoute.push(_outputToWantRoute[i]);
            unchecked { ++i; }
        }

        output = outputToNativeRoute[0].from;
        native = outputToNativeRoute[outputToNativeRoute.length -1].to;

        _giveAllowances();
        IComptroller(comptroller).enterMarkets(markets);
    }

    // performance fees
    function chargeFees(address callFeeRecipient) internal override {
        IFeeConfig.FeeCategory memory fees = getFees();
        uint256 toNative = IERC20(output).balanceOf(address(this)) * fees.total / DIVISOR;
        ISolidlyRouter(unirouter).swapExactTokensForTokens(toNative, 0, outputToNativeRoute, address(this), block.timestamp);

        uint256 nativeBal = IERC20(native).balanceOf(address(this));

        uint256 callFeeAmount = nativeBal * fees.call / DIVISOR;
        IERC20(native).safeTransfer(callFeeRecipient, callFeeAmount);

        uint256 beefyFeeAmount = nativeBal * fees.beefy / DIVISOR;
        IERC20(native).safeTransfer(beefyFeeRecipient, beefyFeeAmount);

        uint256 strategistFeeAmount = nativeBal * fees.strategist / DIVISOR;
        IERC20(native).safeTransfer(strategist, strategistFeeAmount);

        emit ChargedFees(callFeeAmount, beefyFeeAmount, strategistFeeAmount);
    }

    // swap rewards to {want}
    function swapRewards() internal override {
        uint256 outputBal = IERC20(output).balanceOf(address(this));
        ISolidlyRouter(unirouter).swapExactTokensForTokens(outputBal, 0, outputToWantRoute, address(this), block.timestamp);
    }

    // native reward amount for calling harvest
    function callReward() public override returns (uint256) {
        IFeeConfig.FeeCategory memory fees = getFees();
        uint256 outputBal = rewardsAvailable();
        uint256 nativeOut;
        if (outputBal > 0) {
            uint256[] memory amountOut = ISolidlyRouter(unirouter).getAmountsOut(outputBal, outputToNativeRoute);
            nativeOut = amountOut[amountOut.length -1];
        }

        return nativeOut * fees.total / DIVISOR * fees.call / DIVISOR;
    }

    function _solidlyToRoute(ISolidlyRouter.Routes[] memory _route) internal pure returns (address[] memory) {
        address[] memory route = new address[](_route.length + 1);
        route[0] = _route[0].from;
        for (uint i; i < _route.length; ++i) {
            route[i + 1] = _route[i].to;
        }
        return route;
    }

    function outputToNative() external view override returns (address[] memory) {
        ISolidlyRouter.Routes[] memory _route = outputToNativeRoute;
        return _solidlyToRoute(_route);
    }

    function outputToWant() external view override returns (address[] memory) {
        ISolidlyRouter.Routes[] memory _route = outputToWantRoute;
        return _solidlyToRoute(_route);
    }
}