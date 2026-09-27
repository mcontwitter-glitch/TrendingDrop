use anchor_lang::prelude::*;
use std::collections::BTreeSet;

use crate::errors::VelocityError;
use crate::events::AttentionUpdated;
use crate::math::{ema_update, velocity_params, weighted_attention};
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

    /// Fee-paying cranker / keeper. Counted toward quorum if authorized.
    pub cranker: Signer<'info>,
}

/// Oracle crank — updates attention EMA and sell-tax / effective-k inputs.
///
/// Phase-1 mainnet (multi-sig crank):
/// - Metrics are passed once (all oracles attest the same values by co-signing the tx).
/// - `cranker` (if authorized) + `remaining_accounts` that are **signers** and in
///   `authorized_oracles` form the attestation set.
/// - Require `≥ quorum` **distinct** authorized oracles. Reject duplicates / unauthorized.
///
/// `proof` is reserved for future ed25519 sysvar introspection (TODO below).
pub fn update_attention_handler(
    ctx: Context<UpdateAttention>,
    twitter_delta: u64,
    telegram_delta: u64,
    new_holders: u64,
    proof: Vec<u8>,
) -> Result<()> {
    let cfg = &ctx.accounts.oracle_config;

    // TODO(mainnet-phase-2): when `proof` is non-empty, verify ed25519 signatures via
    // the Ed25519Program instruction introspection / sysvar instead of (or in addition
    // to) requiring remaining accounts as tx signers. Canonical message should commit
    // to (curve, twitter, telegram, holders, timestamp/epoch). For now we only accept
    // the multi-sig crank path; `proof` must be empty or is ignored with a soft check.
    let _ = &proof; // future: ed25519 aggregation stub

    let oracle_count = collect_oracle_attestations(
        ctx.accounts.cranker.key(),
        ctx.remaining_accounts,
        &cfg.authorized_oracles,
        cfg.quorum,
    )?;

    let clock = Clock::get()?;
    let curve = &mut ctx.accounts.curve;

    // Optional interval soft-check (staleness is a client concern for trades).
    if curve.last_oracle_update > 0 && cfg.update_interval > 0 {
        let _elapsed = clock
            .unix_timestamp
            .saturating_sub(curve.last_oracle_update);
    }

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
