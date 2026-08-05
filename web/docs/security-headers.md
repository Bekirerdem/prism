# Security headers

Set in `vercel.json`, applied to every path. Closes audit finding F4 (open since the
2026-06-03 review) for the directives that can be shipped without guesswork.

| Header | Value | Why |
|---|---|---|
| `Content-Security-Policy` | `frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'` | Clickjacking was the concrete exploit: with the page framable, an attacker overlays their own UI on a connected session and gets the user to click the real "Send payment" / "Add payee" controls. The passkey ceremony still binds to the real origin — but what the user *believes* they are approving is attacker-controlled. |
| `X-Frame-Options` | `DENY` | Same control for browsers that honour it ahead of `frame-ancestors`. |
| `X-Content-Type-Options` | `nosniff` | No MIME sniffing of served assets. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Treasury and wallet addresses appear in URLs; do not leak the path off-origin. |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | No downgrade. `preload` is deliberately omitted — submitting to the preload list is hard to reverse and should be a separate, deliberate decision. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Features the app never uses. **`publickey-credentials-get` is deliberately not restricted** — that is WebAuthn, which passkey login needs. |

## Deliberately NOT set yet: `script-src` / `connect-src`

A full CSP is the remaining half of F4 and it is not shipped, on purpose.

`script-src 'self'` would block the inline theme bootstrap in `index.html` (it runs
before first paint precisely so the palette does not flash), and `connect-src` has to
enumerate every endpoint the app actually talks to: Soroban RPC, Horizon, friendbot,
`*.supabase.co` over both HTTPS and WSS, and the whole WalletConnect/Reown set
(relay, explorer API, pulse). Getting that list wrong does not fail loudly — it
silently breaks mobile wallet connect, which is a path this project has already had
to repair twice.

Shipping it needs a live verification pass against a real WalletConnect session, not
a best guess. Until then the headers above stand, and they are the ones that close
the exploit the audit actually demonstrated.
