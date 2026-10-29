import { describe, expect, it } from "vitest";
import { diffSwapNotices, parseSeenSwaps, type SwapLite } from "@/lib/swap-notices";

const ME = 1;
const swap = (id: string, over: Partial<SwapLite> = {}): SwapLite => ({
  id,
  requesterId: 2,
  targetId: ME,
  status: "pending",
  ...over,
});

describe("diffSwapNotices", () => {
  it("stays quiet the first time it sees this person, and remembers what is there", () => {
    const r = diffSwapNotices(null, [swap("in1"), swap("out1", { requesterId: ME, targetId: 3 })], ME);
    expect(r.notices).toEqual([]);
    expect(r.seen).toEqual({ incoming: ["in1"], outgoing: ["out1"] });
  });

  it("reports a pending request to me that was not seen before", () => {
    const r = diffSwapNotices({ incoming: ["in1"], outgoing: [] }, [swap("in1"), swap("in2")], ME);
    expect(r.notices).toEqual([{ type: "incoming", id: "in2" }]);
    expect(r.seen.incoming).toEqual(["in1", "in2"]);
  });

  it("does not repeat a request once seen", () => {
    const first = diffSwapNotices({ incoming: [], outgoing: [] }, [swap("in1")], ME);
    const second = diffSwapNotices(first.seen, [swap("in1")], ME);
    expect(first.notices).toHaveLength(1);
    expect(second.notices).toEqual([]);
  });

  it("ignores pending requests between other people", () => {
    const r = diffSwapNotices({ incoming: [], outgoing: [] }, [swap("x", { requesterId: 2, targetId: 3 })], ME);
    expect(r.notices).toEqual([]);
    expect(r.seen).toEqual({ incoming: [], outgoing: [] });
  });

  it("reports when a request I sent is accepted or declined", () => {
    const seen = { incoming: [], outgoing: ["a", "d"] };
    const r = diffSwapNotices(
      seen,
      [
        swap("a", { requesterId: ME, targetId: 3, status: "accepted" }),
        swap("d", { requesterId: ME, targetId: 4, status: "declined" }),
      ],
      ME,
    );
    expect(r.notices).toEqual([
      { type: "accepted", id: "a" },
      { type: "declined", id: "d" },
    ]);
    expect(r.seen.outgoing).toEqual([]);
  });

  it("stays quiet for outcomes of requests it never saw pending", () => {
    const r = diffSwapNotices({ incoming: [], outgoing: [] }, [swap("a", { requesterId: ME, targetId: 3, status: "accepted" })], ME);
    expect(r.notices).toEqual([]);
  });

  it("drops a request I sent that was cancelled or vanished, without a notice", () => {
    const r = diffSwapNotices(
      { incoming: [], outgoing: ["c", "gone"] },
      [swap("c", { requesterId: ME, targetId: 3, status: "cancelled" })],
      ME,
    );
    expect(r.notices).toEqual([]);
    expect(r.seen.outgoing).toEqual([]);
  });

  it("starts watching a new request I sent without announcing it", () => {
    const r = diffSwapNotices({ incoming: [], outgoing: [] }, [swap("n", { requesterId: ME, targetId: 3 })], ME);
    expect(r.notices).toEqual([]);
    expect(r.seen.outgoing).toEqual(["n"]);
  });

  it("forgets incoming requests that are no longer pending", () => {
    const r = diffSwapNotices({ incoming: ["old"], outgoing: [] }, [swap("old", { status: "accepted" })], ME);
    expect(r.notices).toEqual([]);
    expect(r.seen.incoming).toEqual([]);
  });
});

describe("parseSeenSwaps", () => {
  it("reads what was stored", () => {
    expect(parseSeenSwaps('{"incoming":["a"],"outgoing":["b"]}')).toEqual({ incoming: ["a"], outgoing: ["b"] });
  });

  it("returns null for missing or malformed data", () => {
    expect(parseSeenSwaps(null)).toBeNull();
    expect(parseSeenSwaps("not json")).toBeNull();
    expect(parseSeenSwaps('{"incoming":"a"}')).toBeNull();
    expect(parseSeenSwaps('{"incoming":[1],"outgoing":[]}')).toBeNull();
    expect(parseSeenSwaps("null")).toBeNull();
  });
});
