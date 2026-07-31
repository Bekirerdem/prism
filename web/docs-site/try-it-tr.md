# Hızlı başlangıç (Türkçe)

*English version: [Try it in 5 minutes](/try-it)*

Aşağıdaki akış tamamen **testnet** üzerindedir: gerçek para yok, riskiniz sıfır.
Her adım kendi cüzdanınızla imzalanır — non-custodial, fonlar hep sizin kontrolünüzde.

**Uygulama:** [prism-stellar.vercel.app](https://prism-stellar.vercel.app)

## Telefondan bağlanma

Adımlar telefonda da aynen çalışır. Tarayıcı eklentisi yerine:

1. **Freighter mobil** (veya WalletConnect destekleyen başka bir Stellar cüzdanı) kur.
2. Cüzdanın ayarlarından ağı **Testnet**'e al.
3. Uygulamada *Connect wallet* → **WalletConnect** → QR kodu telefon cüzdanınla
   tara → onayla.

## Adımlar

1. **Cüzdan kur** — masaüstünde [Freighter](https://www.freighter.app/) eklentisini kur,
   ağı **Testnet**'e al. Zaten Stellar cüzdanın varsa bu adımı atla.
2. **Bağlan** — sağ üstteki *Connect wallet* → **Freighter** (masaüstü) ya da
   **WalletConnect** (telefon).
3. **Ücretsiz testnet XLM al** — cüzdanın boşsa uygulama fark eder ve **"Get free
   testnet XLM"** butonu gösterir; tek tık yeter.
4. **Hazineni oluştur** — günlük ve işlem-başı limitlerini gir → *Create treasury* →
   imzala. Bitince **"Copy ID" ile hazine kimliğini kopyala ve sakla** — başka cihazdan
   aynı hazineyi bu ID ile açarsın (ya da oluştururken opsiyonel Stellar yedeğini
   onayla, dert bitsin).
5. **Fonla** — bir miktar gir (ör. 20) → *Fund* → imzala.
6. **Payee onayla** — *Payments → Payees* sekmesinde ödeme yapılabilecek adresi ekle.
   İkinci adresin yoksa **"use the sample vendor"** bağlantısını kullan.
7. **Ödeme gönder** — onayladığın adrese limit içinde bir ödeme → on-chain işler ✓.
8. **Asıl gösteriyi izle** — bir de limit ÜSTÜ tutar dene, ya da hiç onaylamadığın bir
   adrese göndermeyi dene: işlem **on-chain reddedilir**, para yerinden oynamaz.
   Bu red, ürünün ta kendisi. 🔴
9. **Hazineyi ajana devret (popup'lar bitsin)** — **Agent** sekmesinde harcama tavanı
   ve süre belirle → *Start Leash* (tek onay). Artık ödemeler session anahtarıyla
   imzalanır — **Run autonomous task**'a bas: 1 XLM, **sıfır popup'la** on-chain işler,
   tüm kurallar yine geçerli. *Revoke Leash* kontrolü anında geri alır.
10. **Sahip kontrolleri** — **Settings**'te *Pause spending* (ajan donar, withdraw
    çalışır), *Withdraw* ile paranı geri çek, *Update limits* ile limitleri anında
    güncelle — sahibin her zaman bir çıkışı var.

## Bir şey ters giderse

Hatalar uygulama içinde açıklamalı gösterilir. Sağ alttaki **Share feedback** butonu
kısa bir form açar — iki cümlelik geri bildirim yol haritasını doğrudan şekillendirir. 🙏
