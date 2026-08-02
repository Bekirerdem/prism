// The single migration surface for fee sponsorship.
//
// Today this posts to our own /api/relay, which forwards to OpenZeppelin's managed Channels
// service. Moving to a self-hosted relayer changes the proxy's baseUrl and nothing here; the
// app never talks to the relay service directly, because the API key must not reach a browser.
//
// fetch is injected so the whole thing unit-tests offline.

export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/** Shown when OpenZeppelin's free fee quota for our key is spent (resets 24h after first use). */
export const RELAY_QUOTA_MSG = "We can't send transactions right now — please try again shortly.";
const GENERIC_MSG = "Couldn't submit that transaction. Try again.";
const UNBUILT_MSG = "That transaction could not be prepared — try again.";

interface XdrLike {
  toXDR: (format?: string) => string;
}

/** An assembled contract-client transaction, narrowed to the parts the relay reads. */
export interface AssembledLike {
  signAndSend?: () => Promise<unknown>;
  built?: { operations?: Array<{ func?: XdrLike; auth?: XdrLike[] }> };
}

/** Sign-free extraction of what the relay needs: the host function and its auth entries.
 *  The passkey has already filled the auth entries in by the time this runs. */
function decode(tx: AssembledLike): { func: string; auth: string[] } {
  const op = tx.built?.operations?.[0];
  if (!op?.func) throw new Error(UNBUILT_MSG);
  return {
    func: op.func.toXDR("base64"),
    auth: (op.auth ?? []).map((entry) => entry.toXDR("base64")),
  };
}

/** Submit a passkey-signed transaction through our relay proxy. */
export async function relayTx(
  fetchImpl: FetchLike,
  tx: AssembledLike,
): Promise<{ hash?: string }> {
  const { func, auth } = decode(tx);

  const res = await fetchImpl("/api/relay", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ func, auth }),
  });

  const body = (await res.json().catch(() => ({}))) as { hash?: string; error?: string };

  if (!res.ok) {
    throw new Error(body.error === "FEE_LIMIT_EXCEEDED" ? RELAY_QUOTA_MSG : GENERIC_MSG);
  }
  return { hash: body.hash };
}
