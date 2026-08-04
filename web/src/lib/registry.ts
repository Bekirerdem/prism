// On-chain treasury discovery (M2): after a deploy we best-effort register the
// treasury under the owner's wallet in the TreasuryRegistry contract, and on a
// fresh device we can recover it with an unsigned simulation — localStorage is
// no longer the only copy of "which treasury is mine".
import { Client } from "./registryClient";
import { isValidContractId } from "./userTreasury";
import type { TxExecutor } from "./executor";
import { NETWORK_PASSPHRASE, REGISTRY_ID, RPC_URL } from "../config";

function makeRegistry(address: string, signer?: TxExecutor["signer"]): Client {
  return new Client({
    contractId: REGISTRY_ID,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    // A smart wallet is not a classic account: the contract client resolves publicKey with
    // getAccount(), which answers a C-address with "invalid version byte". That broke both
    // halves of discovery for passkey users — registration threw, and the read below caught
    // it and reported "no treasuries". Unset, the SDK simulates against its null account.
    ...(isValidContractId(address) ? {} : { publicKey: address }),
    ...(signer ? { signTransaction: signer.signTransaction } : {}),
  });
}

/** Record the treasury under the owner's wallet (owner-signed). Callers treat this
 *  as best-effort: a decline or RPC failure must never break the deploy flow.
 *
 *  Submission goes through the executor: a wallet sends it over RPC as it always has, a
 *  passkey signs the auth entry and the relay pays for it. */
export async function registerTreasury(
  executor: TxExecutor,
  treasuryId: string,
): Promise<void> {
  const tx = await makeRegistry(executor.address, executor.signer).register({
    owner: executor.address,
    treasury: treasuryId,
  });
  await executor.submit(tx);
}

/** Every treasury this wallet registered, oldest → newest — an unsigned read.
 *  Returns [] when the wallet has none or the registry is unreachable; malformed
 *  ids are filtered so a bad registry entry can never wedge the workspace. */
export async function discoverTreasuries(address: string): Promise<string[]> {
  try {
    const res = await makeRegistry(address).treasuries_of({ owner: address });
    return (res.result ?? []).filter(isValidContractId);
  } catch (e) {
    // Best-effort by design, but silence here once hid a real bug for a whole session.
    console.error("[registry] discovery failed for", address, e);
    return [];
  }
}
