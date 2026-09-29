use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::errors::NarrativeError;
use crate::events::ConfigUpdated;
use crate::instructions::initialize_config::{
    DEFAULT_POST_THRESHOLD_SECS, DEFAULT_STAKER_AIRDROP_BPS, MAX_STAKER_AIRDROP_BPS,
};
use crate::state::NarrativeConfig;

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    /// CHECK: Manually deserialized — may be short pre-migration
    /// (staker_airdrop_bps / post_threshold_secs appended). Realloc'd in handler.
    #[account(
        mut,
        seeds = [NarrativeConfig::SEED],
        bump,
    )]
    pub config: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Load NarrativeConfig from possibly-undersized account data (prefix-compatible).
fn load_config(data: &[u8]) -> Result<(u8, NarrativeConfig)> {
    require!(data.len() >= 8, NarrativeError::Unauthorized);
    let disc = &data[..8];
    // Pad to full size so missing trailing staker_airdrop_bps reads as 0.
    let need = 8 + NarrativeConfig::INIT_SPACE;
    let mut buf = vec![0u8; need];
    let n = data.len().min(need);
    buf[..n].copy_from_slice(&data[..n]);
    let cfg: NarrativeConfig =
        NarrativeConfig::try_deserialize(&mut &buf[..]).map_err(|_| NarrativeError::Unauthorized)?;
    // Recover bump from seeds if zeroed (shouldn't happen for prefix-compatible layout).
    let _ = disc;
    Ok((cfg.bump, cfg))
}

/// Authority-only: update fee, min stake, treasury, curve program, staker airdrop bps,
/// and/or post-threshold final window. Also reallocs NarrativeConfig after upgrades that
/// append fields (`staker_airdrop_bps`, `post_threshold_secs`).
pub fn update_config_handler(
    ctx: Context<UpdateConfig>,
    fee_bps: Option<u16>,
    min_stake: Option<u64>,
    treasury: Option<Pubkey>,
    curve_program: Option<Pubkey>,
    staker_airdrop_bps: Option<u16>,
    post_threshold_secs: Option<i64>,
) -> Result<()> {
    let info = ctx.accounts.config.to_account_info();
    let data = info.try_borrow_data()?;
    let (stored_bump, mut config) = load_config(&data)?;
    drop(data);

    require_keys_eq!(
        config.authority,
        ctx.accounts.authority.key(),
        NarrativeError::Unauthorized
    );

    // Ensure account is large enough for the new layout.
    let need = 8 + NarrativeConfig::INIT_SPACE;
    let rent = Rent::get()?;
    let new_min = rent.minimum_balance(need);
    let current_len = info.data_len();
    if current_len < need {
        let extra_lamports = new_min.saturating_sub(info.lamports());
        if extra_lamports > 0 {
            transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.authority.to_account_info(),
                        to: info.clone(),
                    },
                ),
                extra_lamports,
            )?;
        }
        info.realloc(need, false)?;
    }

    if let Some(fee) = fee_bps {
        require!(fee <= 1000, NarrativeError::InvalidFeeBps);
        config.fee_bps = fee;
    }
    if let Some(min) = min_stake {
        config.min_stake = min;
    }
    if let Some(t) = treasury {
        config.treasury = t;
    }
    if let Some(c) = curve_program {
        config.curve_program = c;
    }
    if let Some(bps) = staker_airdrop_bps {
        require!(bps <= MAX_STAKER_AIRDROP_BPS, NarrativeError::InvalidAirdropBps);
        config.staker_airdrop_bps = bps;
    } else if config.staker_airdrop_bps == 0 {
        config.staker_airdrop_bps = DEFAULT_STAKER_AIRDROP_BPS;
    }
    if let Some(secs) = post_threshold_secs {
        // Allow short values for Devnet smoke; product default is 30m.
        require!(secs >= 1 && secs <= config.graduation_window, NarrativeError::InvalidDuration);
        config.post_threshold_secs = secs;
    } else if config.post_threshold_secs == 0 {
        config.post_threshold_secs = DEFAULT_POST_THRESHOLD_SECS;
    }

    // Preserve bump from seeds if deserialize left it intact.
    if config.bump == 0 {
        config.bump = ctx.bumps.config;
    } else {
        let _ = stored_bump;
    }

    {
        let mut dst = info.try_borrow_mut_data()?;
        let mut out = Vec::with_capacity(need);
        config.try_serialize(&mut out)?;
        require!(out.len() <= dst.len(), NarrativeError::MathOverflow);
        dst[..out.len()].copy_from_slice(&out);
        if out.len() < dst.len() {
            dst[out.len()..].fill(0);
        }
    }

    emit!(ConfigUpdated {
        authority: config.authority,
        fee_bps: config.fee_bps,
        min_stake: config.min_stake,
        treasury: config.treasury,
        curve_program: config.curve_program,
        staker_airdrop_bps: config.staker_airdrop_bps,
        post_threshold_secs: config.post_threshold_secs,
    });

    Ok(())
}
