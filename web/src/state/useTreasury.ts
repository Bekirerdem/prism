import { useContext } from "react";
import { TreasuryContext, type TreasuryContextValue } from "./treasuryContext";

export function useTreasury(): TreasuryContextValue {
  const ctx = useContext(TreasuryContext);
  if (!ctx) throw new Error("useTreasury must be used inside TreasuryProvider");
  return ctx;
}
