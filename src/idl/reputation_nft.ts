/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/reputation_nft.json`.
 */
export type ReputationNft = {
  "address": "DrzQKZpvg8y7Gymp5yz2upX24v3fV7j7eFuqT31Nxgvd",
  "metadata": {
    "name": "reputationNft",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Bonding Curve Casino — Reputation / Lore NFTs (Phase 4)"
  },
  "instructions": [
    {
      "name": "addTrait",
      "docs": [
        "Append a special trait (owner-signed)."
      ],
      "discriminator": [
        160,
        101,
        154,
        121,
        141,
        218,
        30,
        118
      ],
      "accounts": [
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "profile.owner",
                "account": "traderProfile"
              }
            ]
          }
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "profile"
          ]
        }
      ],
      "args": [
        {
          "name": "newTrait",
          "type": {
            "defined": {
              "name": "trait"
            }
          }
        }
      ]
    },
    {
      "name": "initializeProfile",
      "docs": [
        "Initialize an empty TraderProfile for `owner`.",
        "NFT mint is a separate step (`mint_reputation_nft`)."
      ],
      "discriminator": [
        32,
        145,
        77,
        213,
        58,
        39,
        251,
        234
      ],
      "accounts": [
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
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
      "name": "mintReputationNft",
      "docs": [
        "Mint a Metaplex reputation NFT and store mint on TraderProfile."
      ],
      "discriminator": [
        240,
        117,
        21,
        198,
        77,
        214,
        150,
        128
      ],
      "accounts": [
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "mint",
          "docs": [
            "New SPL mint (decimals = 0). Mint authority = owner for the create+mint flow;",
            "revoked to None after minting supply=1."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenAccount",
          "docs": [
            "Owner's ATA receiving the single NFT token."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "owner"
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
          "name": "metadata",
          "writable": true
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "profile"
          ]
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
        },
        {
          "name": "tokenMetadataProgram",
          "address": "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
        }
      ],
      "args": []
    },
    {
      "name": "updateProfile",
      "docs": [
        "Record a prediction outcome and recompute accuracy / tier.",
        "Syncs Metaplex metadata when `nft_mint` is set."
      ],
      "discriminator": [
        98,
        67,
        99,
        206,
        86,
        115,
        175,
        1
      ],
      "accounts": [
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "profile.owner",
                "account": "traderProfile"
              }
            ]
          }
        },
        {
          "name": "authority",
          "docs": [
            "Crank / NarrativeAuction CPI signer (or profile owner). Phase 4 trusts",
            "the caller; gate via protocol config in a later revision if needed."
          ],
          "signer": true
        },
        {
          "name": "metadata",
          "docs": [
            "When no NFT is minted, pass any writable account (e.g. profile) — ignored."
          ],
          "writable": true
        },
        {
          "name": "tokenMetadataProgram"
        }
      ],
      "args": [
        {
          "name": "wasCorrect",
          "type": "bool"
        },
        {
          "name": "volume",
          "type": "u64"
        },
        {
          "name": "newTrait",
          "type": {
            "option": {
              "defined": {
                "name": "trait"
              }
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "traderProfile",
      "discriminator": [
        99,
        135,
        170,
        100,
        49,
        79,
        225,
        169
      ]
    }
  ],
  "events": [
    {
      "name": "profileInitialized",
      "discriminator": [
        1,
        31,
        122,
        19,
        193,
        205,
        23,
        27
      ]
    },
    {
      "name": "profileUpdated",
      "discriminator": [
        186,
        248,
        62,
        98,
        112,
        98,
        161,
        252
      ]
    },
    {
      "name": "reputationNftMetadataUpdated",
      "discriminator": [
        214,
        53,
        245,
        63,
        180,
        243,
        195,
        13
      ]
    },
    {
      "name": "reputationNftMinted",
      "discriminator": [
        76,
        92,
        72,
        157,
        250,
        198,
        79,
        188
      ]
    },
    {
      "name": "traitAdded",
      "discriminator": [
        15,
        200,
        169,
        142,
        211,
        197,
        225,
        167
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6001,
      "name": "unauthorized",
      "msg": "Unauthorized profile update"
    },
    {
      "code": 6002,
      "name": "alreadyInitialized",
      "msg": "Profile already initialized"
    },
    {
      "code": 6003,
      "name": "traitCapacity",
      "msg": "Trait list is full (max 8)"
    },
    {
      "code": 6004,
      "name": "traitDuplicate",
      "msg": "Trait already present on profile"
    },
    {
      "code": 6005,
      "name": "invalidVolume",
      "msg": "Invalid volume amount"
    },
    {
      "code": 6006,
      "name": "nftAlreadyMinted",
      "msg": "Reputation NFT already minted for this profile"
    },
    {
      "code": 6007,
      "name": "invalidMetadataPda",
      "msg": "Invalid Metaplex metadata PDA"
    },
    {
      "code": 6008,
      "name": "invalidMetadataProgram",
      "msg": "Invalid Token Metadata program id"
    },
    {
      "code": 6009,
      "name": "nftNotMinted",
      "msg": "Reputation NFT not yet minted"
    }
  ],
  "types": [
    {
      "name": "profileInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "profile",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "profileUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "profile",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "wasCorrect",
            "type": "bool"
          },
          {
            "name": "volume",
            "type": "u64"
          },
          {
            "name": "accuracyScore",
            "type": "u16"
          },
          {
            "name": "tier",
            "type": {
              "defined": {
                "name": "reputationTier"
              }
            }
          },
          {
            "name": "totalPredictions",
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
      "name": "reputationNftMetadataUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "profile",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "tier",
            "type": {
              "defined": {
                "name": "reputationTier"
              }
            }
          },
          {
            "name": "uri",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "reputationNftMinted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "profile",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "metadata",
            "type": "pubkey"
          },
          {
            "name": "tier",
            "type": {
              "defined": {
                "name": "reputationTier"
              }
            }
          },
          {
            "name": "uri",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "reputationTier",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "bronze"
          },
          {
            "name": "silver"
          },
          {
            "name": "gold"
          },
          {
            "name": "diamond"
          },
          {
            "name": "mythic"
          }
        ]
      }
    },
    {
      "name": "traderProfile",
      "docs": [
        "Per-wallet prediction reputation profile.",
        "Seeds = [b\"profile\", owner]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "totalPredictions",
            "type": "u32"
          },
          {
            "name": "correctPredictions",
            "type": "u32"
          },
          {
            "name": "totalVolume",
            "docs": [
              "Cumulative stake/trade volume in lamports."
            ],
            "type": "u64"
          },
          {
            "name": "accuracyScore",
            "docs": [
              "Accuracy in bps (0–10_000), includes Weighted_Volume_Factor."
            ],
            "type": "u16"
          },
          {
            "name": "tier",
            "type": {
              "defined": {
                "name": "reputationTier"
              }
            }
          },
          {
            "name": "lastUpdated",
            "type": "i64"
          },
          {
            "name": "specialTraits",
            "type": {
              "vec": {
                "defined": {
                  "name": "trait"
                }
              }
            }
          },
          {
            "name": "nftMint",
            "docs": [
              "Metaplex NFT mint pubkey (default until `mint_reputation_nft`)."
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
      "name": "trait",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "earlyAdopter"
          },
          {
            "name": "oracleWhisperer"
          },
          {
            "name": "mergeMaster"
          },
          {
            "name": "diamondHands"
          },
          {
            "name": "narrativeCreator"
          }
        ]
      }
    },
    {
      "name": "traitAdded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "profile",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "traitKind",
            "type": {
              "defined": {
                "name": "trait"
              }
            }
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    }
  ]
};
