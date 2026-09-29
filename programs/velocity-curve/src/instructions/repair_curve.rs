use anchor_lang::Discriminator;
use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::errors::VelocityError;
use crate::math::{apply_buy, spot_price, tokens_out_for_sol};
use crate::state::{
    VelocityToken, CURVE_REAL_TOKEN, GRADUATE_REAL_SOL, INITIAL_VIRTUAL_SOL, INITIAL_VIRTUAL_TOKEN,
};

/// Legacy VelocityToken body length (pre-CPMM trailing fields), excluding 8-byte disc.
pub const LEGACY_BODY_LEN: usize = 214;
/// Full account size with discriminator after CPMM fields appended.
pub const CURVE_ACCOUNT_LEN: usize = 8 + VelocityToken::INIT_SPACE;

/// Repair / migrate a curve to Pump.fun CPMM reserves.
/// Creator-only. Handles legacy 222-byte accounts via UncheckedAccount + realloc.
#[derive(Accounts)]
pub struct RepairCurve<'info> {
    /// CHECK: VelocityToken PDA — validated by seeds + discriminator in handler.
    #[account(
        mut,
        seeds = [VelocityToken::SEED, story_id.key().as_ref()],
        bump,
    )]
    pub curve: UncheckedAccount<'info>,

    /// CHECK: Canonical story PDA used for curve seeds.
    pub story_id: UncheckedAccount<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn repair_curve_handler(
    ctx: Context<RepairCurve>,
    base_price: u64,
    curve_k: u64,
) -> Result<()> {
    let virtual_sol = if base_price > 0 {
        base_price
    } else {
        INITIAL_VIRTUAL_SOL
    };
    let virtual_token = if curve_k > 0 {
        curve_k
    } else {
        INITIAL_VIRTUAL_TOKEN
    };
    require!(
        virtual_sol > 0 && virtual_token > 0,
        VelocityError::InvalidParams
    );

    let curve_info = ctx.accounts.curve.to_account_info();
    require_keys_eq!(
        *curve_info.owner,
        crate::ID,
        VelocityError::Unauthorized
    );

    // Snapshot legacy / current fields before realloc.
    let data = curve_info.try_borrow_data()?;
    require!(data.len() >= 8 + LEGACY_BODY_LEN, VelocityError::InvalidParams);
    require!(
        data[0..8] == VelocityToken::DISCRIMINATOR,
        VelocityError::InvalidParams
    );

    let mint = Pubkey::new_from_array(data[8..40].try_into().unwrap());
    let story_id_stored = Pubkey::new_from_array(data[40..72].try_into().unwrap());
    let creator = Pubkey::new_from_array(data[72..104].try_into().unwrap());
    // Offsets match historical layout (virtual_sol@104 … seed@212, bumps@220).
    let seed_liquidity = u64::from_le_bytes(data[212..220].try_into().unwrap());
    let real_sol_existing = u64::from_le_bytes(data[164..172].try_into().unwrap());
    let bump = data[220];
    let vault_bump = data[221];
    let attention = u64::from_le_bytes(data[128..136].try_into().unwrap());
    let price_velocity = u64::from_le_bytes(data[136..144].try_into().unwrap());
    let sell_tax_bps = u16::from_le_bytes(data[152..154].try_into().unwrap());
    let last_oracle = i64::from_le_bytes(data[154..162].try_into().unwrap());
    let merge_count = data[162];
    let is_merged = data[163] != 0;
    let protocol_fees = u64::from_le_bytes(data[172..180].try_into().unwrap());
    let holder_rewards = u64::from_le_bytes(data[180..188].try_into().unwrap());
    let reward_index = u128::from_le_bytes(data[188..204].try_into().unwrap());
    drop(data);

    require!(
        creator == ctx.accounts.authority.key(),
        VelocityError::Unauthorized
    );
    require!(
        story_id_stored == ctx.accounts.story_id.key()
            || ctx.accounts.story_id.key() == story_id_stored,
        VelocityError::StoryMismatch
    );
    // Prefer the story passed in (canonical) — also accept if stored matches.
    let story_id = ctx.accounts.story_id.key();
    require_keys_eq!(story_id_stored, story_id, VelocityError::StoryMismatch);
    require!(
        bump == ctx.bumps.curve,
        VelocityError::InvalidParams
    );

    // Realloc if short.
    let needed = CURVE_ACCOUNT_LEN;
    if curve_info.data_len() < needed {
        let rent = Rent::get()?;
        let new_min = rent.minimum_balance(needed);
        let current = curve_info.lamports();
        if current < new_min {
            transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.authority.to_account_info(),
                        to: curve_info.clone(),
                    },
                ),
                new_min.saturating_sub(current),
            )?;
        }
        curve_info.realloc(needed, false)?;
    }

    // Build Pump CPMM state; replay seed as AMM buy.
    let seed = if seed_liquidity > 0 {
        seed_liquidity
    } else {
        real_sol_existing
    };

    let mut vs = virtual_sol;
    let mut vt = virtual_token;
    let mut rs = 0u64;
    let mut rt = CURVE_REAL_TOKEN;
    let mut supply = 0u64;
    let mut price = spot_price(vs, vt)?;
    let mut complete = false;

    if seed > 0 {
        let dy = tokens_out_for_sol(seed, vs, vt)?.min(rt);
        if dy > 0 {
            let (nvs, nvt, nrs, nrt, nsupply, nprice) =
                apply_buy(vs, vt, rs, rt, supply, seed, dy)?;
            vs = nvs;
            vt = nvt;
            rs = nrs;
            rt = nrt;
            supply = nsupply;
            price = nprice;
        }
    }
    if rs >= GRADUATE_REAL_SOL {
        complete = true;
    }

    let token = VelocityToken {
        mint,
        story_id,
        creator,
        virtual_sol: vs,
        current_supply: supply,
        current_price: price,
        attention_score: attention,
        price_velocity,
        virtual_token: vt,
        sell_tax_bps,
        last_oracle_update: last_oracle,
        merge_count,
        is_merged,
        real_sol: rs,
        protocol_fees,
        holder_rewards_pool: holder_rewards,
        reward_index,
        last_price: price,
        seed_liquidity: seed,
        bump,
        vault_bump,
        real_token: rt,
        complete,
    };

    {
        let mut data = curve_info.try_borrow_mut_data()?;
        let mut cursor = std::io::Cursor::new(&mut data[8..]);
        // Write body after disc (disc already correct).
        AnchorSerialize::serialize(&token, &mut cursor)
            .map_err(|_| error!(VelocityError::InvalidParams))?;
    }

    msg!(
        "Repaired curve→CPMM story={} virtual_sol={} virtual_token={} real_sol={} supply={} price={} complete={}",
        story_id,
        vs,
        vt,
        rs,
        supply,
        price,
        complete
    );
    Ok(())
}

/// Creator-only: reset `current_supply` without changing virtual reserves.
pub fn repair_curve_supply_handler(ctx: Context<RepairCurve>, current_supply: u64) -> Result<()> {
    let curve_info = ctx.accounts.curve.to_account_info();
    require_keys_eq!(*curve_info.owner, crate::ID, VelocityError::Unauthorized);
    require!(
        curve_info.data_len() >= CURVE_ACCOUNT_LEN,
        VelocityError::InvalidParams
    );

    let mut data = curve_info.try_borrow_mut_data()?;
    require!(
        data[0..8] == VelocityToken::DISCRIMINATOR,
        VelocityError::InvalidParams
    );
    let creator = Pubkey::new_from_array(data[72..104].try_into().unwrap());
    require!(
        creator == ctx.accounts.authority.key(),
        VelocityError::Unauthorized
    );
    let story = Pubkey::new_from_array(data[40..72].try_into().unwrap());
    require_keys_eq!(story, ctx.accounts.story_id.key(), VelocityError::StoryMismatch);

    // current_supply @ offset 112
    data[112..120].copy_from_slice(&current_supply.to_le_bytes());
    let vs = u64::from_le_bytes(data[104..112].try_into().unwrap());
    let vt = u64::from_le_bytes(data[144..152].try_into().unwrap());
    let price = spot_price(vs, vt)?;
    data[120..128].copy_from_slice(&price.to_le_bytes());
    data[204..212].copy_from_slice(&price.to_le_bytes()); // last_price

    msg!(
        "Repaired curve supply story={} supply={} price={}",
        story,
        current_supply,
        price
    );
    Ok(())
}
