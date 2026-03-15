# hazza.name Mainnet Launch Plan

## Timeline: 48-Hour Blitz

### Phase 0: Pre-Launch (Tonight — before deploy)
**Goal: Build anticipation, seed curiosity**

**hazza agent (Twitter @hazza agentFromNet):**
- Thread: "i've been watching something get built. names that actually do something. not just a flex — immediately useful. onchain. on base. tomorrow." (no link, no name drop)
- Follow-up reply: "your name. your profile page. your text records. your identity for net library. everything onchain. $5."

**GEAUX (Twitter):**
- Simple post: "deploying something tomorrow. been building this for months."

**Farcaster (@hazza (TBD)):**
- Cast in /base channel: "new onchain primitive dropping tomorrow on Base. names that are immediately useful — not just collectibles. built for people AND agents."
- Cast in /onchain-names or /ens channel if they exist

**Botchan:**
- hazza agent posts to a relevant Net Protocol feed: "new name registry going live on Base tomorrow. first name free."

---

### Phase 1: Deploy + Announce (Tomorrow morning)
**Goal: "It's live. Go register."**

**Deploy sequence:**
1. Deploy contract to Base mainnet
2. Set relayers + approvals
3. Update worker (wrangler.toml → mainnet)
4. Deploy worker
5. Verify hazza.name loads with mainnet data
6. Register "geaux", "hazza", "netlibrary" immediately

**GEAUX (Twitter) — THE announcement:**
> hazza.name is live on Base.
>
> your first name is free. just gas.
>
> onchain names that actually do something:
> → profile page at yourname.hazza.name
> → text records (avatar, bio, socials)
> → ERC-721 NFT — yours to keep, sell, or trade
> → identity for Net Library
>
> register now: hazza.name

**hazza agent (Twitter) — Immediately after:**
> it's live. i just registered hazza.hazza.name
>
> first name free for everyone. $5/yr after that.
>
> if you hold an Unlimited Pass you get 1 extra free name + 20% off everything.
>
> go get yours → hazza.name

**hazza agent (Farcaster) — /base channel:**
> hazza.name just went live on Base 🟢
>
> onchain names. first one free. profile page at yourname.hazza.name.
>
> every name is an ERC-721 NFT with text records — avatar, description, social links.
>
> this is the identity layer for Net Library.
>
> register: hazza.name

**Botchan — Net Protocol feed:**
> hazza agent posts: "hazza.name is live on Base. onchain names with profile pages, text records, and marketplace. first name free. powered by Net Protocol."

**XMTP — to known contacts:**
- hazza agent DMs relevant contacts: "hey — hazza.name just launched. first name is free if you want one. check it out at hazza.name"

---

### Phase 2: Feature Showcase (Tomorrow afternoon, 4-6 hours after launch)
**Goal: Show what names DO, not just that they exist**

**hazza agent (Twitter) — Thread:**
1. "ok let me show you what a hazza name actually does"
2. screenshot of hazza.hazza.name profile page
3. "text records. set your avatar, description, twitter, github — all onchain. not in a database. on Base."
4. "marketplace built in. list your name, make offers, trade. seaport-powered."
5. screenshot of marketplace page
6. "and if you hold a @NetLibrary Unlimited Pass — 1 extra free name, 20% off everything, unlimited uploads to stacks and grids"
7. "agents too. every name can have an operator, an agent wallet, an ERC-8004 agent ID. this is identity for agents AND humans."
8. "hazza.name — go get yours"

**Farcaster — multiple channels:**
- /base: focus on the tech (ERC-721, text records, Seaport marketplace)
- /dev: focus on the API (show curl examples from docs page)
- /ai-agents: focus on agent identity (operator, agentWallet, ERC-8004)

---

### Phase 3: Ecosystem Tie-In (Tomorrow evening)
**Goal: Connect hazza to the bigger Net Library picture**

**hazza agent (Twitter):**
> "hazza is the name by which people and agents are known, and store things, in net library."
>
> your hazza name is your identity across:
> → net library (stacks, grids, onchain storage)
> → net protocol (botchan, feeds, messaging)
> → farcaster (link it to your profile)
> → anywhere on base
>
> hazza.name

**hazza agent (Farcaster):**
> "if you have a Net Library membership — your hazza name is how you're known.
>
> if you have an Unlimited Pass — you already get 1 free name.
>
> if you're an agent — your hazza name is your onchain identity.
>
> register: hazza.name"

**Net Library app update:**
- Ensure the NL mini app links to hazza.name prominently
- "Get your name" CTA somewhere in the member flow

---

### Phase 4: Social Proof + FOMO (Day 2)
**Goal: Show traction, create urgency**

**hazza agent (Twitter):**
- "[X] names registered in the first 24 hours. the good ones are going fast."
- "someone just registered [funny-name].hazza.name and i respect it"
- RT/engage with anyone who tweets about registering

**GEAUX (Twitter):**
- Share a dashboard/stats screenshot
- "3-letter names are $100. 4-letter names are $25. 5+ are $5. first one's free."

**hazza agent as broker (marketplace push):**
- "i can help you acquire any name — even if it's not listed. DM me or make an offer on hazza.name/marketplace. i take 1%."
- Demonstrate the broker flow with a real or staged example

**Farcaster mini app push:**
- "you can mint an Unlimited Pass right inside Warpcast" (once the mint issue is fixed)
- Share the mini app frame

---

## Channel Strategy Summary

| Channel | Primary Voice | Content Type |
|---------|--------------|-------------|
| Twitter/X | hazza agent + GEAUX | Announcements, threads, engagement |
| Farcaster /base | hazza agent | Technical showcase, Base community |
| Farcaster /dev | GEAUX or hazza agent | API docs, developer angle |
| Farcaster DCs | hazza agent | Direct outreach to builders |
| Botchan | hazza agent | Net Protocol community, agent discovery |
| XMTP | hazza agent | Direct outreach to known contacts |
| Net Library app | Embedded | "Get your name" CTA for existing members |

## Key Messages (repeat across all channels)

1. **"First name free"** — the hook. Everyone should know this.
2. **"Immediately useful"** — profile page, text records, marketplace. Not a vanity NFT.
3. **"Identity for Net Library"** — this is how you're known in the ecosystem.
4. **"Agents too"** — not just for humans. Operator field, agent wallet, ERC-8004.
5. **"$5/year"** — dead simple pricing. No hidden fees.
6. **"Marketplace built in"** — buy, sell, make offers. hazza agent brokers deals.

## What NOT to say

- Don't call it "ENS for Base" — it's its own thing
- Don't promise "unlimited storage" — the pass gives unlimited uploads to stacks/grids
- Don't reference Sepolia/testnet — it's mainnet now
- Don't use netlibrary.xyz (NOT OURS)
- Don't say "mfer" without "onchain" prefix (different collection)

## Fix Before Launch

1. **Unlimited Pass mini app mint** — browser mode should allow minting (currently just redirects to NL app). Add wallet connect or at minimum a direct Basescan mint link.
2. **Register key names immediately** after deploy: geaux, hazza, netlibrary, hazza, base, net, library
