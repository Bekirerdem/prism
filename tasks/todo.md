# Kova 5 — Hijyen + UX Dalgası (2026-07-31)

Plan: `~/.claude/plans/lucky-wandering-harp.md` (Bekir onaylı). SCF #45 kabulü ana hedef;
isim kararı Bekir'de (bu akşam), rebrand ayrı dalga.

- [x] 0.1 E2E cüzdan kirliliği: `docs/metrics/e2e-exclude.json` + user-count.mjs exclude
      desteği + test-signer modunda on-chain register atlanıyor (treasury.tsx) → organik 9/50
- [ ] 0.2 `PLAYWRIGHT_TEST_WALLET_SECRET` repo secret (BEKİR) — sabit funded cüzdan
- [x] 0.3 todo.md gerçeğe çekildi + issue #8 daraltıldı (countdown canlı, kalan=renewal)
- [ ] 1. UX dalgası (spec-first): dil katmanı (web3 jargon → müşteri dili, Verglas ilkesi)
      + onboarding netliği + fund bottom-sheet + legacy treasury rehberi →
      spec `docs/superpowers/specs/2026-07-31-ux-customer-language.md` → Bekir onayı →
      implement → ayna kapısı (canlı + 390px)
- [ ] 2. Passkey-kit fizibilite raporu (kod yok) → karar Bekir
- [ ] 3. SCF #45 başvuru taslağı: "policy-compliance treasury ≠ confidential payments"
      ilk cümle + temiz traction + tranche iskeleti (T1=ZK köprüsü) · Interest Form (BEKİR)
- [ ] 4. Açık iş entegrasyonu başlangıcı: accumulator spec revizyonu (Olio referanslı)
      + issue #12 fee-sponsorship POC (ayrı onayla)

# Kova 4 — App Shell Redesign (2026-07-23, branch `feat/app-shell`)

Spec: `docs/superpowers/specs/2026-07-23-app-shell-redesign-design.md` · Plan:
`docs/superpowers/plans/2026-07-23-app-shell-redesign.md`. Wave 7 #13/#6/#10 bu işin
içinde eridi (Bekir kararı: hepsi bizde; dashboard'dan çekilmeleri Bekir'de).

- [x] Saf lib'ler (TDD): routes (+#workspace redirect) · feedFilter (kind grupları,
      kindColor) · payees (payee_add/payee_rm fold + local book) · onboarding (stepper)
      · treasuryList (local ∪ registry merge) · toastQueue — 154/154 vitest yeşil
- [x] FeedEvent zenginleştirme: treasuryId + payee alanları; payee_add/payee_rm/paused/
      revoked/agent olay etiketleri
- [x] TreasuryProvider — Workspace'in tüm state/aksiyonları context'e taşındı (Seyit'in
      parseXlmAmount ön-doğrulaması + session `registered` kurtarması korunarak);
      validation=inline, tx sonuçları=toast
- [x] AppShell: sidebar (5 bölüm + Guided demo + Testnet badge) · topbar (treasury
      switcher #10 + WalletChip) · mobil bottom tab bar
- [x] Sayfalar: Overview (balance hero + canlı limit enstrümanı + quick actions +
      recent activity + stat şeridi + stepper) · Setup (kapı + sihirbaz) · Payments
      (Send/Payees + canlı limit bağlamı + is_payee rozeti + history) · Agent (leash
      countdown) · Activity (#6: çipler + my-treasury + load more) · Settings (telafi
      register + limits + danger zone)
- [x] Cutover: Workspace.tsx + AppNav.tsx emekli; hash normalize (#workspace→#overview);
      lint 7 warning = redesign öncesi baseline (0 error, CI gate yeşil)
- [x] Motion: stagger + rolling balance + bar dolumu + blocked flaş (reduced-motion saygılı)
- [x] Duman testi (chrome-devtools): kapı/Activity/redirect/mobil 375px + FAB-tab bar
      çakışması fixlendi; screenshot'lar `docs/screenshots/appshell-*.png`
- [x] Gerçek Freighter E2E (Bekir) — KAPANDI: PR #16 merge + `vercel --prod` (07-23),
      Bekir'in tam mobil E2E'si zincirde kanıtlı (07-28: fund 1000 → pay 25 ✓ → reject),
      12 karelik submission ss seti `Desktop/prism-ss/`
- [ ] Wave 7 dashboard'ından #13/#6/#10 çekilsin (Bekir)

# Kova 2 — Dokümantasyon / kredibilite (2026-07-03) ✅

- [x] SECURITY.md — güvenlik modeli + 2026-06-03 audit bulgularının durumu (fixed/open)
      + known limitations + vulnerability disclosure yolu
- [x] ROADMAP.md — M1-M5 milestone'ları (Startup Track submission için öne çekildi)
- [x] README "real USDC" iddiası düzeltildi (testnet USDC + XLM gerçeği + M3 yolu)
- [x] CHANGELOG.md — 0.1.0 (IBW) → 0.2.0 (ZK+trust) → 0.3.0 (per-user) → 0.3.1 (onboarding)
- [x] web/README.md — Vite boilerplate yerine gerçek dev dokümanı
- [x] supabase/migrations/0001 — feedback+activity şeması + insert-only RLS repo'da
- [x] (2026-07-09 → 07-26) lint borcu KAPANDI (issue #5): effect refactor'ları yapıldı,
      warn'a çekilen kurallar temizlendi — bugünkü eslint.config.js'te tek kalan istisna
      Playwright spec'lerinde `react-hooks/rules-of-hooks: off` (gerekçeli). CI lint gate'liyor.

# Kova 1 — 10-kullanıcı push'u öncesi onboarding düzeltmeleri (2026-07-02)

Hedef: WhatsApp'tan gelen sıfır-bakiyeli, telefonlu, ilk-kez kullanıcı akışı baştan sona
takılmadan tamamlasın. Her madde ayrı commit; sonunda manuel Vercel deploy + canlı doğrulama.

- [x] 1. Funding gate — Workspace'e cüzdan XLM bakiyesi kontrolü + friendbot butonu
      (`lib/funding.ts` + 8 unit test; hesap yoksa/bakiye < 5 XLM ise uyarı kutusu)
- [x] 2. Treasury ID kaybolmasın — deploy sonrası "ID'ni kaydet" uyarısı + Copy ID butonu
      + "open existing" input'una StrKey C… validasyonu (`isValidContractId` + test)
- [x] 3. İlk kullanıcı akış yağlaması — "use the sample vendor" doldurma bağlantısı
      + whitelist başarısında Spend "To" alanı otomatik dolar
- [x] 4. Hata mesajları — deploy/fund/whitelist/pay catch'leri `sendErr`'de; `sendErr`'e
      "account not found" + mesaj-tabanlı "insufficient balance" eklendi (+2 test)
- [x] 5. Mobil — landing nav ≤900px'te Demo/Wallet/Activity kompakt kalıyor; iç nav
      flex-wrap + maxWidth; Workspace üst boşluk (84px); "Agent demo" butonu artık
      dashboard'a gidiyor (bug'dı: landing'e gidiyordu). 375px'te görsel doğrulandı.
- [x] 6. Onboarding docs — README adımları yenilendi (Freighter + friendbot + Copy ID
      + sample vendor); `docs/TRY-IT-TR.md` Türkçe hızlı başlangıç eklendi
- [x] 7. Deploy + canlı doğrulama — 42/42 test + build yeşil; `vercel --prod` →
      prism-stellar.vercel.app alias'landı; Vercel'de VITE_SUPABASE_* env'leri mevcut;
      canlıda feedback formu ile E2E insert doğrulandı (test satırı sonra silindi)

## İnceleme / Notlar

- Supabase `activity` + `feedback` RLS: enabled, sadece anon INSERT policy (SELECT yok) —
  canlı DB'de doğrulandı. Migration olarak repo'ya commit etmek → Kova 2.
- `npm run lint`: temiz (lint borcu 07-26'da issue #5 ile kapandı; CI gate'liyor).
- Kova 2 (dokümantasyon/kredibilite) ve Kova 3 (mimari: agent-signing, kontrat yaşam
  döngüsü, midnight burst, ZK entegrasyonu, ABI drift, analytics penceresi) bekliyor —
  ayrıntılar 2026-07-02 oturum değerlendirmesinde.
