// The single source of truth for the connected-user experience: wallet address, active
// treasury, on-chain state/lifecycle, and every treasury action — lifted out of the old
// Workspace so all shell pages read one context. Transaction progress/results surface as
// toasts; validation failures return `{ validation: true }` and render inline at the form.
import { useCallback, useEffect, useMemo, useState } from "react";
import { connect as kitConnect, walletSignerFor } from "../lib/walletKit";
import { useWalletAddress } from "../lib/useWalletAddress";
import {
  clearTreasuryId,
  getTreasuryId,
  listTreasuries,
  setActiveTreasury,
  setTreasuryId,
} from "../lib/treasuryStore";
import {
  addPayee,
  adminWithdraw,
  deployTreasury,
  fundTreasury,
  isValidContractId,
  makeTreasury,
  pay,
  readLifecycle,
  readState,
  removePayee,
  revokeSession,
  setLimits,
  setPaused,
  type Lifecycle,
  type PrismState,
} from "../lib/userTreasury";
import { SERVICE, shortAddr } from "../config";
import { fundWithFriendbot, getXlmBalance } from "../lib/funding";
import { connectErr, errText, sendErr } from "../lib/wallet-errors";
import { parseXlmAmount } from "../lib/validate";
import { trackError, trackViolation } from "../lib/analytics";
import { logActivity } from "../lib/activity";
import {
  clearSessionSecret,
  createSession,
  loadSessionSecret,
  sessionIsActive,
  sessionPay,
} from "../lib/session";
import { discoverTreasuries, registerTreasury } from "../lib/registry";
import { testSignerAvailable } from "../lib/testSigner";
import { mergeTreasuries } from "../lib/treasuryList";
import { useToast } from "./toastContext";
import { TreasuryContext, type ActionOutcome, type Busy, type TreasuryContextValue } from "./treasuryContext";

const fail = (msg: string): ActionOutcome => ({ ok: false, msg });
const invalid = (msg: string): ActionOutcome => ({ ok: false, msg, validation: true });

export function TreasuryProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();

  const address = useWalletAddress();
  const [treasuryId, setTreasuryIdState] = useState<string | null>(
    () => (address ? getTreasuryId(address) : null),
  );
  const [state, setState] = useState<PrismState | null>(null);
  const [lifecycle, setLifecycle] = useState<Lifecycle | null>(null);
  const [legacy, setLegacy] = useState(false);
  const [sessionSecret, setSessionSecret] = useState<string | null>(null);
  const [walletXlm, setWalletXlm] = useState<number | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [registryIds, setRegistryIds] = useState<string[]>([]);
  const [creatingNew, setCreatingNew] = useState(false);
  const [localIds, setLocalIds] = useState<string[]>(() => (address ? listTreasuries(address) : []));

  const [prevAddress, setPrevAddress] = useState(address);
  if (address !== prevAddress) {
    setPrevAddress(address);
    setTreasuryIdState(address ? getTreasuryId(address) : null);
    setState(null);
    setLifecycle(null);
    setLegacy(false);
    setSessionSecret(null);
    setWalletXlm(undefined);
    setRegistryIds([]);
    setLocalIds(address ? listTreasuries(address) : []);
  }

  const loadKey = address && treasuryId ? `${address}:${treasuryId}:${refreshKey}` : "";
  const [trackedLoadKey, setTrackedLoadKey] = useState("");
  if (loadKey !== trackedLoadKey) {
    setTrackedLoadKey(loadKey);
    setLoading(!!loadKey);
  }

  // The single-spender rule: while a session is active, payments must be signed
  // by the session key — the wallet's signature would be rejected on-chain.
  const sessionActive = !legacy && sessionIsActive(lifecycle?.session ?? null);

  const treasuries = useMemo(() => mergeTreasuries(localIds, registryIds), [localIds, registryIds]);

  const bump = useCallback(() => setRefreshKey((k) => k + 1), []);

  const loadState = useCallback(async (id: string, addr: string, opts?: { markLoading?: boolean }) => {
    if (opts?.markLoading !== false) setLoading(true);
    try {
      const t = makeTreasury(id, addr, walletSignerFor(addr));
      setState(await readState(t));
      // One probe decides v3 vs legacy: pre-M2 treasuries have no get_session/is_paused.
      const lc = await readLifecycle(t);
      setLifecycle(lc);
      setLegacy(lc === null);
      setSessionSecret(loadSessionSecret(id));
    } catch {
      setState(null);
      setLifecycle(null);
      toast("error", "Could not read this treasury — it may not exist on testnet.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const refreshWalletXlm = useCallback(async (addr: string) => {
    try {
      setWalletXlm(await getXlmBalance(addr));
    } catch {
      setWalletXlm(undefined);
    }
  }, []);

  const syncLocalIds = useCallback((addr: string | null) => {
    setLocalIds(addr ? listTreasuries(addr) : []);
  }, []);

  // Stay in sync with the global connection (nav chip connect/disconnect). On ANY
  // address change, clear everything derived from the previous wallet — otherwise a
  // stale session key, balance, or treasury list can leak into the new context.
  // (Handled during render via prevAddress above.)

  useEffect(() => {
    if (!address || !treasuryId) return;
    void (async () => {
      await loadState(treasuryId, address, { markLoading: false });
    })();
  }, [address, treasuryId, trackedLoadKey, loadState]);

  useEffect(() => {
    if (!address) return;
    void (async () => {
      await refreshWalletXlm(address);
    })();
  }, [address, refreshWalletXlm]);

  // Registry discovery: fills the switcher and (on a fresh device with no localStorage
  // mapping) adopts the latest registered treasury — M2 cross-device recovery.
  useEffect(() => {
    if (!address) return;
    let alive = true;
    (async () => {
      const found = await discoverTreasuries(address);
      if (!alive) return;
      setRegistryIds(found);
      if (!treasuryId && !creatingNew && found.length > 0) {
        const latest = found[found.length - 1];
        setTreasuryId(address, latest);
        setTreasuryIdState(latest);
        syncLocalIds(address);
        toast("success", `Recovered your treasury from the on-chain registry ✓ (${shortAddr(latest)})`);
      }
    })();
    return () => {
      alive = false;
    };
  }, [address, treasuryId, creatingNew, syncLocalIds, toast]);

  const refresh = useCallback(async (opts?: { markLoading?: boolean }) => {
    if (address && treasuryId) await loadState(treasuryId, address, opts);
    if (address) void refreshWalletXlm(address);
  }, [address, treasuryId, loadState, refreshWalletXlm]);

  // ---- actions ------------------------------------------------------------------

  const connect = useCallback(async () => {
    setBusy("connect");
    try {
      const addr = await kitConnect();
      setTreasuryIdState(getTreasuryId(addr));
      syncLocalIds(addr);
    } catch (e) {
      toast("error", connectErr(e));
    } finally {
      setBusy(null);
    }
  }, [syncLocalIds, toast]);

  const friendbot = useCallback(async (): Promise<ActionOutcome> => {
    if (!address) return fail("Connect a wallet first.");
    setBusy("friendbot");
    toast("info", "Requesting testnet XLM from friendbot…");
    try {
      await fundWithFriendbot(address);
      await refreshWalletXlm(address);
      const msg = "Wallet funded with testnet XLM ✓";
      toast("success", msg);
      return { ok: true, msg };
    } catch (e) {
      const msg = errText(e);
      toast("error", msg);
      return fail(msg);
    } finally {
      setBusy(null);
    }
  }, [address, refreshWalletXlm, toast]);

  const deploy = useCallback(
    async (daily: string, perTask: string): Promise<ActionOutcome> => {
      if (!address) return fail("Connect a wallet first.");
      // Validate before the wallet popup — an empty/NaN field would otherwise reach
      // toStroops(NaN) and throw an opaque "must be a non-negative number".
      const dailyLimit = parseXlmAmount(daily, "daily limit");
      if (!dailyLimit.ok) return invalid(dailyLimit.msg);
      const perTaskLimit = parseXlmAmount(perTask, "per-payment limit");
      if (!perTaskLimit.ok) return invalid(perTaskLimit.msg);
      // The v3 constructor rejects a self-contradicting policy on-chain — catch it
      // here first so the user gets a clear message instead of a failed deploy.
      if (perTaskLimit.value > dailyLimit.value) {
        return invalid("Per-payment limit can't exceed the daily limit.");
      }
      setBusy("deploy");
      toast("info", "Deploying your treasury — confirm in your wallet…");
      try {
        const id = await deployTreasury(address, walletSignerFor(address), dailyLimit.value, perTaskLimit.value);
        setTreasuryId(address, id);
        setTreasuryIdState(id);
        setCreatingNew(false);
        syncLocalIds(address);
        void logActivity({ walletAddress: address, treasuryId: id, action: "deploy" });
        // Best-effort on-chain registration (a second wallet prompt). A decline only
        // means this device's localStorage stays the sole copy of the id.
        // E2E runs must never touch the registry — it feeds the user-count evidence,
        // and throwaway Playwright wallets were inflating it (docs/metrics/e2e-exclude.json).
        let registered = false;
        if (!testSignerAvailable()) {
          try {
            toast("info", "Registering on-chain for cross-device recovery — confirm in your wallet…");
            await registerTreasury(address, walletSignerFor(address), id);
            registered = true;
            setRegistryIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
            void logActivity({ walletAddress: address, treasuryId: id, action: "register" });
          } catch {
            /* declined / RPC hiccup — the localStorage mapping still works */
          }
        }
        const msg = registered
          ? "Treasury deployed ✓ and registered on-chain — recoverable from any device."
          : "Treasury deployed ✓ — on-chain registration was skipped, so your ID is the only key to this treasury: copy it now.";
        toast("success", msg);
        return { ok: true, msg };
      } catch (e) {
        const msg = sendErr(e);
        toast("error", msg);
        return fail(msg);
      } finally {
        setBusy(null);
      }
    },
    [address, syncLocalIds, toast],
  );

  const openExisting = useCallback(
    (raw: string): ActionOutcome => {
      if (!address) return fail("Connect a wallet first.");
      const id = raw.trim();
      if (!isValidContractId(id)) {
        return invalid("That doesn't look like a treasury contract ID — it starts with C and is 56 characters long.");
      }
      setTreasuryId(address, id);
      setTreasuryIdState(id);
      setCreatingNew(false);
      syncLocalIds(address);
      return { ok: true, msg: "" };
    },
    [address, syncLocalIds],
  );

  const fund = useCallback(
    async (amount: string): Promise<ActionOutcome> => {
      if (!address || !treasuryId) return fail("No treasury open.");
      const amt = parseXlmAmount(amount);
      if (!amt.ok) return invalid(amt.msg);
      setBusy("fund");
      toast("info", "Funding — confirm in your wallet…");
      try {
        const hash = await fundTreasury(treasuryId, address, walletSignerFor(address), amt.value);
        void logActivity({ walletAddress: address, treasuryId, action: "fund", txHash: hash, amountXlm: amt.value });
        toast("success", "Funded ✓", { hash });
        bump();
        await loadState(treasuryId, address);
        void refreshWalletXlm(address);
        return { ok: true, msg: "Funded ✓", hash };
      } catch (e) {
        const msg = sendErr(e);
        toast("error", msg);
        return fail(msg);
      } finally {
        setBusy(null);
      }
    },
    [address, treasuryId, bump, loadState, refreshWalletXlm, toast],
  );

  const whitelist = useCallback(
    async (payeeAddr: string): Promise<ActionOutcome> => {
      if (!address || !treasuryId) return fail("No treasury open.");
      const p = payeeAddr.trim();
      if (!p) return invalid("Enter a payee address.");
      setBusy("whitelist");
      toast("info", "Whitelisting payee — confirm in your wallet…");
      try {
        const t = makeTreasury(treasuryId, address, walletSignerFor(address));
        await addPayee(t, p);
        void logActivity({ walletAddress: address, treasuryId, action: "whitelist" });
        const msg = `Payee whitelisted: ${shortAddr(p)}`;
        toast("success", msg);
        bump();
        return { ok: true, msg };
      } catch (e) {
        const msg = sendErr(e);
        toast("error", msg);
        return fail(msg);
      } finally {
        setBusy(null);
      }
    },
    [address, treasuryId, bump, toast],
  );

  const removePayeeAddr = useCallback(
    async (payeeAddr: string): Promise<ActionOutcome> => {
      if (!address || !treasuryId) return fail("No treasury open.");
      setBusy("removePayee");
      toast("info", "Removing payee — confirm in your wallet…");
      try {
        const t = makeTreasury(treasuryId, address, walletSignerFor(address));
        await removePayee(t, payeeAddr.trim());
        const msg = `Payee removed: ${shortAddr(payeeAddr)}`;
        toast("success", msg);
        bump();
        return { ok: true, msg };
      } catch (e) {
        const msg = sendErr(e);
        toast("error", msg);
        return fail(msg);
      } finally {
        setBusy(null);
      }
    },
    [address, treasuryId, bump, toast],
  );

  const spend = useCallback(
    async (to: string, amount: string): Promise<ActionOutcome> => {
      if (!address || !treasuryId) return fail("No treasury open.");
      const amt = parseXlmAmount(amount);
      if (!amt.ok) return invalid(amt.msg);
      if (sessionActive && !sessionSecret) {
        return invalid(
          "An agent session is active but its key isn't on this device — revoke the session (Agent page) to spend with your wallet.",
        );
      }
      setBusy("spend");
      toast("info", sessionActive ? "Sending payment — signed by the session agent…" : "Sending payment — confirm in your wallet…");
      try {
        // Single-spender rule: an active session's key signs instead of the wallet.
        const res =
          sessionActive && sessionSecret
            ? await sessionPay(treasuryId, sessionSecret, BigInt(Date.now()), to.trim(), amt.value)
            : await pay(
                makeTreasury(treasuryId, address, walletSignerFor(address)),
                BigInt(Date.now()),
                to.trim(),
                amt.value,
              );
        if (res.ok) {
          void logActivity({
            walletAddress: address,
            treasuryId,
            action: sessionActive ? "agent_pay" : "pay",
            txHash: res.hash,
            amountXlm: amt.value,
          });
          const msg = sessionActive
            ? "Payment settled ✓ — signed by the session agent, no wallet popup."
            : "Payment settled ✓";
          toast("success", msg, { hash: res.hash });
          bump();
          await loadState(treasuryId, address);
          return { ok: true, msg, hash: res.hash };
        }
        trackViolation(treasuryId);
        void logActivity({ walletAddress: address, treasuryId, action: "reject", amountXlm: amt.value });
        const msg = `Blocked by policy: ${res.errorMessage}`;
        toast("error", msg);
        await loadState(treasuryId, address);
        return fail(msg);
      } catch (e) {
        trackError(treasuryId, errText(e)); // raw message for monitoring; the classified one for the user
        const msg = sendErr(e);
        toast("error", msg);
        return fail(msg);
      } finally {
        setBusy(null);
      }
    },
    [address, treasuryId, sessionActive, sessionSecret, bump, loadState, toast],
  );

  const startLeash = useCallback(
    async (cap: string, hours: string): Promise<ActionOutcome> => {
      if (!address || !treasuryId) return fail("No treasury open.");
      const capV = parseXlmAmount(cap, "session cap");
      if (!capV.ok) return invalid(capV.msg);
      const hoursV = parseXlmAmount(hours, "duration");
      if (!hoursV.ok) return invalid(hoursV.msg);
      setBusy("session");
      toast("info", "Starting agent session — confirm in your wallet…");
      try {
        const t = makeTreasury(treasuryId, address, walletSignerFor(address));
        const res = await createSession(t, treasuryId, capV.value, hoursV.value, (phase) =>
          toast(
            "info",
            phase === "registering"
              ? "Registering the session — confirm in your wallet…"
              : "Funding the agent's key on testnet…",
          ),
        );
        if (res.ok) {
          setSessionSecret(loadSessionSecret(treasuryId));
          void logActivity({ walletAddress: address, treasuryId, action: "session_start", txHash: res.hash });
          const msg = "Agent session started ✓ — payments now sign without wallet popups.";
          toast("success", msg, { hash: res.hash });
          await loadState(treasuryId, address);
          return { ok: true, msg, hash: res.hash };
        }
        if (res.registered) {
          // Session is live on-chain but its key couldn't be funded. Load the saved secret
          // and refresh state so the UI matches the chain (active session + revoke control).
          setSessionSecret(loadSessionSecret(treasuryId));
          void logActivity({ walletAddress: address, treasuryId, action: "session_start" });
          const msg = res.errorMessage ?? "Session registered but its key couldn't be funded — revoke it and start a new one.";
          toast("error", msg);
          await loadState(treasuryId, address);
          return fail(msg);
        }
        const msg = `Blocked: ${res.errorMessage}`;
        toast("error", msg);
        return fail(msg);
      } catch (e) {
        const msg = sendErr(e);
        toast("error", msg);
        return fail(msg);
      } finally {
        setBusy(null);
      }
    },
    [address, treasuryId, loadState, toast],
  );

  const revokeLeash = useCallback(async (): Promise<ActionOutcome> => {
    if (!address || !treasuryId) return fail("No treasury open.");
    setBusy("revoke");
    toast("info", "Revoking session — confirm in your wallet…");
    try {
      const t = makeTreasury(treasuryId, address, walletSignerFor(address));
      const res = await revokeSession(t);
      if (res.ok) {
        clearSessionSecret(treasuryId);
        setSessionSecret(null);
        void logActivity({ walletAddress: address, treasuryId, action: "session_revoke", txHash: res.hash });
        const msg = "Session revoked ✓ — your wallet is the spender again.";
        toast("success", msg, { hash: res.hash });
        await loadState(treasuryId, address);
        return { ok: true, msg, hash: res.hash };
      }
      const msg = `Blocked: ${res.errorMessage}`;
      toast("error", msg);
      return fail(msg);
    } catch (e) {
      const msg = sendErr(e);
      toast("error", msg);
      return fail(msg);
    } finally {
      setBusy(null);
    }
  }, [address, treasuryId, loadState, toast]);

  const runAutonomousTask = useCallback(
    async (to?: string): Promise<ActionOutcome> => {
      if (!address || !treasuryId || !sessionSecret) return fail("No active session key on this device.");
      const dest = (to ?? "").trim() || SERVICE;
      setBusy("task");
      toast("info", "Agent is paying autonomously — no wallet popup…");
      try {
        const res = await sessionPay(treasuryId, sessionSecret, BigInt(Date.now()), dest, 1);
        if (res.ok) {
          void logActivity({ walletAddress: address, treasuryId, action: "agent_pay", txHash: res.hash, amountXlm: 1 });
          const msg = `Agent paid 1 XLM to ${shortAddr(dest)} autonomously ✓ — the contract enforced the policy.`;
          toast("success", msg, { hash: res.hash });
          bump();
          await loadState(treasuryId, address);
          return { ok: true, msg, hash: res.hash };
        }
        trackViolation(treasuryId);
        void logActivity({ walletAddress: address, treasuryId, action: "reject", amountXlm: 1 });
        const msg = `Blocked by policy: ${res.errorMessage}`;
        toast("error", msg);
        await loadState(treasuryId, address);
        return fail(msg);
      } catch (e) {
        trackError(treasuryId, errText(e));
        const msg = sendErr(e);
        toast("error", msg);
        return fail(msg);
      } finally {
        setBusy(null);
      }
    },
    [address, treasuryId, sessionSecret, bump, loadState, toast],
  );

  const togglePause = useCallback(async (): Promise<ActionOutcome> => {
    if (!address || !treasuryId || !lifecycle) return fail("No treasury open.");
    const next = !lifecycle.paused;
    setBusy("pause");
    toast("info", `${next ? "Pausing" : "Resuming"} — confirm in your wallet…`);
    try {
      const t = makeTreasury(treasuryId, address, walletSignerFor(address));
      const res = await setPaused(t, next);
      if (res.ok) {
        void logActivity({ walletAddress: address, treasuryId, action: "pause" });
        const msg = next ? "Treasury paused — spending is frozen." : "Treasury resumed ✓";
        toast("success", msg, { hash: res.hash });
        await loadState(treasuryId, address);
        return { ok: true, msg, hash: res.hash };
      }
      const msg = res.errorMessage ?? "Pause toggle failed.";
      toast("error", msg);
      return fail(msg);
    } catch (e) {
      const msg = sendErr(e);
      toast("error", msg);
      return fail(msg);
    } finally {
      setBusy(null);
    }
  }, [address, treasuryId, lifecycle, loadState, toast]);

  const withdraw = useCallback(
    async (to: string, amount: string): Promise<ActionOutcome> => {
      if (!address || !treasuryId) return fail("No treasury open.");
      const amt = parseXlmAmount(amount);
      if (!amt.ok) return invalid(amt.msg);
      setBusy("withdraw");
      toast("info", "Withdrawing — confirm in your wallet…");
      try {
        const t = makeTreasury(treasuryId, address, walletSignerFor(address));
        const res = await adminWithdraw(t, to.trim() || address, amt.value);
        if (res.ok) {
          void logActivity({ walletAddress: address, treasuryId, action: "withdraw", txHash: res.hash, amountXlm: amt.value });
          toast("success", "Withdrawn ✓", { hash: res.hash });
          bump();
          await loadState(treasuryId, address);
          void refreshWalletXlm(address);
          return { ok: true, msg: "Withdrawn ✓", hash: res.hash };
        }
        const msg = `Blocked: ${res.errorMessage}`;
        toast("error", msg);
        return fail(msg);
      } catch (e) {
        const msg = sendErr(e);
        toast("error", msg);
        return fail(msg);
      } finally {
        setBusy(null);
      }
    },
    [address, treasuryId, bump, loadState, refreshWalletXlm, toast],
  );

  const updateLimits = useCallback(
    async (daily: string, perTask: string): Promise<ActionOutcome> => {
      if (!address || !treasuryId) return fail("No treasury open.");
      const dailyLimit = parseXlmAmount(daily, "daily limit");
      if (!dailyLimit.ok) return invalid(dailyLimit.msg);
      const perTaskLimit = parseXlmAmount(perTask, "per-payment limit");
      if (!perTaskLimit.ok) return invalid(perTaskLimit.msg);
      if (perTaskLimit.value > dailyLimit.value) {
        return invalid("Per-payment limit can't exceed the daily limit.");
      }
      setBusy("limits");
      toast("info", "Updating limits — confirm in your wallet…");
      try {
        const t = makeTreasury(treasuryId, address, walletSignerFor(address));
        const res = await setLimits(t, dailyLimit.value, perTaskLimit.value);
        if (res.ok) {
          void logActivity({ walletAddress: address, treasuryId, action: "limits" });
          const msg = "Limits updated ✓ — effective immediately.";
          toast("success", msg, { hash: res.hash });
          await loadState(treasuryId, address);
          return { ok: true, msg, hash: res.hash };
        }
        const msg = `Blocked: ${res.errorMessage}`;
        toast("error", msg);
        return fail(msg);
      } catch (e) {
        const msg = sendErr(e);
        toast("error", msg);
        return fail(msg);
      } finally {
        setBusy(null);
      }
    },
    [address, treasuryId, loadState, toast],
  );

  // Catch-up registration for a treasury whose deploy-time registration was skipped.
  const registerActive = useCallback(async (): Promise<ActionOutcome> => {
    if (!address || !treasuryId) return fail("No treasury open.");
    setBusy("register");
    toast("info", "Registering on-chain — confirm in your wallet…");
    try {
      await registerTreasury(address, walletSignerFor(address), treasuryId);
      setRegistryIds((ids) => (ids.includes(treasuryId) ? ids : [...ids, treasuryId]));
      void logActivity({ walletAddress: address, treasuryId, action: "register" });
      const msg = "Registered on-chain ✓ — recoverable from any device.";
      toast("success", msg);
      return { ok: true, msg };
    } catch (e) {
      const msg = sendErr(e);
      toast("error", msg);
      return fail(msg);
    } finally {
      setBusy(null);
    }
  }, [address, treasuryId, toast]);

  const switchTreasury = useCallback(
    (id: string) => {
      if (!address || id === treasuryId) return;
      setCreatingNew(false);
      setTreasuryId(address, id); // adds if unknown (registry-only entries), sets active
      setTreasuryIdState(id);
      setState(null);
      setLifecycle(null);
      setLegacy(false);
      setSessionSecret(null);
      syncLocalIds(address);
      bump();
    },
    [address, treasuryId, syncLocalIds, bump],
  );

  // Forget is local-only (the contract lives on regardless). treasuryStore can only
  // drop the ACTIVE id, so forgetting another row briefly makes it active, drops it,
  // then restores the previous selection.
  const forgetTreasury = useCallback(
    (id: string) => {
      if (!address) return;
      const previous = treasuryId;
      if (id === previous) {
        clearTreasuryId(address);
        const next = getTreasuryId(address);
        setTreasuryIdState(next);
        setState(null);
        setLifecycle(null);
        setSessionSecret(null);
      } else {
        setActiveTreasury(address, id);
        clearTreasuryId(address);
        if (previous) setActiveTreasury(address, previous);
      }
      syncLocalIds(address);
    },
    [address, treasuryId, syncLocalIds],
  );

  const value: TreasuryContextValue = {
    address,
    treasuryId,
    state,
    lifecycle,
    legacy,
    sessionActive,
    sessionSecret,
    walletXlm,
    loading,
    busy,
    refreshKey,
    treasuries,
    refresh,
    connect,
    friendbot,
    deploy,
    openExisting,
    fund,
    whitelist,
    removePayeeAddr,
    spend,
    startLeash,
    revokeLeash,
    runAutonomousTask,
    togglePause,
    withdraw,
    updateLimits,
    registerActive,
    switchTreasury,
    forgetTreasury,
    creatingNew,
    startNewTreasury: () => setCreatingNew(true),
    cancelNewTreasury: () => setCreatingNew(false),
  };

  return <TreasuryContext.Provider value={value}>{children}</TreasuryContext.Provider>;
}
