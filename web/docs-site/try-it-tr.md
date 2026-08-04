# Hızlı başlangıç (Türkçe)

*English version: [Try it in 5 minutes](/try-it)*

Aşağıdaki akış tamamen **testnet** üzerindedir: gerçek para yok, riskiniz sıfır.
Her adımı siz imzalarsınız — non-custodial, fonlar hep sizin kontrolünüzde.

**Uygulama:** [eunomia.finance](https://eunomia.finance)

## İki giriş yolu

**Passkey ile (en hızlısı).** Face ID, parmak izi ya da cihaz şifreniz. Kurulacak cüzdan,
yazılacak seed cümlesi ve önceden bulunması gereken XLM yok — passkey bir Stellar smart
wallet'ı kontrol eder, işlem ücretleri sponsorludur. Telefonda da aynı şekilde çalışır.

**Cüzdan ile.** Zaten varsa: masaüstünde Freighter, xBull, Albedo, LOBSTR, Rabet veya
Hana; telefonda WalletConnect destekleyen herhangi bir Stellar cüzdanı. Cüzdanın kendi
ayarlarından ağı önce **Testnet**'e alın.

## Adımlar

1. **Giriş yap** — *Create your treasury with a passkey* ve yüzünle, parmak izinle ya da
   cihaz şifrenle onayla. (Cüzdan mı tercih ediyorsun? *I have a wallet* → cüzdanını seç.
   Telefonda **WalletConnect**'i seçip QR'ı tara.)
2. **Kuralları belirle ve oluştur** — günlük ve işlem-başı limit → *Create treasury* →
   onayla. Bitince **"Copy ID" ile hazine kimliğini kopyala ve sakla**, ya da Settings'te
   *Back up on Stellar* ile aynı passkey'in olduğu her cihazdan bulunabilir hale getir.
3. **Fonla** — bir miktar gir (ör. 20) → *Fund* → onayla. Cüzdanla girdiysen ve bakiyen
   boşsa önce tek tıkla **"Get test XLM"** butonu çıkar.
4. **Alıcı onayla** — **Payments** sayfasında ödeme yapılabilecek adresi ekle. İkinci
   adresin yoksa **"use the sample vendor"** bağlantısını kullan.
5. **Ödeme gönder** — onayladığın adrese limit içinde bir ödeme → on-chain işler ✓.
6. **Asıl gösteriyi izle** — bir de limit ÜSTÜ tutar dene, ya da hiç onaylamadığın bir
   adrese göndermeyi dene: işlem **on-chain reddedilir**, para yerinden oynamaz.
   Bu red, ürünün ta kendisi. 🔴
7. **Hazineyi ajana devret (popup'lar bitsin)** — **Agent** sekmesinde harcama tavanı
   ve süre belirle → *Start Leash* (tek onay). Artık ödemeler session anahtarıyla
   imzalanır — **Run autonomous task**'a bas: 1 XLM, **sıfır popup'la** on-chain işler,
   tüm kurallar yine geçerli. *Revoke Leash* kontrolü anında geri alır.
8. **Sahip kontrolleri** — **Settings**'te *Pause spending* (ajan donar, withdraw
   çalışır), *Withdraw* ile paranı geri çek, *Update limits* ile limitleri anında
   güncelle — sahibin her zaman bir çıkışı var.

## Bir şey ters giderse

Hatalar uygulama içinde açıklamalı gösterilir. Sağ alttaki **Share feedback** butonu
kısa bir form açar — iki cümlelik geri bildirim yol haritasını doğrudan şekillendirir. 🙏
