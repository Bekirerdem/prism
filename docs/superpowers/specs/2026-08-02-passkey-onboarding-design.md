# Passkey Onboarding — Smart Wallet + Relayer

**Status: draft — awaiting Bekir's approval.**
Karar zinciri bu oturumda kapandı: **yol 1 (passkey kullanıcısı tam vatandaş)** + **OZ Channels
relayer (adaptör arkasında)** + **testnet'te tek signer**. Domain kilidi çözüldü:
`rp.id = eunomia.finance`. Bu spec SCF #45 T1 tranche'ının "passkey onboarding" kalemidir.

Landing'in görsel dili bu dalganın DIŞINDA (todo 1c, en son). Tasarım dönüşümü bu işten SONRA
gelir — gerekçe §6'da.

## 0) Problem — ölçülmüş duvar

`funnel_events` canlı sorgusu (2026-08-02):

| | Desktop | Mobil | Toplam |
|---|---|---|---|
| Session | 161 | 92 | **251** |
| Connect'e basan | 50 | 25 | **74** (%29) |
| Bağlanan | 31 | 8 | **39** (%15,5 uçtan uca) |

Hata dökümünde 37 kaydın 28'i tek metin: **"The user closed the modal."** Yani duvar teknik
değil — kullanıcı cüzdan listesini açıyor, kurulu cüzdanı olmadığı (ya da kurmak istemediği)
için kapatıyor.

**Passkey'in hedefi bu 28 + mobil kuyruk.** Butona hiç basmayan 177 kişi bu işin kapsamı
DEĞİL (o landing/değer-önerisi meselesi) — kapsamı şişirmemek için açıkça yazıldı.

## 1) Neden passkey-kit, ve konumlandırma

Kit'in sağladıkları: `createWallet(appName, userName)` (passkey kaydı + smart wallet deploy),
`connectWallet()` (passkey'den cüzdan çözümleme), `addSecp256r1/addEd25519/addPolicy`,
süreli/geçici signer'lar, `MercuryIndexer` ile signer→cüzdan ters arama. Kontrat "son kalıcı
admin signer"ı silmeyi reddediyor.

**Çakışma değil, katman farkı.** Smart wallet'ın kendi `SignerLimits`'i var; panelde
"smart wallet zaten limit koyuyor, Eunomia'ya ne gerek var?" sorusu çıkacaktır. Kitin kendi
dokümanı cevabı veriyor:

> *"A `Signature::Policy` carries no secret, so a per-transfer cap alone is trivially drained
> by repeated capped transfers"*

İşlem-başı tavan tekrarlı harcamayla boşaltılabilir. Eunomia'nın kümülatif günlük limiti +
rolling 24s penceresi + payee whitelist'i tam o açığı kapatır. **Smart wallet = kimlik ve
imza; Eunomia = kümülatif politika.** Bu ayrım SCF başvurusunda da kullanılacak.

## 2) Mimari

Bugün kod tek ekseni soyutluyor — *kim imzalıyor* (`ContractSigner`). *Kim gönderiyor* contract
client'ın içinde gömülü. Passkey'de iki eksen de değişiyor: imzalanan şey **auth entry**
(tx zarfı değil), gönderen ise **relayer** (RPC değil).

```
lib/executor.ts     TxExecutor { address, sign, send }
                    ├── walletExecutor   → bugünkü davranış, BİT BİT AYNI (imzala → RPC)
                    └── passkeyExecutor  → auth entry imzala → relayer'a gönder

lib/passkey.ts      PasskeyKit sarmalayıcı (createWallet / connectWallet / sign)
lib/relayer.ts      OZ Channels adaptörü — self-host geçişi SADECE bu dosyayı ilgilendirir
api/relay.ts        ince proxy (API key burada durur)
state/treasury.tsx  context artık signer değil executor tutar
```

Sayfalar ve UI bileşenleri bu değişikliği görmez; `state/treasury.tsx` tüm aksiyonları zaten
tek yerde topluyor.

**`walletExecutor` davranışı bit bit korunur.** 39 bağlanmış kullanıcı ve zincirde kanıtlı
işlemler o yoldan geçti; passkey ikinci bir yol olarak yanına girer, yerine geçmez.

### Neden OZ Channels (üçüncü taraf değerlendirmesi)

- OZ-managed, **ücretsiz** ("No credits, subscriptions, or payment systems"), **fee'yi OZ
  ödüyor** — kendi fee-payer hesabımızı fonlamıyoruz.
- API key: `channels.openzeppelin.com/testnet/gen` · mainnet `/gen`. İki ağ da destekli.
- **Kota gerçek:** API key başına stroop cinsinden fee tüketim limiti, ilk işlemden 24 saat
  sonra sıfırlanır; aşınca `FEE_LIMIT_EXCEEDED`.
- **Launchtube emsali ters yönde okunur:** SDF kendi deneysel servisini kapatıp Relayer'ı
  ikame veriyor; gerekçe olarak Launchtube'un olgunluk/ölçeklenebilirlik/denetim eksikliğini
  gösteriyor. Yön daha kırılgana değil, daha sağlama doğru.
- **Çıkış kapısı aynı pakette:** `@openzeppelin/relayer-plugin-channels` hem managed servisin
  arkasındaki plugin hem de self-host edilen şey. Kilitlenme kod seviyesinde değil, endpoint +
  API key seviyesinde → `lib/relayer.ts` tek dosyalık göç yüzeyi.
- Reddedilen alternatif (kendi Vercel fee-payer'ımız): fee-payer sırrını taşımak, hesabı
  fonlamak, channel/sequence yönetimini yazmak = OZ'un çözdüğü problemi baştan çözmek, mainnet'te
  gerçek parayla. Daha çok iş, daha çok saldırı yüzeyi.

### Kurulum girdileri (plan aşamasında netleşecek)

- **`walletWasmHash`** — PasskeyKit smart wallet WASM hash'i gerekiyor (kit config'inin zorunlu
  alanı). Testnet için hangi hash'in kullanılacağı plan aşamasının ilk kalemlerinden;
  kendi WASM'ımızı yüklemek gerekip gerekmediği orada karara bağlanır.
- **`MercuryIndexer`** — signer→cüzdan ters araması için; kitin dokümanında "keyless public
  indexer" olarak geçiyor, yani ek API key beklenmiyor. Doğrulanacak; key gerekiyorsa §4'ün
  sır kuralları aynen uygulanır (`VITE_` YOK, proxy üzerinden).

## 3) SDK 14→16 geçişi (ayrı ön adım)

`passkey-kit@0.14.0` peer dep: `@stellar/stellar-sdk >=16.0.0`. Bizde `^14.6.1`. Kaçış yok.

v16 breaking listesi kodumuza karşı tarandı:

| Breaking change | Bizdeki durum |
|---|---|
| `stellar-base` fold-in | **Etkilenmiyoruz** — `src/`'de tek bir `stellar-base` importu yok |
| `MethodOptions.authV2` / `simulateTransaction` authV2 argümanı kaldırıldı | **Kullanmıyoruz** — `src/`'de hiç geçmiyor |
| Reach-through deps kendin declare et (`urijs`, `@noble/curves`, `sha.js`, `randombytes`, `toml`) | Hiçbirine dokunmuyoruz |
| Node 22+ | Node **v24.13** — yeterli |

Kalan iki gerçek risk: (a) `@stellar/stellar-sdk/contract` Client API'si değiştiyse
`treasuryClient` + `registryClient` binding'lerini yeniden üretmek (CLI 26.1.0'dan yükseltme
gerekebilir), (b) ESM/native fetch geçişinin Vite bundle'ında `polyfills.ts` Buffer shim'iyle
davranışı.

`packages/prover` kendi eski SDK'sında kalır — izole, passkey yolunu etkilemez. Monorepo'da iki
sürüm bulunması **bilinçli**; ZK tarafını bu işe karıştırmak kapsamı şişirir.

**Neden ayrı adım:** doğrulama kapısı güçlü (183 vitest + lint + tsc + build + gerçek testnet
E2E smoke). Bump tek başına bu kapıdan geçerse, sonraki hatanın suçlusu tartışmasız passkey olur.
Karıştırırsak her hata iki şüpheliyle gelir.

## 4) Sır yönetimi (açık kaynak şartı)

**`.env`'de olmak ve repoda olmamak YETMEZ.** Vite, `VITE_` önekli her değişkeni derleme zamanı
sabiti olarak bundle'a gömer — key repoda hiç görünmese bile canlı `main.js` içinde düz metin
çıkar.

1. **OZ API key asla `VITE_` almaz.** Adı `OZ_CHANNELS_API_KEY`; sadece Vercel env'de, sadece
   `api/relay.ts` içinde `process.env` ile okunur (server runtime, bundle'a girmez).
2. `.env.example`'a placeholder. `.gitignore` zaten doğru (`.env.*` ignore, `.env.example`
   istisna) — dokunulmaz.
3. **Proxy açık olmayacak.** Açık kaynak projede `api/relay.ts` adresini herkes görür;
   allowlist yoksa fee kotamızı isteyen tüketir. Proxy yalnızca bizim kontrat adreslerimize
   giden tx'leri geçirir, gerisini reddeder.
4. `FEE_LIMIT_EXCEEDED` kullanıcıya insan dilinde döner, ham hata değil.

Mevcut 4 `VITE_` değişkeni sorun değil — hepsi public olması gerekenler (Supabase anon key
RLS insert-only, WalletConnect project id, test flag).

## 5) Kullanıcı akışı

### Masaüstü desteği

WebAuthn'da biyometri tek yol değil. Tarayıcı, cihazda ne varsa onu sunar: **Windows Hello**
(PIN/parmak izi/yüz), **macOS Touch ID**, **telefonla eşleştirme (hybrid/QR)**, **şifre
yöneticisi / tarayıcı senkronizasyonu** (1Password, Bitwarden, iCloud Keychain, Google),
**donanım anahtarı**.

**Bu seçimi biz yapmıyoruz, OS/tarayıcı yapıyor** → mobil/masaüstü için ayrı akış yazılmaz;
`walletDevice.ts`'teki cüzdan ayıklaması passkey yolunda gereksiz.

Tespit katmanı: `isUserVerifyingPlatformAuthenticatorAvailable()` ile yerleşik authenticator
sorgulanır; yoksa buton kalır, alt metin "telefonunla bağlan" olur. Tarayıcı WebAuthn'ı hiç
desteklemiyorsa passkey seçeneği gizlenir → kullanıcı bugünkü Freighter yoluna düşer.

Senkronize passkey'ler cihazlar arası taşınır; "cihaz kaybı" riski device-bound passkey'lerdeki
kadar keskin değil. Testnet kararını değiştirmez, mainnet konuşmasında ayrım önemli.

### Akış

```
Landing → [Passkey ile başla]   ← birincil
        → [Cüzdanım var]         ← ikincil, bugünkü modal
```

Passkey: buton → OS arayüzü → `createWallet()` smart wallet deploy → Overview. **Cüzdan
kurulumu yok, seed phrase yok, XLM yok** — relayer fee'yi ödüyor, friendbot kapısı bu yolda
çıkmaz. Dönen kullanıcı: `connectWallet()` cüzdanı çözer.

Sonrası birebir aynı: treasury kur → fonla → payee onayla → agent harca. Passkey kullanıcısı
tam vatandaş; `state/treasury.tsx` executor'ı çağırır, kaynağı bilmez.

### Dokunulacak yüzeyler

| Yüzey | İş |
|---|---|
| Landing / giriş kapısı | İkili CTA — tek "Connect wallet" ikiye ayrılır |
| `WalletChip` | Passkey oturumunu da gösterir (chip aynı, kaynak farklı) |
| Setup | Friendbot kapısı passkey yolunda atlanır |
| `Settings` | Cüzdan tipi görünür; mevcut yapı korunur |
| Docs | "Passkey cihazına bağlıdır" notu |

**Kapsam dışı (testnet kararı):** yedek signer ekranı, passkey oluşturma ara ekranı, signer
yönetimi. Bunlar mainnet dalgasına (T3) kalem olarak geçer; Settings'te yeri şimdiden bellidir.

## 6) Tasarım dönüşümüyle ilişki

Çakışma yok: passkey `lib/` + `api/`'de yaşar (SDK'yı import eden 16 dosyanın 13'ü `lib/`),
tasarım ise `landing.css` / `shell.css` / `pages/*` sunum katmanında. App shell ayrımı zaten
doğru kurulmuş.

**Sıra: passkey önce, tasarım sonra.** Gerekçe: passkey'i yapmadan yeni yüzeylerin gerçek şekli
belli olmuyor. Bittiğinde tasarım dönüşümü eksiksiz ekran envanteri üzerine gelir ve tek geçişte
giydirir. Testnet kararıyla tasarım yükü zaten küçüldü: **bir yeni CTA düzeni + bir bilgi notu.**

## 7) Hata durumları

Tümü `wallet-errors.ts`'te toplanır (mevcut `errText` / `isStaleSessionError` kalıbı).

| Durum | Kullanıcı ne görür |
|---|---|
| OS dialogunu kapattı | Sessiz iptal, hata değil — funnel'a `dismissed` |
| Tarayıcı WebAuthn desteklemiyor | Passkey seçeneği görünmez, Freighter yolu kalır |
| Yerleşik authenticator yok | Buton durur, alt metin "telefonunla bağlan" |
| `FEE_LIMIT_EXCEEDED` | "Şu an işlem gönderemiyoruz, birazdan tekrar dene" + Freighter alternatifi |
| Relayer 5xx/timeout | Tek retry, sonra anlaşılır mesaj |
| Proxy allowlist reddi | Genel hata; bizim tarafımızda bug sinyali |
| Cüzdan çözülemedi (indexer) | "Cüzdanın bulunamadı" + yeniden dene |
| Kontrat politika reddi | **Değişmez** — bugünkü blocked akışı aynen |

Ham WalletConnect/relayer/WebAuthn mesajı kullanıcıya gösterilmez.

## 8) Ölçüm

`funnel.ts` zaten `connect_result` olayında `walletId` taşıyor. Passkey `walletId: "passkey"`
ile aynı boruya girer → passkey vs Freighter dönüşümü doğrudan karşılaştırılabilir.

Taban çizgisi §0'da kayıtlı. Canlıya çıktıktan sonra aynı sorgu koşulur, fark ölçülür.

Bu madde baştan konuyor çünkü daha önce kullanıcı kanıtı telemetriye sonradan eklenmişti ve
gelen kullanıcılar kanıtsız kaybolmuştu — aynı hata tekrarlanmayacak.

## 9) Başarı kriteri

> Passkey ile giren bir kullanıcı, cüzdan kurmadan ve hiç XLM'i olmadan kendi treasury'sini
> kurabiliyor, fonlayabiliyor, bir ödeme yaptırabiliyor ve limit aşımında kontrat reddini
> görebiliyor — hepsi zincirde tx hash'iyle doğrulanabilir.

## 10) Doğrulama kapıları

1. **SDK bump** → 183 vitest + lint + tsc + build + E2E smoke yeşil, davranış değişmemiş.
   Geçmeden passkey'e başlanmaz.
2. **Relayer proxy** → allowlist birim testleri + testnet'te proxy üzerinden geçmiş **1 gerçek
   tx zincirde**.
3. **Passkey akışı** → Playwright sanal authenticator ile otomatik E2E (Chromium CDP
   `WebAuthn.addVirtualAuthenticator`; **plan aşamasının ilk işi bunu doğrulamak** — çalışmazsa
   manuel doğrulamaya düşülür) + Bekir'in gerçek Windows Hello E2E'si.
4. **Canlı** → funnel'da passkey/Freighter karşılaştırması okunabiliyor.

Birim testler kitin DOM'a bağlı kısmından bağımsız kalır — `walletSigner.ts` kalıbı (kit enjekte
edilir, saf test edilir) passkey adaptöründe de uygulanır.

## Kaynaklar

- OZ Channels: https://docs.openzeppelin.com/relayer/1.3.x/guides/stellar-channels-guide
- Stellar resmi (Launchtube → Relayer): https://developers.stellar.org/docs/tools/openzeppelin-relayer
- passkey-kit: https://github.com/kalepail/passkey-kit (npm `passkey-kit@0.14.0`)
