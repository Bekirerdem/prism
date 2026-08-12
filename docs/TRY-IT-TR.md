# Eunomia'yı Dene — 5 Dakikalık Rehber (Testnet)

*English version: [TRY-IT.md](TRY-IT.md)*

**Eunomia nedir?** AI agent'lara güvenle harcama yetkisi veren, Stellar üzerinde çalışan
sınırlı bir hazine (bounded treasury): günlük limit + işlem-başı limit + payee whitelist'ini
**kontrat** uygular — model ne kadar "ikna edilirse edilsin" limit dışına para çıkamaz.

Aşağıdaki akış tamamen **testnet** üzerindedir: gerçek para yok, riskiniz sıfır.
Her adım cüzdanınızla imzalanır — non-custodial, fonlar hep sizin kontrolünüzde.

**Uygulama:** [eunomia.finance](https://eunomia.finance)

## Mobil cihazdan bağlanma

Aşağıdaki adımlar telefondan da aynen çalışır. Tarayıcı eklentisi yerine:

1. **Freighter mobil** (veya WalletConnect destekleyen başka bir Stellar cüzdanı)
   uygulamasını app store'dan kur.
2. **Testnet'e al** — cüzdanın ayarlarından ağı **Testnet** olarak değiştir.
3. **WalletConnect ile bağlan** — uygulamada *Connect wallet*'a dokun → modalda
   **WalletConnect**'i seç → telefon cüzdanınla QR kodu tara → onayla.

Şimdi aşağıdaki adımları takip et — her şey aynı şekilde çalışır.

## Adımlar

1. **Cüzdan kur** — **masaüstünde** [Freighter](https://www.freighter.app/) tarayıcı
   eklentisini kur, ayarlarından ağı **Testnet**'e al. **Telefonda** yukarıdaki *Mobil
   cihazdan bağlanma* bölümüne bak. (Zaten Stellar cüzdanın varsa bu adımı atla.)
2. **Bağlan** — sağ üstteki *Connect wallet*'a veya *Open app*'e tıkla → **Freighter**
   (masaüstü) ya da **WalletConnect** (telefon) seçeneklerinden birini seç.
3. **Ücretsiz testnet XLM al** — cüzdanın boşsa uygulama bunu fark eder ve
   **"Get free testnet XLM"** butonu gösterir; tek tıkla friendbot cüzdanını fonlar.
4. **Hazineni oluştur** — günlük ve işlem-başı limitlerini gir → *Create treasury* →
   cüzdanında imzala. Deploy bitince **"Copy ID" ile hazine kimliğini kopyala ve sakla** —
   başka tarayıcı/cihazdan aynı hazineyi bu ID ile açarsın.
5. **Fonla** — bir miktar XLM gir (ör. 20) → *Fund* → imzala.
6. **Payee whitelist'le** — ödeme yapılabilecek adresi ekle. İkinci bir adresin yoksa
   inputun altındaki **"use the sample vendor"** bağlantısına tıkla, örnek adresi kullan.
7. **Harca** — whitelist'lediğin adrese limit içinde bir ödeme gönder → on-chain işler ✓.
8. **Asıl gösteriyi izle** — şimdi bir de limit ÜSTÜ tutar dene, ya da whitelist dışı bir
   adrese göndermeyi dene: kontrat işlemi **on-chain reddeder**, para yerinden oynamaz.
   Bu red, ürünün ta kendisi. 🔴
9. **Hazineyi ajana devret (popup'lar bitsin)** — **Agent** sekmesinde harcama
   tavanı ve süre belirle → *Start Leash* (tek cüzdan onayı). Artık ödemeler
   session anahtarıyla imzalanır — **Run autonomous task**'a bas: 1 XLM, **sıfır cüzdan
   popup'ıyla** on-chain işler ve tüm limitler yine geçerlidir. *Revoke Leash* ile
   kontrolü anında geri alırsın.
10. **Sahip kontrolleri** — **Settings** sekmesinde *Pause spending* (ajanı dondurur,
     withdraw çalışmaya devam eder), *Withdraw* ile paranı geri çek, *Update limits* ile
     limitleri anında güncelle — sahibin her zaman bir çıkışı var.

## Bir şey ters giderse

- Hata mesajları uygulama içinde açıklamalı gösterilir (bakiye yetersiz, imza reddedildi vb.).
- Sağ alttaki **Share feedback** butonu kısa bir Google Form açar — iki cümlelik geri
  bildirim yol haritasını doğrudan şekillendirir. 🙏

## Daha fazlası

- Ana [README](../README.md) — mimari, kontratlar, ZK confidential mode
- İzleyici demosu (cüzdan gerektirmez): ana sayfada **Launch live demo**
