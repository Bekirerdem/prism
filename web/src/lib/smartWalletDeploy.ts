// Deploying a contract *from* a smart wallet, rather than from a transaction source account.
//
// The ordinary path — the contract client's `Client.deploy` — deploys from whatever account
// the transaction is built on, and Soroban authorises that with SOURCE_ACCOUNT credentials.
// OpenZeppelin Channels submits from its own channel account and rejects that shape outright
// ("Detached address credentials required"), which is correct: a source-account signature
// would be the relayer's, not the user's.
//
// Naming the smart wallet as the deployer moves the authorisation onto the wallet's own
// C-address. Simulation then returns ADDRESS credentials — bound to the wallet, carrying a
// nonce — which the passkey can sign and the relayer is free to submit from anywhere.
//
// Measured on testnet before this was written: a G-address deployer yields
// `sorobanCredentialsSourceAccount`, a C-address deployer yields `sorobanCredentialsAddress`.
import {
  Account,
  Address,
  BASE_FEE,
  Operation,
  Transaction,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";

/** The one RPC capability this needs, narrowed so it unit-tests without a network. */
export interface SimulatingServer {
  simulateTransaction(tx: Transaction): Promise<{
    error?: string;
    result?: { retval?: xdr.ScVal; auth?: xdr.SorobanAuthorizationEntry[] };
  }>;
}

export interface SmartWalletDeployDeps {
  server: SimulatingServer;
  networkPassphrase: string;
  /** Any funded classic account. Simulation has to be built on *something*, and it is never
   *  submitted from here — the relayer builds the real transaction. Authorisation rides on
   *  the wallet's address credentials, so this account has no say over the deploy. */
  simulationSource: string;
  signAuthEntry: <T>(entry: T) => Promise<T>;
  relay: (func: string, auth: string[]) => Promise<{ hash?: string }>;
}

const PREPARE_FAILED = "That treasury couldn't be prepared — try again.";

/** 32 random bytes: the salt that makes a wallet's second treasury a different contract
 *  from its first. */
function freshSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

/** Deploy `wasmHash` with `walletAddress` as the deployer, returning the new contract id.
 *  The wallet signs; the relayer pays and submits. */
export async function deployFromSmartWallet(
  deps: SmartWalletDeployDeps,
  walletAddress: string,
  wasmHash: string,
  constructorArgs: xdr.ScVal[],
): Promise<string> {
  const op = Operation.createCustomContract({
    address: new Address(walletAddress),
    wasmHash: Buffer.from(wasmHash, "hex"),
    salt: freshSalt(),
    constructorArgs,
  });

  const tx = new TransactionBuilder(new Account(deps.simulationSource, "0"), {
    fee: BASE_FEE,
    networkPassphrase: deps.networkPassphrase,
  })
    .addOperation(op)
    .setTimeout(180)
    .build();

  const sim = await deps.server.simulateTransaction(tx);
  if (sim.error || !sim.result?.retval) {
    // The user-facing message stays one sentence; the reason belongs in the console, or a
    // live failure is indistinguishable from every other one.
    console.error("[deploy] simulation did not yield a contract:", sim.error ?? sim);
    throw new Error(PREPARE_FAILED);
  }

  // The chain names the contract during simulation, so there is no second implementation of
  // the id derivation to keep in step with the host's.
  const contractId = Address.fromScVal(sim.result.retval).toString();

  const signed = await Promise.all((sim.result.auth ?? []).map((e) => deps.signAuthEntry(e)));

  await deps.relay(
    op.body().invokeHostFunctionOp().hostFunction().toXDR("base64"),
    signed.map((e) => e.toXDR("base64")),
  );

  return contractId;
}
