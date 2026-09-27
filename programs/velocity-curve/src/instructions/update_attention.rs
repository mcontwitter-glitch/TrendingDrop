use anchor_lang::prelude::*;
use std::collections::BTreeSet;

use crate::errors::VelocityError;
use crate::events::AttentionUpdated;
use crate::math::{ema_update, velocity_params, weighted_attention};
use crate::oracle_proof::{
    canonical_message, collect_ed25519_attestations, parse_proof_timestamp,
};
use crate::state::{OracleConfig, VelocityToken, EMA_ALPHA_BPS};

#[derive(Accounts)]
pub struct UpdateAttention<'info> {
    #[account(
        mut,
        seeds = [VelocityToken::SEED, curve.story_id.as_ref()],
        bump = curve.bump,
    )]
    pub curve: Account<'info, VelocityToken>,

    #[account(
        seeds = [OracleConfig::SEED],
        bump = oracle_config.bump,
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    /// Fee-paying cranker / keeper. Counted toward quorum if authorized (signer mode).
    pub cranker: Signer<'info>,

    /// CHECK: Instructions sysvar — required for ed25519 proof mode (`proof` non-empty).
    /// Pass the sysvar address always; ignored when `proof` is empty.
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,
}

/// Oracle crank — updates attention EMA and sell-tax / effective-k inputs.
///
/// ## Attestation modes
///
/// 1. **Tx-signer quorum** (`proof` empty): `cranker` (if authorized) +
///    `remaining_accounts` that are **signers** and in `authorized_oracles`.
///    Require `≥ quorum` distinct authorized oracles.
///
/// 2. **Ed25519 offline** (`proof` non-empty): `proof = timestamp (i64 LE) [+ ignored]`.
///    Prior Ed25519Program instructions in this tx must verify signatures over the
///    canonical message (see `oracle_proof`). Distinct authorized pubkeys ≥ quorum.
///    Rejects bad proofs with `InvalidOracleProof`.
pub fn update_attention_handler(
    ctx: Context<UpdateAttention>,
    twitter_delta: u64,
    telegram_delta: u64,
    new_holders: u64,
    proof: Vec<u8>,
) -> Result<()> {
    let cfg = &ctx.accounts.oracle_config;
    let curve_key = ctx.accounts.curve.key();

    let oracle_count = if !proof.is_empty() {
        let timestamp = parse_proof_timestamp(&proof)?;
        let msg = canonical_message(
            &curve_key,
            twitter_delta,
            telegram_delta,
            new_holders,
            timestamp,
        );
        collect_ed25519_attestations(
            &ctx.accounts.instructions_sysvar.to_account_info(),
            &cfg.authorized_oracles,
            &msg,
            cfg.quorum,
        )?
    } else {
        collect_oracle_attestations(
            ctx.accounts.cranker.key(),
            ctx.remaining_accounts,
            &cfg.authorized_oracles,
            cfg.quorum,
        )?
    };

    let clock = Clock::get()?;
    let curve = &mut ctx.accounts.curve;

    let raw = weighted_attention(
        twitter_delta,
        telegram_delta,
        new_holders,
        cfg.twitter_weight,
        cfg.telegram_weight,
        cfg.onchain_weight,
    )?;

    curve.attention_score = ema_update(curve.attention_score, raw, EMA_ALPHA_BPS)?;

    let price_delta = curve.current_price.abs_diff(curve.last_price);
    if price_delta > 0 {
        curve.price_velocity =
            ema_update(curve.price_velocity, price_delta, EMA_ALPHA_BPS)?;
    }
    curve.last_price = curve.current_price;

    let (eff_k, tax) = velocity_params(
        curve.curve_k,
        curve.attention_score,
        curve.price_velocity,
    )?;
    curve.sell_tax_bps = tax;
    curve.last_oracle_update = clock.unix_timestamp;

    emit!(AttentionUpdated {
        curve: curve.key(),
        twitter_delta,
        telegram_delta,
        new_holders,
        raw_score: raw,
        attention_score: curve.attention_score,
        price_velocity: curve.price_velocity,
        sell_tax_bps: tax,
        effective_k: eff_k,
        oracle_count,
        quorum: cfg.quorum,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

/// Collect distinct authorized oracle signers from cranker + remaining accounts.
fn collect_oracle_attestations(
    cranker: Pubkey,
    remaining: &[AccountInfo],
    authorized: &[Pubkey],
    quorum: u8,
) -> Result<u8> {
    let mut seen: BTreeSet<Pubkey> = BTreeSet::new();

    let is_authorized = |k: &Pubkey| authorized.iter().any(|a| a == k);

    if is_authorized(&cranker) {
        seen.insert(cranker);
    }

    for acc in remaining.iter() {
        require!(acc.is_signer, VelocityError::OracleNotSigner);
        require!(is_authorized(acc.key), VelocityError::UnauthorizedOracle);
        require!(seen.insert(*acc.key), VelocityError::DuplicateOracle);
    }

    require!(
        (seen.len() as u8) >= quorum,
        VelocityError::InsufficientOracleQuorum
    );

    Ok(seen.len() as u8)
}
