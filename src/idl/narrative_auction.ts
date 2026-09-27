/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/narrative_auction.json`.
 */
export type NarrativeAuction = {
  "address": "75xWzXGb3A7UgpqDDL9ByVXpaZ8Zw4AF4i7whnVXyh8m",
  "metadata": {
    "name": "narrativeAuction",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Bonding Curve Casino — Phase 1 Narrative Auction"
  },
  "instructions": [
    {
      "name": "claimStake",
      "discriminator": [
        62,
        145,
        133,
        242,
        244,
        59,
        53,
        139
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  97,
                  114,
                  114,
                  97,
                  116,
                  105,
                  118,
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
          "name": "story",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  111,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "story.creator",
                "account": "storyMarket"
              },
              {
                "kind": "account",
                "path": "story.content_hash",
                "account": "storyMarket"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  111,
                  114,
                  121,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "story"
              }
            ]
          }
        },
        {
          "name": "stakePosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "story"
              },
              {
                "kind": "account",
                "path": "staker"
              }
            ]
          }
        },
        {
          "name": "userStakeIndex",
          "docs": [
            "Decrement open-stake counter when this position closes."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  45,
                  115,
                  116,
                  97,
                  107,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "staker"
              }
            ]
          }
        },
        {
          "name": "staker",
          "writable": true,
          "signer": true,
          "relations": [
            "stakePosition"
          ]
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "contributeLosingPool",
      "discriminator": [
        141,
        1,
        52,
        12,
        50,
        248,
        241,
        164
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  97,
                  114,
                  114,
                  97,
                  116,
                  105,
                  118,
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
          "name": "sourceStory",
          "docs": [
            "Forfeited story whose vault SOL feeds the winner."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  111,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "source_story.creator",
                "account": "storyMarket"
              },
              {
                "kind": "account",
                "path": "source_story.content_hash",
                "account": "storyMarket"
              }
            ]
          }
        },
        {
          "name": "sourceVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  111,
                  114,
                  121,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "sourceStory"
              }
            ]
          }
        },
        {
          "name": "destStory",
          "docs": [
            "Winner (or soon-to-graduate Active) narrative receiving the losing pool."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  111,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "dest_story.creator",
                "account": "storyMarket"
              },
              {
                "kind": "account",
                "path": "dest_story.content_hash",
                "account": "storyMarket"
              }
            ]
          }
        },
        {
          "name": "destVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  111,
                  114,
                  121,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "destStory"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": {
            "option": "u64"
          }
        }
      ]
    },
    {
      "name": "failStory",
      "discriminator": [
        42,
        21,
        232,
        85,
        92,
        201,
        180,
        122
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  97,
                  114,
                  114,
                  97,
                  116,
                  105,
                  118,
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
          "name": "story",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  111,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "story.creator",
                "account": "storyMarket"
              },
              {
                "kind": "account",
                "path": "story.content_hash",
                "account": "storyMarket"
              }
            ]
          }
        },
        {
          "name": "clock",
          "address": "SysvarC1ock11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "forfeitStory",
      "discriminator": [
        166,
        60,
        2,
        116,
        231,
        20,
        48,
        125
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  97,
                  114,
                  114,
                  97,
                  116,
                  105,
                  118,
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
          "name": "story",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  111,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "story.creator",
                "account": "storyMarket"
              },
              {
                "kind": "account",
                "path": "story.content_hash",
                "account": "storyMarket"
              }
            ]
          }
        },
        {
          "name": "clock",
          "address": "SysvarC1ock11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "graduateNarrative",
      "discriminator": [
        21,
        32,
        48,
        232,
        31,
        141,
        95,
        249
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  97,
                  114,
                  114,
                  97,
                  116,
                  105,
                  118,
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
          "name": "story",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  111,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "story.creator",
                "account": "storyMarket"
              },
              {
                "kind": "account",
                "path": "story.content_hash",
                "account": "storyMarket"
              }
            ]
          }
        },
        {
          "name": "rankingBoard",
          "docs": [
            "King-of-the-Hill rank slots (1..=5). Lazy-init on first graduate."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  97,
                  110,
                  107,
                  105,
                  110,
                  103,
                  45,
                  98,
                  111,
                  97,
                  114,
                  100
                ]
              }
            ]
          }
        },
        {
          "name": "vault",
          "docs": [
            "Story SOL vault — retains winner principals; seed liquidity moves to curve vault."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  111,
                  114,
                  121,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "story"
              }
            ]
          }
        },
        {
          "name": "curveProgram"
        },
        {
          "name": "tokenMint",
          "docs": [
            "New SPL mint for VelocityCurve::initialize_token (must sign; created in CPI)."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "curveState",
          "writable": true
        },
        {
          "name": "curveVault",
          "writable": true
        },
        {
          "name": "tokenVault",
          "writable": true
        },
        {
          "name": "payer",
          "docs": [
            "Crank / payer for RankingBoard init and CPI rent."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        },
        {
          "name": "clock",
          "address": "SysvarC1ock11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "rank",
          "type": "u8"
        }
      ]
    },
    {
      "name": "initializeConfig",
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
                  110,
                  97,
                  114,
                  114,
                  97,
                  116,
                  105,
                  118,
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
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "treasury"
        },
        {
          "name": "curveProgram"
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
          "name": "minStake",
          "type": {
            "option": "u64"
          }
        }
      ]
    },
    {
      "name": "initializeStory",
      "discriminator": [
        44,
        222,
        203,
        51,
        69,
        186,
        15,
        67
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  97,
                  114,
                  114,
                  97,
                  116,
                  105,
                  118,
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
          "name": "story",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  111,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "arg",
                "path": "contentHash"
              }
            ]
          }
        },
        {
          "name": "creator",
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
        },
        {
          "name": "duration",
          "type": "i64"
        },
        {
          "name": "graduationThreshold",
          "type": {
            "option": "u64"
          }
        }
      ]
    },
    {
      "name": "resolveStakes",
      "discriminator": [
        218,
        246,
        68,
        196,
        44,
        147,
        203,
        167
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  97,
                  114,
                  114,
                  97,
                  116,
                  105,
                  118,
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
          "name": "story",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  111,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "story.creator",
                "account": "storyMarket"
              },
              {
                "kind": "account",
                "path": "story.content_hash",
                "account": "storyMarket"
              }
            ]
          }
        },
        {
          "name": "stakePosition",
          "docs": [
            "The stake being marked claimable in this crank call."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "story"
              },
              {
                "kind": "account",
                "path": "stake_position.staker",
                "account": "stakePosition"
              }
            ]
          }
        },
        {
          "name": "userStakeIndex",
          "docs": [
            "Required so Forfeited positions can free a UserStakeIndex slot (no claim path)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  45,
                  115,
                  116,
                  97,
                  107,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "stake_position.staker",
                "account": "stakePosition"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "stakeOnNarrative",
      "discriminator": [
        217,
        203,
        70,
        49,
        37,
        59,
        141,
        91
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  97,
                  114,
                  114,
                  97,
                  116,
                  105,
                  118,
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
          "name": "story",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  111,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "story.creator",
                "account": "storyMarket"
              },
              {
                "kind": "account",
                "path": "story.content_hash",
                "account": "storyMarket"
              }
            ]
          }
        },
        {
          "name": "vault",
          "docs": [
            "Story SOL vault PDA."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  111,
                  114,
                  121,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "story"
              }
            ]
          }
        },
        {
          "name": "stakePosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "story"
              },
              {
                "kind": "account",
                "path": "staker"
              }
            ]
          }
        },
        {
          "name": "userStakeIndex",
          "docs": [
            "Global per-user open-stake counter. Seeds = [\"user-stakes\", staker]."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  45,
                  115,
                  116,
                  97,
                  107,
                  101,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "staker"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "staker",
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
        }
      ]
    },
    {
      "name": "updateConfig",
      "discriminator": [
        29,
        158,
        252,
        191,
        10,
        83,
        219,
        99
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
                  110,
                  97,
                  114,
                  114,
                  97,
                  116,
                  105,
                  118,
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
          "name": "authority",
          "signer": true,
          "relations": [
            "config"
          ]
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
          "name": "minStake",
          "type": {
            "option": "u64"
          }
        },
        {
          "name": "treasury",
          "type": {
            "option": "pubkey"
          }
        },
        {
          "name": "curveProgram",
          "type": {
            "option": "pubkey"
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "narrativeConfig",
      "discriminator": [
        196,
        155,
        239,
        15,
        94,
        3,
        212,
        204
      ]
    },
    {
      "name": "rankingBoard",
      "discriminator": [
        235,
        106,
        201,
        166,
        29,
        242,
        21,
        212
      ]
    },
    {
      "name": "stakePosition",
      "discriminator": [
        78,
        165,
        30,
        111,
        171,
        125,
        11,
        220
      ]
    },
    {
      "name": "storyMarket",
      "discriminator": [
        143,
        16,
        240,
        145,
        12,
        253,
        111,
        98
      ]
    },
    {
      "name": "userStakeIndex",
      "discriminator": [
        244,
        100,
        80,
        34,
        188,
        158,
        37,
        219
      ]
    }
  ],
  "events": [
    {
      "name": "configInitialized",
      "discriminator": [
        181,
        49,
        200,
        156,
        19,
        167,
        178,
        91
      ]
    },
    {
      "name": "configUpdated",
      "discriminator": [
        40,
        241,
        230,
        122,
        11,
        19,
        198,
        194
      ]
    },
    {
      "name": "losingPoolContributed",
      "discriminator": [
        81,
        85,
        77,
        81,
        56,
        249,
        154,
        240
      ]
    },
    {
      "name": "narrativeGraduated",
      "discriminator": [
        57,
        200,
        172,
        47,
        120,
        203,
        82,
        125
      ]
    },
    {
      "name": "narrativeStaked",
      "discriminator": [
        48,
        33,
        186,
        51,
        119,
        204,
        64,
        88
      ]
    },
    {
      "name": "stakeClaimed",
      "discriminator": [
        231,
        124,
        83,
        169,
        100,
        57,
        96,
        131
      ]
    },
    {
      "name": "stakesResolved",
      "discriminator": [
        202,
        86,
        169,
        248,
        98,
        22,
        187,
        11
      ]
    },
    {
      "name": "storyFailed",
      "discriminator": [
        152,
        19,
        194,
        58,
        49,
        24,
        14,
        38
      ]
    },
    {
      "name": "storyForfeited",
      "discriminator": [
        185,
        159,
        208,
        225,
        182,
        24,
        60,
        190
      ]
    },
    {
      "name": "storyInitialized",
      "discriminator": [
        180,
        137,
        133,
        140,
        105,
        139,
        102,
        36
      ]
    },
    {
      "name": "userStakeIndexUpdated",
      "discriminator": [
        251,
        176,
        68,
        6,
        116,
        140,
        218,
        121
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "stakeTooSmall",
      "msg": "Stake amount below minimum"
    },
    {
      "code": 6001,
      "name": "notActive",
      "msg": "Story market is not Active"
    },
    {
      "code": 6002,
      "name": "auctionEnded",
      "msg": "Auction has already ended"
    },
    {
      "code": 6003,
      "name": "auctionNotEnded",
      "msg": "Auction has not ended yet"
    },
    {
      "code": 6004,
      "name": "thresholdNotMet",
      "msg": "Graduation threshold not met"
    },
    {
      "code": 6005,
      "name": "thresholdMet",
      "msg": "Cannot fail: graduation threshold is met (graduate or forfeit instead)"
    },
    {
      "code": 6006,
      "name": "invalidRank",
      "msg": "Rank must be 1–5 for graduation"
    },
    {
      "code": 6007,
      "name": "rankTaken",
      "msg": "Rank slot already occupied by another story"
    },
    {
      "code": 6008,
      "name": "alreadyResolved",
      "msg": "Story already resolved (Graduated, Failed, or Forfeited)"
    },
    {
      "code": 6009,
      "name": "stakeAlreadyResolved",
      "msg": "Stake position already resolved"
    },
    {
      "code": 6010,
      "name": "alreadyClaimed",
      "msg": "Stake already claimed"
    },
    {
      "code": 6011,
      "name": "nothingToClaim",
      "msg": "Nothing claimable on this position"
    },
    {
      "code": 6012,
      "name": "invalidFeeBps",
      "msg": "Invalid fee bps (max 1000 = 10%)"
    },
    {
      "code": 6013,
      "name": "invalidDuration",
      "msg": "Duration outside allowed graduation window"
    },
    {
      "code": 6014,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6015,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6016,
      "name": "invalidContentHash",
      "msg": "Content hash must be non-zero"
    },
    {
      "code": 6017,
      "name": "notForfeited",
      "msg": "Story must be Forfeited to contribute losing stakes"
    },
    {
      "code": 6018,
      "name": "invalidContributeDest",
      "msg": "Destination must be Active or Graduated to receive losing pool"
    },
    {
      "code": 6019,
      "name": "insufficientVault",
      "msg": "Vault has insufficient lamports (rent / liquidity reserve)"
    },
    {
      "code": 6020,
      "name": "invalidContributeAmount",
      "msg": "Contribute amount is zero or exceeds available"
    },
    {
      "code": 6021,
      "name": "invalidCurveProgram",
      "msg": "Curve program id mismatch"
    },
    {
      "code": 6022,
      "name": "maxStakesExceeded",
      "msg": "User has reached max_stakes_per_user open story stakes"
    },
    {
      "code": 6023,
      "name": "stakeIndexMismatch",
      "msg": "UserStakeIndex user mismatch"
    }
  ],
  "types": [
    {
      "name": "configInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "configUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "minStake",
            "type": "u64"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "curveProgram",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "losingPoolContributed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "sourceStory",
            "type": "pubkey"
          },
          {
            "name": "destStory",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "destWinningPool",
            "type": "u64"
          },
          {
            "name": "destWinnerBonusPool",
            "type": "u64"
          },
          {
            "name": "destLiquidityReserve",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "marketPhase",
      "docs": [
        "Lifecycle of a StoryMarket."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "draft"
          },
          {
            "name": "active"
          },
          {
            "name": "graduated"
          },
          {
            "name": "failed"
          },
          {
            "name": "forfeited"
          }
        ]
      }
    },
    {
      "name": "narrativeConfig",
      "docs": [
        "Global config PDA: seeds = [b\"narrative-config\"]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "docs": [
              "Protocol fee on each stake. 200 = 2%."
            ],
            "type": "u16"
          },
          {
            "name": "minStake",
            "type": "u64"
          },
          {
            "name": "maxStakesPerUser",
            "type": "u8"
          },
          {
            "name": "graduationWindow",
            "docs": [
              "Default auction duration in seconds (24–48h)."
            ],
            "type": "i64"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "curveProgram",
            "docs": [
              "VelocityCurve program id for graduation CPI."
            ],
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "narrativeGraduated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "story",
            "type": "pubkey"
          },
          {
            "name": "rank",
            "type": "u8"
          },
          {
            "name": "totalStaked",
            "type": "u64"
          },
          {
            "name": "liquidityReserve",
            "type": "u64"
          },
          {
            "name": "winnerBonusPool",
            "type": "u64"
          },
          {
            "name": "winningPool",
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
      "name": "narrativeStaked",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "story",
            "type": "pubkey"
          },
          {
            "name": "staker",
            "type": "pubkey"
          },
          {
            "name": "grossAmount",
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          },
          {
            "name": "netAmount",
            "type": "u64"
          },
          {
            "name": "totalStaked",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "rankingBoard",
      "docs": [
        "Singleton King-of-the-Hill board: which stories occupy ranks 1..=5.",
        "Seeds = [b\"ranking-board\"]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "ranks",
            "docs": [
              "Story pubkeys for ranks 1..=5 (`Pubkey::default()` = empty slot)."
            ],
            "type": {
              "array": [
                "pubkey",
                5
              ]
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "stakeClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "story",
            "type": "pubkey"
          },
          {
            "name": "staker",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "claimedTotal",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "stakePosition",
      "docs": [
        "Per-user stake on a story.",
        "Seeds = [b\"stake\", story, staker]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "staker",
            "type": "pubkey"
          },
          {
            "name": "story",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Net amount credited after fee (lamports)."
            ],
            "type": "u64"
          },
          {
            "name": "lockedAt",
            "type": "i64"
          },
          {
            "name": "claimed",
            "type": "bool"
          },
          {
            "name": "accuracyScore",
            "docs": [
              "Updated post-resolution (0–10000 bps accuracy)."
            ],
            "type": "u16"
          },
          {
            "name": "claimable",
            "docs": [
              "Claimable lamports after resolve (winner bonus and/or principal)."
            ],
            "type": "u64"
          },
          {
            "name": "isWinner",
            "docs": [
              "True if this stake is on a Graduated narrative."
            ],
            "type": "bool"
          },
          {
            "name": "resolved",
            "docs": [
              "True once resolve_stakes has set claimable (even if 0 for Forfeited)."
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
      "name": "stakesResolved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "story",
            "type": "pubkey"
          },
          {
            "name": "staker",
            "type": "pubkey"
          },
          {
            "name": "phase",
            "type": "u8"
          },
          {
            "name": "claimable",
            "type": "u64"
          },
          {
            "name": "isWinner",
            "type": "bool"
          },
          {
            "name": "winnerBonusPool",
            "type": "u64"
          },
          {
            "name": "liquidityReserve",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "storyFailed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "story",
            "type": "pubkey"
          },
          {
            "name": "totalStaked",
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
      "name": "storyForfeited",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "story",
            "type": "pubkey"
          },
          {
            "name": "totalStaked",
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
      "name": "storyInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "story",
            "type": "pubkey"
          },
          {
            "name": "creator",
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
            "name": "endsAt",
            "type": "i64"
          },
          {
            "name": "graduationThreshold",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "storyMarket",
      "docs": [
        "One narrative / story market.",
        "Seeds = [b\"story\", creator, content_hash]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "contentHash",
            "docs": [
              "IPFS / content-addressed hash of the narrative JSON."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "phase",
            "type": {
              "defined": {
                "name": "marketPhase"
              }
            }
          },
          {
            "name": "totalStaked",
            "docs": [
              "Net SOL credited to this narrative after fees (lamports)."
            ],
            "type": "u64"
          },
          {
            "name": "uniqueStakers",
            "type": "u32"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "endsAt",
            "type": "i64"
          },
          {
            "name": "graduationThreshold",
            "docs": [
              "Minimum total_staked required to graduate."
            ],
            "type": "u64"
          },
          {
            "name": "winningPool",
            "docs": [
              "Accumulated losing-stake SOL attributed to this winner (pre-split)."
            ],
            "type": "u64"
          },
          {
            "name": "rank",
            "docs": [
              "Rank assigned at graduation (1..=5). 0 = unranked."
            ],
            "type": "u8"
          },
          {
            "name": "liquidityReserve",
            "docs": [
              "SOL reserved for initial VelocityCurve liquidity (80% of winning_pool)."
            ],
            "type": "u64"
          },
          {
            "name": "winnerBonusPool",
            "docs": [
              "SOL reserved for proportional winner payouts (20% of winning_pool)."
            ],
            "type": "u64"
          },
          {
            "name": "contributedOut",
            "docs": [
              "Lamports already transferred out of this vault via contribute (Forfeited)."
            ],
            "type": "u64"
          },
          {
            "name": "claimedTotal",
            "docs": [
              "Lamports paid out via claim_stake (vault accounting)."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "userStakeIndex",
      "docs": [
        "Per-user index of distinct open story stakes.",
        "Seeds = [b\"user-stakes\", user]",
        "",
        "Enforces `NarrativeConfig.max_stakes_per_user` (default 20): counts how many",
        "distinct stories the user currently has an open StakePosition on. Incremented",
        "when a new position is opened; decremented on claim (Graduated/Failed) or on",
        "resolve when Forfeited (claimable = 0, lifecycle ends without claim)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "activeStakes",
            "docs": [
              "Distinct stories with an open (not yet closed) stake."
            ],
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "userStakeIndexUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "story",
            "type": "pubkey"
          },
          {
            "name": "activeStakes",
            "type": "u8"
          },
          {
            "name": "delta",
            "docs": [
              "+1 on open, -1 on close (claim / forfeited resolve)."
            ],
            "type": "i8"
          }
        ]
      }
    }
  ]
};
