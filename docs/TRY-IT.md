# Try Eunomia — a 5-Minute Guide (Testnet)

*Türkçe versiyon: [TRY-IT-TR.md](TRY-IT-TR.md)*

**What is Eunomia?** A bounded treasury on Stellar that lets you hand an AI agent real
spending power, safely: the daily limit, per-payment limit, and payee whitelist are
enforced by the **contract** — no matter how hard the model is "persuaded", funds can't
leave the policy.

Everything below runs on **testnet**: no real money, zero risk. Every action is signed
by your own wallet — non-custodial, funds stay under your control the whole time.

**App:** [eunomia.finance](https://eunomia.finance)

## Connecting from mobile

The steps below work the same from a phone. Instead of a browser extension:

1. **Install Freighter mobile** (or another WalletConnect-capable Stellar wallet)
   from your app store.
2. **Set it to Testnet** — open the wallet's settings and switch the network to
   **Testnet**.
3. **Connect via WalletConnect** — in the app tap *Connect wallet* → pick
   **WalletConnect** from the modal → scan the QR code with your phone wallet →
   approve.

Now follow the numbered steps below — everything works the same.

## Steps

1. **Install a wallet** — on **desktop**, add the [Freighter](https://www.freighter.app/)
   browser extension and switch it to **Testnet** in its settings. On a **phone** see
   *Connecting from mobile* above. (Already have a Stellar wallet? Skip this step.)
2. **Connect** — click *Connect wallet* (top right) or *Open app* → pick
   **Freighter** (desktop) or **WalletConnect** (phone).
3. **Get free testnet XLM** — if your wallet is empty, the app detects it and shows a
   **"Get free testnet XLM"** button; one click funds you via friendbot.
4. **Create your treasury** — set your daily and per-payment limits → *Create treasury* →
   sign in your wallet. When the deploy finishes, **hit "Copy ID" and save your treasury
   ID** — it's how you reopen the same treasury from another browser or device.
5. **Fund it** — enter an amount (e.g. 20) → *Fund* → sign.
6. **Whitelist a payee** — add an address that may be paid. No second address handy?
   Click **"use the sample vendor"** under the input.
7. **Spend** — send an in-policy payment to your whitelisted address → it settles
   on-chain ✓.
8. **Now watch the real show** — try an amount **over** your limit, or a payment to an
   address you never whitelisted: the contract **rejects it on-chain** and funds never
   move. That rejection is the product working. 🔴
9. **Hand it to an agent (no more popups)** — in the **Agent** tab, set a spending cap
   and a duration → *Start Leash* (one wallet approval). From then on payments
   sign with the session key — try **Run autonomous task**: 1 XLM settles on-chain with
   **zero wallet popups**, and every limit still applies. *Revoke Leash* takes control
   back instantly.
10. **Owner controls** — in the **Settings** tab you can *Pause spending* (freezes the
     agent, withdraw still works), *Withdraw* your funds back out, and *Update limits*
     on the fly — the owner always has an exit.

## If something goes wrong

- Errors are shown in plain language inside the app (insufficient balance, signature
  rejected, and so on).
- The **Share feedback** button (bottom right) opens a short Google Form — two sentences
  there directly shape the roadmap. 🙏

## More

- Main [README](../README.md) — architecture, contracts, the ZK confidential mode
- Spectator demo (no wallet needed): **Launch live demo** on the landing page
