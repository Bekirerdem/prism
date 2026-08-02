# Passkey Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cüzdanı olmayan bir kullanıcı passkey ile girip, hiç XLM'i olmadan kendi treasury'sini kurabilsin, fonlayabilsin, ödeme yaptırabilsin ve limit aşımında kontrat reddini görebilsin.

**Architecture:** Passkey cüzdanı bir smart wallet (C-adres); imzalanan şey auth entry, gönderen ise OZ Channels relayer. Bugünkü Freighter yolu `ContractSigner` üzerinden RPC'ye gidiyor. İki yolu ortak bir `TxExecutor { address, sign, send }` arkasında topluyoruz; `state/treasury.tsx` executor'ı tutar, sayfalar farkı görmez.

**Tech Stack:** React 19 + Vite 8 + TypeScript · `@stellar/stellar-sdk` 16 · `passkey-kit` 0.14.0 · `@openzeppelin/relayer-plugin-channels` 0.20.0 · Vercel serverless (Node 24.x) · vitest + Playwright

**Spec:** `docs/superpowers/specs/2026-08-02-passkey-onboarding-design.md`

## Global Constraints

Her task'ın gereksinimleri bu bölümü kapsar.

- **SDK tabanı:** `@stellar/stellar-sdk >= 16.0.0` — `passkey-kit@0.14.0`'ın peer dep'i. Bump kapsamı: `web/` + `packages/treasury-client` + `packages/registry-client`.
- **Node:** 22+ gerekiyor. Lokal v24.13, Vercel projesi `nodeVersion: 24.x`.
- **Sır kuralı:** `VITE_` önekli hiçbir değişken gizli değer taşımaz — Vite onları bundle'a gömer. OZ API key adı `OZ_CHANNELS_API_KEY`, yalnızca `web/api/relay.ts` içinde `process.env` ile okunur.
- **Proxy allowlist zorunlu:** açık kaynak projede relay endpoint'i herkese görünür; allowlist yoksa fee kotası tüketilir.
- **`rp.id = eunomia.finance`** (WebAuthn origin kilidi).
- **`walletExecutor` davranışı bit bit korunur** — 39 bağlanmış kullanıcı ve zincirde kanıtlı işlemler o yoldan geçti.
- **Ham hata metni kullanıcıya gösterilmez** (WebAuthn / relayer / WalletConnect).
- **Testnet: tek signer.** Yedek signer, signer yönetimi ve passkey ara ekranı KAPSAM DIŞI (mainnet/T3).
- **Doğrulama kapısı (her aşama sonunda):** `npm test` (183 vitest) + `npm run lint` + `tsc -b` + `npm run build` + `npm run test:e2e`, hepsi `web/` altında.
- **Vercel deploy kökü `web/`** → serverless function `web/api/` altına konur (`vercel --prod --cwd web`).

---

# AŞAMA 0 — SDK 14→16 bump

Passkey'e geçmeden bu aşama tamamen yeşil olmalı. Karıştırılırsa her hata iki şüpheliyle gelir.

### Task 1: `web/` SDK 16 bump

**Files:**
- Modify: `web/package.json` (dependencies)
- Modify: `web/package-lock.json` (otomatik)

**Interfaces:**
- Consumes: —
- Produces: `@stellar/stellar-sdk@^16` çözümlenmiş `web/node_modules`; sonraki tasklar bunun üstüne kurulur.

- [ ] **Step 1: Mevcut yeşil tabanı kaydet**

```bash
cd web
npm test 2>&1 | tail -5
npm run lint 2>&1 | tail -5
```

Beklenen: vitest **183 passed**, lint 0 error. Bu sayıyı not et — bump sonrası aynı olmalı.

- [ ] **Step 2: Bump**

```bash
cd web
npm install @stellar/stellar-sdk@^16
```

- [ ] **Step 3: Tip kontrolü — ilk gerçek sinyal**

```bash
cd web
npx tsc -b
```

Beklenen: ya temiz geçer, ya `treasuryClient.ts`/`registryClient.ts` içinde `@stellar/stellar-sdk/contract` importlarında hata verir. Hata verirse **binding'leri elle düzeltme** — Task 2'de yeniden üretilecekler. Hataları not et, Task 2'ye geç, sonra buraya dön.

- [ ] **Step 4: Testler ve build**

```bash
cd web
npm test
npm run lint
npm run build
```

Beklenen: 183 passed, 0 lint error, build başarılı. `polyfills.ts` Buffer shim'i yüzünden build kırılırsa: hata metnini oku, `Buffer` globalinin ne zaman gerektiğini kontrol et — shim `main.tsx`'te ilk import olmalı.

- [ ] **Step 5: Commit**

```bash
git add web/package.json web/package-lock.json
git commit -m "chore(deps): bump @stellar/stellar-sdk to v16 in web"
```

---

### Task 2: Client paketlerini bump et ve binding'leri yeniden üret

**Files:**
- Modify: `packages/treasury-client/package.json`
- Modify: `packages/registry-client/package.json`
- Modify: `packages/treasury-client/src/index.ts` (generate çıktısı)
- Modify: `packages/registry-client/src/index.ts` (generate çıktısı)
- Modify: `web/src/lib/treasuryClient.ts` (sync kopyası)
- Modify: `web/src/lib/registryClient.ts` (sync kopyası)

**Interfaces:**
- Consumes: Task 1'in SDK 16 tabanı.
- Produces: SDK 16 uyumlu, CI `cmp` kapısından geçen binding çiftleri.

> CI şu iki satırla eşitliği zorluyor — bu task'ın çıktısı onları yeşil bırakmalı:
> `cmp packages/treasury-client/src/index.ts web/src/lib/treasuryClient.ts`
> `cmp packages/registry-client/src/index.ts web/src/lib/registryClient.ts`

- [ ] **Step 1: `stellar` CLI sürümünü kontrol et**

```bash
stellar --version
```

Beklenen: 26.1.0 veya üstü. Binding üretimi SDK 16 uyumlu çıktı vermiyorsa CLI'ı güncelle:

```bash
cargo install --locked stellar-cli
```

- [ ] **Step 2: Her iki pakette SDK'yı bump et**

```bash
cd packages/treasury-client && npm install @stellar/stellar-sdk@^16
cd ../registry-client && npm install @stellar/stellar-sdk@^16
```

- [ ] **Step 3: WASM'ların yerinde olduğunu doğrula**

```bash
ls target/wasm32v1-none/release/treasury.wasm target/wasm32v1-none/release/treasury_registry.wasm
```

Yoksa önce derle:

```bash
stellar contract build
```

- [ ] **Step 4: Binding'leri yeniden üret (web'e senkron dahil)**

```bash
cd packages/treasury-client && npm run generate
cd ../registry-client && npm run generate
```

`generate` script'i binding'i üretip `sync:web` ile `web/src/lib/`'e kopyalar.

- [ ] **Step 5: Senkronu doğrula — CI'ın koştuğu komutun aynısı**

```bash
cd ../..
cmp packages/treasury-client/src/index.ts web/src/lib/treasuryClient.ts
cmp packages/registry-client/src/index.ts web/src/lib/registryClient.ts
```

Beklenen: iki komut da sessiz (fark yok). Çıktı varsa `npm run sync:web` tekrar koş.

- [ ] **Step 6: Web tarafını yeniden doğrula**

```bash
cd web
npx tsc -b && npm test && npm run lint && npm run build
```

Beklenen: 183 passed, 0 error, build başarılı. Task 1 Step 3'te not ettiğin binding hataları burada kapanmış olmalı.

- [ ] **Step 7: Commit**

```bash
git add packages/treasury-client packages/registry-client web/src/lib/treasuryClient.ts web/src/lib/registryClient.ts
git commit -m "chore(deps): bump client packages to stellar-sdk v16 and regenerate bindings"
```

---

### Task 3: Aşama 0 kapısı — gerçek testnet E2E

**Files:**
- Değişiklik yok; bu bir doğrulama task'ı.

**Interfaces:**
- Consumes: Task 1 + Task 2.
- Produces: "SDK 16 altında mevcut ürün bozulmadı" kanıtı. Bu geçmeden Aşama 1'e başlanmaz.

- [ ] **Step 1: E2E smoke koş**

```bash
cd web
npm run test:e2e
```

Beklenen: gerçek testnet'te connect→deploy→fund→whitelist→pay zinciri yeşil (~44s referans süre).

- [ ] **Step 2: Kırılırsa teşhis**

Kırılma SDK 16'nın `rpc.Server` veya `contract.Client` davranış değişikliğinden gelir. Hata metnini oku, migration kılavuzuna bak: https://stellar.github.io/js-stellar-sdk/guides/00-migration/ — düzelt, Step 1'i tekrarla.

- [ ] **Step 3: Kapıyı işaretle**

```bash
git commit --allow-empty -m "test: SDK v16 gate green — 183 unit + lint + build + testnet e2e"
```

---

# AŞAMA 1 — OZ Channels relayer proxy

### Task 4: Allowlist mantığı (saf, TDD)

**Files:**
- Create: `web/src/lib/relayGuard.ts`
- Create: `web/src/lib/relayGuard.test.ts`

**Interfaces:**
- Consumes: —
- Produces: `isAllowedContract(id: string, allowlist: string[]): boolean` — Task 5 bunu proxy içinde kullanır.

> Neden saf bir dosya: proxy'nin karar mantığı Node runtime'ından bağımsız test edilebilsin. Bu, `walletSigner.ts`'in kalıbı.

- [ ] **Step 1: Failing test yaz**

```ts
// web/src/lib/relayGuard.test.ts
import { describe, it, expect } from "vitest";
import { isAllowedContract } from "./relayGuard";

const ALLOW = ["CBEPVXK6AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4ZE7"];

describe("isAllowedContract", () => {
  it("allows a contract on the list", () => {
    expect(isAllowedContract(ALLOW[0], ALLOW)).toBe(true);
  });

  it("rejects a contract that is not on the list", () => {
    expect(isAllowedContract("CDOTHERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", ALLOW)).toBe(false);
  });

  it("rejects empty or malformed input rather than passing it through", () => {
    expect(isAllowedContract("", ALLOW)).toBe(false);
    expect(isAllowedContract("not-a-contract", ALLOW)).toBe(false);
  });

  it("rejects everything when the allowlist is empty — fail closed", () => {
    expect(isAllowedContract(ALLOW[0], [])).toBe(false);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

```bash
cd web && npx vitest run src/lib/relayGuard.test.ts
```

Beklenen: FAIL — `isAllowedContract` bulunamıyor.

- [ ] **Step 3: Minimal implementasyon**

```ts
// web/src/lib/relayGuard.ts
// The relay endpoint is public in an open-source repo: without this gate anyone could
// spend our OZ fee quota. Fails closed — an empty allowlist allows nothing.

/** Stellar contract ids are StrKey `C…`, 56 chars. */
const CONTRACT_ID = /^C[A-Z2-7]{55}$/;

export function isAllowedContract(id: string, allowlist: string[]): boolean {
  if (!CONTRACT_ID.test(id)) return false;
  return allowlist.includes(id);
}
```

- [ ] **Step 4: Testin geçtiğini gör**

```bash
cd web && npx vitest run src/lib/relayGuard.test.ts
```

Beklenen: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/relayGuard.ts web/src/lib/relayGuard.test.ts
git commit -m "feat(relay): allowlist guard for the public relay endpoint"
```

---

### Task 5: Relayer proxy (Vercel function)

**Files:**
- Create: `web/api/relay.ts`
- Create: `web/.env.example` (yoksa; varsa modify)
- Modify: `web/package.json` (dependency: `@openzeppelin/relayer-plugin-channels`)

**Interfaces:**
- Consumes: `isAllowedContract` (Task 4).
- Produces: `POST /api/relay` → gövde `{ contractId: string, func: string, auth: string[] }`, cevap `{ hash: string, status: string }` veya `{ error: string }`. Task 8/10 bunu `lib/relayer.ts` üzerinden çağırır.

> OZ SDK çağrısı dokümandaki şekliyle: `client.submitSorobanTransaction({ func, auth })` → `{transactionId, hash, status}`.

- [ ] **Step 1: API anahtarını al ve env'e koy**

Testnet anahtarı: `https://channels.openzeppelin.com/testnet/gen`

Vercel'e ekle (**`VITE_` öneki YOK** — bu kritik):

```bash
cd web
vercel env add OZ_CHANNELS_API_KEY production
```

Lokal geliştirme için `web/.env` (gitignore'lu) içine aynı satır: `OZ_CHANNELS_API_KEY=...`

- [ ] **Step 2: `.env.example`'a placeholder ekle**

```bash
# web/.env.example
# Server-only. NEVER prefix with VITE_ — Vite inlines VITE_* into the bundle.
OZ_CHANNELS_API_KEY=your-testnet-key-from-channels.openzeppelin.com/testnet/gen
```

- [ ] **Step 3: Bağımlılığı kur**

```bash
cd web
npm install @openzeppelin/relayer-plugin-channels
```

- [ ] **Step 4: Proxy'yi yaz**

```ts
// web/api/relay.ts
// Vercel serverless function. Holds the OZ Channels API key so it never reaches the
// browser bundle. Carries NO fee-payer secret and funds no account — OZ pays the fees.
// The endpoint is public (open-source repo), so every request is allowlist-checked.
import { isAllowedContract } from "../src/lib/relayGuard";

const ALLOWED_CONTRACTS = (process.env.RELAY_ALLOWED_CONTRACTS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const apiKey = process.env.OZ_CHANNELS_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Relay is not configured." }, { status: 503 });
  }

  let body: { contractId?: string; func?: string; auth?: string[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  const { contractId, func, auth } = body;
  if (!contractId || !func || !Array.isArray(auth)) {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!isAllowedContract(contractId, ALLOWED_CONTRACTS)) {
    return Response.json({ error: "Contract not allowed." }, { status: 403 });
  }

  const { ChannelsClient } = await import("@openzeppelin/relayer-plugin-channels");
  const client = new ChannelsClient({
    baseUrl: "https://channels.openzeppelin.com/testnet",
    apiKey,
  });

  try {
    const result = await client.submitSorobanTransaction({ func, auth });
    return Response.json({ hash: result.hash, status: result.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("FEE_LIMIT_EXCEEDED")) {
      return Response.json({ error: "FEE_LIMIT_EXCEEDED" }, { status: 429 });
    }
    console.error("relay failed:", msg);
    return Response.json({ error: "Relay failed." }, { status: 502 });
  }
}
```

> **`ChannelsClient` yapılandırıcısının gerçek adı ve alanları kurulumda doğrulanacak.** Paket kurulduktan sonra `node_modules/@openzeppelin/relayer-plugin-channels/dist/index.d.ts` dosyasını aç, dışa aktarılan sınıf/fonksiyon adını ve `submitSorobanTransaction` imzasını oku, yukarıdaki iki satırı ona göre düzelt. Gerisi aynı kalır.

- [ ] **Step 5: Allowlist env'ini ekle**

Treasury + registry kontrat adreslerini `DEPLOYMENT.md`'den al:

```bash
cd web
vercel env add RELAY_ALLOWED_CONTRACTS production
# değer: CBEP…,CAQ5…  (virgülle ayrılmış)
```

- [ ] **Step 6: Tip kontrolü**

```bash
cd web && npx tsc -b
```

`api/` klasörü `tsconfig.app.json`'ın DOM tipleriyle çakışırsa: `tsconfig.app.json`'ın `include` listesinden `api` hariç tutulur, `api/` için `tsconfig.node.json`'a eklenir.

- [ ] **Step 7: Commit**

```bash
git add web/api/relay.ts web/.env.example web/package.json web/package-lock.json
git commit -m "feat(relay): OZ Channels proxy with allowlist and server-side key"
```

---

### Task 6: Aşama 1 kapısı — zincirde 1 gerçek tx

**Files:**
- Değişiklik yok; doğrulama task'ı.

**Interfaces:**
- Consumes: Task 5.
- Produces: relayer'ın gerçekten çalıştığı kanıtı (tx hash). Geçmeden Aşama 2'ye başlanmaz.

- [ ] **Step 1: Preview deploy**

```bash
cd web && vercel --cwd . 
```

- [ ] **Step 2: Allowlist reddini doğrula**

```bash
curl -s -X POST "<preview-url>/api/relay" \
  -H "content-type: application/json" \
  -d '{"contractId":"CDNOTALLOWEDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","func":"x","auth":[]}'
```

Beklenen: HTTP 403, gövde `{"error":"Contract not allowed."}`

- [ ] **Step 3: İzinli kontratla gerçek bir çağrı geçir**

Treasury'nin okuma fonksiyonlarından biri yerine **durum değiştiren** bir çağrı kullan (relayer'ın gerçekten submit ettiğini görmek için). Bir test treasury'sinde `add_payee` çağrısının `func` + `auth` XDR'ını üret, `/api/relay`'e POST et.

Beklenen: HTTP 200, gövde `{ hash, status }`.

- [ ] **Step 4: Zincirde doğrula**

Dönen hash'i Stellar Expert testnet'te aç:
`https://stellar.expert/explorer/testnet/tx/<hash>`

Beklenen: işlem başarılı, **fee'yi OZ'un channel hesabı ödemiş** (source account bizim değil).

- [ ] **Step 5: Kapıyı işaretle**

```bash
git commit --allow-empty -m "test: relay gate green — allowlist rejects, real testnet tx <hash>"
```

---

# AŞAMA 2 — Passkey akışı

### Task 7: Passkey destek tespiti (saf, TDD)

**Files:**
- Create: `web/src/lib/passkeySupport.ts`
- Create: `web/src/lib/passkeySupport.test.ts`

**Interfaces:**
- Consumes: —
- Produces: `passkeyCapability(nav): Promise<"platform" | "cross-device" | "none">` — Task 11 CTA'yı buna göre çizer.

- [ ] **Step 1: Failing test yaz**

```ts
// web/src/lib/passkeySupport.test.ts
import { describe, it, expect } from "vitest";
import { passkeyCapability } from "./passkeySupport";

describe("passkeyCapability", () => {
  it("reports platform when a built-in authenticator is available", async () => {
    const win = {
      PublicKeyCredential: {
        isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true),
      },
    };
    await expect(passkeyCapability(win)).resolves.toBe("platform");
  });

  it("reports cross-device when WebAuthn exists but no built-in authenticator", async () => {
    const win = {
      PublicKeyCredential: {
        isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(false),
      },
    };
    await expect(passkeyCapability(win)).resolves.toBe("cross-device");
  });

  it("reports none when WebAuthn is absent", async () => {
    await expect(passkeyCapability({})).resolves.toBe("none");
  });

  it("degrades to cross-device when the probe throws", async () => {
    const win = {
      PublicKeyCredential: {
        isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.reject(new Error("boom")),
      },
    };
    await expect(passkeyCapability(win)).resolves.toBe("cross-device");
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

```bash
cd web && npx vitest run src/lib/passkeySupport.test.ts
```

Beklenen: FAIL — modül yok.

- [ ] **Step 3: Implementasyon**

```ts
// web/src/lib/passkeySupport.ts
// What the browser can offer, decided once at load. The OS picks the actual authenticator
// (Windows Hello, Touch ID, phone-over-QR, password manager) — we only decide whether to
// show the passkey CTA and which hint to put under it.

export type PasskeyCapability = "platform" | "cross-device" | "none";

interface WebAuthnWindow {
  PublicKeyCredential?: {
    isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
  };
}

export async function passkeyCapability(win: WebAuthnWindow): Promise<PasskeyCapability> {
  const probe = win.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable;
  if (!probe) return "none";
  try {
    return (await probe()) ? "platform" : "cross-device";
  } catch {
    // WebAuthn exists; only the convenience probe failed. Phone pairing still works.
    return "cross-device";
  }
}
```

- [ ] **Step 4: Testin geçtiğini gör**

```bash
cd web && npx vitest run src/lib/passkeySupport.test.ts
```

Beklenen: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/passkeySupport.ts web/src/lib/passkeySupport.test.ts
git commit -m "feat(passkey): capability probe for the passkey CTA"
```

---

### Task 8: Passkey adaptörü (kit enjekte edilir, TDD)

**Files:**
- Create: `web/src/lib/passkey.ts`
- Create: `web/src/lib/passkey.test.ts`
- Modify: `web/package.json` (dependency: `passkey-kit`)

**Interfaces:**
- Consumes: —
- Produces:
  - `interface PasskeyBackend { createWallet(app: string, user: string): Promise<{ contractId: string }>; connectWallet(): Promise<{ contractId: string }>; sign(xdr: string): Promise<string> }`
  - `makePasskeyWallet(backend: PasskeyBackend, app: string): { create(user: string): Promise<string>; connect(): Promise<string>; sign(xdr: string): Promise<string> }`
  - Task 10 `makePasskeyWallet`'ı `passkeyExecutor` içinde kullanır.

> Kalıp `walletSigner.ts` ile aynı: kit dışarıdan enjekte edilir, dosya DOM'a bağlanmadan test edilir.

- [ ] **Step 1: Paketi kur ve gerçek imzaları oku**

```bash
cd web
npm install passkey-kit
```

Sonra tipleri aç ve **`createWallet` / `connectWallet` / `sign` metotlarının gerçek parametre ve dönüş tiplerini oku**:

```bash
cat node_modules/passkey-kit/dist/index.d.ts | head -80
```

Aşağıdaki `PasskeyBackend` arayüzü bizim sınırımız; kit'e bağlanan tek yer Step 5'teki fabrika fonksiyonu. Kit imzaları farklıysa **sadece o fonksiyon** uyarlanır, testler ve tüketiciler değişmez.

- [ ] **Step 2: Failing test yaz**

```ts
// web/src/lib/passkey.test.ts
import { describe, it, expect, vi } from "vitest";
import { makePasskeyWallet, type PasskeyBackend } from "./passkey";

const backend = (over: Partial<PasskeyBackend> = {}): PasskeyBackend => ({
  createWallet: vi.fn().mockResolvedValue({ contractId: "CWALLET" }),
  connectWallet: vi.fn().mockResolvedValue({ contractId: "CWALLET" }),
  sign: vi.fn().mockResolvedValue("SIGNED"),
  ...over,
});

describe("makePasskeyWallet", () => {
  it("creates a wallet and returns its contract id", async () => {
    const be = backend();
    const w = makePasskeyWallet(be, "Eunomia");

    await expect(w.create("bekir")).resolves.toBe("CWALLET");
    expect(be.createWallet).toHaveBeenCalledWith("Eunomia", "bekir");
  });

  it("connects an existing wallet", async () => {
    const be = backend();
    const w = makePasskeyWallet(be, "Eunomia");

    await expect(w.connect()).resolves.toBe("CWALLET");
  });

  it("passes the xdr through to the backend signer", async () => {
    const be = backend();
    const w = makePasskeyWallet(be, "Eunomia");

    await expect(w.sign("XDR")).resolves.toBe("SIGNED");
    expect(be.sign).toHaveBeenCalledWith("XDR");
  });

  it("turns a user-cancelled prompt into a recognisable error, not a raw WebAuthn message", async () => {
    const be = backend({
      createWallet: vi.fn().mockRejectedValue(new Error("NotAllowedError: The operation either timed out or was not allowed")),
    });
    const w = makePasskeyWallet(be, "Eunomia");

    await expect(w.create("bekir")).rejects.toThrow(/cancelled/i);
    await expect(w.create("bekir")).rejects.not.toThrow(/NotAllowedError/);
  });
});
```

- [ ] **Step 3: Testin başarısız olduğunu gör**

```bash
cd web && npx vitest run src/lib/passkey.test.ts
```

Beklenen: FAIL — modül yok.

- [ ] **Step 4: Implementasyon**

```ts
// web/src/lib/passkey.ts
// Thin seam over passkey-kit. The kit is injected so this file unit-tests without WebAuthn
// or the DOM — same pattern as walletSigner.ts. Raw WebAuthn errors never reach the user.

export interface PasskeyBackend {
  createWallet(app: string, user: string): Promise<{ contractId: string }>;
  connectWallet(): Promise<{ contractId: string }>;
  sign(xdr: string): Promise<string>;
}

export interface PasskeyWallet {
  create(user: string): Promise<string>;
  connect(): Promise<string>;
  sign(xdr: string): Promise<string>;
}

/** The browser rejects with NotAllowedError both when the user dismisses the OS prompt and
 *  when it times out. Neither is worth showing verbatim. */
function humanise(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (/notallowed|aborterror|timed out|cancel/i.test(msg)) {
    return new Error("Passkey prompt cancelled — try again.");
  }
  return new Error("Couldn't use your passkey. Try again or connect a wallet instead.");
}

export function makePasskeyWallet(backend: PasskeyBackend, app: string): PasskeyWallet {
  return {
    async create(user) {
      try {
        return (await backend.createWallet(app, user)).contractId;
      } catch (e) {
        throw humanise(e);
      }
    },
    async connect() {
      try {
        return (await backend.connectWallet()).contractId;
      } catch (e) {
        throw humanise(e);
      }
    },
    async sign(xdr) {
      try {
        return await backend.sign(xdr);
      } catch (e) {
        throw humanise(e);
      }
    },
  };
}
```

- [ ] **Step 5: Kit'e bağlayan fabrikayı ekle (aynı dosyanın sonuna)**

```ts
// The only place that touches passkey-kit directly. Adjust the three call sites here if the
// kit's signatures differ from PasskeyBackend — nothing else in the app changes.
import { PasskeyKit } from "passkey-kit";
import { RPC_URL, NETWORK_PASSPHRASE, WALLET_WASM_HASH } from "../config";

export function realPasskeyBackend(): PasskeyBackend {
  const kit = new PasskeyKit({
    rpcUrl: RPC_URL,
    networkPassphrase: NETWORK_PASSPHRASE,
    walletWasmHash: WALLET_WASM_HASH,
  });

  return {
    createWallet: (app, user) => kit.createWallet(app, user),
    connectWallet: () => kit.connectWallet(),
    sign: (xdr) => kit.sign(xdr),
  };
}
```

`WALLET_WASM_HASH` + `RPC_URL` `web/src/config.ts`'e eklenir (yoksa). WASM hash kitin dokümanındaki testnet değeridir; Step 1'de okuduğun `.d.ts` ile birlikte doğrula.

- [ ] **Step 6: Testlerin geçtiğini gör**

```bash
cd web && npx vitest run src/lib/passkey.test.ts && npm test
```

Beklenen: 4 yeni test passed, toplam suite yeşil.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/passkey.ts web/src/lib/passkey.test.ts web/src/config.ts web/package.json web/package-lock.json
git commit -m "feat(passkey): injectable passkey-kit adapter with humanised errors"
```

---

### Task 9: `TxExecutor` soyutlaması + `walletExecutor` (davranış korunur, TDD)

**Files:**
- Create: `web/src/lib/executor.ts`
- Create: `web/src/lib/executor.test.ts`

**Interfaces:**
- Consumes: `ContractSigner` (`walletSigner.ts`).
- Produces:
  - `interface TxExecutor { address: string; kind: "wallet" | "passkey"; signer: ContractSigner; send?: (contractId: string, func: string, auth: string[]) => Promise<{ hash: string }> }`
  - `makeWalletExecutor(address: string, signer: ContractSigner): TxExecutor`
  - Task 10 `makePasskeyExecutor`'ı ekler; Task 11 `kind` alanını UI'da kullanır.

> `send` opsiyonel: wallet yolunda contract client kendi RPC'sine gönderir (bugünkü davranış), passkey yolunda relayer'a gider.

- [ ] **Step 1: Failing test yaz**

```ts
// web/src/lib/executor.test.ts
import { describe, it, expect, vi } from "vitest";
import { makeWalletExecutor } from "./executor";

describe("makeWalletExecutor", () => {
  it("carries the address and marks itself as the wallet path", () => {
    const signer = { signTransaction: vi.fn() };
    const ex = makeWalletExecutor("GADDR", signer);

    expect(ex.address).toBe("GADDR");
    expect(ex.kind).toBe("wallet");
  });

  it("passes the signer through untouched — the wallet path must not change behaviour", async () => {
    const signTransaction = vi.fn().mockResolvedValue({ signedTxXdr: "S", signerAddress: "GADDR" });
    const ex = makeWalletExecutor("GADDR", { signTransaction });

    await ex.signer.signTransaction("XDR");

    expect(signTransaction).toHaveBeenCalledWith("XDR");
  });

  it("has no send hook — the contract client submits over RPC as before", () => {
    const ex = makeWalletExecutor("GADDR", { signTransaction: vi.fn() });
    expect(ex.send).toBeUndefined();
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

```bash
cd web && npx vitest run src/lib/executor.test.ts
```

Beklenen: FAIL — modül yok.

- [ ] **Step 3: Implementasyon**

```ts
// web/src/lib/executor.ts
// Two things vary between the wallet path and the passkey path: who signs, and who submits.
// ContractSigner already covered the first. TxExecutor covers both so state/treasury.tsx can
// stay indifferent to which path the user came in through.
import type { ContractSigner } from "./walletSigner";

export interface TxExecutor {
  address: string;
  kind: "wallet" | "passkey";
  signer: ContractSigner;
  /** Present only when submission does NOT go over RPC (passkey → relayer). */
  send?: (contractId: string, func: string, auth: string[]) => Promise<{ hash: string }>;
}

/** The existing path, unchanged: the wallet signs, the contract client submits over RPC. */
export function makeWalletExecutor(address: string, signer: ContractSigner): TxExecutor {
  return { address, kind: "wallet", signer };
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

```bash
cd web && npx vitest run src/lib/executor.test.ts
```

Beklenen: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/executor.ts web/src/lib/executor.test.ts
git commit -m "feat(executor): TxExecutor seam with wallet path preserved"
```

---

### Task 10: `passkeyExecutor` + relayer istemcisi

**Files:**
- Create: `web/src/lib/relayer.ts`
- Create: `web/src/lib/relayer.test.ts`
- Modify: `web/src/lib/executor.ts` (ekleme)
- Modify: `web/src/lib/executor.test.ts` (ekleme)

**Interfaces:**
- Consumes: `makePasskeyWallet` (Task 8), `TxExecutor` (Task 9), `POST /api/relay` (Task 5).
- Produces:
  - `submitViaRelay(fetchImpl, contractId, func, auth): Promise<{ hash: string }>`
  - `makePasskeyExecutor(contractId: string, wallet: PasskeyWallet, send): TxExecutor`

> `lib/relayer.ts` göç yüzeyidir: managed'dan self-host'a geçiş yalnızca bu dosyayı ilgilendirir.

- [ ] **Step 1: Relayer istemcisi için failing test yaz**

```ts
// web/src/lib/relayer.test.ts
import { describe, it, expect, vi } from "vitest";
import { submitViaRelay } from "./relayer";

const ok = (body: unknown) =>
  vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(body) });
const fail = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue({ ok: false, status, json: () => Promise.resolve(body) });

describe("submitViaRelay", () => {
  it("posts the call to /api/relay and returns the hash", async () => {
    const f = ok({ hash: "abc123", status: "SUCCESS" });

    await expect(submitViaRelay(f, "CTREASURY", "FUNC", ["AUTH"])).resolves.toEqual({ hash: "abc123" });
    expect(f).toHaveBeenCalledWith("/api/relay", expect.objectContaining({ method: "POST" }));
  });

  it("turns a spent fee quota into an actionable message", async () => {
    const f = fail(429, { error: "FEE_LIMIT_EXCEEDED" });

    await expect(submitViaRelay(f, "CTREASURY", "FUNC", [])).rejects.toThrow(
      /can't send transactions right now/i,
    );
  });

  it("does not leak the raw server error", async () => {
    const f = fail(502, { error: "Relay failed." });

    await expect(submitViaRelay(f, "CTREASURY", "FUNC", [])).rejects.not.toThrow(/Relay failed\./);
  });
});
```

- [ ] **Step 2: Testin başarısız olduğunu gör**

```bash
cd web && npx vitest run src/lib/relayer.test.ts
```

Beklenen: FAIL — modül yok.

- [ ] **Step 3: Relayer istemcisini yaz**

```ts
// web/src/lib/relayer.ts
// The single migration surface: moving from OZ's managed Channels service to a self-hosted
// plugin changes this file and nothing else. fetch is injected so this unit-tests offline.

export type FetchLike = (url: string, init?: RequestInit) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

const QUOTA_MSG = "We can't send transactions right now — please try again shortly.";
const GENERIC_MSG = "Couldn't submit that transaction. Try again.";

export async function submitViaRelay(
  fetchImpl: FetchLike,
  contractId: string,
  func: string,
  auth: string[],
): Promise<{ hash: string }> {
  const res = await fetchImpl("/api/relay", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contractId, func, auth }),
  });

  const body = (await res.json().catch(() => ({}))) as { hash?: string; error?: string };

  if (!res.ok) {
    throw new Error(body.error === "FEE_LIMIT_EXCEEDED" ? QUOTA_MSG : GENERIC_MSG);
  }
  if (!body.hash) throw new Error(GENERIC_MSG);
  return { hash: body.hash };
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

```bash
cd web && npx vitest run src/lib/relayer.test.ts
```

Beklenen: 3 passed.

- [ ] **Step 5: `passkeyExecutor` için failing test ekle**

```ts
// web/src/lib/executor.test.ts — mevcut dosyanın sonuna
import { makePasskeyExecutor } from "./executor";

describe("makePasskeyExecutor", () => {
  const wallet = { create: vi.fn(), connect: vi.fn(), sign: vi.fn().mockResolvedValue("SIGNED") };

  it("carries the smart wallet contract id and marks the passkey path", () => {
    const ex = makePasskeyExecutor("CWALLET", wallet, vi.fn());
    expect(ex.address).toBe("CWALLET");
    expect(ex.kind).toBe("passkey");
  });

  it("signs through the passkey wallet", async () => {
    const ex = makePasskeyExecutor("CWALLET", wallet, vi.fn());
    const out = await ex.signer.signTransaction("XDR");
    expect(out).toEqual({ signedTxXdr: "SIGNED", signerAddress: "CWALLET" });
  });

  it("submits through the injected relay hook instead of RPC", async () => {
    const send = vi.fn().mockResolvedValue({ hash: "h1" });
    const ex = makePasskeyExecutor("CWALLET", wallet, send);

    await expect(ex.send!("CTREASURY", "FUNC", ["A"])).resolves.toEqual({ hash: "h1" });
    expect(send).toHaveBeenCalledWith("CTREASURY", "FUNC", ["A"]);
  });
});
```

- [ ] **Step 6: Testin başarısız olduğunu gör**

```bash
cd web && npx vitest run src/lib/executor.test.ts
```

Beklenen: FAIL — `makePasskeyExecutor` yok.

- [ ] **Step 7: `executor.ts`'e ekle**

```ts
// web/src/lib/executor.ts — dosyanın sonuna
import type { PasskeyWallet } from "./passkey";

/** The passkey path: the smart wallet signs, the relayer submits. */
export function makePasskeyExecutor(
  contractId: string,
  wallet: PasskeyWallet,
  send: (contractId: string, func: string, auth: string[]) => Promise<{ hash: string }>,
): TxExecutor {
  return {
    address: contractId,
    kind: "passkey",
    signer: {
      signTransaction: async (xdr) => ({
        signedTxXdr: await wallet.sign(xdr),
        signerAddress: contractId,
      }),
    },
    send,
  };
}
```

- [ ] **Step 8: Testlerin geçtiğini gör**

```bash
cd web && npx vitest run src/lib/executor.test.ts && npm test
```

Beklenen: 6 executor testi passed, suite yeşil.

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/relayer.ts web/src/lib/relayer.test.ts web/src/lib/executor.ts web/src/lib/executor.test.ts
git commit -m "feat(passkey): passkey executor submitting through the relay"
```

---

### Task 11: Submit yolunu executor'a aç

**Files:**
- Modify: `web/src/lib/walletKit.ts` (`connectPasskey` + `executorFor` ekle)
- Modify: `web/src/lib/userTreasury.ts` (submit merkezileştirme)
- Modify: `web/src/state/treasury.tsx` (14 `walletSignerFor` çağrısı → executor)

**Interfaces:**
- Consumes: `makeWalletExecutor` / `makePasskeyExecutor` (Task 9-10), `realPasskeyBackend` + `makePasskeyWallet` (Task 8), `submitViaRelay` (Task 10).
- Produces:
  - `connectPasskey(mode: "create" | "connect", userLabel?: string): Promise<string>`
  - `executorFor(address: string): TxExecutor`
  - `submitTx(tx, executor): Promise<unknown>` (`userTreasury.ts`) — Task 12 bunlara dokunmaz, sadece UI bağlar.

> **Bu task'ın asıl işi burada:** `userTreasury.ts` bugün submit'i `tx.signAndSend()` ile yapıyor (satır ~96, 159, 164, 175 ve devamı) — yani contract client kendi RPC'sine gönderiyor. Passkey yolunda bu relayer'a gitmeli. `signAndSend()` çağrılarını tek bir `submitTx` yardımcısından geçirmeden passkey submit yolu devreye girmez.

- [ ] **Step 1: `walletKit.ts`'e passkey bağlantısını ekle**

`connect()` fonksiyonunun hemen altına, aynı funnel enstrümantasyonuyla:

```ts
/** Passkey path. Same funnel contract as connect(), tagged walletId "passkey" so the two
 *  entry paths are directly comparable in funnel_events. */
export async function connectPasskey(mode: "create" | "connect", userLabel = "Eunomia user"): Promise<string> {
  logFunnel({ event: "connect_click", walletId: "passkey" });
  const wallet = makePasskeyWallet(realPasskeyBackend(), "Eunomia");
  try {
    const contractId = mode === "create" ? await wallet.create(userLabel) : await wallet.connect();
    connectedAddress = contractId;
    sessionStorage.setItem(ADDR_KEY, contractId);
    sessionStorage.setItem(WALLET_ID_KEY, "passkey");
    notifyAddress();
    logFunnel({ event: "connect_result", outcome: "success", walletId: "passkey" });
    return contractId;
  } catch (e) {
    logFunnel({ event: "connect_result", outcome: "error", walletId: "passkey", detail: errText(e) });
    throw e;
  }
}
```

Gerekli importları dosyanın başına ekle: `makePasskeyWallet, realPasskeyBackend` (`./passkey`).

- [ ] **Step 2: Executor'ı üret**

`walletSignerFor` fonksiyonunun yanına:

```ts
/** The executor for the current session — passkey sessions submit through the relay. */
export function executorFor(address: string): TxExecutor {
  if (sessionStorage.getItem(WALLET_ID_KEY) === "passkey") {
    const wallet = makePasskeyWallet(realPasskeyBackend(), "Eunomia");
    return makePasskeyExecutor(address, wallet, (contractId, func, auth) =>
      submitViaRelay(fetch as unknown as FetchLike, contractId, func, auth),
    );
  }
  return makeWalletExecutor(address, walletSignerFor(address));
}
```

- [ ] **Step 3: `userTreasury.ts`'te submit'i merkezileştir**

Dosyanın üstüne tek yardımcı ekle:

```ts
import type { TxExecutor } from "./executor";

/** Every state-changing call goes through here. The wallet path keeps the contract client's
 *  own RPC submission; the passkey path hands the built call to the relayer instead. */
export async function submitTx(
  tx: { signAndSend: () => Promise<unknown>; toXDR?: () => string },
  executor: TxExecutor,
  contractId: string,
): Promise<unknown> {
  if (!executor.send) return tx.signAndSend();      // wallet path — unchanged
  const xdr = tx.toXDR?.() ?? "";
  const signed = await executor.signer.signTransaction(xdr);
  return executor.send(contractId, signed.signedTxXdr, []);
}
```

Sonra `signAndSend()` çağrılarını (satır ~96, 159, 164, 175 ve devamı) `submitTx(tx, executor, contractId)` ile değiştir. İlgili fonksiyonlar (`deployTreasury`, `addPayee`, `removePayee`, `pay`, `setPaused`, `adminWithdraw`, `setLimits`, `setSession`, `revokeSession`) `signer` yerine `executor` parametresi alacak şekilde imzalarını günceller.

> `auth` dizisinin gerçek içeriği kit'in `sign()` dönüşüne bağlı — Task 8 Step 1'de okuduğun `.d.ts`'e göre doldurulur. Wallet yolunda bu satır hiç çalışmaz.

- [ ] **Step 4: `state/treasury.tsx`'i executor'a geçir**

`walletSignerFor(addr)` **14 çağrı noktasında** geçiyor (satır 104, 229, 243, 291, 317, 341, 376, 425, 471, 534, 563, 600, 629). Hepsini `executorFor(addr)` ile değiştir; `makeTreasury(id, addr, executor.signer)` şeklinde client'a signer verilmeye devam eder, submit ise Step 3'teki `submitTx` üzerinden executor'a bakar.

- [ ] **Step 5: Testleri koş — wallet yolunun bozulmadığını gör**

```bash
cd web && npx tsc -b && npm test && npm run lint
```

Beklenen: **183 + yeni testler**, kırmızı yok. Kırmızı varsa wallet yolunda davranış değişmiş demektir — Global Constraints ihlali, düzelt.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/walletKit.ts web/src/lib/userTreasury.ts web/src/state/treasury.tsx
git commit -m "feat(passkey): route submission through TxExecutor, relay for passkey sessions"
```

---

### Task 12: UI yüzeyleri — giriş kapısı, chip, kurulum, docs

**Files:**
- Modify: `web/src/components/Landing.tsx` (ikili CTA)
- Modify: `web/src/components/WalletChip.tsx` (passkey etiketi)
- Modify: `web/src/pages/Overview.tsx:177` (friendbot kapısı)
- Modify: `web/docs-site/` içindeki uygun sayfa (passkey notu)

**Interfaces:**
- Consumes: `connectPasskey` (Task 11), `passkeyCapability` (Task 7).
- Produces: —

- [ ] **Step 1: Giriş kapısını ikiye ayır**

`Landing.tsx`'te birincil CTA passkey, ikincil CTA mevcut modal:

```tsx
{capability !== "none" && (
  <button className="cta cta--primary" onClick={() => void connectPasskey("create")}>
    Passkey ile başla
    <span className="cta__hint">
      {capability === "platform" ? "Parmak izi, yüz ya da PIN" : "Telefonunla bağlan"}
    </span>
  </button>
)}
<button className="cta cta--ghost" onClick={() => void connect()}>Cüzdanım var</button>
```

`capability` mount'ta bir kez: `passkeyCapability(window).then(setCapability)`.

- [ ] **Step 2: `WalletChip`'te passkey oturumunu göster**

Adres gösterimi aynı kalır; oturum kaynağı `passkey` ise chip etiketi "Passkey" olur. "Disconnect" aynı `disconnect()`'i çağırır — ek iş yok.

- [ ] **Step 3: Friendbot kapısını passkey yolunda atla**

`Overview.tsx:177`'deki koşul bugün şu: `t.address && t.walletXlm !== undefined && needsFunding(t.walletXlm)`. Passkey kullanıcısının XLM'i hiç olmayacak (relayer ödüyor) — bu kutu ona sürekli görünür ve yanlış yönlendirir. Koşula oturum tipi eklenir: passkey oturumunda kutu çizilmez.

- [ ] **Step 4: Docs notunu ekle**

`web/docs-site/` altındaki uygun kavram sayfasına kısa bir bölüm:

> **Passkey wallets are tied to your device.** A passkey lives in your device's secure storage (or your password manager, if it syncs them). On testnet this costs you nothing — test XLM has no value. Before mainnet we will add a backup signer so a lost device never means lost funds.

- [ ] **Step 5: Tam kapı**

```bash
cd web && npx tsc -b && npm test && npm run lint && npm run build
```

Beklenen: hepsi yeşil.

- [ ] **Step 6: Commit**

```bash
git add web/src web/docs-site
git commit -m "feat(passkey): dual entry CTA, passkey chip, skip funding gate, docs note"
```

---

### Task 13: Aşama 2 kapısı — E2E ve canlı doğrulama

**Files:**
- Create: `web/e2e/passkey.spec.ts`

**Interfaces:**
- Consumes: Task 11 + Task 12.
- Produces: passkey akışının otomatik + gerçek cihaz kanıtı.

- [ ] **Step 1: Sanal authenticator'ın çalıştığını doğrula — bu adım ilk yapılacak iş**

```ts
// web/e2e/passkey.spec.ts
import { test, expect } from "@playwright/test";

test("passkey path creates a wallet with a virtual authenticator", async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true },
  });

  await page.goto("/");
  await page.getByRole("button", { name: /passkey ile başla/i }).click();

  await expect(page.getByText(/treasury|overview/i)).toBeVisible({ timeout: 30_000 });
});
```

```bash
cd web && npx playwright test e2e/passkey.spec.ts
```

**Çalışmazsa:** CDP `WebAuthn` domain'i bu Playwright/Chromium sürümünde kullanılamıyor demektir. O durumda bu spec silinir ve doğrulama Step 3'teki manuel yola düşer — planın geri kalanı etkilenmez. Bu kararı burada ver, sonraki adımlara taşıma.

- [ ] **Step 2: Mevcut smoke'un hâlâ yeşil olduğunu gör**

```bash
cd web && npm run test:e2e
```

Beklenen: Freighter/test-signer yolu bozulmamış.

- [ ] **Step 3: Preview'da gerçek cihaz doğrulaması (Bekir)**

```bash
cd web && vercel --cwd .
```

Preview URL'de Windows Hello ile: passkey oluştur → treasury kur → fonla → payee onayla → 1 ödeme → limit aşan 1 ödeme (reddedilmeli). Her adımın tx hash'ini not et.

- [ ] **Step 4: Zincirde doğrula**

Her hash'i `https://stellar.expert/explorer/testnet/tx/<hash>` üzerinde aç. Beklenen: ödemeler settled, limit aşımı kontrat tarafından reddedilmiş.

- [ ] **Step 5: Production deploy**

```bash
cd web && vercel --prod --cwd .
```

- [ ] **Step 6: Funnel'ı oku — passkey ile cüzdan yolunu karşılaştır**

```sql
select coalesce(wallet_id,'(none)') as path,
  count(distinct session_id) filter (where event='connect_click') as clicked,
  count(distinct session_id) filter (where event='connect_result' and outcome='success') as connected
from funnel_events
where created_at > now() - interval '7 days'
group by 1 order by clicked desc;
```

Taban çizgisi (2026-08-02): 251 session → 74 tıklama → 39 bağlantı; hataların 28'i "kullanıcı modalı kapattı".

- [ ] **Step 7: Kapıyı işaretle**

```bash
git commit --allow-empty -m "test: passkey gate green — e2e + real device run, tx <hash>"
```

---

### Task 14 (opsiyonel): `packages/prover` ölü bağımlılığını temizle

**Files:**
- Modify: `packages/prover/package.json`

**Interfaces:**
- Consumes: —
- Produces: —

> Bekir'in onayına bağlı. `prover` `@stellar/stellar-sdk`'yı hiç import etmiyor (`encode.ts` yorumda, `submit.ts` `stellar` CLI'ını child process sarmalıyor) — bağımlılık ölü. Silmek monorepo'daki sürüm tutarsızlığını kapatır, hiçbir satırı etkilemez.

- [ ] **Step 1: Kullanılmadığını bir kez daha doğrula**

```bash
cd packages/prover && grep -rn "@stellar/stellar-sdk" src/
```

Beklenen: **çıktı yok.** Çıktı varsa bu task iptal — bağımlılık canlı demektir.

- [ ] **Step 2: Kaldır**

```bash
cd packages/prover && npm uninstall @stellar/stellar-sdk
```

- [ ] **Step 3: Testin hâlâ geçtiğini gör**

```bash
cd packages/prover && npm test
```

Beklenen: `salt.test.ts` yeşil.

- [ ] **Step 4: Commit**

```bash
git add packages/prover/package.json packages/prover/package-lock.json
git commit -m "chore(prover): drop unused @stellar/stellar-sdk dependency"
```

---

## Aşama sonrası

- `README` traction bölümü passkey yolu canlıya çıkıp ilk dış kullanıcı geldiğinde güncellenir.
- Yedek signer / signer yönetimi mainnet dalgasına (T3) kalır — bu planın kapsamında değil.
- Tasarım dönüşümü bu plandan SONRA gelir; envanteri Task 12'nin dokunduğu yüzeyler belirler.
