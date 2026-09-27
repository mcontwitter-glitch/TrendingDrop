//! Minimal Metaplex Token Metadata CPI helpers (no `mpl-token-metadata` crate).
//!
//! Compatible with Token Metadata program on Solana 1.18 / Anchor 0.30 without
//! pulling edition2024 / conflicting proc-macro deps. Instruction layouts match
//! `mpl-token-metadata` CreateMetadataAccountV3 / UpdateMetadataAccountV2.
//!
//! Program id (mainnet / devnet / localnet clone):
//!   `metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s`

use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
    system_program,
};

/// Metaplex Token Metadata program id.
pub const TOKEN_METADATA_PROGRAM_ID: Pubkey =
    pubkey!("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

/// Instruction enum discriminators (legacy single-byte Metaplex layout).
const IX_CREATE_METADATA_ACCOUNT_V3: u8 = 33;
const IX_UPDATE_METADATA_ACCOUNT_V2: u8 = 15;

/// Metadata PDA seeds: ["metadata", program_id, mint]
pub fn find_metadata_account(mint: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[
            b"metadata",
            TOKEN_METADATA_PROGRAM_ID.as_ref(),
            mint.as_ref(),
        ],
        &TOKEN_METADATA_PROGRAM_ID,
    )
}

/// Deterministic placeholder URI — replaceable by an off-chain JSON host later.
/// Format: `https://bcc.local/reputation/{tier}/{owner}.json`
pub fn reputation_uri(tier_label: &str, owner: &Pubkey) -> String {
    format!(
        "https://bcc.local/reputation/{}/{}.json",
        tier_label.to_ascii_lowercase(),
        owner
    )
}

pub fn reputation_name(tier_label: &str) -> String {
    // Metaplex name max 32 bytes.
    let name = format!("BCC Reputation · {}", tier_label);
    if name.len() <= 32 {
        name
    } else {
        format!("BCC {}", tier_label)
    }
}

pub const REPUTATION_SYMBOL: &str = "BCCR";

/// Borsh-encode a UTF-8 string (u32 LE length + bytes).
fn push_string(buf: &mut Vec<u8>, s: &str) {
    let bytes = s.as_bytes();
    buf.extend_from_slice(&(bytes.len() as u32).to_le_bytes());
    buf.extend_from_slice(bytes);
}

/// Build CreateMetadataAccountV3 instruction data.
fn create_metadata_v3_data(name: &str, symbol: &str, uri: &str, is_mutable: bool) -> Vec<u8> {
    let mut data = Vec::with_capacity(256);
    data.push(IX_CREATE_METADATA_ACCOUNT_V3);
    // DataV2
    push_string(&mut data, name);
    push_string(&mut data, symbol);
    push_string(&mut data, uri);
    data.extend_from_slice(&0u16.to_le_bytes()); // seller_fee_basis_points
    data.push(0); // creators: None
    data.push(0); // collection: None
    data.push(0); // uses: None
    data.push(u8::from(is_mutable));
    data.push(0); // collection_details: None
    data
}

/// Build UpdateMetadataAccountV2 instruction data (update DataV2 only).
fn update_metadata_v2_data(name: &str, symbol: &str, uri: &str) -> Vec<u8> {
    let mut data = Vec::with_capacity(256);
    data.push(IX_UPDATE_METADATA_ACCOUNT_V2);
    // Option<DataV2> = Some
    data.push(1);
    push_string(&mut data, name);
    push_string(&mut data, symbol);
    push_string(&mut data, uri);
    data.extend_from_slice(&0u16.to_le_bytes());
    data.push(0); // creators: None
    data.push(0); // collection: None
    data.push(0); // uses: None
    // new_update_authority: None
    data.push(0);
    // primary_sale_happened: None
    data.push(0);
    // is_mutable: None
    data.push(0);
    data
}

/// CPI CreateMetadataAccountV3. `update_authority` becomes the metadata update authority
/// (does not need to sign at create time — passed as non-signer account meta).
pub fn create_metadata_accounts_v3<'info>(
    metadata: AccountInfo<'info>,
    mint: AccountInfo<'info>,
    mint_authority: AccountInfo<'info>,
    payer: AccountInfo<'info>,
    update_authority: AccountInfo<'info>,
    system_program_ai: AccountInfo<'info>,
    name: &str,
    symbol: &str,
    uri: &str,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    let ix = Instruction {
        program_id: TOKEN_METADATA_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(metadata.key(), false),
            AccountMeta::new_readonly(mint.key(), false),
            AccountMeta::new_readonly(mint_authority.key(), true),
            AccountMeta::new(payer.key(), true),
            AccountMeta::new_readonly(update_authority.key(), false),
            AccountMeta::new_readonly(system_program::ID, false),
        ],
        data: create_metadata_v3_data(name, symbol, uri, true),
    };

    let infos = &[
        metadata,
        mint,
        mint_authority,
        payer,
        update_authority,
        system_program_ai,
    ];

    if signer_seeds.is_empty() {
        anchor_lang::solana_program::program::invoke(&ix, infos)?;
    } else {
        invoke_signed(&ix, infos, signer_seeds)?;
    }
    Ok(())
}

/// CPI UpdateMetadataAccountV2 — update name/symbol/uri. `update_authority` must sign
/// (PDA via `signer_seeds`).
pub fn update_metadata_accounts_v2<'info>(
    metadata: AccountInfo<'info>,
    update_authority: AccountInfo<'info>,
    name: &str,
    symbol: &str,
    uri: &str,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    let ix = Instruction {
        program_id: TOKEN_METADATA_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(metadata.key(), false),
            AccountMeta::new_readonly(update_authority.key(), true),
        ],
        data: update_metadata_v2_data(name, symbol, uri),
    };

    let infos = &[metadata, update_authority];
    invoke_signed(&ix, infos, signer_seeds)?;
    Ok(())
}
