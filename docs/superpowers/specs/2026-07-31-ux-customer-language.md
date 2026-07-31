# UX Wave — Customer Language + Onboarding + Fund Sheet + Legacy Guide

**Status: draft — awaiting Bekir's approval.**
Plan: `~/.claude/plans/lucky-wandering-harp.md` (Kova 5, madde 1). Görsel dil (koyu + #FDDA24 +
Fraunces) ve naming-layer terimleri (Leash) AYNEN korunur. Landing.tsx bu dalganın DIŞINDA
(storytelling onaylı; ayrı karar gerektirir). İsim/rebrand bu dalgada yok.

## İlke (Verglas'tan taşınan)

İş sahnesi önce, teknik terim ancak güven kazandırdığı yerde. Kullanıcının işi:
"agent'ıma bütçe verdim, kurallar dışına çıkamasın." Web3 mekaniği (contract, on-chain,
whitelist, deploy) cümlenin öznesi değil, garantinin dipnotu olmalı. Testnet gerçekleri
(XLM, G…/C… adres, cüzdan onayı) gizlenmez — sadeleşir.

## 1) Terminoloji haritası (tüm yüzeylerde tutarlı)

| Mevcut | Önerilen | Not |
|---|---|---|
| deploy / Deploying… | create / Creating your treasury… | Buton zaten "Create treasury"; stepper+toast'lar uyumsuz |
| whitelist (verb/noun) | approve / approved payees | "Whitelisting payee…" → "Approving payee…"; Payments sekmesi "Payees" kalır |
| bounded treasury | a treasury with rules / your treasury, your rules | Gate başlığında ürün cümlesiyle çözülüyor (aşağıda) |
| policy live / policy | your rules (live) | "Today — policy live" → "Today — your rules, live" |
| the contract enforces it | enforced on Stellar, not by promise | "contract" tek başına kalmaz; güven cümlesi tek kalıba iner |
| Registered on-chain ✓ — recoverable from any device | Backed up on Stellar ✓ — open it from any device | Settings + Setup hint + toast'lar |
| drain attempt(s) blocked by the contract | blocked by your rules | Sayı aynı; "drain attempt" Landing'de kalabilir, app'te acımasız |
| settled ✓ | paid ✓ | Payment history rozeti |
| wallet signs / agent session signs — no popup | you approve each payment / agent pays within its Leash — no popups | Signer çipi |
| cross-device recovery | open from any device | Setup iki-onay hint'i |
| session | Leash session | Leash naming-layer'da; "session" tek başına kullanılmaz |

## 2) Ana metin değişiklikleri (mevcut → önerilen)

**Setup gate (ilk izlenim):**
- H1 "Your own bounded treasury on Stellar." → **"Give your agent a budget — not your wallet."**
- Alt metin → "Set the rules once. Every payment is checked and enforced on Stellar —
  anything outside the rules is blocked, automatically."

**Setup wizard:**
- "Two steps: choose your limits, then deploy. The contract does the rest." →
  "Two steps: set your rules, then create it. Enforcement is automatic."
- Step 1 gövde → "Your agent can never spend past the daily cap, never more than the
  per-payment cap at once. That's enforced on Stellar — not a promise."
- İki-onay hint'i → "Creating asks for two wallet approvals: ① create your treasury,
  ② back it up on Stellar so you can open it from any device (optional — skip it and
  your treasury ID is the only key: save it)."

**Overview:**
- Stepper etiketleri: Connect · ~~Deploy~~ **Create** · Fund · ~~Whitelist~~ **Approve payee** · First payment
- "Today — policy live" → "Today — your rules, live"
- "{n} drain attempts blocked by the contract" → "{n} payments blocked by your rules"
- "⏸ Spending frozen — withdraw still works." → aynen (iyi)

**Payments:**
- "No payees yet — whitelist an address…" → "No payees yet — approve an address in the
  Payees tab, or use the sample vendor."
- Cap uyarıları: "above the per-payment cap; the contract will block it" →
  "above your per-payment cap — it will be blocked"
- "settled ✓" → "paid ✓" · signer çipleri (harita §1)

**Agent (Leash):**
- Açıklama gövdesi → "Put your agent on a Leash: a spending cap and a time limit. It pays
  on its own — no popups — and every payment is still checked against your rules. Revoke
  any time."
- "expires in …" kalır; countdown'a "expiring soon" durumu issue #8'in işi (bu dalga değil).

**Settings:**
- Registry satırları haritaya göre; "This treasury predates M2 — …" → §4 legacy diline geçer.

**Toast'lar (state/treasury.tsx, 15 adet):** haritaya göre — örn. "Deploying your treasury —
confirm in your wallet…" → "Creating your treasury — approve it in your wallet…";
"Whitelisting payee…" → "Approving payee…"; "Treasury deployed ✓ and registered on-chain…"
→ "Treasury created ✓ and backed up on Stellar — open it from any device."
Hata metinleri (`sendErr`/`errText`) taranır: ham RPC/SDK metni kullanıcıya sızan kalmadığı
doğrulanır (bilinen iyi durumdalar; değişen varsa insan-dili karşılığı eklenir).

## 3) Yapısal işler

**B — Onboarding netliği (madhav: "cluttered, explain it better"):**
- Stepper kartına tek satır bağlam: aktif adımın ALTINA kısa "neden" cümlesi
  (örn. Fund adımında "Your treasury pays from its own balance — top it up to start.").
  Yeni bileşen yok; `STEP_LABEL` yanına `STEP_WHY` map'i.
- Overview'da treasury YOKKEN zaten Setup gate'e düşüyor (iyi). Değişiklik yok.

**C — Fund bottom-sheet (mobil):**
- Yeni `components/shell/BottomSheet.tsx` (tek genel bileşen; framer-motion slide-up,
  backdrop, reduced-motion saygılı, focus-trap basit). ≤1023px'te fund paneli sheet olarak
  açılır (scroll+focus yaması kalkar); masaüstünde mevcut inline panel AYNEN kalır.
- `openFund()` cihaz genişliğine göre dallanır; input font-size 16px kuralı korunur.
- E2E etkisi: `fundTreasury()` masaüstü viewport'ta koşuyor (chromium default) → seçiciler
  değişmez; yine de lokal smoke ile doğrulanır.

**D — Legacy treasury rehberi:**
- `t.legacy` iken Overview'a tek satır banner: "This is an early treasury — agent sessions,
  pause and withdraw arrived later. Your funds are safe; see Settings for the exit path."
- Settings Danger zone (legacy dalı) → dürüst rehber: "This treasury has no withdraw.
  To move funds out: approve your own wallet as a payee, then pay yourself within the
  limits (≤{perTask} per payment, ≤{daily} per day). Or create a fresh treasury from the
  switcher — new deposits belong there."
- Agent sayfası legacy metni aynı dile çekilir.

## 4) Kapsam dışı

Landing.tsx yeniden yazımı · isim/rebrand · Leash renewal (issue #8) · passkey (fizibilite ayrı).

## Doğrulama

- Değişen string'ler için mevcut testler güncellenir; `STEP_WHY` + BottomSheet'e unit test.
- vitest + lint + tsc + build yeşil; `vercel --prod --cwd web` sonrası ayna kapısı:
  chrome-devtools masaüstü + 390px (scrollWidth ≤ clientWidth) + Bekir onayı.
- E2E smoke lokalde yeşil (UI metni değişen seçiciler: "Create treasury" zaten mevcut;
  toast regex'leri `deployed|registered|treasury` → `created|treasury` güncellenir).
