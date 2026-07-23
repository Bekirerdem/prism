# App Shell Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-card, form-stack Workspace with a real product app shell — sidebar navigation, Overview dashboard (balance hero + live limit instrument), and 5-section IA (Overview / Payments / Agent / Activity / Settings) — per `docs/superpowers/specs/2026-07-23-app-shell-redesign-design.md`.

**Architecture:** All treasury state/actions lift out of `Workspace.tsx` into a `TreasuryProvider` context; pages become thin presentational units under an `AppShell` (sidebar + topbar + mobile bottom tabs). Pure logic (routes, payee derivation, onboarding progress, feed filtering, treasury-list merge) lives in tested `lib/` modules. Hash routing is preserved with `#workspace → #overview` redirect.

**Tech Stack:** React 19 + Vite + TypeScript, framer-motion (mevcut), inline-style idiomu + `shell.css` (media queries), vitest, @stellar/stellar-sdk, Supabase (activity/funnel).

## Global Constraints

- Görsel dil AYNEN: bg `rgba(18,18,28,…)` kart dili, aksan `#FDDA24`, hata `#FF5D5D`, başarı `#00FF43`, soluk metin `#A0A0B8`/`#7C7C92`, display font `'Fraunces', Georgia, serif`, mono `ui-monospace`. Yeni component library/CSS framework YOK, yeni npm bağımlılığı YOK.
- İsim-bağımlı tema YOK (isim değişecek); ◭ mark ve mevcut copy tonu korunur. UI copy İngilizce.
- Her formda `lib/validate.ts` (`parseXlmAmount`, `isValidPaymentDest`) cüzdan popup'ından ÖNCE çalışır (Seyit'in PR #14 deseni geriye götürülemez).
- `createSession`'ın `registered:true` kurtarma yolu (session zincirde ama key fonlanamadı → secret yükle + revoke göster) Agent sayfasına aynen taşınır.
- Funnel (`logFunnel`) ve activity (`logActivity`) telemetri çağrıları mevcut noktalarında kalır; hiçbir aksiyondan silinmez.
- CI lint gate'i var: `npm run lint` 0 error vermeli. Yeni kodda `set-state-in-effect`/`refs` uyarısı ARTMAMALI (TreasuryProvider bu borcu azaltma fırsatı).
- Mevcut tüm vitest süitleri yeşil kalır; `contracts/**/test_snapshots` ASLA elle değiştirilmez/commit'lenmez (üretilmiş artifact).
- Commit: conventional commits, mantıksal birim başına; push PowerShell'den.
- Landing (`Landing.tsx`) ve Demo (`Dashboard.tsx`) İÇERİĞİNE dokunulmaz (chrome/nav entegrasyonu Task 15'te sadece sarmalar).
- Production deploy YOK bu planda — branch `feat/app-shell`; deploy zamanlaması Bekir kararı (24 Tem etkinliği).

## Dosya Haritası

```
web/src/
  lib/routes.ts (+test)          — hash↔view eşlemesi, #workspace redirect     [Task 1]
  lib/events.ts (değişir,+test)  — FeedEvent.treasuryId/payee; payee_add vb.   [Task 2]
  lib/activity.ts (değişir)      — activityToFeedEvent treasury_id taşır       [Task 2]
  lib/feedFilter.ts (+test)      — kind-grup + treasury filtresi                [Task 3]
  lib/payees.ts (+test)          — olaylardan payee seti + optimistic book      [Task 4]
  lib/onboarding.ts (+test)      — setupProgress                                [Task 5]
  state/toast.tsx (+test)        — ToastProvider/useToast (+kuyruk reducer)     [Task 6]
  lib/treasuryList.ts (+test)    — local ∪ registry merge                       [Task 7]
  state/treasury.tsx             — TreasuryProvider/useTreasury (Workspace'ten) [Task 7]
  components/shell/AppShell.tsx  — sidebar+topbar+bottom bar                    [Task 8]
  components/shell/shell.css     — layout + media query                         [Task 8]
  components/shell/TreasurySwitcher.tsx                                          [Task 8]
  lib/useAnalytics.ts            — Analytics.tsx veri mantığı hook'a            [Task 9]
  components/shell/StatStrip.tsx — 24h stat şeridi                              [Task 9]
  components/shell/RecentActivity.tsx                                            [Task 9]
  pages/Overview.tsx             — hero + quick actions + alt bölge             [Task 9]
  pages/Setup.tsx                — connect gate + kurulum sihirbazı             [Task 10]
  pages/Payments.tsx             — Send|Payees sekmeleri + history              [Task 11]
  pages/Agent.tsx                — Leash                                         [Task 12]
  pages/ActivityPage.tsx         — feed + filtre çipleri + load-more            [Task 13]
  pages/Settings.tsx             — treasury/limits/danger zone                  [Task 14]
  App.tsx (değişir)              — shell cutover; Workspace+AppNav emekli       [Task 15]
```

---

### Task 0: Branch

- [ ] **Step 1:** `git checkout -b feat/app-shell` (main = `2d4f3b2` üzerinden). Doğrula: `git status` temiz.

---

### Task 1: `lib/routes.ts` — hash↔view eşlemesi

**Files:** Create `web/src/lib/routes.ts`, `web/src/lib/routes.test.ts`

**Interfaces (Produces):**
```ts
export type AppPage = "overview" | "payments" | "agent" | "activity" | "settings";
export type View = AppPage | "landing" | "dashboard" | "wallet";
export const APP_PAGES: readonly AppPage[];
export function viewFromHash(hash: string): View;   // "#workspace"→"overview", bilinmeyen→"landing"
export function hashForView(v: View): string;        // "landing"→"", diğerleri→kendisi
export function isAppPage(v: View): v is AppPage;
```

- [ ] **Step 1: Failing test** — `routes.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { hashForView, isAppPage, viewFromHash } from "./routes";

describe("viewFromHash", () => {
  it("maps each app page", () => {
    for (const p of ["overview", "payments", "agent", "activity", "settings"])
      expect(viewFromHash(`#${p}`)).toBe(p);
  });
  it("redirects legacy #workspace to overview", () => {
    expect(viewFromHash("#workspace")).toBe("overview");
  });
  it("keeps dashboard and wallet", () => {
    expect(viewFromHash("#dashboard")).toBe("dashboard");
    expect(viewFromHash("#wallet")).toBe("wallet");
  });
  it("falls back to landing on unknown/empty", () => {
    expect(viewFromHash("")).toBe("landing");
    expect(viewFromHash("#nope")).toBe("landing");
  });
});
describe("hashForView", () => {
  it("round-trips", () => {
    expect(hashForView("landing")).toBe("");
    expect(hashForView("overview")).toBe("overview");
  });
});
describe("isAppPage", () => {
  it("splits app pages from standalone views", () => {
    expect(isAppPage("overview")).toBe(true);
    expect(isAppPage("dashboard")).toBe(false);
  });
});
```
- [ ] **Step 2:** `npm test -- routes` → FAIL (module yok).
- [ ] **Step 3: Implement**
```ts
export type AppPage = "overview" | "payments" | "agent" | "activity" | "settings";
export type View = AppPage | "landing" | "dashboard" | "wallet";

export const APP_PAGES = ["overview", "payments", "agent", "activity", "settings"] as const;
const STANDALONE = ["dashboard", "wallet"] as const;
const LEGACY: Record<string, View> = { workspace: "overview" };

export function viewFromHash(hash: string): View {
  const h = hash.replace(/^#/, "");
  if (h in LEGACY) return LEGACY[h];
  if ((APP_PAGES as readonly string[]).includes(h)) return h as AppPage;
  if ((STANDALONE as readonly string[]).includes(h)) return h as View;
  return "landing";
}
export function hashForView(v: View): string {
  return v === "landing" ? "" : v;
}
export function isAppPage(v: View): v is AppPage {
  return (APP_PAGES as readonly string[]).includes(v);
}
```
- [ ] **Step 4:** `npm test -- routes` → PASS. `npm run lint` → 0 error.
- [ ] **Step 5:** `git add … && git commit -m "feat(web): route map with legacy #workspace redirect"`

---

### Task 2: FeedEvent zenginleştirme — `treasuryId` + `payee`

**Files:** Modify `web/src/lib/events.ts` (FeedEvent alanları + formatEvent + fetchEventsPage), `web/src/lib/activity.ts` (activityToFeedEvent), test ekle: `events.test.ts`, `activity.test.ts` (mevcut dosyalara).

**Interfaces (Produces):** `FeedEvent` şu opsiyonel alanları kazanır: `treasuryId?: string` (olayın kontratı / activity satırının treasury_id'si), `payee?: string` (payee_add/payee_rm data'sı). `formatEvent` yeni kind'ları insan diliyle etiketler: `payee_add`, `payee_rm`, `paused`, `revoked`, `agent`.

- [ ] **Step 1: Failing testler** — `events.test.ts`'e ekle:
```ts
it("formats payee_add / payee_rm with the payee address", () => {
  expect(formatEvent(["payee_add"], "GABC…XYZ")).toEqual({
    kind: "payee_add",
    label: expect.stringContaining("whitelisted"),
  });
  expect(formatEvent(["payee_rm"], "GABC…XYZ").label).toContain("removed");
});
it("formats paused / revoked / agent lifecycle events", () => {
  expect(formatEvent(["paused"], true).label).toContain("paused");
  expect(formatEvent(["paused"], false).label).toContain("resumed");
  expect(formatEvent(["revoked"], null).label.toLowerCase()).toContain("leash");
});
```
`activity.test.ts`'e: `activityToFeedEvent` sonucu `treasuryId` alanını `row.treasury_id`'den taşır.
- [ ] **Step 2:** test FAIL doğrula.
- [ ] **Step 3: Implement** — `FeedEvent`'e `treasuryId?/payee?`; `formatEvent` switch'ine:
```ts
case "payee_add": return { kind, label: `Payee whitelisted: ${short(data)}` };
case "payee_rm":  return { kind, label: `Payee removed: ${short(data)}` };
case "paused":    return { kind, label: data ? "Treasury paused" : "Treasury resumed" };
case "revoked":   return { kind, label: "Leash revoked" };
case "agent":     return { kind, label: `Root agent rotated to ${short(data)}` };
```
`fetchEventsPage` map'inde: `treasuryId: e.contractId`, `payee: kind === "payee_add" || kind === "payee_rm" ? String(data) : undefined`. `activityToFeedEvent` dönüşüne `treasuryId: row.treasury_id ?? undefined`.
- [ ] **Step 4:** `npm test` tüm süit PASS (mevcut event testleri kırılmamalı — formatEvent default davranışı değişmedi).
- [ ] **Step 5:** commit `feat(web): feed events carry treasuryId and payee; label payee/lifecycle events`

---

### Task 3: `lib/feedFilter.ts`

**Files:** Create `web/src/lib/feedFilter.ts`, `web/src/lib/feedFilter.test.ts`

**Interfaces (Produces):**
```ts
export type KindGroup = "payments" | "blocked" | "fund" | "deploy" | "whitelist" | "leash" | "lifecycle" | "zk";
export const KIND_GROUPS: Record<KindGroup, readonly string[]>; // örn. payments:["paid"], whitelist:["whitelist","payee_add","payee_rm"], leash:["leash","revoked"], lifecycle:["lifecycle","paused","agent"], zk:["attested","escrowed","released","refunded"]
export interface FeedFilter { groups: ReadonlySet<KindGroup> | null; treasuryId: string | null } // null = filtre yok
export function filterFeed(events: FeedEvent[], f: FeedFilter): FeedEvent[];
export function groupOfKind(kind: string): KindGroup | null;
```

- [ ] **Step 1: Failing test** — kind→grup eşlemesi; grup filtresi; treasury filtresi (`treasuryId` alanı olmayan olaylar treasury filtresi aktifken ELENİR — platform geneli satırlar "benim treasury'm" görünümüne sızmasın); ikisi birlikte.
- [ ] **Step 2:** FAIL doğrula. **Step 3:** implement (saf, ~30 satır). **Step 4:** PASS + lint. **Step 5:** commit `feat(web): pure feed filtering by kind group and treasury`

---

### Task 4: `lib/payees.ts`

**Files:** Create `web/src/lib/payees.ts`, `web/src/lib/payees.test.ts`

**Kaynak gerçeği:** Kontrat `payee_add`/`payee_rm` olaylarını payee adresi data'sıyla yayınlar (`contracts/treasury/src/lib.rs:159,170`); enumeration getter YOK (yalnız `is_payee`). Liste = olay fold'u ∪ cihaz-yerel optimistic book; rozet = `is_payee` simülasyonu.

**Interfaces (Produces):**
```ts
export interface PayeeEntry { address: string; addedAt?: string; source: "chain" | "local" }
export function payeesFromEvents(events: FeedEvent[]): PayeeEntry[]; // id'ye göre kronolojik fold: payee_add→ekle, payee_rm→çıkar
export function mergePayees(chain: PayeeEntry[], local: string[]): PayeeEntry[]; // chain öncelikli, dupe'suz
export function loadPayeeBook(treasuryId: string): string[];           // localStorage `prism_payees_<id>`
export function rememberPayee(treasuryId: string, addr: string): void;
export function forgetPayee(treasuryId: string, addr: string): void;
```
`verifyPayee` ayrı yazılmaz — sayfa `makeTreasury(...).is_payee({payee})` simülasyonunu doğrudan çağırır (Task 11).

- [ ] **Step 1: Failing test** — add→listede; add sonra rm→yok; rm sonra tekrar add→var; sıralama olay `id`'sine göre (TOID artan = kronolojik); merge'de chain kaydı local dupe'unu yutar; book round-trip (localStorage mock: `vi.stubGlobal` yerine basit in-memory `Storage` şimi — mevcut `treasuryStore.test.ts`'teki desene bak ve aynısını kullan).
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS + lint. **Step 5:** commit `feat(web): payee list derived from chain events with local book fallback`

---

### Task 5: `lib/onboarding.ts`

**Files:** Create `web/src/lib/onboarding.ts`, `web/src/lib/onboarding.test.ts`

**Interfaces (Produces):**
```ts
export type SetupStep = "connect" | "deploy" | "fund" | "whitelist" | "pay";
export interface SetupInputs {
  connected: boolean; hasTreasury: boolean;
  balance: bigint | null;        // null = henüz okunmadı
  payeeCount: number | null; hasPaid: boolean;
}
export interface SetupProgress { steps: { step: SetupStep; done: boolean }[]; next: SetupStep | null; complete: boolean }
export function setupProgress(i: SetupInputs): SetupProgress; // next = sıradaki ilk yapılmamış adım
```

- [ ] **Step 1: Failing test** — boş kullanıcı→next "connect"; bağlı+treasury'siz→"deploy"; balance>0+payee 0→"whitelist"; hepsi→complete; balance null iken fund done sayılMAZ.
- [ ] **Step 2-5:** FAIL→implement (yukarıdaki spec'in fold'u, ~25 satır)→PASS→commit `feat(web): onboarding step progress calculator`

---

### Task 6: Toast sistemi

**Files:** Create `web/src/state/toast.tsx`, `web/src/state/toastQueue.ts` (saf reducer), `web/src/state/toastQueue.test.ts`

**Interfaces (Produces):**
```ts
// toastQueue.ts (saf):
export type ToastKind = "info" | "success" | "error";
export interface ToastItem { id: number; kind: ToastKind; msg: string; hash?: string }
export function pushToast(list: ToastItem[], t: Omit<ToastItem, "id">, nextId: number, cap?: number): ToastItem[]; // cap default 4, en eskisi düşer
export function dismissToast(list: ToastItem[], id: number): ToastItem[];
// toast.tsx:
export function ToastProvider({ children }): JSX.Element; // sağ-üstte stack render eder (topbar altı), success/info 5sn auto-dismiss, error kalıcı (x ile), hash varsa "view tx ↗" linki (EXPLORER)
export function useToast(): { toast(kind: ToastKind, msg: string, opts?: { hash?: string }): void };
```
Stil: mevcut `statusBox` dilinden (border 1px kind-rengi + `rgba(18,18,28,0.9)` zemin, 13.5px). framer-motion `AnimatePresence` ile giriş/çıkış (y: -8, opacity).

- [ ] **Step 1:** toastQueue testleri (push cap'i, dismiss, id artışı). **Step 2:** FAIL. **Step 3:** implement (reducer + provider). **Step 4:** PASS + lint + `npm run build` yeşil. **Step 5:** commit `feat(web): toast system (queue reducer + provider)`

---

### Task 7: `TreasuryProvider` + `lib/treasuryList.ts`

**Files:** Create `web/src/state/treasury.tsx`, `web/src/lib/treasuryList.ts`, `web/src/lib/treasuryList.test.ts`. (Workspace.tsx bu task'ta SİLİNMEZ — Task 15'e kadar yaşar; provider mantığı oradan KOPYALANIR.)

**treasuryList (saf):**
```ts
export interface TreasuryRef { id: string; registered: boolean }
export function mergeTreasuries(localIds: string[], registryIds: string[]): TreasuryRef[];
// registry kaynak-doğrusu: registry'dekiler registered:true; yalnız local'de olan registered:false; sıra: registry sırası + sonda local-only'ler; dupe yok
```
Test: kesişim, local-only işaretleme, boş girdiler.

**TreasuryProvider (Produces — sayfaların tek veri kaynağı):**
```ts
export interface TreasuryContextValue {
  address: string | null; treasuryId: string | null;
  state: PrismState | null; lifecycle: Lifecycle | null; legacy: boolean;
  sessionActive: boolean; sessionSecret: string | null;
  walletXlm: number | null | undefined; loading: boolean;
  busy: Busy;                       // Workspace'teki Busy tipi aynen taşınır
  refreshKey: number;               // StatStrip/feed yenilemesi için artan sayaç
  treasuries: TreasuryRef[];        // mergeTreasuries(local, discoverTreasuries(address))
  refresh(): Promise<void>;
  connect(): Promise<void>;         // kitConnect + funnel zaten walletKit içinde
  friendbot(): Promise<ActionOutcome>;
  deploy(daily: string, perTask: string): Promise<ActionOutcome>;
  openExisting(id: string): ActionOutcome;
  fund(amount: string): Promise<ActionOutcome>;
  whitelist(payee: string): Promise<ActionOutcome>;
  removePayeeAddr(payee: string): Promise<ActionOutcome>;   // removePayee ilk kez UI'a bağlanır
  spend(to: string, amount: string): Promise<ActionOutcome>;
  startLeash(cap: string, hours: string): Promise<ActionOutcome>;
  revokeLeash(): Promise<ActionOutcome>;
  runAutonomousTask(to: string): Promise<ActionOutcome>;
  togglePause(): Promise<ActionOutcome>;
  withdraw(to: string, amount: string): Promise<ActionOutcome>;
  updateLimits(daily: string, perTask: string): Promise<ActionOutcome>;
  switchTreasury(id: string): void; forgetTreasury(id: string): void;
}
export type ActionOutcome = { ok: boolean; msg: string; hash?: string; validation?: boolean };
// validation:true → cüzdan popup'ı hiç açılmadı; sayfa mesajı formun YANINDA gösterir, toast atılmaz.
export function TreasuryProvider({ children }): JSX.Element;
export function useTreasury(): TreasuryContextValue;
```

**Taşıma kuralları (Workspace.tsx → provider):**
- Her aksiyonun gövdesi Workspace'teki güncel (Seyit-sonrası) halinden birebir taşınır: `parseXlmAmount` ön-doğrulamaları (validation:true outcome olarak döner), `logActivity` çağrıları, `trackViolation`/`trackError`, `setRefreshKey`, `loadState` yenilemeleri.
- `create` = deploy + best-effort `registerTreasury` (iki cüzdan onayı deseni aynen).
- `startLeash` Seyit'in `res.registered` kurtarma dalını AYNEN içerir (secret yükle + state yenile + hata outcome'u).
- Durum mesajları: `setStatus` yerine → tx-progress/success/error `useToast().toast(...)`; validation hataları outcome ile sayfaya döner. Recovery/success metinleri Workspace'tekiyle aynı kalır ("Treasury deployed ✓ …" vb.).
- `onAddressChange` temizliği (adres değişince derived state sıfırlama) + registry-recovery effect'i (`discoverTreasuries` ile localStorage'sız cihazda son treasury'yi benimseme) provider'a taşınır.
- `switchTreasury(id)`: `setTreasuryId(address, id)` + state yeniden yükle (reload YOK). `forgetTreasury`: yalnız local map'ten siler; aktif treasury unutulursa kalan son kayıt devralır (mevcut `treasuryStore` davranışı korunur).
- Effect'ler `set-state-in-effect` uyarısını BÜYÜTMEden yazılır (mevcut desen korunur; fırsat varsa callback'e çekilir).

- [ ] **Step 1:** treasuryList testleri yaz → FAIL → implement → PASS.
- [ ] **Step 2:** `state/treasury.tsx`'i yukarıdaki sözleşmeyle yaz (Workspace'ten kopya + dönüşüm). `npm run build` + `npm run lint` yeşil (provider henüz mount edilmiyor; davranış testi Task 15 E2E'de).
- [ ] **Step 3:** commit `feat(web): TreasuryProvider — treasury state and actions lifted out of Workspace`

---

### Task 8: `AppShell` + `TreasurySwitcher`

**Files:** Create `web/src/components/shell/AppShell.tsx`, `web/src/components/shell/shell.css`, `web/src/components/shell/TreasurySwitcher.tsx`

**Interfaces:**
```ts
// AppShell.tsx
export default function AppShell({ page, onGo, children }: {
  page: View;                       // aktif view (sidebar highlight; dashboard/wallet'ta highlight yok)
  onGo: (v: View) => void;
  children: React.ReactNode;
}): JSX.Element;
```
**Yapı (spec kabuk wireframe'i):**
- Desktop ≥1024: `display:grid; grid-template-columns: 232px 1fr`. Sidebar: üstte ◭ brand (landing'e link), ortada 5 nav maddesi (aktif: sol 2px `#FDDA24` çubuk + `#EDEDF4` metin; pasif `#A0A0B8`), altta ayraç + "Guided demo" linki (`#dashboard`) + ⚠ Testnet badge (sarı ton kutu, `fundBox` dili) + "Docs ↗" (README linki).
- Topbar (grid sağ kolon üstü, sticky): solda `TreasurySwitcher`, sağda mevcut `WalletChip` (variant solid).
- Mobil <1024 (`shell.css` media query): sidebar `display:none`; üst bar: brand + switcher (kısaltılmış) + WalletChip; altta `position:fixed` bottom tab bar — 5 ikon+etiket (11px), aktif sarı. İçerik `padding-bottom: 76px` (bottom bar payı).
- Sınıf adları `shell__*` (appnav.css `anav__*` deseni gibi).

```ts
// TreasurySwitcher.tsx — useTreasury()'den treasuries + treasuryId + switchTreasury/forgetTreasury
// Kapalı: [◇ CBQQ…WCHZ ▾] mono chip. Açık (WalletChip menü deseni — dışarı tıkla kapan):
//   her satır: shortAddr(id) + ("not registered" soluk etiketi) + aktif ✓; satır tık = switch
//   satır hover'da "forget" (yalnız local siler; confirm YOK ama title açıklar)
//   altta ayraç + "New treasury" (→ Setup'a: treasuryId'yi null'a çekmez, `#overview`+setup görünür zaten yoksa; treasury varken gizli)
// Cüzdan bağlı değil / treasury yoksa: switcher yerine hiçbir şey (boş span) — Setup zaten kapıda.
```

- [ ] **Step 1:** shell.css + AppShell + TreasurySwitcher'ı yaz. Geçici olarak render doğrulaması: `npm run build` yeşil (mount Task 15'te).
- [ ] **Step 2:** `npm run lint` 0 error.
- [ ] **Step 3:** commit `feat(web): AppShell chrome — sidebar, topbar, mobile bottom tabs, treasury switcher`

---

### Task 9: Overview sayfası

**Files:** Create `web/src/lib/useAnalytics.ts`, `web/src/components/shell/StatStrip.tsx`, `web/src/components/shell/RecentActivity.tsx`, `web/src/pages/Overview.tsx`. Modify `web/src/components/Analytics.tsx` (veri mantığı hook'a çekilir, component hook'u kullanır — Demo'daki davranış değişmez).

**useAnalytics (Analytics.tsx'in effect'i taşınır, davranış birebir):**
```ts
export function useAnalyticsScore(contractId: string, refreshKey: number): {
  score: Score;                    // lib/analytics'teki mevcut skor tipi
  status: "loading" | "ready" | "error";
  truncated: boolean;
  refresh(): void;                 // tick artırır
};
// İç mantık AYNEN: loadLedger(contractId) başlangıcı, cursor devam etme (cursorRef),
// fetchAllEvents, recordEvents, truncated bayrağı, console.warn'lar. Analytics.tsx bu hook'u
// tüketen saf render'a iner (grid + Stat + truncated uyarısı aynı).
```

**RecentActivity:** `fetchActivityHistory(40)` → `filterFeed(events, { groups: null, treasuryId })` → ilk 5; `subscribeActivity` ile canlı ekleme (aynı filtre); satır: kind-renk nokta (blocked `#FF5D5D`, fund/deploy lime `#00FF43`, leash sarı, diğer nötr — ActivityFeed'deki mevcut renk eşlemesi neyse AYNISI) + label + `timeAgo` + tx linki. Altta "View all →" (`#activity`). Boş durum: "No activity yet — fund your treasury to get started."

**Overview.tsx (spec wireframe'i birebir):**
- `useTreasury()` + `useAnalyticsScore(treasuryId, refreshKey)` + `setupProgress(...)` (hasPaid = `score.payments > 0`; payeeCount = Task 4 türetmesinin uzunluğu — `payeesFromEvents(ledger)` + book merge).
- Stepper kartı: `!progress.complete` iken hero ÜSTÜNDE tek satır adım göstergesi (5 nokta+etiket, done ✓ sarı, next vurgulu + next-adım CTA butonu).
- HERO (asimetrik 7/5 grid, min-height ~55vh masaüstü): SOL — "BALANCE" label + `fmtXlm(state.balance)` Fraunces 56px (mobil 40px) + " XLM" 16px; durum çipleri satırı (● Active yeşil / ⏸ Paused kırmızı; Leash: none|active amber); mono treasury id + Copy + explorer ↗ (Workspace'teki copyId deseni). SAĞ — "TODAY — POLICY LIVE" paneli (balanceBox dili): daily bar (`daySpent/dailyLimit`, 8px yükseklik, dolum `#FDDA24`, aşan kısım işareti yok — bar max %100), altında "32.0 / 50 XLM today" + "per-payment ≤ 10 XLM" + "remaining today: N XLM" (`dailyLimit-daySpent`, negatifse 0) + blocked sayısı (`score.violations`).
- QUICK ACTIONS şeridi: `[+ Fund]` (primary; tıklayınca butonun altında inline panel: amount input + Fund butonu — `fund(amount)` outcome; validation mesajı panelde) · `[→ Send payment]` (ghost; `onGo("payments")`) · `[⚡ Start Leash]` (ghost; `onGo("agent")`; leash aktifse buton "Leash active →" olur).
- ALT BÖLGE (7/5): sol `RecentActivity`, sağ `StatStrip` (Payments / Spent 24h / Blocked / Payees — 2×2 mini grid, mevcut `Stat` görünümü).
- Yükleme: state null iken hero'da skeleton bloklar (`rgba(255,255,255,0.06)` yuvarlatılmış kutular + hafif pulse animasyonu, shell.css'te `@keyframes shellPulse`), "Reading treasury…" metni YOK.
- Cüzdan bakiye kapısı (walletXlm < MIN_XLM): Workspace'teki `fundBox` bloğu hero üstünde aynen (friendbot butonu `friendbot()` outcome→toast).

- [ ] **Step 1:** `useAnalytics.ts`'i çıkar, Analytics.tsx'i hook'a bağla → `npm test` (mevcut analytics testleri) + build yeşil → commit `refactor(web): extract analytics data loading into useAnalyticsScore hook`
- [ ] **Step 2:** StatStrip + RecentActivity + Overview'u yaz → build + lint yeşil → commit `feat(web): Overview page — balance hero, live limit instrument, quick actions, recent activity`

---

### Task 10: Setup sayfası (kapı + sihirbaz)

**Files:** Create `web/src/pages/Setup.tsx`

**Davranış:** `useTreasury()`; `!address` → KAPI: ortalanmış dar kart (◭ + "Your own bounded treasury on Stellar." tek cümle + `[Connect wallet]` primary (`connect()`, `connecting` durumunu WalletChip gibi butonda göster) + "watch the demo →" ghost link `#dashboard`). `address && !treasuryId` → SİHİRBAZ:
- Adım 0 (koşullu): friendbot kartı (Workspace `fundBox` aynen — `needsFunding(walletXlm)` iken).
- Adım 1 kartı "Set your limits": daily + per-payment inputları (default 50/10) + altında insan-dili açıklama: "Your agent can never spend more than the daily limit in any rolling 24h — the contract enforces it, not a promise." Canlı doğrulama: `parseXlmAmount` + per>daily inline hata.
- Adım 2 kartı "Deploy": `[Create treasury]` primary → `deploy(daily, perTask)`; buton altı iki-onay açıklaması (Workspace `hintRow` metni aynen: "① create … ② register — ② optional…"). Başarı → provider treasuryId set eder → App otomatik Overview'a düşer (Task 15 render kuralı).
- İkincil yol (ayraç altında, soluk): "Already have a treasury?" input + `[Open it]` (`openExisting` — StrKey validasyonu provider'da, hata inline).

- [ ] **Step 1:** Setup.tsx'i yaz → build + lint yeşil.
- [ ] **Step 2:** commit `feat(web): Setup — connect gate and treasury creation wizard`

---

### Task 11: Payments sayfası

**Files:** Create `web/src/pages/Payments.tsx`

**Yapı:** Üstte sekme çifti `[Send] [Payees]` (URL değişmez; yerel state).
- **Send:** "To" alanı = datalist'li input (önerisi: türetilmiş payee listesi; custom G…/M… adres de yazılabilir — `isValidPaymentDest` inline doğrular, C… adrese "contract addresses can't receive payments" hatası) + sample-vendor doldurma linki (SERVICE, Workspace'teki `inlineLink` deseni). "Amount" + altında CANLI bağlam satırı (soluk, 12px): "per-payment ≤ {fmtXlm(perTaskLimit)} XLM · {fmtXlm(dailyLimit-daySpent)} XLM left today"; amount > perTask ya da > kalan-günlük iken satır `#E0A106` uyarı tonuna döner (gönderme yine serbest — son söz kontratın; BLOCKED da ürünün kendisi). İmzacı çipi: sessionActive ? "agent session signs — no popup" (amber) : "wallet signs" (soluk). `[Send payment]` → `spend(to, amount)`; sessionActive && !sessionSecret hatası provider'dan outcome olarak gelir, inline gösterilir.
- **Send altı — Payment history:** `fetchActivityHistory(60)` + `filterFeed({groups: new Set(["payments","blocked"]), treasuryId})`; satır: tutar + yön + `settled ✓`/`BLOCKED` (kırmızı) + timeAgo + tx ↗. Boş: "No payments yet."
- **Payees:** liste = `mergePayees(payeesFromEvents(loadLedger(treasuryId)), loadPayeeBook(treasuryId))`; her satır mount'ta `is_payee` simülasyonuyla doğrulanır (`makeTreasury(treasuryId, address, walletSignerFor(address)).is_payee({payee})` — read-only, imza yok; sonuç: `verified ✓` yeşil / `not on whitelist` soluk) + `[remove]` ghost (→ `removePayeeAddr`, başarıda listeden düşer + `forgetPayee`). Altta add formu: adres input + `[Add payee]` → `whitelist(addr)`; başarıda `rememberPayee` + listeye optimistic ekle. Boş liste: "No payees yet — whitelist an address to start paying it."

- [ ] **Step 1:** Payments.tsx yaz → build + lint. **Step 2:** commit `feat(web): Payments — send with live limit context, payees management, history`

---

### Task 12: Agent sayfası

**Files:** Create `web/src/pages/Agent.tsx`

**Yapı:** `useTreasury()`. `legacy` → bilgi kartı (Workspace metni aynen). Leash AKTİF: durum paneli — agent `shortAddr`, cap barı (`spent/limit`, StatStrip bar dili), "expires in {countdown}" (1sn interval, `valid_until*1000 - now`; süre dolunca provider `refresh()`), key-cihaz durumu (`sessionSecret ? "key on this device" : "key elsewhere — revoke to spend from here"`); `[Run autonomous task]` (yalnız sessionSecret varken; `runAutonomousTask(to)` — to = payee listesinin ilki ?? SERVICE, buton etiketi Workspace'teki gibi hedefi söyler) + `[Revoke Leash]` ghost. PASİF: açıklama paragrafı (Workspace `hintRow` metni) + cap/duration inputları (default 25/24) + `[Start Leash]` → `startLeash`; `registered` kurtarma outcome'u error toast'la gelir ve panel aktif-görünüme geçer (provider halletti).

- [ ] **Step 1:** Agent.tsx yaz → build + lint. **Step 2:** commit `feat(web): Agent — leash status, start/revoke, autonomous task`

---

### Task 13: Activity sayfası (+ filtre çipleri, #6 kapsamı)

**Files:** Create `web/src/pages/ActivityPage.tsx`. Modify `web/src/components/ActivityFeed.tsx` (filtre prop'ları + load-more).

**Yapı:** ActivityFeed'e opsiyonel prop'lar: `filter?: FeedFilter`, `pageSize?: number` (default mevcut cap). Feed render'ından önce `filterFeed` uygulanır; `mergeFeedEvents`/poll/Realtime mantığına DOKUNULMAZ (filtre yalnız görünümde). Load-more: gösterilen satır sayısı state'i (`pageSize` artışlı "Load more" butonu; kaynak listeler zaten bellekteyken dilimleme yeterli — Supabase `fetchActivityHistory(limit)` çağrısı 120→240'a çıkan ikinci sayfa isteğiyle derinleşir). ActivityPage: çip satırı (All + 8 grup çipi; aktifler sarı kenarlı) + bağlıyken "my treasury only" toggle (treasuryId filtresi) + ActivityFeed. Çip/toggle state'i ActivityPage'de, ActivityFeed'e prop.

- [ ] **Step 1:** ActivityFeed prop + dilimleme değişikliği (davranış: prop'suz çağrı birebir eski görünüm — Demo/eski kullanım kırılmaz) → build + mevcut testler yeşil.
- [ ] **Step 2:** ActivityPage yaz → lint → commit `feat(web): Activity page — kind filters, my-treasury toggle, load more`

---

### Task 14: Settings sayfası

**Files:** Create `web/src/pages/Settings.tsx`

**Yapı:** üç bölüm (Section deseni):
- **Treasury:** tam ID mono (kırılabilir satır) + Copy + explorer ↗; registry durumu: `treasuries` içinde aktif id `registered:true` ise "Registered on-chain ✓", değilse uyarı + `[Register]` (yeni provider aksiyonu DEĞİL — `registerTreasury(address, walletSignerFor(address), treasuryId)` çağrısını burada yap, başarıda `logActivity(register)` + toast + `refresh()`; deploy'daki best-effort kaydın telafisi).
- **Limits:** mevcut değerler input default'u (`fmtXlm` ham sayıya çevrilmiş) + `[Update limits]` → `updateLimits`; inline validation.
- **Danger zone** (kırmızı kenarlı bölüm): Pause/Resume butonu (`togglePause`, paused iken açıklama "spending frozen; withdraw still works") + Withdraw (to default = cüzdan adresi placeholder'ı, amount) → `withdraw`.

- [ ] **Step 1:** Settings.tsx yaz → build + lint. **Step 2:** commit `feat(web): Settings — treasury identity, limits, danger zone`

---

### Task 15: App.tsx cutover — shell canlıya, Workspace/AppNav emekli

**Files:** Modify `web/src/App.tsx`, `web/src/components/WalletChip.tsx` (menüye "Wallet details" maddesi), `web/src/components/Landing.tsx` (yalnız `onWorkspace` hedef hash'i — içerik değişmez). Delete `web/src/components/Workspace.tsx`, `web/src/components/AppNav.tsx` (ve `appnav.css`'ten yalnız-AppNav sınıfları KALIR — WalletChip `anav__*` sınıflarını kullanıyor, css dosyası kalır).

**App.tsx yeni kurgu:**
- `viewFromHash`/`hashForView` artık `lib/routes`'tan (App içi kopyalar silinir). Hash listener aynı.
- Render: `landing` → Landing (aynen). Diğer TÜM view'lar → `<ToastProvider><TreasuryProvider><AppShell page={view} onGo={go}>{content}</AppShell></TreasuryProvider></ToastProvider>`; content: `overview` → (`!address || !treasuryId` ? `<Setup/>` : `<Overview onGo={go}/>`) · `payments|agent|settings` → treasury yoksa `<Setup/>` yoksa ilgili sayfa · `activity` → `<ActivityPage/>` (bağlantısız da çalışır) · `dashboard` → `<Dashboard onHome={…}/>` (içerik aynen, shell chrome içinde; sidebar'da "Guided demo" aktif görünür) · `wallet` → `<Wallet/>` (sidebar highlight yok). Lazy import düzeni korunur (`lazyWithReload`).
- AnimatePresence sayfa geçişleri korunur (mevcut fade desenleri).
- Landing `onWorkspace` → `go("overview")`; nav'daki "Open app" hedefi `#overview`.
- WalletChip menüsüne (bağlıyken) "Wallet details" maddesi → `window.location.hash = "wallet"`.
- **Spec sapması (bilinçli, Bekir'e raporlanır):** Demo ve Wallet view'ları da shell chrome'u içinde render edilir — iki ayrı nav sistemi yaşatmamak için AppNav tamamen emekli olur; Dashboard/Wallet İÇERİĞİ değişmez.

- [ ] **Step 1:** App.tsx'i yeniden yaz; Workspace.tsx + AppNav.tsx sil; kalan importları temizle (orphan taraması: `grep -r "Workspace\|AppNav" web/src`).
- [ ] **Step 2:** `npm test` TÜM süit + `npm run lint` + `npm run build` yeşil.
- [ ] **Step 3:** `npm run dev` ile lokal duman testi: landing → Open app → kapı → (cüzdansız kadar) hash geçişleri, `#workspace` redirect, mobil görünüm (devtools 375px).
- [ ] **Step 4:** commit `feat(web)!: app shell cutover — sidebar product chrome replaces Workspace card and AppNav`

---

### Task 16: Motion + craft pass (anayasa)

**Files:** Modify `pages/Overview.tsx`, `components/shell/*` (yalnız görsel katman)

- [ ] **Step 1:** Page-load stagger: Overview'da hero → quick actions → alt bölge `motion.div` sıralı `initial={{opacity:0, y:12}}` + `transition delay` kademeleri (Landing'deki ease eğrisi `[0.2, 0.7, 0.3, 1]`).
- [ ] **Step 2:** Balance sayı rulosu (mount'ta 0→değer, ~600ms, framer-motion `animate` + `useMotionValue`; reduced-motion'da atla) + daily bar dolum animasyonu (width % geçişi).
- [ ] **Step 3:** RecentActivity'ye yeni olay düşünce satır girişi (AnimatePresence, blocked ise kısa kırmızı arka plan flaşı → sönümlenir).
- [ ] **Step 4:** build + lint + test yeşil → commit `feat(web): load choreography and live-event motion on Overview`

---

### Task 17: Doğrulama + ayna kapısı + teslim

- [ ] **Step 1:** Tam süit: `npm test` (web) — tüm testler; `npm run lint` 0 error (warn sayısı cutover ÖNCESİNE eşit ya da az); `npm run build`.
- [ ] **Step 2:** Manuel E2E (testnet, gerçek Freighter, lokal dev server): connect → setup sihirbazı → deploy (+register) → fund → payee add (+verified rozeti) → pay (settled) → limit üstü pay (BLOCKED, Payments history'de kırmızı) → Leash start → autonomous task → revoke → switcher (ikinci treasury aç/geç) → Settings pause/resume + withdraw → `#workspace` redirect → Activity filtreleri.
- [ ] **Step 3:** 375px mobil tur (bottom bar, hero, sihirbaz) + masaüstü/mobil öncesi-sonrası screenshot'lar (`docs/screenshots/`e `appshell-*` adlarıyla).
- [ ] **Step 4:** AYNA KAPISI (screenshot üzerinden, Bekir'e göstermeden): göz ilk balance hero'ya mı gidiyor? 100 AI-dashboard'undan ayırt edilir mi? 3+ ardışık eşit-ağırlık bölge var mı? FAIL varsa düzelt, sonra Bekir'e sun.
- [ ] **Step 5:** `tasks/todo.md`'ye "Kova 4 — App Shell" bloğu (yapılanlar + kalan lint-warn borcu notu) + oturum sonunda dev server kapat.
- [ ] **Step 6:** Bekir onayı sonrası (ayrı karar): merge + `vercel --prod` (web/) + canlı doğrulama; Wave dashboard'ından #13/#6/#10 çekilmesi (Bekir).

## Self-Review Notları

- Spec kapsama: kabuk (T8), Overview (T9), Setup (T10), Payments+payee türetme (T4/T11), Agent (T12), Activity+filtre (T3/T13), Settings+register telafisi (T14), switcher (T7/T8), routing+redirect (T1/T15), toast/inline (T6), skeleton/empty (T9-14), motion (T16), doğrulama+ayna (T17). Analytics-sayfası kaldırma → hook'laştırma T9'da; Wallet nav kaldırma T15'te. Boşluk yok.
- Tip tutarlılığı: `ActionOutcome`, `TreasuryRef`, `FeedFilter`, `SetupProgress` tanımları tek yerde (T3/T5/T7) ve tüketicileri aynı adlarla çağırıyor.
- Bilinçli spec sapması T15'te işaretli (Demo/Wallet shell chrome'u içinde — AppNav tam emekli).
