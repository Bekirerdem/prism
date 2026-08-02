import { describe, it, expect } from "vitest";
import { Address, Contract, Keypair, xdr } from "@stellar/stellar-sdk";
import { classifyHostFunction } from "./hostFunction";

const TREASURY = "CAYWNXHANRY5GSJAZOR4YTKBKNOKTCITE52ZRKDKCAWLDTYWFFVFSPAZ";
const WASM_HASH = "475cfbe2ca79d7977c8e4d29438ae70b9d95a12cb2bfcd9fed4e4f7a26d798b2";
// Derived from a fixed seed so the test stays deterministic; only its shape matters here.
const DEPLOYER = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1)).publicKey();

/** A real `invoke_contract` host function, built the way the contract client builds one. */
function invokeXdr(contractId: string): string {
  return new Contract(contractId).call("get_state").body().invokeHostFunctionOp().hostFunction().toXDR("base64");
}

/** A real `create_contract_v2` host function for deploying from an address. */
function createXdr(wasmHex: string): string {
  return xdr.HostFunction.hostFunctionTypeCreateContractV2(
    new xdr.CreateContractArgsV2({
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
          address: Address.fromString(DEPLOYER).toScAddress(),
          salt: Buffer.alloc(32),
        }),
      ),
      executable: xdr.ContractExecutable.contractExecutableWasm(Buffer.from(wasmHex, "hex")),
      constructorArgs: [],
    }),
  ).toXDR("base64");
}

/** Uploading arbitrary wasm through our fee quota must never be allowed. */
function uploadXdr(): string {
  return xdr.HostFunction.hostFunctionTypeUploadContractWasm(Buffer.from([0, 1, 2, 3])).toXDR("base64");
}

describe("classifyHostFunction", () => {
  it("reads the contract id out of an invoke, rather than trusting the caller", () => {
    expect(classifyHostFunction(invokeXdr(TREASURY))).toEqual({ kind: "invoke", contractId: TREASURY });
  });

  it("reads the wasm hash out of a deploy", () => {
    expect(classifyHostFunction(createXdr(WASM_HASH))).toEqual({ kind: "deploy", wasmHash: WASM_HASH });
  });

  it("refuses a raw wasm upload", () => {
    expect(classifyHostFunction(uploadXdr())).toEqual({ kind: "other" });
  });

  it("refuses input that is not a host function at all", () => {
    expect(classifyHostFunction("not-base64-xdr")).toEqual({ kind: "other" });
    expect(classifyHostFunction("")).toEqual({ kind: "other" });
  });
});
