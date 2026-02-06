const { ethers } = require("ethers");

const errors = [
    "CurrencyNotSettled()",
    "PoolNotInitialized()",
    "AlreadyUnlocked()",
    "ManagerLocked()",
    "TickSpacingTooLarge(int24)",
    "TickSpacingTooSmall(int24)",
    "CurrenciesOutOfOrderOrEqual(address,address)",
    "UnauthorizedDynamicLPFeeUpdate()",
    "SwapAmountCannotBeZero()",
    "NonzeroNativeValue()",
    "MustClearExactPositiveDelta()",
    "ProtocolFeeControllerNotSet()",
    "InvalidProtocolFee()",
    "InvalidHookResponse()",
    "HookAddressNotValid(address)"
];

console.log("Error Selectors:");
errors.forEach(err => {
    const selector = ethers.id(err).slice(0, 10);
    console.log(`${selector} : ${err}`);
});

const target = "0x7c9c6e8f";
console.log(`\nTarget: ${target}`);
