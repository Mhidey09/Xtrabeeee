# WHERE SHOULD MOCHI STAKE? A GenLayer staking explainer

A 64-second, 1920×1080, 30 fps animated explainer about **GenLayer staking and delegation**. Mochi, GenLayer's mascot, is the main character.

## Story

| Time | Beat | What you see |
|---|---|---|
| 0–7.6 s | Meet Mochi | Mochi hops in holding GEN and wonders how it can help keep GenLayer honest. On screen: "WHERE SHOULD MOCHI STAKE?" |
| 7.6–19.6 s | What validators do | An Intelligent Contract task arrives. Five validators each check it independently, then vote. The five checks merge into one result. |
| 19.6–30.6 s | Staking | A validator stakes GEN into its vault and its seat lights up. It earns a reward. A dishonest validator gets part of its stake **slashed**. |
| 30.6–41.4 s | Delegation | Mochi walks over and delegates GEN to a validator it trusts. Mochi's share earns a reward, and a red ripple shows Mochi shares the risk too. |
| 41.4–54.6 s | Why it matters | Everyone piles onto one validator: its podium towers and the whole stage tilts. Then stake spreads across several validators and the network settles level. |
| 54.6–64 s | Mochi's answer | "If it were me? I'd spread it out." Then the end card: "Stake carefully. Delegate wisely." with the GenLayer mark. |

It covers all five prompt topics: what staking and delegation mean, what validators do, why your choice of validator matters, how this affects security and decentralization, and the "one validator or several?" question (answer: spread it out).

## Fact basis (GenLayer docs)

The facts come from the GenLayer docs: [Staking](https://docs.genlayer.com/understand-genlayer-protocol/core-concepts/optimistic-democracy/staking), [Unstaking](https://docs.genlayer.com/understand-genlayer-protocol/core-concepts/optimistic-democracy/unstaking), [Validators and roles](https://docs.genlayer.com/understand-genlayer-protocol/core-concepts/validators-and-validator-roles), [FAQ](https://docs.genlayer.com/FAQ) and the [whitepaper](https://genlayer.com/whitepaper). These sites were checked through search summaries, because this build environment blocks direct access to genlayer.com.

- Validators stake GEN to become eligible for consensus duties. Token holders can delegate GEN to a validator without running a node.
- Delegation increases a validator's selection weight. Delegators share both the pool's rewards and its slash exposure.
- Dishonest validators are slashed; the appeals process provides the failsafe.
- No amounts, APYs or minimums are shown. The docs list governance-configurable minimums (42,000 GEN to run a validator, 42 GEN to delegate) that may change.
- "Spread it out" is presented as Mochi's personal take, not advice.

## Files

- `index.html`, `src/staking.js`: the film, a deterministic Three.js scene. `renderAt(t)` draws any frame.
- `audio/make_audio.py`: synthesized score and sound design plus the final mix. `audio/vo_*.wav` holds the voiceover, generated with Kokoro TTS (`af_heart`).
- `assets/ref/mochi_reference.jpg` (Mochi reference) and `assets/logos/genlayer_source.png` (GenLayer mark): the supplied assets. Tinted copies of the mark are keyed from the source with unchanged geometry.
- `build/where-should-mochi-stake.mp4`: the rendered film.

Re-render with `npm install`, then `python audio/make_audio.py`, then `node tools/render.mjs 3 30`.
