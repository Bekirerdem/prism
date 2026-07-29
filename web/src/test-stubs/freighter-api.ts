// Vitest-only stand-in for @stellar/freighter-api. The real package is CommonJS and its
// named exports fail node-ESM interop when the kit's Freighter module is imported inside
// vitest (walletDevice.test.ts pulls it for the real FREIGHTER_ID constant). None of
// these are ever called in unit tests — the browser build resolves the real package.
const unavailable = async () => {
  throw new Error("freighter-api stub — not available in unit tests");
};

export const getAddress = unavailable;
export const getNetwork = unavailable;
export const isConnected = unavailable;
export const requestAccess = unavailable;
export const signAuthEntry = unavailable;
export const signMessage = unavailable;
export const signTransaction = unavailable;
export default {
  getAddress,
  getNetwork,
  isConnected,
  requestAccess,
  signAuthEntry,
  signMessage,
  signTransaction,
};
