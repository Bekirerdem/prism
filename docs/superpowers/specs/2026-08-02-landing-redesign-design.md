# Landing Redesign — Marketing Voice + New Visual Identity + Passkey Entry

**Status: draft — awaiting Bekir's approval.**
Bu iş [[2026-08-02-passkey-onboarding-design]]'in UI ayağını da kapsıyor: passkey giriş kapısı
ayrı bir dalga olarak değil, yeni landing'in içinde doğuyor. **Dashboard bu spec'in DIŞINDA** —
orada UX + layout iyileştirmesi gerekiyor ve kendi spec'ini hak ediyor.

Sayfa metinleri **İngilizce** (bugünkü gibi; kitle global). Bu dosyadaki Türkçe kısımlar
gerekçe ve açıklama.

## 0) Neden

Bugünkü landing baştan sona teknik doküman dili konuşuyor: *"muxed sub-addresses"*,
*"Groth16/BN254 proofs"*, *"ERC-8004"*, *"zero-cost sub-addresses"*, *"replay-guarded"*,
*"contract v3.1"*. Bir işletme sahibi bu cümlelerin hiçbirini anlamıyor; geliştirici bile
ikinci paragrafta yoruluyor.

Aynı anda ölçülmüş bir dönüşüm sorunu var: **251 session → 74 connect denemesi → 39 bağlantı**,
ve başarısızlıkların 28'i tek sebepten — kullanıcı cüzdan modalını açıp kapatıyor. Passkey bu
duvarı kaldırıyor, landing de onu birincil kapı yapmalı.

## 1) Kararlar (bu oturumda kapandı)

| Konu | Karar |
|---|---|
| Kitle | Agent çalıştıran **kurumsal** taraf + **geliştiriciler** (ortak payda: agent'a para harcatan) |
| Birincil CTA | **Passkey ile kendi kasanı kur** — cüzdan kurmadan, XLM'siz |
| Teknik içerik | Vaade çevrilecek; mekanik docs'a taşınacak |
| Anlatı | **Kanıt önce**: bir satır acı → gerçek reddedilme anı |
| Hero görseli | Ürün ekranı **değil** (kurumsal duruş) → tipografi + canlı sayaç |
| Tipografi | **Questrial** (başlık) + **Geist** (gövde) — ikisi de Google Fonts |
| Palet | krem `#FCFFD5` · koyu yeşil `#223E05` · yeşil `#A2CB28` · kırmızı `#A62021` |
| Tema | **Açık varsayılan**, koyu tercih olarak |
| Animasyon | **GSAP + Lenis** çekirdek; Three.js ve Matter.js elendi |

Canlı önizleme ve WCAG ölçümleri: `web/docs/design/palette-preview.html` (commit `89b0f23`).

### Renk sistemi

```
--bg:      #FCFFD5   krem zemin (~%75 yüzey)
--surface: #F4FADC   kart zemini (tek tip)
--ink:     #223E05   metin — siyah kullanılmıyor, paletin kendi koyusu
--ink-2:   #55693F   ikincil metin
--green:   #A2CB28   izin / eylem / ilerleme  → SADECE dolgu
--red:     #A62021   ret / durum / link       → hem metin hem zemin
```

Ölçülmüş kısıtlar (değiştirilemez):
- **`#A2CB28` metin olamaz** — krem üzerinde 1.84:1. Üstüne daima `#223E05` (6.31:1);
  beyaz metin 1.89:1, **asla**.
- `#A62021` metin olarak krem üzerinde 7.16:1 ✓, zemin olarak beyaz metinle 7.37:1 ✓.
- `#223E05` / krem = 11.6:1 ✓.
- **Kart durumu zeminde değil, 5px sol şeritte.** Açık ton denendi ve bırakıldı: kırmızının
  açık hali pembeleşiyor, yeşilin açık hali soluyor.

### Animasyon envanteri

| Bileşen | Nerede | Bağımlılık |
|---|---|---|
| `hero-1` | Hero giriş sahnesi | GSAP |
| `scroll-29` | Kanıt bölümü pinned reveal | GSAP + Lenis |
| `scroll-61` | "Nasıl çalışır" metin animasyonu | vanilla → GSAP'e uyarlanacak |
| `sliders-13` | Dört garanti gezinmesi | vanilla JS |
| `text-15` | Gizlilik bölümü reveal | Next.js → React'e uyarlanacak |

**Elenenler ve gerekçeleri:** `bg-2` — Kite.ai'ın hero'sunun birebir aynısı, bu ekosistemde
en sık kıyaslanacağımız proje (Three.js bağımlılığı da onunla düştü). `physic-5` — Matter.js
maliyeti (+80 KB, sürekli fizik döngüsü) tek dekoratif etki için asimetrik, ve savrulan
kelimeler "kontrol/öngörülebilirlik" anlatısına ters çalışıyor.

Tüm animasyonlar `prefers-reduced-motion` altında kapanacak.

## 2) Sayfa yapısı

### Bölüm 1 — Hero

```
[Agent'a anahtar vermek zorunda değilsin.]     ← Questrial, clamp(38px,5.6vw,72px)
Give your agent a budget — not your wallet.
Rules live in the contract, not in the prompt.

[Create your treasury with a passkey]  [I have a wallet]
 ↑ birincil, --green dolgu, --ink metin      ↑ ikincil, --red metin

── canlı sayaç şeridi ─────────────────────────
20 spend attempts blocked · 13 treasuries · 76 actions   ← zincirden, gerçek
```

**Görsel yok, ekran görüntüsü yok.** Sayaç şeridi kanıtı ilk ekranda veriyor ama iddia
etmiyor — rakamlar zincirden okunuyor.

Animasyon: `hero-1` giriş sahnesi — başlık kelime kelime yerleşiyor, sayaç şeridi son gelir.

Passkey CTA'sı `passkeyCapability()`'ye göre alt metin taşır:
- `platform` → "Fingerprint, face or PIN"
- `cross-device` → "Pair with your phone"
- `none` → **buton hiç render edilmez**, sayfa bugünkü davranışa düşer

### Bölüm 2 — Kanıt

```
It went out of policy. The chain refused.

[ 18 / 50 XLM        ]  [ Blocked            ]  [ Approved payee     ]
[ within today's cap ]  [ 150 XLM · over cap ]  [ GDOM…QCRT          ]
  ↑ yeşil şerit           ↑ kırmızı şerit        ↑ yeşil şerit
```

Alt satır: *"Not a promise — a record. 20 attempts stopped by the contract so far."*
+ gerçek bir tx hash'ine bağlantı (Stellar Expert).

Animasyon: `scroll-29` pinned reveal — kartlar scroll'la sırayla ortaya çıkar; kırmızı
kart en son ve bir beat gecikmeyle (reddedilme anı vurgulanır).

Docs köprüsü: "See the contract →" `contracts.md`

### Bölüm 3 — Nasıl çalışır

Üç adım, her biri tek cümle:
1. **Create a treasury** — one tap, no wallet setup
2. **Set the rules** — per-payment cap, daily cap, approved payees
3. **Let the agent spend** — inside the rules, or not at all

Animasyon: `scroll-61` metin animasyonu (adımlar sırayla).
Docs köprüsü: "How it's built →" `architecture.md`

### Bölüm 4 — Dört garanti

Bugünkü "guardrails" bölümünün pazarlama dilindeki karşılığı. Dört kart, gezinilebilir:
- **Per-payment cap** — no single payment can exceed what you set
- **Daily cap** — refills on a rolling 24-hour window, not a calendar reset
- **Approved payees only** — an unknown address is refused, whatever the prompt says
- **Instant revoke** — cut the agent's authority in one transaction

Kritik cümle (bu bölümün varlık sebebi): *"A per-payment cap alone can be drained by repeated
payments. These caps are cumulative — that is the difference."*

Animasyon: `sliders-13`.
Docs köprüsü: "Contract mechanics →" `contracts.md`

### Bölüm 5 — Gizlilik

```
Prove you followed the rules — without showing the numbers.
```

Vaat dili: rakipler ne harcadığını, kime ödediğini, marjını görmesin; uyum yine kanıtlansın.
**"Groth16", "BN254", "zero-knowledge" kelimeleri landing'de GEÇMEZ.**

Animasyon: `text-15` reveal.
Docs köprüsü: "How the proof works →" `zk.md`

### Bölüm 6 — CTA

Tek koyu blok (`--ink` zemin, krem metin):
```
Your treasury, in 30 seconds.
No wallet, no seed phrase, no XLM.

[Start with a passkey]   [Documentation →]
```

### Bölüm 7 — Footer

Docs · GitHub (açık kaynak) · traction satırı · Stellar testnet rozeti.

## 3) Docs'a taşınacaklar

Landing'den çıkan her teknik parça bir docs sayfasına gider — **silinmiyor, taşınıyor**:

| Landing'den çıkan | Gideceği yer |
|---|---|
| muxed sub-address anlatımı ("zero-cost, no memos") | `architecture.md` |
| ERC-8004 itibar mekaniği | `contracts.md` |
| Escrow (release/refund) detayı | `contracts.md` |
| Groth16 / BN254 / Sealed Receipt | `zk.md` (zaten var, genişletilecek) |
| "Leash" teriminin teknik tanımı | `contracts.md` |
| Kontrat sürümleri, wasm hash'leri | `contracts.md` |
| "Two rails" (USDC out / XLM in) mekaniği | `architecture.md` |

## 4) Teknik yaklaşım

### Tema sistemi

Bugün renkler `landing.css` ve `shell.css` içinde **doğrudan gömülü**. Bu iş yalnızca landing'i
kapsıyor ama token sistemini kuruyor:

```css
:root { --bg, --surface, --ink, --ink-2, --green, --red, --line }
:root[data-theme="dark"] { …aynı isimler, koyu değerler }
```

Tema seçimi `localStorage` + `prefers-color-scheme` fallback. **Dashboard bu dalgada
dönüştürülmüyor** — token'lar hazır olacak, dashboard'un geçişi kendi spec'inde yapılacak.
Geçiş dönemi boyunca dashboard koyu kalır; bu bilinçli.

### Bağımlılıklar

`gsap` + `lenis` eklenecek. İkisi de landing route'una **dinamik import** ile girer
(`passkey-kit`'te uygulanan kalıp) — dashboard bundle'ı büyümez.

### Dosya yapısı

`Landing.tsx` bugün 447 satır ve tek parça. Yeni yapı bölüm başına bir bileşen:

```
components/landing/
  Hero.tsx          Proof.tsx        HowItWorks.tsx
  Guarantees.tsx    Privacy.tsx      FinalCta.tsx     Footer.tsx
  useReveal.ts      ← GSAP/Lenis sarmalayıcı, reduced-motion burada
landing.css         ← token'lar + bölüm stilleri
```

Gerekçe: 447 satırlık tek dosyada yedi bölümü ayrı ayrı düzenlemek hataya açık, ve her
bölümün kendi animasyonu var.

### Passkey UI

`connectPasskey` / `passkeyCapability` / `isPasskeySession` zaten yazıldı ve test edildi
(228 test). Bu spec onları yalnızca **bağlıyor**:
- Hero CTA → `connectPasskey("create")`
- İkincil CTA → mevcut `connect()`
- `WalletChip` passkey oturumunu gösterir
- Passkey oturumunda friendbot kutusu gizlenir, yerine faucet düğmesi

## 5) Kapsam dışı

- **Dashboard UX + layout** (ayrı spec)
- Dashboard'un açık temaya geçişi (token'lar hazırlanır, uygulama sonraki dalga)
- Mainnet anlatısı — testnet gerçeği saklanmıyor, rozet duruyor
- Yedek signer / signer yönetimi ekranları (mainnet/T3)

## 6) Başarı kriteri

> Cüzdanı olmayan bir ziyaretçi landing'e giriyor, ilk ekranda ne olduğunu anlıyor, tek
> dokunuşla passkey'le kasasını kuruyor — ve sayfada "Groth16", "muxed" ya da "ERC-8004"
> kelimelerinin hiçbirini görmüyor.

Ölçüm: `funnel_events`'te `walletId: "passkey"` dönüşümü, bugünkü taban çizgisiyle
karşılaştırmalı (251 → 74 → 39).

## 7) Doğrulama

1. `npm test` + `lint` + `tsc -b` + `build` yeşil
2. `prefers-reduced-motion` açıkken tüm animasyonlar kapalı, sayfa okunur
3. 390px'te yatay taşma yok (`documentElement.scrollWidth === clientWidth`)
4. WCAG: metin çiftleri §1'deki ölçülen değerlerin altına düşmüyor
5. Passkey yolu gerçek cihazda: Bekir'in Windows Hello turu + zincirde tx
6. Mevcut wallet yolu bozulmadı — E2E smoke yeşil
