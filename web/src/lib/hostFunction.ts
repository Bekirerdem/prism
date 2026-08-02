// What the relay is actually being asked to do, read out of the transaction itself.
//
// The proxy must not trust a caller-supplied "this call goes to contract X" claim: anyone can
// post a permitted address alongside a different payload. Decoding the host function here means
// the admission check in relayGuard sees what the chain will see.
import { Address, TransactionBuilder, xdr } from "@stellar/stellar-sdk";

export type HostCall =
  | { kind: "invoke"; contractId: string }
  | { kind: "deploy"; wasmHash: string }
  | { kind: "other" };

const OTHER: HostCall = { kind: "other" };

/** Decode a base64 host function into the one fact the relay needs to admit or reject it.
 *  Anything we don't explicitly recognise — a raw wasm upload above all — comes back "other",
 *  which the caller rejects. */
export function classifyHostFunction(funcXdr: string): HostCall {
  let fn: xdr.HostFunction;
  try {
    fn = xdr.HostFunction.fromXDR(funcXdr, "base64");
  } catch {
    return OTHER;
  }

  switch (fn.switch().name) {
    case "hostFunctionTypeInvokeContract": {
      const address = fn.invokeContract().contractAddress();
      return { kind: "invoke", contractId: Address.fromScAddress(address).toString() };
    }
    case "hostFunctionTypeCreateContractV2":
    case "hostFunctionTypeCreateContract": {
      const args = fn.switch().name === "hostFunctionTypeCreateContractV2"
        ? fn.createContractV2()
        : fn.createContract();
      const executable = args.executable();
      if (executable.switch().name !== "contractExecutableWasm") return OTHER;
      return { kind: "deploy", wasmHash: executable.wasmHash().toString("hex") };
    }
    default:
      return OTHER;
  }
}

/** The host function inside a signed transaction envelope, or null when there isn't one.
 *
 *  passkey-kit's `createWallet` returns a fully signed deploy transaction rather than a bare
 *  host function, so the relay has to be able to look inside an envelope and apply the same
 *  admission rules. The network passphrase is irrelevant here — we are reading, not verifying
 *  signatures — so any valid one parses. */
export function hostFunctionFromEnvelope(envelopeXdr: string): string | null {
  let operations: ReadonlyArray<{ type: string; func?: xdr.HostFunction }>;
  try {
    const tx = TransactionBuilder.fromXDR(envelopeXdr, "Test SDF Network ; September 2015");
    operations = ("operations" in tx ? tx.operations : []) as typeof operations;
  } catch {
    return null;
  }

  const op = operations.find((o) => o.type === "invokeHostFunction");
  return op?.func ? op.func.toXDR("base64") : null;
}
