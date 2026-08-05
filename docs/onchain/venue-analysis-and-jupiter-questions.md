# Venue Analysis — Where Agents Actually Trade

**Status:** Research, August 2026 · Decision pending
**Blocks:** `agent_vault` (spec §9.1). `agent_registry` is unaffected — built, tested, and
deployed to devnet at `22rFHvivAX4hDwx3NdwfQ1hsyorwDFxc9JLy5WcZV7x6`.

---

## 0. The question that decides everything

The vault's core guarantee is that it verifies position cap and drawdown **in the same
transaction as the trade**. That requires the venue to be a Solana program the vault can CPI
into, with a position representation it can read on-chain.

So the venue question is not "which market has the best UX" — it is:

> **Where does the position actually settle, and can a Solana program see and constrain it?**

Everything below is organised around that.

---

## 1. Jupiter: Predict vs Forecast — the distinction that matters

These are **not two products**. Per Jupiter's own announcement: *"For users, Forecast is built
into @jup_predict, but provides an additional liquidity model."*

| Layer | What it is |
|---|---|
| **Jupiter Predict** | The product and API at `jup.ag/prediction`. One surface, one API. |
| **Providers** | Sources of markets behind it. The API exposes a `provider` field. |
| **`polymarket`** | A provider — the worked example in Jupiter's own API docs. Settles on **Polygon**. |
| **`bisonfi` / Forecast** | Jupiter's **native** liquidity model. Prop market makers quote competitively. Settles on **Solana**. |

**Category breadth on Predict is real** — Sports, Crypto, Politics, Esports, Culture, Economics,
Tech, Finance, Weather, Mentions, all confirmed by the API's own category filters and by live
volume on the site.

**But breadth ≠ enforceable.** A large share of that catalogue appears to come from the
`polymarket` provider, which settles on Polygon. Broad markets behind a Solana front-end do not
give the vault anything to constrain.

### 1.1 The countervailing finding

Jupiter's position docs say that opening a position:

- **requires signing a Solana transaction**
- produces a position with an **"on-chain account address"**
- tracks size in `contractsMicro` (`1000000` = 1 contract)

That is more promising than a pure bridge. Jupiter clearly has *some* Solana-side representation
even for `polymarket`-provider markets.

**What public docs do not answer — and this is the crux:**

1. Is that Solana account a legible position holding economic exposure, or an order receipt
   against Polygon settlement?
2. Can a program CPI into it, or is REST the only supported path?
3. Which providers settle natively, and which are bridged?

These are §5 questions 1–3. Nothing else should be decided before they are answered.

### 1.2 Jupiter Forecast — the confirmed-native piece

| | |
|---|---|
| Issuer program | `2sVcg2dBSUzXkmdZ8M5cp1LbnzDrWJmr6hktkHwB8nY3` |
| Config PDA | `8LczfBkVZJhGnTYH8nQke2YC3b83GFZ8qZtfuMRe6AN6` |
| Positions | **SPL Token-2022 mints** — one per outcome, $1 if it wins, $0 if it loses |
| Trading | USDC ↔ outcome-token swaps via Swap API (`/swap/v2`) or Prediction API (`/prediction/v1`, beta) |
| Settlement | Chainlink; winning tokens redeem automatically, no manual claim |
| Market coverage | **15-minute BTC up/down only** |

Token-represented positions are exactly what the vault wants: position size becomes a **balance
read**, not an exercise in parsing instruction data.

The limitation is coverage, not mechanism.

---

## 2. Other Solana-native venues

### 2.1 Drift BET — ❌ RULED OUT

**An earlier revision of this document recommended Drift BET as the strongest first
integration. That recommendation is withdrawn.**

On **1 April 2026** Drift Protocol suffered a **$285M exploit** — the largest of 2026 and the
second largest in Solana's history, wiping out more than half its TVL. Deposits and withdrawals
were suspended. Recovery is backed by roughly $150M from Tether and partners, and the protocol
is relaunching under a new identity, **Velocity** (private beta July 2026).

Velocity describes itself as *"a fork of Drift Protocol v2, deployed under its own program ID
with a reduced, more secure feature set"* — perpetual futures, swaps, and lending only.
**Prediction markets were dropped.** `docs.drift.trade` now redirects to Velocity's
documentation.

So Drift BET is not a viable venue: the protocol that hosted it is mid-recovery, and its
successor deliberately does not carry the product.

**The attack matters to us beyond ruling out a venue.** It was not a code bug — it was months of
social engineering against the multisig, ending in a malicious asset being whitelisted. That is
a near-exact template for how our own vault could be drained. Written up as a design
requirement in `agent-registry-and-vault.md` §11.

### 2.2 World — powers Phantom

Launched 1 July 2026. Non-custodial, routes orders to liquidity providers, resolves via
Chainlink, distributed inside Phantom to ~20M users. Covers BTC plus real-world events (World
Cup).

Strong distribution and decent coverage, but **no public developer documentation or program ID
found**. Would require direct contact before it can be evaluated.

---

## 3. Comparison

| | Forecast (`bisonfi`) | World | Predict via `polymarket` | ~~Drift BET~~ |
|---|---|---|---|---|
| Settles on Solana | ✅ | ✅ | ❌ Polygon | — |
| Position readable on-chain | ✅ Token-2022 | Unknown | ❓ unresolved | — |
| Enforcement atomicity | ✅ if CPI supported | Unknown | ❌ | — |
| Public dev docs | ✅ | ❌ | ✅ | — |
| Market breadth | ❌ BTC only | 🟡 BTC + events | ✅ widest | — |
| Program ID published | ✅ | ❌ | n/a | — |
| Status | Live | Live | Live | ❌ **$285M exploit, product discontinued** |

The field is thinner than it looked. Only **two** genuinely native Solana candidates remain, one
with no public documentation and the other currently BTC-only.

---

## 4. The design insight that makes any of them work

Do **not** parse venue instruction data to determine position size. It is brittle,
venue-specific, and breaks whenever the venue upgrades.

Use **post-condition enforcement**:

1. Record vault USDC balance and outcome-token balances **before**
2. CPI into the whitelisted venue program
3. Assert **after**: position value ≤ `position_cap_bps` of vault value, and drawdown from
   high-water mark < `max_drawdown_bps`
4. Revert the entire transaction if either fails

On Solana this is atomic and therefore airtight. It also keeps `execute_trade` largely
venue-agnostic — which is what makes adding the second and third venue cheap.

> **Implementation note:** Forecast outcome tokens are **Token-2022**, not classic SPL. The vault
> must use `anchor_spl::token_interface`, not `anchor_spl::token`. The registry's $AGENT handling
> can stay on classic SPL.

---

## 5. Questions for Jupiter

### Context to open with

> We are building Agent Circle — a marketplace where developers list self-hosted trading agents
> and traders allocate capital that those agents trade on their behalf. Trader funds sit in a
> non-custodial Solana vault program: the trader is the sole withdrawal authority, and the agent
> holds only scoped permission to trade. The vault must enforce a position cap and a max-drawdown
> limit **atomically, in the same transaction as the trade** — otherwise the risk controls we
> promise traders are unenforceable. We are evaluating whether Jupiter can be that venue.

### Decisive — these three determine Solana vs Polygon

**1. For markets under `"provider": "polymarket"`, what exactly is the on-chain Solana account
that a position creates?**
Does it hold the economic exposure, or is it a receipt/intent against settlement that ultimately
happens on Polygon?
*Why it matters: your position docs mention an "on-chain account address" and require signing a
Solana transaction, which suggests real Solana-side state. But if the exposure ultimately lives
on Polygon, our vault cannot value or constrain the position, and the whole non-custodial design
fails for those markets.*

**2. Can an on-chain Solana program CPI into the position-opening flow — for any provider, or
only for `bisonfi`/Forecast?**
Or is the REST API the only supported integration path?
*Why it matters: if trading is API-only, no smart contract can enforce risk limits atomically.
This single answer decides our chain.*

**3. Which providers settle natively on Solana, and which are bridged?**
A full list with the settlement chain for each would be ideal.
*Why it matters: it tells us exactly how much of the Predict catalogue is actually usable for a
program-enforced product, versus only usable for a UI.*

### Architecture — assuming CPI is possible

4. **Is there a published IDL** for the Forecast issuer program
   (`2sVcg2dBSUzXkmdZ8M5cp1LbnzDrWJmr6hktkHwB8nY3`)? If not, is one planned, or can we get
   account layouts and instruction discriminators under NDA?

5. **Can a PDA hold outcome tokens and redeem at settlement**, or does redemption assume an
   end-user wallet? Any constraint on the holder being a program-derived address?

6. **Which Token-2022 extensions are in use** on the outcome mints — transfer hooks, transfer
   fees, confidential transfers, non-transferable? Transfer hooks in particular would materially
   change our CPI design and audit surface.

7. **Is there a way to read a market's current price/odds on-chain** — a Forecast account we can
   deserialise — or is pricing API-only?
   *Why it matters: we must value an open position in-program to enforce a position cap. If price
   is API-only, we need an oracle or a different enforcement approach.*

8. **What happens at settlement if the holder is a program account?** Is redemption automatic, or
   does it need a crank?

### Roadmap

9. **What is the roadmap for Forecast (`bisonfi`) beyond 15-minute BTC up/down?** Sports,
   politics, general event markets — and on what timeline?
   *Why it matters: if the native provider stays BTC-only, we need a second native venue for
   breadth regardless of how good the technical fit is.*

10. **Is the Prediction API's beta status expected to include breaking changes to the on-chain
    program**, or only to REST endpoints?

### Operational

11. **Rate limits and API key terms** for a platform routing many users' trades — is there a
    partner or institutional tier?

12. **Do you have other integrators building vaults or managed-position products on Jupiter
    prediction markets**, and is there a reference implementation or design guidance to follow?

### What to bring back

| Answer | Unblocks |
|---|---|
| Q2 — CPI supported? | The entire chain decision |
| Q1 + Q3 — which providers are natively settled | How much catalogue we can actually use |
| Q4 — IDL exists? | Integration cost estimate |
| Q6 — Token-2022 extensions | Vault design + audit scope |
| Q7 — on-chain price data? | Whether position-cap enforcement is even possible |
| Q9 — Forecast roadmap | Whether we need a second venue at launch |

---

## 6. Recommendation

**Do not commit to a venue before Q1–Q3 are answered.**

Then:

- **CPI supported + native providers cover real breadth** → Jupiter, Solana, everything we have
  built ships. Best outcome by a wide margin.
- **CPI supported but only `bisonfi` is native (BTC-only)** → build the mechanism on Forecast to
  prove it works, launch narrow, and pursue **World** for breadth. The §4 post-condition design
  makes the second venue comparatively cheap.
- **CPI not supported anywhere on Jupiter** → the Solana-native field is down to World, which has
  no public documentation. At that point Polygon/Solidity becomes a serious option again,
  despite the rewrite cost and weaker enforcement.

### On sequencing

The strategic call — **Solana-native first, other chains as a Phase 2 upgrade** — remains right.
It keeps $AGENT, the wallet stack, and the deployed registry coherent.

**But build one venue first, not three.** One venue is roughly 40% of the work of three, and the
post-condition design makes later venues cheap *once the first is proven*. Building three
integrations before validating that the enforcement mechanism works at all is how you end up
with three broken ones.

Suggested order: **Jupiter Forecast first** — it is the only remaining candidate with both a
published program ID and public documentation, so it is the only one we can build against
without waiting on anyone. Then World, once it publishes docs or responds to contact.

### Two things worth doing regardless of the venue answer

1. **Contact World.** It is now one of only two native candidates and we know almost nothing
   about it. Phantom distribution and event-market breadth make it strategically valuable, and
   the absence of public docs is the only thing blocking evaluation.
2. **Design the vault's governance defences now** (`agent-registry-and-vault.md` §11). They are
   venue-independent, they are the highest-severity risk in the system, and the Drift precedent
   shows the cost of getting them wrong is total.
