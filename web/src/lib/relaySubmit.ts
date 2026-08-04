// Submitting a passkey-signed host function on the user's behalf.
//
// This used to go to OpenZeppelin Channels. It cannot any more: passkey-kit signs with
// CAP-0071-02 address-bound credentials (`sorobanCredentialsAddressV2`, Protocol 27) and the
// Channels plugin runs @stellar/stellar-sdk 14.6.1, which rejects that credential type while
// parsing — "unknown SorobanCredentialsType member for value 2". Measured directly against
// both SDKs; testnet itself is on Protocol 27, so the chain is not the laggard here. Until
// Channels catches up, every passkey-signed call has to be submitted by us.
//
// What this does NOT change: authorisation. The auth entries are signed by the user's passkey
// and bound to their smart wallet's address, so whoever sources the transaction has no say
// over what it may do. The fee account pays the fee and nothing else — no custody, and the
// admission gate in the caller still decides what is allowed through at all.
import {
  Account,
  BASE_FEE,
  Keypair,
  Operation,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";

/** The RPC surface this needs, narrowed so it unit-tests without a network. */
export interface SubmittingServer {
  getAccount(address: string): Promise<{ sequenceNumber(): string }>;
  simulateTransaction(tx: unknown): Promise<{
    error?: string;
    restorePreamble?: { transactionData?: unknown };
    transactionData?: { build(): xdr.SorobanTransactionData };
  }>;
  sendTransaction(tx: unknown): Promise<{ hash: string; status: string; errorResult?: unknown }>;
  getTransaction(hash: string): Promise<{ status: string }>;
}

export interface SubmitDeps {
  server: SubmittingServer;
  keypair: Keypair;
  networkPassphrase: string;
  /** How many times to ask whether the transaction made it into a ledger. */
  pollAttempts?: number;
  wait?: (ms: number) => Promise<void>;
}

export class RelaySubmitError extends Error {}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Build, sign and submit `func` with the caller's already-signed `auth` entries.
 *
 *  The auth entries are passed through untouched. Simulation is only asked for the footprint
 *  and resource fee — its own auth output is discarded, because replacing signed entries with
 *  freshly recorded ones would throw the user's signature away. */
export async function submitHostFunction(
  deps: SubmitDeps,
  func: xdr.HostFunction,
  auth: xdr.SorobanAuthorizationEntry[],
): Promise<{ hash: string; status: string }> {
  const address = deps.keypair.publicKey();
  const sequence = (await deps.server.getAccount(address)).sequenceNumber();

  const build = (sorobanData?: xdr.SorobanTransactionData) =>
    new TransactionBuilder(new Account(address, sequence), {
      fee: BASE_FEE,
      networkPassphrase: deps.networkPassphrase,
      ...(sorobanData ? { sorobanData } : {}),
    })
      .addOperation(Operation.invokeHostFunction({ func, auth }))
      .setTimeout(120)
      .build();

  // A fresh Account is built for each pass: TransactionBuilder.build() advances the sequence
  // it is handed, so reusing one would submit under a number the network has not reached.
  const sim = await deps.server.simulateTransaction(build());
  if (sim.error) throw new RelaySubmitError(`simulation failed: ${sim.error}`);
  if (sim.restorePreamble?.transactionData) {
    throw new RelaySubmitError("the contract's state is archived and needs restoring first");
  }
  if (!sim.transactionData) throw new RelaySubmitError("simulation returned no footprint");

  // Deliberately not rpc.assembleTransaction: it adds minResourceFee to the base fee, and
  // since stellar-base 14.1.0 build() adds the resource fee again — the fee comes out double.
  // Handing sorobanData to the builder counts it exactly once.
  const tx = build(sim.transactionData.build());
  tx.sign(deps.keypair);

  const sent = await deps.server.sendTransaction(tx);
  if (sent.status === "ERROR") {
    throw new RelaySubmitError(
      `the network rejected the transaction: ${JSON.stringify(sent.errorResult ?? {})}`,
    );
  }

  return { hash: sent.hash, status: await settle(deps, sent.hash, sent.status) };
}

/** Submit an already-signed transaction envelope — passkey-kit's smart-wallet deployment,
 *  which arrives complete because the kit's own deployer signed and pays for it. */
export async function submitEnvelope(
  deps: SubmitDeps,
  envelopeXdr: string,
): Promise<{ hash: string; status: string }> {
  const tx = TransactionBuilder.fromXDR(envelopeXdr, deps.networkPassphrase);
  const sent = await deps.server.sendTransaction(tx);
  if (sent.status === "ERROR") {
    throw new RelaySubmitError(
      `the network rejected the transaction: ${JSON.stringify(sent.errorResult ?? {})}`,
    );
  }
  return { hash: sent.hash, status: await settle(deps, sent.hash, sent.status) };
}

/** Wait briefly for a verdict. A transaction that is still pending is reported as such rather
 *  than called a success — the caller shows the user a treasury either way, and claiming one
 *  exists before the ledger agrees is how a failed deploy looks like a working one. */
async function settle(deps: SubmitDeps, hash: string, status: string): Promise<string> {
  const attempts = deps.pollAttempts ?? 8;
  const wait = deps.wait ?? sleep;

  let seen = status;
  for (let i = 0; i < attempts; i++) {
    await wait(1000);
    const { status: current } = await deps.server.getTransaction(hash);
    seen = current;
    if (current !== "NOT_FOUND" && current !== "PENDING") break;
  }

  if (seen === "FAILED") throw new RelaySubmitError("the transaction failed on chain");
  return seen;
}
