/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/lore_merge.json`.
 */
export type LoreMerge = {
  "address": "8pSr3X9iP66rvqMWT4S2gsEGtS8VnCLZtJayY9NB9ySy",
  "metadata": {
    "name": "loreMerge",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "TrendingDrop — Phase 3 Lore Merge"
  },
  "instructions": [
    {
      "name": "executeMerge",
      "docs": [
        "Execute absorption after quorum + voting window."
      ],
      "discriminator": [
        118,
        136,
        161,
        164,
        6,
        225,
        143,
        51
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  114,
                  103,
                  101,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "proposal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  114,
                  103,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "proposal.absorber",
                "account": "mergeProposal"
              },
              {
                "kind": "account",
                "path": "proposal.target",
                "account": "mergeProposal"
              }
            ]
          }
        },
        {
          "name": "absorberLore",
          "docs": [
            "Absorber lore — gains history entry + lore_power bump."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  111,
                  114,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "proposal.absorber",
                "account": "mergeProposal"
              }
            ]
          }
        },
        {
          "name": "targetLore",
          "docs": [
            "Target lore — transfers current_holder to absorber."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  111,
                  114,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "proposal.target",
                "account": "mergeProposal"
              }
            ]
          }
        },
        {
          "name": "absorberCurve",
          "writable": true
        },
        {
          "name": "targetCurve",
          "writable": true
        },
        {
          "name": "targetVault",
          "writable": true
        },
        {
          "name": "absorberVault",
          "writable": true
        },
        {
          "name": "velocityProgram"
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "executor",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeConfig",
      "docs": [
        "Bootstrap protocol config (treasury, velocity program, vote params)."
      ],
      "discriminator": [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  114,
                  103,
                  101,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "treasury"
        },
        {
          "name": "velocityCurveProgram"
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "feeBps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "proposerMinBps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "quorumBps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "votingDurationSecs",
          "type": {
            "option": "i64"
          }
        }
      ]
    },
    {
      "name": "initializeLoreAsset",
      "docs": [
        "Register a LoreAsset for a graduated VelocityToken curve."
      ],
      "discriminator": [
        220,
        157,
        132,
        39,
        212,
        118,
        201,
        144
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  114,
                  103,
                  101,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "curve"
        },
        {
          "name": "loreAsset",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  111,
                  114,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "curve"
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "contentHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "proposeMerge",
      "docs": [
        "Create merge proposal. Requires holding >1% of absorber supply."
      ],
      "discriminator": [
        116,
        243,
        50,
        14,
        255,
        207,
        76,
        126
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  114,
                  103,
                  101,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "proposal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  114,
                  103,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "absorber"
              },
              {
                "kind": "account",
                "path": "target"
              }
            ]
          }
        },
        {
          "name": "absorber"
        },
        {
          "name": "target"
        },
        {
          "name": "absorberLore",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  111,
                  114,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "absorber"
              }
            ]
          }
        },
        {
          "name": "targetLore",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  111,
                  114,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "target"
              }
            ]
          }
        },
        {
          "name": "proposerHolder"
        },
        {
          "name": "proposer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "targetToken",
          "type": "pubkey"
        },
        {
          "name": "absorptionRatio",
          "type": "u16"
        }
      ]
    },
    {
      "name": "voteMerge",
      "docs": [
        "Vote with holder balance (lore_power soft bonus). One vote per wallet."
      ],
      "discriminator": [
        31,
        122,
        95,
        31,
        18,
        72,
        93,
        253
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  114,
                  103,
                  101,
                  45,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "proposal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  114,
                  103,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "proposal.absorber",
                "account": "mergeProposal"
              },
              {
                "kind": "account",
                "path": "proposal.target",
                "account": "mergeProposal"
              }
            ]
          }
        },
        {
          "name": "voteRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "proposal"
              },
              {
                "kind": "account",
                "path": "voter"
              }
            ]
          }
        },
        {
          "name": "voterHolder"
        },
        {
          "name": "voter",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "support",
          "type": "bool"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "loreAsset",
      "discriminator": [
        0,
        171,
        115,
        117,
        120,
        235,
        120,
        207
      ]
    },
    {
      "name": "mergeConfig",
      "discriminator": [
        188,
        128,
        90,
        187,
        61,
        228,
        50,
        36
      ]
    },
    {
      "name": "mergeProposal",
      "discriminator": [
        9,
        123,
        176,
        217,
        218,
        235,
        50,
        3
      ]
    },
    {
      "name": "voteRecord",
      "discriminator": [
        112,
        9,
        123,
        165,
        234,
        9,
        157,
        167
      ]
    }
  ],
  "events": [
    {
      "name": "loreAssetInitialized",
      "discriminator": [
        141,
        56,
        34,
        75,
        246,
        29,
        77,
        252
      ]
    },
    {
      "name": "mergeConfigInitialized",
      "discriminator": [
        132,
        71,
        193,
        118,
        248,
        100,
        124,
        151
      ]
    },
    {
      "name": "mergeExecuted",
      "discriminator": [
        212,
        9,
        237,
        250,
        181,
        177,
        71,
        244
      ]
    },
    {
      "name": "mergeProposed",
      "discriminator": [
        113,
        180,
        73,
        36,
        170,
        89,
        47,
        59
      ]
    },
    {
      "name": "mergeVoteCast",
      "discriminator": [
        57,
        35,
        21,
        240,
        178,
        18,
        213,
        50
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6001,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6002,
      "name": "zeroAmount",
      "msg": "Amount must be > 0"
    },
    {
      "code": 6003,
      "name": "invalidCurveOwner",
      "msg": "Invalid VelocityCurve account owner"
    },
    {
      "code": 6004,
      "name": "invalidCurveData",
      "msg": "Failed to deserialize VelocityCurve account"
    },
    {
      "code": 6005,
      "name": "invalidHolder",
      "msg": "Holder position does not belong to voter / curve"
    },
    {
      "code": 6006,
      "name": "insufficientHoldings",
      "msg": "Insufficient absorber holdings to propose (>1% required)"
    },
    {
      "code": 6007,
      "name": "sameToken",
      "msg": "Absorber and target must differ"
    },
    {
      "code": 6008,
      "name": "absorberTooYoung",
      "msg": "Absorber lore not old enough for merge (need 7 days)"
    },
    {
      "code": 6009,
      "name": "targetAlreadyAbsorbed",
      "msg": "Target lore already absorbed"
    },
    {
      "code": 6010,
      "name": "absorberInactive",
      "msg": "Absorber lore is absorbed / inactive"
    },
    {
      "code": 6011,
      "name": "votingEnded",
      "msg": "Voting period has ended"
    },
    {
      "code": 6012,
      "name": "votingActive",
      "msg": "Voting period not ended"
    },
    {
      "code": 6013,
      "name": "quorumNotMet",
      "msg": "Quorum not reached"
    },
    {
      "code": 6014,
      "name": "proposalRejected",
      "msg": "Proposal rejected (no >= yes)"
    },
    {
      "code": 6015,
      "name": "alreadyExecuted",
      "msg": "Proposal already executed"
    },
    {
      "code": 6016,
      "name": "historyFull",
      "msg": "Absorption history at max capacity (10)"
    },
    {
      "code": 6017,
      "name": "insufficientVotingPower",
      "msg": "Vote amount exceeds holder voting power"
    },
    {
      "code": 6018,
      "name": "alreadyVoted",
      "msg": "Already voted on this proposal"
    },
    {
      "code": 6019,
      "name": "curveMerged",
      "msg": "Curve is_merged flag set"
    },
    {
      "code": 6020,
      "name": "curveProgramMismatch",
      "msg": "Config velocity_curve_program mismatch"
    },
    {
      "code": 6021,
      "name": "loreMismatch",
      "msg": "Lore asset origin_curve mismatch"
    }
  ],
  "types": [
    {
      "name": "loreAsset",
      "docs": [
        "NFT-like lore asset tied to a curve/token.",
        "Seeds = [b\"lore\", origin_curve]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "originStory",
            "docs": [
              "NarrativeAuction StoryMarket (from VelocityToken.story_id)."
            ],
            "type": "pubkey"
          },
          {
            "name": "originCurve",
            "docs": [
              "Origin VelocityToken curve PDA."
            ],
            "type": "pubkey"
          },
          {
            "name": "currentHolder",
            "docs": [
              "Which token curve currently owns this lore."
            ],
            "type": "pubkey"
          },
          {
            "name": "contentHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "absorptionHistory",
            "docs": [
              "Chain of absorbed origin curves (capped at MAX_ABSORPTION_HISTORY)."
            ],
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "loreValue",
            "docs": [
              "Calculated from original stakes / seed liquidity."
            ],
            "type": "u64"
          },
          {
            "name": "lorePower",
            "docs": [
              "Multiplier in bps (10_000 = 1.0x). Bumps on each absorb."
            ],
            "type": "u32"
          },
          {
            "name": "registeredAt",
            "type": "i64"
          },
          {
            "name": "isAbsorbed",
            "docs": [
              "Set when this lore has been absorbed into another token."
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "loreAssetInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "lore",
            "type": "pubkey"
          },
          {
            "name": "originCurve",
            "type": "pubkey"
          },
          {
            "name": "originStory",
            "type": "pubkey"
          },
          {
            "name": "loreValue",
            "type": "u64"
          },
          {
            "name": "lorePower",
            "type": "u32"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "mergeConfig",
      "docs": [
        "Protocol config for LoreMerge.",
        "Seeds = [b\"merge-config\"]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "velocityCurveProgram",
            "docs": [
              "VelocityCurve program id (owner check for curve / holder PDAs)."
            ],
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "proposerMinBps",
            "type": "u16"
          },
          {
            "name": "quorumBps",
            "type": "u16"
          },
          {
            "name": "votingDurationSecs",
            "type": "i64"
          },
          {
            "name": "mergeMinAgeSecs",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "mergeConfigInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "velocityCurveProgram",
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "mergeExecuted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proposal",
            "type": "pubkey"
          },
          {
            "name": "absorber",
            "type": "pubkey"
          },
          {
            "name": "target",
            "type": "pubkey"
          },
          {
            "name": "loreAsset",
            "type": "pubkey"
          },
          {
            "name": "absorberLorePower",
            "type": "u32"
          },
          {
            "name": "feeLamports",
            "type": "u64"
          },
          {
            "name": "liquidityLamports",
            "type": "u64"
          },
          {
            "name": "absorptionRatio",
            "type": "u16"
          },
          {
            "name": "historyLen",
            "type": "u8"
          },
          {
            "name": "settlementPending",
            "type": "bool"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "mergeProposal",
      "docs": [
        "Community merge proposal (strong token absorbs weak).",
        "Seeds = [b\"merge\", absorber, target]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "absorber",
            "docs": [
              "Strong token curve PDA."
            ],
            "type": "pubkey"
          },
          {
            "name": "target",
            "docs": [
              "Weak token curve PDA to absorb."
            ],
            "type": "pubkey"
          },
          {
            "name": "proposer",
            "type": "pubkey"
          },
          {
            "name": "proposedAt",
            "type": "i64"
          },
          {
            "name": "votingEnds",
            "type": "i64"
          },
          {
            "name": "yesVotes",
            "type": "u64"
          },
          {
            "name": "noVotes",
            "type": "u64"
          },
          {
            "name": "quorumRequired",
            "type": "u64"
          },
          {
            "name": "executed",
            "type": "bool"
          },
          {
            "name": "absorptionRatio",
            "docs": [
              "Target:absorber conversion scaled ×100 (e.g. 500 = 1:5)."
            ],
            "type": "u16"
          },
          {
            "name": "targetLiquiditySnapshot",
            "docs": [
              "Snapshot of target sol_reserve at execute (for settlement crank)."
            ],
            "type": "u64"
          },
          {
            "name": "feeLamports",
            "docs": [
              "5% fee lamports computed at execute."
            ],
            "type": "u64"
          },
          {
            "name": "liquidityLamports",
            "docs": [
              "90% liquidity lamports intended for absorber vault."
            ],
            "type": "u64"
          },
          {
            "name": "settlementPending",
            "docs": [
              "True until VelocityCurve::settle_merge CPI moves vault SOL (cleared on execute)."
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "mergeProposed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proposal",
            "type": "pubkey"
          },
          {
            "name": "absorber",
            "type": "pubkey"
          },
          {
            "name": "target",
            "type": "pubkey"
          },
          {
            "name": "proposer",
            "type": "pubkey"
          },
          {
            "name": "absorptionRatio",
            "type": "u16"
          },
          {
            "name": "quorumRequired",
            "type": "u64"
          },
          {
            "name": "votingEnds",
            "type": "i64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "mergeVoteCast",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proposal",
            "type": "pubkey"
          },
          {
            "name": "voter",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "support",
            "type": "bool"
          },
          {
            "name": "yesVotes",
            "type": "u64"
          },
          {
            "name": "noVotes",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "voteRecord",
      "docs": [
        "One vote per voter per proposal.",
        "Seeds = [b\"vote\", proposal, voter]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proposal",
            "type": "pubkey"
          },
          {
            "name": "voter",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "support",
            "type": "bool"
          },
          {
            "name": "votedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
