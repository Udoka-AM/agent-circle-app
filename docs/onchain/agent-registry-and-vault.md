# Agent Registry & Agent Vault — Program Architecture, Contract Structure & Experience Flow

**Status:** Spec v0.2 · Economic parameters locked · Solana / Anchor first, written to stay EVM-portable
**Scope:** The two custom on-chain programs required for Phase 1
**Single source of truth** — supersedes all earlier draft specs.

---

## 0. Locked parameters

These are **decided**, not suggestions. Build against them.

| Parameter | Value | Notes |
|---|---|---|
| Listing fee | **0 bps** | Field exists and is configurable; set to zero at launch |
| Performance fee | **1000 bps** (10%) | Of net new profit above high-water mark |
| Builder split | **8000 bps** (80%) | Platform takes remaining 20% → 2% of trader profit |
| Management fee | **None — never introduce** | Not a field. Deliberately absent. |
| Fee assessment | On withdrawal **+ weekly crank** | Whichever comes first |
| Unbonding period | **14 days** | Bond remains slashable throughout |
| Default position cap | **1200 bps** (12%) | Per-vault; trader may override stricter only |
| Default max drawdown | **1500 bps** (15%) | Per-vault; trader may override stricter only |
| Slash split | **70% harmed traders / 30% buyback** | Never 100% to treasury |

**Still open — see §9:** bond tier amounts, whitelisted venues, quote token, upgrade authority, crank operator.

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

- **The platform cannot move trader funds.** The trader is the sole withdrawal authority.
- **The agent cannot move trader funds.** It holds scoped trade permission only.
- **The platform does not host agents.** Builder code runs on builder infrastructure.

Residual exposure is **code correctness** — which is what the audit gate exists for.

### 1.3 Deliberately NOT custom programs

- **Revenue-share streaming** → Streamflow
- **Treasury / multisig** → Squads
- **Buyback execution** → Jupiter Swap API + keeper (Phase 2)
- **Sub-tokens** → Meteora DBC (Phase 2)

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
keypair with scoped authority to call `execute_trade` on vaults assigned to its listing.

---

## 3. `agent_registry` — contract structure

### 3.1 Accounts

**`Builder`** — PDA seeds `["builder", authority]`

| Field | Type | Notes |
|---|---|---|
| `authority` | `Pubkey` | Builder's wallet |
| `bond_amount` | `u64` | Staked $AGENT |
| `total_aum` | `u64` | Sum across all this builder's listings — **this is the figure the tier ceiling is enforced against** |
| `tier` | `u8` | 0 = unstaked, 1–3 |
| `unbond_requested_at` | `i64` | 0 if none; starts the 14-day clock |
| `slash_count` | `u16` | Public track record |
| `agent_count` | `u16` | |
| `created_at` | `i64` | |
| `bump` | `u8` | |

**`AgentListing`** — PDA seeds `["agent", builder, agent_seed]`

| Field | Type | Launch value |
|---|---|---|
| `builder` | `Pubkey` | |
| `agent_authority` | `Pubkey` | The bot's signing key — rotatable |
| `status` | `ListingStatus` | `Vetting` / `Live` / `Paused` / `Delisted` |
| `market` | `u8` | Enum matching app market categories |
| `metadata_hash` | `[u8; 32]` | Hash of off-chain description — keeps chain cheap, content tamper-evident |
| `listing_fee_bps` | `u16` | **0** |
| `performance_fee_bps` | `u16` | **1000** |
| `builder_split_bps` | `u16` | **8000** |
| `position_cap_bps` | `u16` | **1200** |
| `max_drawdown_bps` | `u16` | **1500** |
| `auto_pause` | `bool` | `true` |
| `aum_current` | `u64` | Per-listing bookkeeping. The *enforced* ceiling is builder-level — see note below |
| `vault_count` | `u32` | |
| `approved_at` | `i64` | |
| `bump` | `u8` | |

**`BondVault`** — PDA seeds `["bond", builder]` · SPL token account holding staked $AGENT

> **The AUM ceiling is enforced per *builder*, not per listing.** An earlier draft put
> `aum_ceiling` on each listing; that is duplicated state derived from a builder-level
> tier, and it can drift. It also gets the security wrong: a builder able to defraud
> across three agents is exposed for the sum, so three listings must not each carry a
> full ceiling. `Builder.total_aum` is the enforced figure.

### 3.2 Instructions

| Instruction | Signer | Effect |
|---|---|---|
| `register_builder` | Builder | Creates `Builder` PDA |
| `stake_bond(amount)` | Builder | Transfers $AGENT to `BondVault`, recomputes tier |
| `request_unbond` | Builder | Starts 14-day clock; **blocks new vault deposits immediately** |
| `withdraw_bond(amount)` | Builder | Only after 14 days **and** only down to the tier still covering current AUM |
| `submit_listing(agent_authority, market, metadata_hash)` | Builder | Status → `Vetting` |
| `approve_listing(fee_config)` | **Multisig** | Status → `Live`, writes fee + risk config |
| `pause_listing` | Builder or multisig | Blocks new deposits and trades; existing vaults can still withdraw |
| `delist` | Builder or multisig | Terminal |
| `rotate_agent_authority(new_key)` | Builder | Key-compromise recovery — **mandatory, not optional** |
| `slash_bond(amount, reason_hash)` | **Multisig** | Split 70/30 — see §6.3 |

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
| `position_cap_bps` | `u16` | Default 1200; trader may override **stricter only** |
| `max_drawdown_bps` | `u16` | Default 1500; trader may override **stricter only** |
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
| `assess_fees` | Permissionless crank | Weekly cadence; deducts fee, routes splits |
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
    let fee          = profit * 1_000 / 10_000;        // performance_fee_bps
    let builder_cut  = fee * 8_000 / 10_000;           // builder_split_bps
    let platform_cut = fee - builder_cut;

    vault.balance         -= fee;
    vault.high_water_mark  = vault.balance;   // post-fee, prevents double-charging
    // route builder_cut  -> Streamflow stream
    // route platform_cut -> Squads treasury
}
```

**Deposit/withdrawal adjustment — easy to get wrong:**
- On **deposit**: `high_water_mark += amount`. Otherwise fresh capital instantly reads as profit.
- On **withdrawal**: `high_water_mark -= amount` (after fees). Otherwise the trader can
  never earn a fee-free recovery on remaining capital.

### 4.4 `execute_trade` validation

Reject unless **all six** hold:

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

Trader allocates **$10,000** to Agent X. Listing fee 0%, performance fee 10%, split 80/20.

| Step | Amount | Result |
|---|---|---|
| Trader deposits | $10,000 | Vault opens · balance $10,000 · **HWM $10,000** · no upfront fee |
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

Only **one** is currently cash flow at launch:

1. **Performance fee** — 10% of net new profit, split 80/20 builder/platform
2. **Listing fee** — set to **0 bps**; field retained for future use

The rest are token mechanics, not income:
- **Builder staking** — creates $AGENT demand tied to real AUM, not speculation
- **Buyback pool** — funded *from* the platform's share, not a separate stream

---

## 6. Staking / bond model

**Purpose:** make fraud economically irrational, and tie $AGENT demand to real usage
rather than speculation.

### 6.1 Bond scales with capital under management

A fixed bond is meaningless once an agent manages 100× its value. Tiers are used
rather than a live price oracle — simpler, no external dependency, auditable.

| Tier | Bond ($AGENT) | AUM ceiling |
|---|---|---|
| 1 | *TBD* | $25,000 |
| 2 | *TBD* | $150,000 |
| 3 | *TBD* | $1,000,000 |

> **Blocked on the $AGENT price/float decision.** Rule of thumb: bond value ≥ 10–15%
> of the AUM ceiling it unlocks, or the deterrent is theatre. Tiers are fixed token
> counts (no oracle); the multisig may revise them if price moves materially.

The vault program rejects deposits that would push an agent past its tier ceiling.
This creates organic buy pressure as agents succeed — demand follows usage, matching
the "nothing provisioned ahead of demand" thesis in the public docs.

### 6.2 Unbonding — 14 days

A bond only deters fraud if it is still there when the fraud is caught. Without a
delay, a builder can defraud traders and pull their entire stake in the same block,
leaving nothing to slash.

- `request_unbond` starts the clock **and immediately blocks new deposits** into that
  builder's agents — no taking on fresh capital while exiting
- The bond remains **fully slashable** for the entire 14 days
- `withdraw_bond` succeeds only after the clock expires **and** only down to the tier
  that still covers live AUM

### 6.3 Slashing — be honest about what is trustless

**Mechanically provable (program-enforced, no human):**
- Attempting to route funds to a non-whitelisted program
- Exceeding tier AUM ceiling

**Subjective (multisig decision + published rationale):**
- Wash trading / self-dealing
- Coordinated manipulation

Most real misconduct falls in the second bucket. Do **not** market this as "trustless
slashing" — it is multisig-governed slashing with on-chain transparency, and claiming
otherwise is the kind of overstatement the product is positioned against.

**Slash destination: 70% to harmed traders, 30% to buyback pool.** Never 100% to
treasury — that would create an incentive to slash.

---

## 7. Experience flows

### 7.1 Builder journey

1. Connect wallet → **SIWS signature** *(already live in the app)*
2. `register_builder`
3. `stake_bond` → tier assigned, unlocking an AUM ceiling
4. `submit_listing` on-chain + description to Supabase → status `Vetting`
5. Team reviews in **`/admin`** → `approve_listing` (multisig) → status `Live`
6. Builder's own bot watches for vaults opened against its listing
7. Bot calls `execute_trade` within enforced limits
8. Revenue share streams to builder wallet via Streamflow

### 7.2 Trader journey

1. Browse leaderboard / agent profile *(already live)*
2. Connect wallet
3. `open_vault` → set capital, position cap, max drawdown, auto-pause
4. `deposit`
5. Agent trades; trader monitors in **`/dashboard`**
6. `pause_vault` any time; `withdraw` any time — **no lockup**

### 7.3 Mapping to what already exists

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

## 8. Phase mapping

| Phase | On-chain scope |
|---|---|
| **1 (MVP)** | `agent_registry` + `agent_vault` on devnet → audit → mainnet. Streamflow revenue share live. |
| **2** | Buyback keeper (Jupiter), sub-tokens (Meteora DBC), audit report published |
| **3** | Open SDK, external venue integrations |

---

## 9. Open questions blocking a contractor quote

1. **Which prediction-market programs are whitelisted?** Determines the entire CPI
   surface of `execute_trade` — the most expensive instruction to build and audit.
   Need: program ID(s), IDL/SDK, and whether launch is one venue or several.
   **Highest priority.**
2. **$AGENT bond tier amounts** — needs mint address, price, and float. Fixed token
   counts assumed (no oracle).
3. **Quote token** — USDC assumed throughout. Confirm.
4. **Upgrade authority** on each program, and whether it is burned post-audit.
5. **Fee crank** — who runs the weekly keeper, who pays its gas.

---

## 10. Risks to state plainly

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

## 11. The governance attack surface — designed against a real precedent

> **This section is not theoretical. It describes how a comparable Solana protocol lost $285M in
> April 2026, and the specific defences the vault must ship with.**

### 11.1 What happened to Drift

On 1 April 2026 Drift Protocol — then the largest DeFi protocol on Solana — lost **$285M**, the
second largest exploit in Solana's history. The sequence:

1. Attackers spent **months** building relationships with the Drift team
2. They used Solana **durable nonces** to get Security Council members to unknowingly sign
   transactions that remained valid indefinitely
3. Those signatures handed over **admin control**
4. With admin rights, they **whitelisted a worthless token (CVT) as collateral** at an
   artificial price
5. They borrowed against it and drained $285M in real USDC, SOL, and ETH

**No smart contract bug was involved.** The code did exactly what it was told by an authority it
had every reason to trust. Recovery required ~$150M of external support, the protocol suspended
withdrawals, and it has since relaunched under a new identity with prediction markets dropped.

### 11.2 Why this is our worst case, almost exactly

`agent_vault` will hold a **`VenueWhitelist` managed by the multisig**. That is structurally the
same object as Drift's collateral whitelist.

An attacker holding our multisig could:

| Action | Consequence |
|---|---|
| Add a malicious program to `VenueWhitelist` | `execute_trade` CPIs into it and **drains every vault** |
| `set_vault_authority` (registry) | Falsify AUM, bypass tier ceilings |
| `transfer_authority` (registry) | Complete, permanent takeover |
| `slash_bond` | Drain every builder bond |

The whitelist is the crown jewel. Guardrails already bound the multisig on *fees*
(§3.1 — perf ≤ 20%, split ≥ 50%), but an unbounded whitelist makes those guardrails irrelevant:
a malicious venue does not need a high fee to take everything.

### 11.3 Required defences

**These are requirements for `agent_vault`, not suggestions.** Retrofitting them after launch is
much harder than building them in.

> **Status, 21 August 2026 — items 2, 3 and 4 are built in `agent_registry`.**
> `instructions/governance.rs`, 14 tests. `transfer_authority`, `set_vault_authority` and
> `update_tiers` no longer exist as direct instructions; each is now queue → wait → execute,
> with a guardian able to veto during the wait and to pause any listing instantly. Item 1
> (the venue whitelist) and item 5 belong to `agent_vault` and remain outstanding. The same
> design is implemented and tested in Solidity as `VenueWhitelist.sol` in the EVM repository.
>
> Two things worth recording that the list below did not anticipate:
>
> - **`set_timelock_delay` had to be increase-only.** A settable delay is a hole: a
>   compromised authority does not need to defeat the timelock, it simply shortens it to
>   the floor, queues, and executes inside the window it chose. Allowing only increases means
>   the delay in force is always at least the one the guardian agreed to.
> - **The guardian's pause is one-directional.** It can stop a live listing and cannot
>   resume one. An emergency key that could also restart an agent would be a key that can put
>   capital back at risk.

1. **Timelock on whitelist additions — mandatory.** A newly whitelisted venue must be unusable
   for a fixed delay (recommend **72 hours**) after being added. This alone would have blunted
   the Drift attack: the malicious collateral was usable immediately. A timelock converts a
   silent instant drain into a public, observable pending change.

2. **Timelock on `transfer_authority` and `set_vault_authority`**, same reasoning.

3. **A guardian key that can cancel but not initiate.** Asymmetric power is the point: the
   guardian can veto any pending change during its timelock but can never propose one. Cheap to
   implement, and it means compromising the multisig is not sufficient on its own.

4. **Removal is immediate; addition is delayed.** Emergency response must always be faster than
   emergency damage. Removing a venue, pausing a listing, or pausing the whole vault should take
   effect in the same transaction.

5. **Consider a per-venue TVL cap during a ramp-in window** — a newly added venue handles at most
   a small share of total vault value for its first weeks, bounding the blast radius of a
   whitelist mistake made in good faith.

### 11.4 Operational requirements for whoever holds the multisig

The Drift compromise was social, not technical, so the code-level defences above are necessary
but not sufficient.

- **Never sign a transaction whose contents you have not independently verified.** The Drift
  council members believed they were signing something benign.
- **Understand durable nonces.** A durable-nonce transaction does not expire. A signature given
  today can be executed months later, at a moment of the attacker's choosing. Treat any request
  to sign one as hostile until proven otherwise.
- **Expect long-horizon social engineering.** The attackers invested months. Assume a
  counterparty who is friendly, patient, technically credible, and wrong to trust.
- Use Squads' transaction simulation and require multiple independent reviewers to decode
  proposed instruction data rather than trusting a description of it.

### 11.5 The honest framing

Our public docs promise audited contracts. An audit would **not** have caught the Drift attack —
there was no bug to find. Worth being clear internally, and ideally publicly, that an audit
bounds *code* risk, not *governance* risk. The timelock and guardian are what bound governance
risk, and they belong in the security page alongside the audit claim.

---

## Appendix — suggested contractor review order

1. **§11 governance attack surface** → the timelock and guardian requirements shape the whole
   admin design; read before anything else
2. §4.4 `execute_trade` + §9.1 venue whitelist → scope the hardest instruction
3. §4.3 high-water-mark accounting → hardest correctness surface
4. §3 ↔ §4 bond tier vs vault AUM enforcement → cross-program invariant
