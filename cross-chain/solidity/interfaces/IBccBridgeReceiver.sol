// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IBccBridgeReceiver
/// @notice Generic hook for Wormhole / LayerZero / CCIP authenticated payloads.
interface IBccBridgeReceiver {
    /// @param sourceChain Bridge-specific chain id for Solana (implementation-defined).
    /// @param payload     ABI- or borsh-compatible BCC mirror message (see docs/CROSS_CHAIN.md).
    function receiveBccMessage(uint16 sourceChain, bytes calldata payload) external;
}
