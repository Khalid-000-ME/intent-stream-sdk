// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

contract V4Test {
    IPoolManager public manager;

    constructor(address _manager) {
        manager = IPoolManager(_manager);
    }
}
