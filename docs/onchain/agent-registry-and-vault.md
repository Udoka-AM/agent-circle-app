# Agent Registry & Agent Vault — Program Architecture, Contract Structure & Experience Flow

**Status:** Draft for contractor review · Solana / Anchor first, written to stay EVM-portable
**Scope:** The two custom on-chain programs required for Phase 1

---

## 1. What these programs are for

Agent Circle is a marketplace where **builders list agents they build and host themselves**,
and **traders allocate capital that those agents trade on their behalf**.

Two programs make that possible:

| Program | Owns | Why separate |
|---|---|---|
| `agent_registry` | Builder identity, listings, staked bonds, slashing | Identity layer — should be stable, rarely upgraded |
| `agent_vault` | Trader capital, trade permissions, accounting, fees | Holds value and will iterate — isolated blast radius |

Staking lives **inside** the registry rather than in a third program: slashing needs
listing state, so splitting them adds cross-program calls for the most common read
with no security benefit.

### 1.1 The single most important design point

> **The vault is not a custody decision. It is the fee-collection mechanism.**

A performance fee is a percentage of profit. To charge one you must be able to
(a) know the starting balance, (b) know the ending balance, and (c) take the cut
before the trader withdraws. If capital sits in a trader's personal wallet, none of
those are possible — deposits, unrelated trades and skipped signals make "profit from
this agent" unanswerable, and collection becomes an invoice you hope gets paid.

Inside a program-controlled vault, all three are automatic and trustless.

### 1.2 What the vault is *not*

- **You cannot move trader funds.** The trader is the sole withdrawal authority.
- **The agent cannot move trader funds.** It holds scoped trade permission only.
- **You do not host agents.** Builder code runs on builder infrastructure.

Residual exposure is **code correctness** — which is what the audit gate exists for.

---

## 2. Where each piece runs

A frequent source of confusion. Nothing about the vault changes the self-hosted model.

| Layer | Runs where | Responsibility |
|---|---|---|
| Agent strategy / model / bot | **Builder's own infrastructure** | Decides what to trade. Agent Circle never sees or runs this. |
| Agent signing key | Builder's bot | Submits trades *into* vaults it has permission for |
| `agent_registry` / `agent_vault` | **Solana** | Permissions, limits, accounting, fee routing |
| Discovery, metadata, admin, history | **Agent Circle app + Supabase** | Leaderboard, profiles, vetting queue, indexed trades |

The builder's bot is an ordinary program running wherever they like. It simply holds a
keypair that has scoped authority to call `execute_trade` on vaults assigned to its listing.

---

## 3. `agent_registry` — contract structure

### 3.1 Accounts

**`Builder`** — PDA seeds `["builder", authority]`

| Field | Type | Notes |
|---|---|---|
| `authority` | `Pubkey` | Builder's wallet |
| `bond_amount` | `u64` | Staked $AGENT |
| `tier` | `u8` | 0 = unstaked, 1–3 |
| `unbond_requested_at` | `i64` | 0 if none; starts the 14-day clock |
| `slash_count` | `u16` | Public track record |
| `agent_count` | `u16` | |
| `created_at` | `i64` | |
| `bump` | `u8` | |

**`AgentListing`** — PDA seeds `["agent", builder, agent_seed]`

| Field | Type | Notes |
|---|---|---|
| `builder` | `Pubkey` | |
| `agent_authority` | `Pubkey` | The bot's signing key — rotatable |
| `status` | `ListingStatus` | `Vetting` / `Live` / `Paused` / `Delisted` |
| `market` | `u8` | Enum matching app market categories |
| `metadata_hash` | `[u8; 32]` | Hash of off-chain description; keeps chain cheap, content tamper-evident |
| `listing_fee_bps` | `u16` | Recommended **0** at launch |
| `performance_fee_bps` | `u16` | Recommended **1000** (10%) |
| `builder_split_bps` | `u16` | Recommended **8000** (80% to builder) |
| `position_cap_bps` | `u16` | Default risk limit |
| `max_drawdown_bps` | `u16` | Default risk limit |
| `auto_pause` | `bool` | |
| `aum_current` | `u64` | Sum of vault principal — enforced against tier ceiling |
| `aum_ceiling` | `u64` | Derived from builder tier |
| `vault_count` | `u32` | |
| `approved_at` | `i64` | |
| `bump` | `u8` | |

**`BondVault`** — PDA seeds `["bond", builder]` · SPL token account holding staked $AGENT

### 3.2 Instructions

| Instruction | Signer | Effect |
|---|---|---|
| `register_builder` | Builder | Creates `Builder` PDA |
| `stake_bond(amount)` | Builder | Transfers $AGENT to `BondVault`, recomputes tier |
| `request_unbond` | Builder | Starts 14-day clock; blocks new vault deposits |
| `withdraw_bond(amount)` | Builder | Only after 14 days **and** only down to the tier still covering current AUM |
| `submit_listing(agent_authority, market, metadata_hash)` | Builder | Status → `Vetting` |
| `approve_listing(fee_config)` | **Multisig** | Status → `Live`, writes fee + risk config |
| `pause_listing` | Builder or multisig | Blocks new deposits and trades; existing vaults can still withdraw |
| `delist` | Builder or multisig | Terminal |
| `rotate_agent_authority(new_key)` | Builder | Key-compromise recovery — **must exist** |
| `slash_bond(amount, reason_hash)` | **Multisig** | Split: harmed traders + buyback pool |

### 3.3 Listing state machine

```
submit_listing        approve_listing
  ──────────►  Vetting ──────────────►  Live
                  │                      │  ▲
                  │                      │  │ resume
                  │              pause_listing│
                  │                      ▼  │
                  └──────► Delisted ◄── Paused
```

`Delisted` is terminal. Vaults on a delisted agent enter withdraw-only mode.

---

## 4. `agent_vault` — contract structure

### 4.1 Accounts

**`VenueWhitelist`** — PDA seeds `["venues"]`

| Field | Type | Notes |
|---|---|---|
| `authority` | `Pubkey` | Multisig |
| `venues` | `Vec<Pubkey>` | Approved market program IDs |

**`TraderVault`** — PDA seeds `["vault", trader, agent_listing]`

| Field | Type | Notes |
|---|---|---|
| `trader` | `Pubkey` | **Sole withdrawal authority** |
| `agent_listing` | `Pubkey` | |
| `balance` | `u64` | Current value, quote token |
| `principal` | `u64` | Net deposits — used for AUM ceiling |
| `high_water_mark` | `u64` | Fee basis — see §4.3 |
| `position_cap_bps` | `u16` | Trader may override **stricter only** |
| `max_drawdown_bps` | `u16` | Trader may override **stricter only** |
| `auto_pause` | `bool` | |
| `status` | `VaultStatus` | `Active` / `Paused` / `Closing` |
| `last_fee_assessment` | `i64` | |
| `bump` | `u8` | |

### 4.2 Instructions

| Instruction | Signer | Effect |
|---|---|---|
| `open_vault(risk_overrides)` | Trader | Creates vault against a `Live` listing |
| `deposit(amount)` | Trader | CPI to registry: reject if `aum_current + amount > aum_ceiling`. Raises HWM by `amount` |
| `withdraw(amount)` | **Trader only** | Runs `assess_fees` first, then releases |
| `execute_trade(venue, ix_data)` | `agent_authority` | Validated — see §4.4 |
| `assess_fees` | Permissionless crank | Deducts fee, routes splits |
| `pause_vault` / `resume_vault` | Trader | |
| `close_vault` | Trader | Final assessment, return remainder, close |

### 4.3 High-water-mark accounting — the correctness-critical part

Fees accrue **only on profit above the vault's all-time-high balance.**

Without this, a volatile agent earns on every up-swing and returns nothing on
down-swings — a builder can farm variance and extract fees from a trader who ended
up flat or down. **This must be enforced in-program, never off-chain.**

```rust
// on assess_fees
if vault.balance > vault.high_water_mark {
    let profit       = vault.balance - vault.high_water_mark;
    let fee          = profit * listing.performance_fee_bps / 10_000;
    let builder_cut  = fee * listing.builder_split_bps / 10_000;
    let platform_cut = fee - builder_cut;

    vault.balance         -= fee;
    vault.high_water_mark  = vault.balance;   // post-fee, prevents double-charging
    // route builder_cut -> Streamflow stream
    // route platform_cut -> Squads treasury
}
```

**Deposit/withdrawal adjustment — easy to get wrong:**
- On **deposit**: `high_water_mark += amount`. Otherwise fresh capital instantly reads as profit.
- On **withdrawal**: `high_water_mark -= amount` (after fees). Otherwise the trader can
  never earn a fee-free recovery on remaining capital.

### 4.4 `execute_trade` validation

Reject unless **all** hold:

1. `vault.status == Active`
2. `listing.status == Live`
3. Signer matches `listing.agent_authority`
4. Target program ∈ `VenueWhitelist`
5. Resulting position ≤ `balance × position_cap_bps / 10_000`
6. Drawdown from HWM < `max_drawdown_bps`

**Enforce, don't slash.** Prevention at instruction level beats punishment after the
fact — a violated limit that only triggers a slash still means a trader lost money.

When `auto_pause` is set and rule 6 breaches, the vault flips to `Paused` in the same
transaction. Only the trader can resume.

---

## 5. Money flow — worked example

Trader allocates **$10,000** to Agent X. Performance fee 10%, split 80/20.

| Step | Amount | Result |
|---|---|---|
| Trader deposits | $10,000 | Vault opens · balance $10,000 · **HWM $10,000** |
| *(Optional)* listing fee 1.25% | −$125 | Charged regardless of performance — **recommend 0% at launch** |
| Agent trades over 3 months | → $12,000 | Profit above HWM = **$2,000** |
| Performance fee: 10% of profit | −$200 | Assessed on withdrawal or weekly crank |
| → Builder 80% | **$160** | Streamed via Streamflow |
| → Platform 20% | **$40** | Squads treasury → funds Phase 2 buyback |
| Trader withdraws | **$11,800** | Principal was never touchable by platform or builder |

No invoices. No trust. The program deducts the agreed cut **from profit only** and
releases the rest.

**If the agent loses money instead:** balance $9,000, HWM stays $10,000, **fee = $0**.
The builder earns nothing until the vault exceeds $10,000 again.

### 5.1 Revenue streams summarised

Only **two** are actual cash flow:

1. **Performance fee** — 10% of net new profit, split 80/20 builder/platform
2. **Listing fee** — upfront % of allocation · *recommended 0% at launch*

The rest are token mechanics, not income:
- **Builder staking** — creates $AGENT demand tied to real AUM, not speculation
- **Buyback pool** — funded *from* the platform's share, not a separate stream

---

## 6. Experience flows

### 6.1 Builder journey

1. Connect wallet → **SIWS signature** *(already live in the app)*
2. `register_builder`
3. `stake_bond` → tier assigned, unlocking an AUM ceiling
4. `submit_listing` on-chain + description to Supabase → status `Vetting`
5. Team reviews in **`/admin`** → `approve_listing` (multisig) → status `Live`
6. Builder's own bot watches for vaults opened against its listing
7. Bot calls `execute_trade` within enforced limits
8. Revenue share streams to builder wallet via Streamflow

### 6.2 Trader journey

1. Browse leaderboard / agent profile *(already live)*
2. Connect wallet
3. `open_vault` → set capital, position cap, max drawdown, auto-pause
4. `deposit`
5. Agent trades; trader monitors in **`/dashboard`**
6. `pause_vault` any time; `withdraw` any time — **no lockup**

### 6.3 Mapping to what already exists

| Already built | Becomes |
|---|---|
| SIWS session auth | Proof of builder/trader wallet ownership |
| `/builders` submit form | Front-end for `submit_listing` |
| `/admin` vetting queue | Front-end for `approve_listing` (behind multisig) |
| `/agents/[slug]/list` | Front-end for `open_vault` + `deposit` |
| `/dashboard` | Reads real `TraderVault` accounts |
| `performance_snapshots.source` | `builder_reported` → `chain_verified` |
| `agents` table fee columns | Mirror of on-chain `AgentListing` config |

The app was deliberately built so that swapping mock execution for real calls is a
data-layer change, not a redesign.

---

## 7. Open questions blocking a contractor quote

1. **Which prediction-market programs get whitelisted?** Determines the entire CPI
   surface of `execute_trade` — the most expensive instruction to build and audit.
   **Highest priority.**
2. **$AGENT bond tier amounts** — needs a price/float decision. Rule of thumb: bond
   value ≥ 10–15% of the AUM ceiling it unlocks, or the deterrent is theatre.
3. **Quote token** — USDC assumed throughout. Confirm.
4. **Upgrade authority** on each program, and whether it is burned post-audit.
5. **Fee crank** — who runs the keeper, who pays its gas.

---

## 8. Risks to state plainly

- **Regulatory.** Taking a performance fee on third-party trading capital resembles
  regulated investment-advisory activity in several jurisdictions. Get legal advice
  before mainnet — a bigger launch risk than any contract bug.
- **Agent key compromise.** Delegated authority means a stolen key can trade a vault
  (bounded by risk limits). `rotate_agent_authority` is mandatory, not optional.
- **Venue composability.** Whitelisted programs become your attack surface; an exploit
  in a market program is an exploit in your vaults.
- **Audit is a gate, not a step.** No real funds before a published report from a named
  firm — already promised in the public docs.

---

## Appendix — suggested contractor review order

1. §4.4 `execute_trade` + §7.1 venue whitelist → scope the hardest instruction
2. §4.3 high-water-mark accounting → hardest correctness surface
3. §3 ↔ §4 bond tier vs vault AUM enforcement → cross-program invariant
