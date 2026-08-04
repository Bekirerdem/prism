import { describe, it, expect, vi } from "vitest";
import { relayTx } from "./relayer";

const b64 = (s: string) => ({ toXDR: () => s });

/** An assembled transaction as the contract client hands it over, after the passkey signed it. */
const assembled = (auth: string[] = ["AUTH1"]) => ({
  signAndSend: vi.fn(),
  built: { operations: [{ func: b64("FUNC"), auth: auth.map((a) => b64(a)) }] },
});

const respond = (ok: boolean, status: number, body: unknown) =>
  vi.fn().mockResolvedValue({ ok, status, json: () => Promise.resolve(body) });

describe("relayTx", () => {
  it("posts the decoded func and auth entries to our own relay endpoint", async () => {
    const fetchImpl = respond(true, 200, { hash: "abc123", status: "confirmed" });

    await expect(relayTx(fetchImpl, assembled())).resolves.toEqual({ hash: "abc123" });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/relay");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ func: "FUNC", auth: ["AUTH1"] });
  });

  it("sends an empty auth list rather than failing when there are no entries", async () => {
    const fetchImpl = respond(true, 200, { hash: "h" });
    await relayTx(fetchImpl, assembled([]));
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).auth).toEqual([]);
  });

  it("never leaks the raw server error", async () => {
    const fetchImpl = respond(false, 502, { error: "Relay failed." });
    await expect(relayTx(fetchImpl, assembled())).rejects.not.toThrow(/Relay failed\./);
  });

  it("fails clearly when the transaction was never built", async () => {
    const fetchImpl = respond(true, 200, { hash: "h" });
    await expect(relayTx(fetchImpl, { signAndSend: vi.fn() })).rejects.toThrow(/could not be prepared/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
