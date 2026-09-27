// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IVelocityMirror
/// @notice Read-only Base/Arbitrum mirror of Solana VelocityCurve token state.
interface IVelocityMirror {
    struct VelocitySnapshot {
        bytes32 curvePubkey;
        bytes32 storyId;
        bytes32 mint;
        uint64 currentPriceLamports;
        uint64 currentSupply;
        uint32 attentionScore;
        int32 priceVelocity;
        uint16 sellTaxBps;
        uint64 solReserveLamports;
        bool isMerged;
        uint64 slot;
        int64 solanaTimestamp;
    }

    event VelocityUpserted(
        bytes32 indexed curvePubkey,
        uint64 currentPriceLamports,
        uint32 attentionScore,
        uint64 slot
    );

    function upsertVelocity(VelocitySnapshot calldata snap) external;

    function getVelocity(bytes32 curvePubkey) external view returns (VelocitySnapshot memory);
}
