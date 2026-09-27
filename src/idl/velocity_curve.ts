/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/velocity_curve.json`.
 */
export type VelocityCurve = {
  "address": "5VbDjccBDNVCPLpSgxyuw7ptYekrcxH8FySBxaAXx6C",
  "metadata": {
    "name": "velocityCurve",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "TrendingDrop — Phase 2 Velocity Bonding Curve"
  },
  "instructions": [
    {
      "name": "addOracle",
      "docs": [
        "Authority: add an authorized oracle (max 5)."
      ],
      "discriminator": [
        185,
        165,
        165,
        167,
        208,
        207,
        55,
        35
      ],
      "accounts": [
        {
          "name": "oracleConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
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
            "oracleConfig"
          ]
        }
      ],
      "args": [
        {
          "name": "oracle",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "buy",
      "docs": [
        "Buy tokens along the dual curve with slippage protection (mints SPL)."
      ],
      "discriminator": [
        102,
        6,
        61,
        18,
        1,
        218,
        235,
        234
      ],
      "accounts": [
        {
          "name": "curve",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "curve.story_id",
                "account": "velocityToken"
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
                  99,
                  117,
                  114,
                  118,
                  101,
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
                "path": "curve"
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "buyerAta",
          "docs": [
            "Buyer ATA — created if needed."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "buyer"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "holder",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  108,
                  100,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "curve"
              },
              {
                "kind": "account",
                "path": "buyer"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "buyer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        }
      ],
      "args": [
        {
          "name": "solAmount",
          "type": "u64"
        },
        {
          "name": "minTokensOut",
          "type": "u64"
        }
      ]
    },
    {
      "name": "claimHolderRewards",
      "docs": [
        "Claim pro-rata share of accumulated sell-tax rewards."
      ],
      "discriminator": [
        79,
        182,
        142,
        158,
        108,
        127,
        120,
        174
      ],
      "accounts": [
        {
          "name": "curve",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "curve.story_id",
                "account": "velocityToken"
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
                  99,
                  117,
                  114,
                  118,
                  101,
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
                "path": "curve"
              }
            ]
          }
        },
        {
          "name": "holder",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  108,
                  100,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "curve"
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "owner",
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
      "name": "initializeOracleConfig",
      "docs": [
        "Bootstrap oracle config. Default quorum = 3 (pass `Some(1)` for local mock)."
      ],
      "discriminator": [
        131,
        55,
        232,
        105,
        168,
        248,
        10,
        102
      ],
      "accounts": [
        {
          "name": "oracleConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
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
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "updateInterval",
          "type": {
            "option": "i64"
          }
        },
        {
          "name": "authorizedOracles",
          "type": {
            "option": {
              "vec": "pubkey"
            }
          }
        },
        {
          "name": "quorum",
          "type": {
            "option": "u8"
          }
        }
      ]
    },
    {
      "name": "initializeToken",
      "docs": [
        "Called via CPI from NarrativeAuction::graduate_narrative.",
        "Creates SPL mint (authority = curve) + curve vault + curve ATA."
      ],
      "discriminator": [
        38,
        209,
        150,
        50,
        190,
        117,
        16,
        54
      ],
      "accounts": [
        {
          "name": "curve",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "storyId"
              }
            ]
          }
        },
        {
          "name": "storyId",
          "docs": [
            "Constrained to match `params.story_id`."
          ]
        },
        {
          "name": "mint",
          "docs": [
            "New SPL mint — mint authority = curve PDA."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  114,
                  118,
                  101,
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
                "path": "curve"
              }
            ]
          }
        },
        {
          "name": "tokenVault",
          "docs": [
            "Curve-owned ATA holding no circulating supply (mint authority mints to buyers)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "curve"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
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
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "tokenParams"
            }
          }
        }
      ]
    },
    {
      "name": "removeOracle",
      "docs": [
        "Authority: remove an authorized oracle (must not drop below quorum)."
      ],
      "discriminator": [
        60,
        93,
        51,
        197,
        182,
        42,
        170,
        26
      ],
      "accounts": [
        {
          "name": "oracleConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
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
            "oracleConfig"
          ]
        }
      ],
      "args": [
        {
          "name": "oracle",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "sell",
      "docs": [
        "Sell tokens with velocity-dependent tax (burns SPL)."
      ],
      "discriminator": [
        51,
        230,
        133,
        164,
        1,
        127,
        131,
        173
      ],
      "accounts": [
        {
          "name": "curve",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "curve.story_id",
                "account": "velocityToken"
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
                  99,
                  117,
                  114,
                  118,
                  101,
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
                "path": "curve"
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true
        },
        {
          "name": "sellerAta",
          "writable": true
        },
        {
          "name": "holder",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  111,
                  108,
                  100,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "curve"
              },
              {
                "kind": "account",
                "path": "seller"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "seller",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "tokenAmount",
          "type": "u64"
        },
        {
          "name": "minSolOut",
          "type": "u64"
        }
      ]
    },
    {
      "name": "setOracleQuorum",
      "docs": [
        "Authority: set required oracle quorum (1..=authorized_oracles.len())."
      ],
      "discriminator": [
        108,
        213,
        186,
        98,
        77,
        198,
        136,
        69
      ],
      "accounts": [
        {
          "name": "oracleConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
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
            "oracleConfig"
          ]
        }
      ],
      "args": [
        {
          "name": "newQuorum",
          "type": "u8"
        }
      ]
    },
    {
      "name": "settleMerge",
      "docs": [
        "Settle LoreMerge: move fee/liquidity SOL, mark target merged, bump absorber merge_count."
      ],
      "discriminator": [
        73,
        182,
        140,
        30,
        119,
        153,
        110,
        57
      ],
      "accounts": [
        {
          "name": "targetCurve",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "target_curve.story_id",
                "account": "velocityToken"
              }
            ]
          }
        },
        {
          "name": "absorberCurve",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "absorber_curve.story_id",
                "account": "velocityToken"
              }
            ]
          }
        },
        {
          "name": "targetVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  114,
                  118,
                  101,
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
                "path": "targetCurve"
              }
            ]
          }
        },
        {
          "name": "absorberVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  114,
                  118,
                  101,
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
                "path": "absorberCurve"
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "payer",
          "docs": [
            "Pays rent if absorber vault must be created."
          ],
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
          "name": "feeLamports",
          "type": "u64"
        },
        {
          "name": "liquidityLamports",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updateAttention",
      "docs": [
        "Oracle crank — EMA update. Tx-signer quorum or ed25519 proof mode."
      ],
      "discriminator": [
        123,
        247,
        117,
        134,
        208,
        107,
        108,
        50
      ],
      "accounts": [
        {
          "name": "curve",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  114,
                  118,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "curve.story_id",
                "account": "velocityToken"
              }
            ]
          }
        },
        {
          "name": "oracleConfig",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  97,
                  99,
                  108,
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
          "name": "cranker",
          "docs": [
            "Fee-paying cranker / keeper. Counted toward quorum if authorized (signer mode)."
          ],
          "signer": true
        },
        {
          "name": "instructionsSysvar",
          "docs": [
            "Pass the sysvar address always; ignored when `proof` is empty."
          ],
          "address": "Sysvar1nstructions1111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "twitterDelta",
          "type": "u64"
        },
        {
          "name": "telegramDelta",
          "type": "u64"
        },
        {
          "name": "newHolders",
          "type": "u64"
        },
        {
          "name": "proof",
          "type": "bytes"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "holderPosition",
      "discriminator": [
        48,
        115,
        169,
        131,
        27,
        29,
        223,
        126
      ]
    },
    {
      "name": "oracleConfig",
      "discriminator": [
        133,
        196,
        152,
        50,
        27,
        21,
        145,
        254
      ]
    },
    {
      "name": "velocityToken",
      "discriminator": [
        6,
        238,
        175,
        108,
        209,
        117,
        75,
        3
      ]
    }
  ],
  "events": [
    {
      "name": "attentionUpdated",
      "discriminator": [
        142,
        81,
        43,
        105,
        13,
        66,
        32,
        73
      ]
    },
    {
      "name": "holderRewardsClaimed",
      "discriminator": [
        60,
        184,
        143,
        130,
        179,
        103,
        55,
        178
      ]
    },
    {
      "name": "mergeSettled",
      "discriminator": [
        40,
        227,
        160,
        185,
        130,
        242,
        31,
        101
      ]
    },
    {
      "name": "oracleAdded",
      "discriminator": [
        48,
        0,
        207,
        33,
        20,
        56,
        215,
        219
      ]
    },
    {
      "name": "oracleConfigInitialized",
      "discriminator": [
        191,
        12,
        47,
        62,
        214,
        248,
        210,
        74
      ]
    },
    {
      "name": "oracleQuorumUpdated",
      "discriminator": [
        97,
        102,
        174,
        239,
        105,
        51,
        102,
        229
      ]
    },
    {
      "name": "oracleRemoved",
      "discriminator": [
        62,
        112,
        125,
        81,
        128,
        93,
        194,
        96
      ]
    },
    {
      "name": "tokenInitialized",
      "discriminator": [
        77,
        70,
        233,
        124,
        236,
        92,
        204,
        0
      ]
    },
    {
      "name": "tokensBought",
      "discriminator": [
        151,
        148,
        173,
        226,
        128,
        30,
        249,
        190
      ]
    },
    {
      "name": "tokensSold",
      "discriminator": [
        217,
        83,
        68,
        137,
        134,
        225,
        94,
        45
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "slippageExceeded",
      "msg": "Slippage tolerance exceeded"
    },
    {
      "code": 6001,
      "name": "staleOracle",
      "msg": "Oracle data stale"
    },
    {
      "code": 6002,
      "name": "invalidOracleProof",
      "msg": "Invalid oracle proof / unauthorized oracle"
    },
    {
      "code": 6003,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6004,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6005,
      "name": "zeroAmount",
      "msg": "Amount must be > 0"
    },
    {
      "code": 6006,
      "name": "insufficientBalance",
      "msg": "Insufficient holder balance"
    },
    {
      "code": 6007,
      "name": "insufficientVault",
      "msg": "Insufficient vault SOL for payout"
    },
    {
      "code": 6008,
      "name": "nothingToClaim",
      "msg": "Nothing claimable"
    },
    {
      "code": 6009,
      "name": "invalidParams",
      "msg": "Invalid curve parameters (base_price / curve_k)"
    },
    {
      "code": 6010,
      "name": "tradingPaused",
      "msg": "Curve is merged / trading paused"
    },
    {
      "code": 6011,
      "name": "invalidOracleWeights",
      "msg": "Oracle weights must sum to 10000 bps"
    },
    {
      "code": 6012,
      "name": "tooManyOracles",
      "msg": "Too many authorized oracles"
    },
    {
      "code": 6013,
      "name": "storyMismatch",
      "msg": "story_id param mismatch"
    },
    {
      "code": 6014,
      "name": "insufficientOracleQuorum",
      "msg": "Insufficient distinct authorized oracle signers for quorum"
    },
    {
      "code": 6015,
      "name": "duplicateOracle",
      "msg": "Duplicate oracle signer in attestation set"
    },
    {
      "code": 6016,
      "name": "oracleNotSigner",
      "msg": "Oracle remaining account is not a signer"
    },
    {
      "code": 6017,
      "name": "unauthorizedOracle",
      "msg": "Oracle not in authorized set"
    },
    {
      "code": 6018,
      "name": "oracleAlreadyAuthorized",
      "msg": "Oracle already authorized"
    },
    {
      "code": 6019,
      "name": "oracleNotFound",
      "msg": "Oracle not found in authorized set"
    },
    {
      "code": 6020,
      "name": "invalidQuorum",
      "msg": "Quorum must be between 1 and authorized oracle count"
    },
    {
      "code": 6021,
      "name": "oracleRemovalBreaksQuorum",
      "msg": "Cannot remove oracle: would drop below quorum"
    },
    {
      "code": 6022,
      "name": "mintMismatch",
      "msg": "Mint account does not match curve.mint"
    },
    {
      "code": 6023,
      "name": "settlementOverflow",
      "msg": "Settlement amounts exceed target reserve / vault"
    }
  ],
  "types": [
    {
      "name": "attentionUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "curve",
            "type": "pubkey"
          },
          {
            "name": "twitterDelta",
            "type": "u64"
          },
          {
            "name": "telegramDelta",
            "type": "u64"
          },
          {
            "name": "newHolders",
            "type": "u64"
          },
          {
            "name": "rawScore",
            "type": "u64"
          },
          {
            "name": "attentionScore",
            "type": "u64"
          },
          {
            "name": "priceVelocity",
            "type": "u64"
          },
          {
            "name": "sellTaxBps",
            "type": "u16"
          },
          {
            "name": "effectiveK",
            "type": "u64"
          },
          {
            "name": "oracleCount",
            "docs": [
              "Number of distinct authorized oracle signers that attested this update."
            ],
            "type": "u8"
          },
          {
            "name": "quorum",
            "type": "u8"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "holderPosition",
      "docs": [
        "Per-holder position — tracks reward-index / claimable alongside SPL balances.",
        "Seeds = [b\"holder\", curve, owner]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "token",
            "type": "pubkey"
          },
          {
            "name": "balance",
            "type": "u64"
          },
          {
            "name": "entryPrice",
            "type": "u64"
          },
          {
            "name": "lastAttentionClaim",
            "type": "i64"
          },
          {
            "name": "lorePower",
            "docs": [
              "Governance weight for LoreMerge votes."
            ],
            "type": "u32"
          },
          {
            "name": "rewardDebt",
            "docs": [
              "Reward index snapshot (debt) for pro-rata sell-tax claims."
            ],
            "type": "u128"
          },
          {
            "name": "claimableRewards",
            "docs": [
              "Claimable lamports from redistributed sell tax."
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
      "name": "holderRewardsClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "curve",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "amount",
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
      "name": "mergeSettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "target",
            "type": "pubkey"
          },
          {
            "name": "absorber",
            "type": "pubkey"
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
            "name": "absorberMergeCount",
            "type": "u8"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "oracleAdded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "oracle",
            "type": "pubkey"
          },
          {
            "name": "oracleCount",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "oracleConfig",
      "docs": [
        "Oracle network config — Phase-1 mainnet: N-of-M multi-sig crank (default 3/5).",
        "Seeds = [b\"oracle-config\"]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "updateInterval",
            "docs": [
              "Target update interval (e.g. 300s = 5 min)."
            ],
            "type": "i64"
          },
          {
            "name": "twitterWeight",
            "docs": [
              "Weights in bps of 10_000 (default 4000 / 3000 / 3000)."
            ],
            "type": "u16"
          },
          {
            "name": "telegramWeight",
            "type": "u16"
          },
          {
            "name": "onchainWeight",
            "type": "u16"
          },
          {
            "name": "quorum",
            "docs": [
              "Required distinct authorized oracle signers per `update_attention` (default 3)."
            ],
            "type": "u8"
          },
          {
            "name": "authorizedOracles",
            "type": {
              "vec": "pubkey"
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
      "name": "oracleConfigInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "updateInterval",
            "type": "i64"
          },
          {
            "name": "quorum",
            "type": "u8"
          },
          {
            "name": "oracleCount",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "oracleQuorumUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "oldQuorum",
            "type": "u8"
          },
          {
            "name": "newQuorum",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "oracleRemoved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "oracle",
            "type": "pubkey"
          },
          {
            "name": "oracleCount",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "tokenInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "curve",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "storyId",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "basePrice",
            "type": "u64"
          },
          {
            "name": "curveK",
            "type": "u64"
          },
          {
            "name": "seedLiquidity",
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
      "name": "tokenParams",
      "docs": [
        "CPI / init params — field order must stay wire-compatible with",
        "NarrativeAuction `TokenParamsWire`."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "basePrice",
            "type": "u64"
          },
          {
            "name": "initialLiquidity",
            "type": "u64"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "storyId",
            "type": "pubkey"
          },
          {
            "name": "curveK",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tokensBought",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "curve",
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "solIn",
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          },
          {
            "name": "tokensOut",
            "type": "u64"
          },
          {
            "name": "supply",
            "type": "u64"
          },
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "effectiveK",
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
      "name": "tokensSold",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "curve",
            "type": "pubkey"
          },
          {
            "name": "seller",
            "type": "pubkey"
          },
          {
            "name": "tokensIn",
            "type": "u64"
          },
          {
            "name": "solGross",
            "type": "u64"
          },
          {
            "name": "tax",
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          },
          {
            "name": "solNet",
            "type": "u64"
          },
          {
            "name": "supply",
            "type": "u64"
          },
          {
            "name": "price",
            "type": "u64"
          },
          {
            "name": "sellTaxBps",
            "type": "u16"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "velocityToken",
      "docs": [
        "Dual-curve token state.",
        "Seeds = [b\"curve\", story_id]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "storyId",
            "docs": [
              "Link back to NarrativeAuction StoryMarket."
            ],
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "basePrice",
            "type": "u64"
          },
          {
            "name": "currentSupply",
            "type": "u64"
          },
          {
            "name": "currentPrice",
            "type": "u64"
          },
          {
            "name": "attentionScore",
            "docs": [
              "EMA-smoothed attention score (oracle)."
            ],
            "type": "u64"
          },
          {
            "name": "priceVelocity",
            "docs": [
              "Moving average of price change."
            ],
            "type": "u64"
          },
          {
            "name": "curveK",
            "docs": [
              "Base curve constant `k` (before velocity modifier)."
            ],
            "type": "u64"
          },
          {
            "name": "sellTaxBps",
            "docs": [
              "Dynamic 500–1500 bps."
            ],
            "type": "u16"
          },
          {
            "name": "lastOracleUpdate",
            "type": "i64"
          },
          {
            "name": "mergeCount",
            "docs": [
              "How many narratives absorbed via LoreMerge."
            ],
            "type": "u8"
          },
          {
            "name": "isMerged",
            "type": "bool"
          },
          {
            "name": "solReserve",
            "docs": [
              "Actual SOL held in the curve vault (lamports)."
            ],
            "type": "u64"
          },
          {
            "name": "protocolFees",
            "docs": [
              "Accumulated protocol fees (lamports) still in vault."
            ],
            "type": "u64"
          },
          {
            "name": "holderRewardsPool",
            "docs": [
              "Sell-tax share reserved for holders (lamports) still in vault."
            ],
            "type": "u64"
          },
          {
            "name": "rewardIndex",
            "docs": [
              "Cumulative reward index (scaled by REWARD_SCALE in math)."
            ],
            "type": "u128"
          },
          {
            "name": "lastPrice",
            "docs": [
              "Previous spot price for velocity MA."
            ],
            "type": "u64"
          },
          {
            "name": "seedLiquidity",
            "docs": [
              "Liquidity amount recorded at graduation (SOL moved into curve vault on graduate)."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
