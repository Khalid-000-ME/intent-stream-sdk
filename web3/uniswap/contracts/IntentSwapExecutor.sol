// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Minimal Uniswap V3 Router Interface (SwapRouter02)
interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        // uint256 deadline; // REMOVED: SwapRouter02 does NOT use deadline in struct
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

contract IntentSwapExecutor is Ownable {
    using SafeERC20 for IERC20;

    ISwapRouter public immutable swapRouter;

    // Event for when a swap is executed based on an intent
    event IntentExecuted(bytes32 indexed intentId, address indexed user, uint256 amountIn, uint256 amountOut);

    constructor(address _swapRouter) Ownable(msg.sender) {
        swapRouter = ISwapRouter(_swapRouter);
    }

    // struct representing the Intent
    struct Intent {
        bytes32 id;
        address user;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 deadline; // We keep deadline here for intent validity check
        uint24 fee;
    }

    // Execute a swap based on verified intent
    function executeIntent(
        Intent calldata intent
    ) external onlyOwner returns (uint256 amountOut) {
        require(block.timestamp <= intent.deadline, "Intent expired");

        // 1. Transfer tokens from user to this contract
        IERC20(intent.tokenIn).safeTransferFrom(intent.user, address(this), intent.amountIn);

        // 2. Approve SwapRouter
        IERC20(intent.tokenIn).approve(address(swapRouter), intent.amountIn);

        // 3. Execute Swap
        // Note: SwapRouter02 does NOT take deadline in the params struct for exactInputSingle
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: intent.tokenIn,
            tokenOut: intent.tokenOut,
            fee: intent.fee,
            recipient: intent.user, 
            amountIn: intent.amountIn,
            amountOutMinimum: intent.minAmountOut,
            sqrtPriceLimitX96: 0
        });

        amountOut = swapRouter.exactInputSingle(params);

        emit IntentExecuted(intent.id, intent.user, intent.amountIn, amountOut);
    }

    // Function to rescue tokens if needed
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}
