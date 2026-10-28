import { shortDate } from "./dates";
import { ROLE_SHORT, type SlotRole, type SwapKind } from "./roles";

type SlotRef = { date: string; role: SlotRole };

const describe = (s: SlotRef) => `${shortDate(s.date)} ${ROLE_SHORT[s.role]}`;

export function swapMessage(input: {
  kind: SwapKind;
  targetName: string;
  requesterSlot: SlotRef;
  targetSlot: SlotRef | null;
  url: string;
}): string {
  const { kind, targetName, requesterSlot, targetSlot, url } = input;
  const ask =
    kind === "exchange" && targetSlot
      ? `can we swap? My ${describe(requesterSlot)} for your ${describe(targetSlot)}.`
      : `could you take my ${describe(requesterSlot)}?`;
  return `Hi ${targetName}, ${ask} Tap to accept or decline: ${url}`;
}
