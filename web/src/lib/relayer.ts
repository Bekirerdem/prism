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

const GENERIC_MSG = "Couldn't submit that transaction. Try again.";
const UNBUILT_MSG = "That transaction could not be prepared — try again.";
// A refusal is not a hiccup: the relay will answer the same way however many times it is
// asked. Saying "try again" there sends people in circles — a live user spent an evening
// retrying a deploy the relay was never going to sponsor.
const REFUSED_MSG = "We're not cleared to sponsor that transaction — that's on our side, not you. Retrying won't help.";
const UNCONFIGURED_MSG = "Fee sponsorship isn't configured right now, so we can't cover this transaction.";

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

async function post(fetchImpl: FetchLike, payload: unknown): Promise<{ hash?: string }> {
  const res = await fetchImpl("/api/relay", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = (await res.json().catch(() => ({}))) as { hash?: string; error?: string };

  if (!res.ok) {
    // The endpoint keeps its reasons to itself on purpose (its URL is public), but the status
    // and whatever it did say belong in the console — otherwise every relay failure looks the
    // same from here, which is how one live failure cost a whole round.
    console.error(`[relay] ${res.status}:`, body.error ?? "(no detail)");
    if (res.status === 403) throw new Error(REFUSED_MSG);
    if (res.status === 503) throw new Error(UNCONFIGURED_MSG);
    throw new Error(GENERIC_MSG);
  }
  return { hash: body.hash };
}

/** Submit a passkey-signed transaction through our relay proxy. */
export async function relayTx(fetchImpl: FetchLike, tx: AssembledLike): Promise<{ hash?: string }> {
  return post(fetchImpl, decode(tx));
}

/** Submit a host function and its signed auth entries directly. Deploying a treasury from a
 *  smart wallet builds its own operation rather than going through a contract client, so
 *  there is no assembled transaction here to decode. */
export async function relayHostFunction(
  fetchImpl: FetchLike,
  func: string,
  auth: string[],
): Promise<{ hash?: string }> {
  return post(fetchImpl, { func, auth });
}

/** Submit an already-signed transaction envelope — what passkey-kit hands back when it
 *  registers a passkey and deploys the smart wallet. */
export async function relayEnvelope(
  fetchImpl: FetchLike,
  xdr: string,
): Promise<{ hash?: string }> {
  return post(fetchImpl, { xdr });
}
