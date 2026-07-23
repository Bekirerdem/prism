// Setup progress for the Overview stepper and the Setup wizard: five checkpoints from
// first visit to first payment, computed from live state so it always shows the truth
// (and disappears once complete). Pure and unit-tested.
export type SetupStep = "connect" | "deploy" | "fund" | "whitelist" | "pay";

export interface SetupInputs {
  connected: boolean;
  hasTreasury: boolean;
  balance: bigint | null; // null = not read yet — fund must NOT count as done
  payeeCount: number | null; // null = not derived yet
  hasPaid: boolean;
}

export interface SetupProgress {
  steps: { step: SetupStep; done: boolean }[];
  next: SetupStep | null;
  complete: boolean;
}

const ORDER: readonly SetupStep[] = ["connect", "deploy", "fund", "whitelist", "pay"];

export function setupProgress(i: SetupInputs): SetupProgress {
  const done: Record<SetupStep, boolean> = {
    connect: i.connected,
    deploy: i.hasTreasury,
    fund: (i.balance ?? 0n) > 0n,
    whitelist: (i.payeeCount ?? 0) > 0,
    pay: i.hasPaid,
  };
  const steps = ORDER.map((step) => ({ step, done: done[step] }));
  const next = ORDER.find((s) => !done[s]) ?? null;
  return { steps, next, complete: next === null };
}
