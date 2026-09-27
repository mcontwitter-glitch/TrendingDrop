//! Ed25519 oracle attestation via the Instructions sysvar + Ed25519 precompile.
//!
//! ## Canonical message (exact bytes)
//! ```text
//! curve_pubkey (32 bytes)
//! || twitter_delta (u64 little-endian)
//! || telegram_delta (u64 little-endian)
//! || new_holders (u64 little-endian)
//! || timestamp (i64 little-endian)
//! ```
//! Total length = 32 + 8 + 8 + 8 + 8 = 64 bytes.
//!
//! ## Proof arg encoding
//! When `proof` is **non-empty**, it must be at least 8 bytes:
//! `timestamp: i64 LE` (extra bytes ignored). The Ed25519Program verify
//! instruction(s) must appear **earlier in the same transaction**; this module
//! introspects the Instructions sysvar and counts distinct authorized oracle
//! pubkeys that signed the canonical message.
//!
//! ## Modes (see ARCHITECTURE.md)
//! 1. **Tx-signer quorum** — `proof` empty: cranker + remaining_accounts signers.
//! 2. **Ed25519 offline** — `proof` non-empty: precompile + sysvar path above.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::ed25519_program;
use anchor_lang::solana_program::sysvar::instructions::{
    load_current_index_checked, load_instruction_at_checked, ID as INSTRUCTIONS_ID,
};
use std::collections::BTreeSet;

use crate::errors::VelocityError;

pub const CANONICAL_MESSAGE_LEN: usize = 64;

/// Build the canonical oracle attestation message.
pub fn canonical_message(
    curve: &Pubkey,
    twitter_delta: u64,
    telegram_delta: u64,
    new_holders: u64,
    timestamp: i64,
) -> [u8; CANONICAL_MESSAGE_LEN] {
    let mut msg = [0u8; CANONICAL_MESSAGE_LEN];
    msg[..32].copy_from_slice(curve.as_ref());
    msg[32..40].copy_from_slice(&twitter_delta.to_le_bytes());
    msg[40..48].copy_from_slice(&telegram_delta.to_le_bytes());
    msg[48..56].copy_from_slice(&new_holders.to_le_bytes());
    msg[56..64].copy_from_slice(&timestamp.to_le_bytes());
    msg
}

/// Parse `timestamp` from a non-empty proof blob (first 8 bytes, i64 LE).
pub fn parse_proof_timestamp(proof: &[u8]) -> Result<i64> {
    require!(proof.len() >= 8, VelocityError::InvalidOracleProof);
    let mut buf = [0u8; 8];
    buf.copy_from_slice(&proof[..8]);
    Ok(i64::from_le_bytes(buf))
}

/// Collect distinct authorized oracles that signed `message` via Ed25519
/// precompile instructions earlier in this transaction.
pub fn collect_ed25519_attestations(
    instructions_sysvar: &AccountInfo,
    authorized: &[Pubkey],
    message: &[u8],
    quorum: u8,
) -> Result<u8> {
    require_keys_eq!(
        *instructions_sysvar.key,
        INSTRUCTIONS_ID,
        VelocityError::InvalidOracleProof
    );

    let current_index = load_current_index_checked(instructions_sysvar)
        .map_err(|_| error!(VelocityError::InvalidOracleProof))?;

    let mut seen: BTreeSet<Pubkey> = BTreeSet::new();
    let is_authorized = |k: &Pubkey| authorized.iter().any(|a| a == k);

    for i in 0..current_index {
        let ix = load_instruction_at_checked(i as usize, instructions_sysvar)
            .map_err(|_| error!(VelocityError::InvalidOracleProof))?;
        if ix.program_id != ed25519_program::ID {
            continue;
        }
        for pk in extract_matching_signers(&ix.data, message)? {
            require!(is_authorized(&pk), VelocityError::UnauthorizedOracle);
            require!(seen.insert(pk), VelocityError::DuplicateOracle);
        }
    }

    require!(
        (seen.len() as u8) >= quorum,
        VelocityError::InsufficientOracleQuorum
    );
    Ok(seen.len() as u8)
}

// --- Ed25519 instruction layout (Solana native program) ---
const SIGNATURE_OFFSETS_START: usize = 2;
const SIGNATURE_OFFSET_SIZE: usize = 14;
const PUBKEY_LEN: usize = 32;

/// Offsets packed little-endian in Ed25519 instruction data after header.
fn extract_matching_signers(data: &[u8], expected_msg: &[u8]) -> Result<Vec<Pubkey>> {
    require!(data.len() >= SIGNATURE_OFFSETS_START, VelocityError::InvalidOracleProof);
    let num_signatures = data[0] as usize;
    require!(num_signatures > 0, VelocityError::InvalidOracleProof);

    let header_end = SIGNATURE_OFFSETS_START
        .checked_add(
            num_signatures
                .checked_mul(SIGNATURE_OFFSET_SIZE)
                .ok_or(VelocityError::InvalidOracleProof)?,
        )
        .ok_or(VelocityError::InvalidOracleProof)?;
    require!(data.len() >= header_end, VelocityError::InvalidOracleProof);

    let mut out = Vec::with_capacity(num_signatures);
    for n in 0..num_signatures {
        let start = SIGNATURE_OFFSETS_START + n * SIGNATURE_OFFSET_SIZE;
        let public_key_offset = u16::from_le_bytes([data[start + 4], data[start + 5]]) as usize;
        let message_data_offset = u16::from_le_bytes([data[start + 8], data[start + 9]]) as usize;
        let message_data_size = u16::from_le_bytes([data[start + 10], data[start + 11]]) as usize;

        let pk_end = public_key_offset
            .checked_add(PUBKEY_LEN)
            .ok_or(VelocityError::InvalidOracleProof)?;
        let msg_end = message_data_offset
            .checked_add(message_data_size)
            .ok_or(VelocityError::InvalidOracleProof)?;
        require!(data.len() >= pk_end && data.len() >= msg_end, VelocityError::InvalidOracleProof);

        let msg = &data[message_data_offset..msg_end];
        require!(msg == expected_msg, VelocityError::InvalidOracleProof);

        let mut pk_bytes = [0u8; 32];
        pk_bytes.copy_from_slice(&data[public_key_offset..pk_end]);
        out.push(Pubkey::new_from_array(pk_bytes));
    }
    Ok(out)
}
