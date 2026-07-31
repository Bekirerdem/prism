# Try it in 5 minutes (testnet)

*Türkçe versiyon: [Hızlı başlangıç](/try-it-tr)*

Everything below runs on **testnet**: no real money, zero risk. Every action is signed
by your own wallet — non-custodial, funds stay under your control the whole time.

**App:** [prism-stellar.vercel.app](https://prism-stellar.vercel.app)

## Connecting from a phone

The steps work the same on mobile. Instead of a browser extension:

1. **Install Freighter mobile** (or another WalletConnect-capable Stellar wallet).
2. **Switch it to Testnet** in the wallet's settings.
3. **Connect via WalletConnect** — tap *Connect wallet* → pick **WalletConnect** →
   scan the QR with your phone wallet → approve.

## Steps

1. **Install a wallet** — on desktop, add the [Freighter](https://www.freighter.app/)
   extension and switch it to **Testnet**. Already have a Stellar wallet? Skip this.
2. **Connect** — *Connect wallet* (top right) → **Freighter** (desktop) or
   **WalletConnect** (phone).
3. **Get free testnet XLM** — if your wallet is empty the app detects it and shows a
   **"Get free testnet XLM"** button; one click funds you.
4. **Create your treasury** — set your daily and per-payment caps → *Create treasury* →
   sign. When it finishes, **hit "Copy ID" and save your treasury ID** — it's how you
   reopen the same treasury from another device (or approve the optional on-Stellar
   backup during creation and skip the worry).
5. **Fund it** — enter an amount (e.g. 20) → *Fund* → sign.
6. **Approve a payee** — in *Payments → Payees*, add an address that may be paid.
   No second address handy? Click **"use the sample vendor"**.
7. **Send a payment** — pay your approved address within the caps → it lands on-chain ✓.
8. **Now watch the real show** — try an amount **over** your cap, or a payment to an
   address you never approved: it is **rejected on-chain** and funds never move.
   That rejection is the product working. 🔴
9. **Hand it to an agent (no more popups)** — in the **Agent** tab set a spending cap
   and a duration → *Start Leash* (one approval). Payments now sign with the session
   key — try **Run autonomous task**: 1 XLM lands on-chain with **zero wallet popups**,
   every rule still applies. *Revoke Leash* takes control back instantly.
10. **Owner controls** — in **Settings**: *Pause spending* (freezes the agent, withdraw
    still works), *Withdraw* funds back out, *Update limits* live. The owner always has
    an exit.

## If something goes wrong

Errors are shown in plain language inside the app. The **Share feedback** button
(bottom right) opens a short form — two sentences there directly shape the roadmap. 🙏
