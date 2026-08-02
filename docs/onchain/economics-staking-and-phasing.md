# Agent Circle — On-Chain Program Spec (DRAFT v0.1)

**Status:** Draft for review · Chain-neutral by design (Anchor/Solana first, EVM-portable)
**Audience:** Anchor contractor, security auditor, internal review

---

## 0. The decision this spec exists to force

Everything below hinges on one architectural choice:

> **Do trader funds sit in a program-controlled vault, or do agents trade in their own wallets and report results?**

This spec assumes **program-controlled vaults**, because the product's core claim —
"performance verified on-chain" — is only true if every trade flows through a program
that can compute PnL and enforce risk limits. If agents trade off-platform and
self-report, the leaderboard is unverified marketing copy, not a trust layer.

**Consequence:** the vault program is the hard part of Phase 1, not the registry.

---

## 1. Program architecture

**Recommendation: two custom programs for Phase 1.** Resist writing more.

### 1.1 `agent_registry`
Owns identity, listings, and economic security.

| Account | Seeds | Holds |
|---|---|---|
| `Builder` | `["builder", authority]` | authority pubkey, bond amount, tier, unbond request, slash history |
| `AgentListing` | `["agent", builder, agent_id]` | status, market, fee config, agent signing key, AUM cap, risk defaults |
| `BondVault` | `["bond", builder]` | escrowed $AGENT |

Instructions: `register_builder`, `stake_bond`, `request_unbond`, `withdraw_bond`,
`submit_listing`, `approve_listing`*, `pause_listing`, `slash_bond`*
(*multisig-gated)

### 1.2 `agent_vault`
Owns trader capital, execution permissions, accounting, and fees.

| Account | Seeds | Holds |
|---|---|---|
| `TraderVault` | `["vault", trader, agent_listing]` | balance, high-water mark, risk limits, status |
| `VenueWhitelist` | `["venues"]` | approved market program IDs (multisig-managed) |

Instructions: `open_vault`, `deposit`, `withdraw`, `execute_trade`,
`assess_fees`, `pause_vault`, `close_vault`

**Why two and not one:** the vault holds money and will iterate; the registry holds
identity and should be stable. Separate upgrade authorities and separate blast radius.

**Why two and not four:** staking lives in the registry because slashing needs listing
state — splitting them adds CPI for the most common cross-read with no security gain.

### 1.3 Deliberately NOT custom programs
- **Revenue-share streaming** → Streamflow
- **Treasury / multisig** → Squads
- **Buyback execution** → Jupiter Swap API + keeper (Phase 2)
- **Sub-tokens** → Meteora DBC (Phase 2)

---

## 2. Execution & risk model

The vault grants the agent's signing key **delegated authority that can only be used
through `execute_trade`**. The agent never holds trader funds and cannot transfer them out.

`execute_trade` must reject unless:
1. Target program is in `VenueWhitelist`
2. Resulting position ≤ `position_cap_pct` of vault balance
3. Vault drawdown from high-water mark < `max_drawdown_limit_pct`
4. Vault status is `Active`

**Enforce, don't slash.** Prevention at the instruction level is worth more than
punishment after the fact — a violated limit that only triggers a slash still means
a trader lost money.

`auto_pause`: when drawdown breaches the limit, the vault flips to `Paused` in the
same transaction. Only the trader can resume.

**Open dependency:** which Solana prediction-market programs get whitelisted. This
determines CPI surface and is a hard prerequisite for a contractor to scope
`execute_trade`. Resolve before quoting.

---

## 3. Economics — recommended values

All values live in program config, not hardcoded. Recommendations below, with reasoning.

### 3.1 Fees

| Fee | Recommendation | Reasoning |
|---|---|---|
| **Listing / deployment fee** | **0% at launch** (keep field, set to zero) | Currently 1.25% in the DB. An upfront fee on unproven agents taxes exactly the behaviour you need — trial. Rent extraction before volume kills two-sided marketplaces. |
| **Management fee** | **0% — reject entirely** | Charging rent regardless of performance is the misalignment the product exists to solve. Never introduce it. |
| **Performance fee** | **10% of net new profit** | Below hedge-fund 20%, in line with crypto copy-trading (~10%). Only charged when the trader actually made money. |

### 3.2 Performance fee split

**Launch: 80% builder / 20% platform** → platform take = 2% of trader profits.
**Mature: 70/30** once demand is proven.

Subsidise the harder side of the marketplace. You need quality agents before you need
traders; builder-favourable terms early are cheap customer acquisition for supply.

### 3.3 High-water mark — non-negotiable

Fees accrue **only on profit above the vault's all-time-high balance.**

Without this, a volatile agent earns on every up-swing and pays nothing back on
down-swings — a builder can farm variance and extract fees from a flat or losing
trader. This single mechanic is the difference between an aligned fee and a
predatory one. It must be enforced in the program, not off-chain.

### 3.4 Fee assessment cadence

On withdrawal and on a periodic crank (e.g. weekly), whichever comes first.
Assess → split → transfer platform cut to Squads treasury → open/top-up Streamflow
stream for builder cut.

---

## 4. Staking / bond model

**Purpose:** make fraud economically irrational, and tie $AGENT demand to real usage
rather than speculation.

### 4.1 Bond scales with capital under management

A fixed bond is meaningless once an agent manages 100× its value. Recommend tiers
(simpler and more auditable than a live price oracle):

| Tier | Bond ($AGENT) | AUM ceiling |
|---|---|---|
| 1 | *TBD* | $25,000 |
| 2 | *TBD* | $150,000 |
| 3 | *TBD* | $1,000,000 |

> Numbers deliberately blank — they must be set against live $AGENT price and float.
> Rule of thumb: bond value ≥ 10–15% of AUM ceiling, or the deterrent is theatre.

The vault program rejects deposits that would push an agent past its tier ceiling.
This creates organic buy pressure as agents succeed — demand follows usage, matching
the "nothing provisioned ahead of demand" thesis in the docs.

### 4.2 Unbonding

**14-day unbonding period.** Prevents withdraw-then-defraud. Bond stays slashable
during the window.

### 4.3 Slashing — be honest about what's trustless

**Mechanically provable (program-enforced, no human):**
- Attempting to route funds to a non-whitelisted program
- Exceeding tier AUM ceiling

**Subjective (multisig decision + published rationale):**
- Wash trading / self-dealing
- Coordinated manipulation

Most real misconduct falls in the second bucket. Do not market this as "trustless
slashing" — it is multisig-governed slashing with on-chain transparency, and claiming
otherwise is the kind of overstatement the product is positioned against.

**Slash destination:** split between harmed traders (compensation) and buyback pool.
Never 100% to treasury — that creates an incentive to slash.

---

## 5. Phase mapping

| Phase | On-chain scope |
|---|---|
| **1 (MVP)** | `agent_registry` + `agent_vault` on devnet → audit → mainnet. Streamflow revenue share live. |
| **2** | Buyback keeper (Jupiter), sub-tokens (Meteora DBC), audit published |
| **3** | Open SDK, external venue integrations |

---

## 6. Open questions blocking a contractor quote

1. **Which prediction-market programs are whitelisted?** Determines CPI complexity. *Highest priority.*
2. **$AGENT tier amounts** — needs price/float decision.
3. **Custody model confirmed?** This spec assumes non-custodial delegated vaults.
4. **Who holds upgrade authority** on each program, and does it get burned post-audit?
5. **Fee assessment crank** — who runs the keeper, and who pays its gas?

---

## 7. Risks to state plainly

- **Regulatory.** Taking a performance fee on third-party trading capital resembles
  regulated investment-advisory activity in several jurisdictions. Get legal advice
  before mainnet — this is a bigger launch risk than any smart-contract bug.
- **Agent key compromise.** Delegated authority means a stolen agent key can trade
  a vault (bounded by risk limits, but still). Consider key rotation instructions.
- **Venue composability.** Whitelisted programs become your attack surface; an exploit
  in a market program is an exploit in your vaults.
- **Audit is a gate, not a step.** No real funds before a published report from a
  named firm — already promised in the public docs.

---

## Appendix — suggested review order for a contractor

1. §2 execution model + §6.1 venue whitelist → scope `execute_trade`
2. §3.3 high-water-mark accounting → hardest correctness surface
3. §4 bond tiers ↔ vault AUM enforcement → cross-program invariant
