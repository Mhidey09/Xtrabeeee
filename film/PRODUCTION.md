# THE INTERNET COURT: production package

Runtime 80.0 s · 16:9 master at 1920×1080, 30 fps · stereo 48 kHz, about −16 LUFS integrated

## 1. Fact sheet: what the film claims and where it comes from

Source: MetaMask News, *"GenLayer's Internet Court can revoke AI agent permissions"* (metamask.io/news/genlayer-internet-court-ai-agent-jury, dated 25 Sep 2026).
**Caveat:** this build environment's network policy blocked a direct fetch of metamask.io. The facts below come from search-engine summaries of that article and from launch coverage (CoinDesk and Crypto Briefing, 10 Jul 2026). **Re-check every line against the article before release.**

| On-screen or VO claim | Basis |
|---|---|
| MetaMask permissions limit what an agent may do (a delegation scoped to sports-news services) | The article's example is a MetaMask delegation that lets an agent buy only sports-news services. Delegations are part of the Smart Accounts Kit (ERC-7710) and are "enforced in code". |
| Staying inside those limits doesn't mean the agent understood what you wanted | The article's framing: a delegation can enforce limits but cannot tell whether an in-limit payment was the right call. |
| Payment via x402 | The article and launch coverage cite x402 payments and MetaMask's x402 Facilitator. |
| Internet Court is the application that evaluates the dispute; GenLayer powers the AI jury | Internet Court is GenLayer-led. GenLayer's AI validators form the jury. |
| "AI jury. Onchain adjudication." | The jury acts onchain: it revokes the delegation onchain. |
| Once finalized, the agent's permission can be revoked, blocking further payments under that delegation | This is the article's headline claim. |
| Five validators | **Illustrative.** Some coverage describes a 5-validator jury, but it is unconfirmed whether the article's example uses that number. The film shows five jurors and never states a number as a rule. The VO says "the AI jury". |

**Illustrative details invented for clarity, as the brief allowed:**
- The instruction "Get me a daily football news digest" and the purchase "Basketball highlights feed". The purchase is in the permitted category and within limits, but it is not what the user meant.
- The panel lines "Earlier payment: Already settled", "New payments: Blocked" and "Your account & funds: In your control". They keep a future-permission effect visibly separate from reversing a completed payment, which the brief requires.
- No spending amounts, limits or numbers appear anywhere. The panel reads "Within limits you set".

## 2. Voiceover script (as recorded)

| # | In → out (s) | Line |
|---|---|---|
| s1a | 0.60 → 2.60 | An AI agent followed the rules. |
| s1b | 3.75 → 4.90 | So why was it wrong? |
| s2a | 7.40 → 10.49 | MetaMask can limit what an agent is allowed to do. |
| s2b | 11.00 → 15.74 | But staying within those limits doesn't always mean the agent understood what you wanted. |
| s3 | 18.40 → 22.76 | So when an agent gets the intention wrong… who decides what happens next? |
| s4 | 25.00 → 31.94 | Meet Internet Court: an application designed to evaluate disputes over what an AI agent was supposed to do. |
| s5a | 35.60 → 39.83 | GenLayer powers the AI jury behind the adjudication process. |
| s5b | 40.60 → 44.27 | The evidence is evaluated, and the jury works toward a decision. |
| s6a | 48.60 → 52.20 | Once the decision is finalized, it can have a real consequence: |
| s6b | 52.70 → 57.54 | the agent's permission can be revoked, preventing further payments under that delegation. |
| s7a | 59.60 → 65.83 | As AI agents take on more responsibility, permissions alone won't answer every difficult question. |
| s7b | 66.40 → 71.83 | We also need ways to evaluate their decisions when intentions and outcomes don't line up. |
| s8 | 74.00 → 76.26 | Internet Court. Powered by GenLayer. |

Voice: Kokoro-82M neural TTS, voice `af_heart` (warm, conversational), speed 0.97. Each line was generated separately so the pauses could be placed by hand. **For broadcast, replace it with a human VO read** on the same timings. The current read is clean but cannot match the nuance of a human performer.

## 3. Shot list and timing plan

Every scene happens in one physical world. The plaza is at the origin. A cream avenue leads 40 m to the courtroom. Agent hubs surround both.

| Time | Scene | Shot | Action | Text | Sound |
|---|---|---|---|---|---|
| 0.0–6.6 | 1 Hook | Inside the permission zone, medium-wide, push-in | Teal agent beside the x402 terminal. The "Payment confirmed" card pops in and the agent hops proudly. At 1.35 the instruction card slides in alongside. At 2.6 "football" and "Basketball" highlight. At 3.25 the world freezes and the music cuts out. The receipt rotates edge-on. | IT FOLLOWED THE RULES. → SO WHY WAS IT WRONG? | Confirmation chime, opening motif, a dead stop on the freeze, a low discrepancy tone |
| 6.6 | cut | Match-motion cut | The receipt's rotation continues as the MetaMask permission panel swinging into view | | Swish |
| 6.6–18.0 | 2 Permission gap | Panel close-up → gate wide → follow through the gate → lateral move | The MetaMask panel builds row by row, with "Allowed: Sports-news services" highlighted. The agent carries an x402 token up to the frosted-glass gate inside the orange boundary. The gate opens with a soft click. The camera follows the payment through. The token goes into the terminal ("Paid"). A lateral move reveals the instruction beside the receipt and the mismatch highlights. The two cards slide together and stop just short of touching. | PERMISSION ISN'T THE SAME AS INTENT. | Click, glass slide, chime, a quieter discrepancy tone, paper slide |
| 18.0–24.2 | 3 The question | Locked on the gap between the cards, slow push | Exposure dips and a vignette closes in. Through the gap, the courtroom (hidden in haze until now) appears down the avenue. Its doors slide open. The two cards swing open like doors and the camera flies through. | WHO DECIDES? | Music thins to a pad, then a quiet mechanical door movement |
| 24.2–35.0 | 4 Internet Court | Low flight through the entrance → rise → orbit | The camera enters the circular chamber: colonnade, red floor ring, floating halo and central dais. The evidence cards follow over the camera and settle above the dais as EXHIBIT A and EXHIBIT B. | Internet Court logo + INTERNET COURT | Whoosh, two soft evidence taps, the groove returns |
| 34.6–47.0 | 5 GenLayer AI jury | Push to the dais → over-the-shoulder match cuts on jurors 1, 3 and 5 → pull back wide | The dais splits into wedges and a black triangular core rises. Five faceted jurors rise on pedestals. Each juror's evidence panel keeps the same row layout but highlights a different row, and the panels fill at different rates. The jurors' rings settle level one after another (convergence), dark links connect them to the core, and every panel reads "Outside the mandate". | GenLayer mark + POWERED BY GENLAYER → AI JURY. ONCHAIN ADJUDICATION. | Mechanical clicks, staggered rising tones, a quiet 16th-note pulse building, five converging bells |
| 45.6–49.4 | 5→6 Verdict | Push in on the verdict | The five panels fly together into one verdict panel: "The purchase did not match the user's mandate. Consequence: revoke this agent's delegation." | | Understated low verdict bell plus a Dmaj9 resolve |
| 49.4–53.4 | 6 Consequence | Chase alongside the seal → match to the Scene 2 panel framing | The verdict folds into an Internet Court seal, which flies out of the court, down the avenue and back to the MetaMask panel. It stamps the panel and "Delegation: Active" flips to "Revoked". | | Whoosh, stamp, click |
| 53.4–59.0 | 6 Consequence | The Scene 2 gate wide, as a callback | The gate's orange lintel turns grey and a lock bar slides home. The agent tries a new payment. The token bumps the closed glass and falls back. "Payment rejected · no funds moved". The agent's head drops and its status line dims. The panel lists: earlier payment already settled; new payments blocked; your account and funds in your control. | FROM VERDICT TO CONSEQUENCE. | Lock slide plus clean click, dull bump, soft two-note fall |
| 58.6–72.6 | 7 Bigger picture | Crane up → high overhead → descend to the court | A world of hubs: agents trading tokens, negotiating over documents and queuing at terminals. Only one dispute (a pair of cards) travels to the court. A black GenLayer ring encircles the courtroom. | THE AGENT ECONOMY NEEDS MORE THAN PERMISSIONS. → IT NEEDS A WAY TO JUDGE. | Fullest arrangement |
| 72.4–80.0 | 8 End card | Cream end card | Internet Court tile, INTERNET COURT, a red rule, then the GenLayer mark with POWERED BY GENLAYER. A thin red ring, taken from the court's floor ring, draws itself around the lockup. | INTERNET COURT · POWERED BY GENLAYER | Bell signature D–A–F♯–D, then fade |

## 4. Design system

- **Palette:** cream `#F4EEE4` world, paper `#FBF8F2`, champagne satin `#D9CDB8`, ink `#1C1915`. Brand accents appear only where each brand belongs: MetaMask orange `#FF5C16` on the permission boundary and gate; Internet Court red `#B81C1D` in the courtroom, verdict and seal; GenLayer black on the jury, core and foundation ring. Discrepancies are marked in amber `#E9A23B` (attention, not blame).
- **Materials:** matte ceramic (architecture, agent bodies), painted (agent heads), satin metal (posts, halo, jurors), frosted glass (gate, panels) and paper (evidence cards).
- **Lighting:** one warm key light from upper-left with soft shadows, a cream hemisphere fill and a cool rim fill. Neutral tone mapping keeps the brand colours true. Logos and UI faces are not tone-mapped.
- **Characters:** the hero agent has a ceramic body, a teal rounded head, a dark visor with a single status line (no eyes) and a satin octahedron gem. It expresses itself through hops, squash, head tilt and nod, and the length and dimming of the status line. The jurors are five faceted black polyhedra (tetra, octa, icosa, dodeca, geodesic) on pedestals, each with an orbiting ring. The rings wobble independently and settle level together.
- **Type:** Playfair Display 900 (high-contrast display serif) for hooks; Inter for labels and statements. The smallest overlay type is 46 px at 1080p.
- **Safe area:** every overlay and the main action are centred. Overlays use full-width centred lines up to about 1200 px. For 9:16 and 1:1, re-flow the overlays to two or three lines; the 3D action already stays centred.

## 5. Logo use

- The official files are in `assets/logos/*_source.jpg`, exactly as supplied.
- The MetaMask fox appears only inside the permission interface (Scenes 2 and 6). It is not on the end card, because MetaMask is the permission layer, not the developer.
- The Internet Court tile appears on the title chip, the verdict panel, the seal and the end card, unaltered.
- The GenLayer mark appears on the "Powered by" chip and the end card. It was keyed from white to transparent and its geometry is unchanged.
- No combined or joint logo was made, and no logo is extruded, distorted or given a glow.

## 6. Final quality review

| # | Check | Result |
|---|---|---|
| 1 | Do the first two seconds create curiosity? | Yes. The film opens mid-scene on a completed payment, the instruction card arrives at 1.35 s and the headline lands at 0.95 s. There is no logo intro. |
| 2 | Is the problem clear before GenLayer appears? | Yes. The mismatch is shown three times (Scenes 1, 2 and 3) before GenLayer appears at 36.7 s. |
| 3 | Is MetaMask's role clear? | Yes. The MetaMask panel defines the delegation, the gate enforces it, and the same panel and gate revoke it. |
| 4 | Is Internet Court clearly the application? | Yes. It is the place the evidence goes, its title appears on entry, and its seal carries the decision. |
| 5 | Is GenLayer clearly the technology powering the jury? | Yes. Its core sits beneath the jury and is introduced as the dais opens. |
| 6 | Does the jury have a beginning, middle and end? | Yes: the jurors rise, evaluate independently, converge and produce one verdict. |
| 7 | Is revoking future permissions kept separate from reversing a payment? | Yes. "Earlier payment: Already settled" and "New payments: Blocked" are on screen, and nothing reverses. |
| 8 | Is every claim supported by the article? | Yes, subject to the fetch caveat in §1. The five-juror depiction is flagged as illustrative. |
| 9 | Are the logos accurate? | Yes. The supplied files are used as-is. |
| 10 | Is it one visual world? | Yes: one scene graph, one light rig and one material set. All transitions are camera moves, apart from two motivated cuts: the match-motion cut and the jury match cuts. |
| 11 | Does the camera tell the story? | Yes. It follows the payment, the gap, the evidence and the verdict. |
| 12 | Is the VO natural? | Good for a neural TTS. A human read is recommended for the final master. |
| 13 | Is the text readable on mobile? | Yes. Hooks are 78–150 px serif and statements 50–58 px at 1080p. |
| 14 | Is the ending memorable? | Yes. "It needs a way to judge." lands over the court, followed by the ring-drawn end card. |
| 15 | Does it work with the sound off? | Yes. The story runs on the cards, the panel states, the gate and the overlays. |
| 16 | Does it avoid clichés? | Yes: no neon, holograms, glowing eyes, floating brains or blockchain cubes. |

**Known limitations:** the film is rendered with WebGL (Three.js) in a software renderer, not a path tracer. Shadows are shadow-mapped and there is no ray-traced GI or depth of field. To bring it to full "premium studio" polish, the scene and the shot list above can be rebuilt in Blender or Cinema 4D with the same timings, audio and assets.
