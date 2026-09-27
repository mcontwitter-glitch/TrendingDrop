// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IStoryMarketMirror
/// @notice Read-only Base/Arbitrum mirror of Solana NarrativeAuction StoryMarket state.
/// @dev Solana remains canonical. Updates arrive via authenticated bridge messages.
interface IStoryMarketMirror {
    /// @dev Mirrors programs/narrative-auction MarketPhase.
    enum Phase {
        Draft,
        Active,
        Graduated,
        Failed,
        Forfeited
    }

    struct StorySnapshot {
        bytes32 storyPubkey;
        bytes32 creator;
        bytes32 contentHash;
        Phase phase;
        uint64 totalStakedLamports;
        uint32 uniqueStakers;
        uint64 endsAt;
        uint64 graduationThreshold;
        uint8 rank;
        uint64 slot;
        int64 solanaTimestamp;
    }

    event StoryUpserted(
        bytes32 indexed storyPubkey,
        Phase phase,
        uint64 totalStakedLamports,
        uint64 slot
    );

    /// @notice Apply an attested snapshot from the Solana → L2 bridge relayer.
    function upsertStory(StorySnapshot calldata snap) external;

    function getStory(bytes32 storyPubkey) external view returns (StorySnapshot memory);

    function storyCount() external view returns (uint256);
}
