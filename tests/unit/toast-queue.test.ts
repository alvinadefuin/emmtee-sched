import { describe, expect, it } from "vitest";
import { MAX_TOASTS, pushToast, removeToast, toastDuration, type ToastItem } from "@/lib/toast-queue";

const t = (id: string, kind: ToastItem["kind"] = "success"): ToastItem => ({ id, kind, message: `m${id}` });

describe("pushToast", () => {
  it("appends the newest toast at the end", () => {
    expect(pushToast([t("1")], t("2")).map((x) => x.id)).toEqual(["1", "2"]);
  });

  it(`keeps at most ${MAX_TOASTS}, dropping the oldest`, () => {
    const list = [t("1"), t("2"), t("3")];
    expect(pushToast(list, t("4")).map((x) => x.id)).toEqual(["2", "3", "4"]);
  });

  it("replaces a toast with the same id and moves it to the end", () => {
    const list = [t("a"), t("b")];
    const next = pushToast(list, { id: "a", kind: "error", message: "again" });
    expect(next.map((x) => x.id)).toEqual(["b", "a"]);
    expect(next[1].message).toBe("again");
  });

  it("does not mutate the input", () => {
    const list = [t("1")];
    pushToast(list, t("2"));
    expect(list).toHaveLength(1);
  });
});

describe("removeToast", () => {
  it("removes by id and ignores unknown ids", () => {
    expect(removeToast([t("1"), t("2")], "1").map((x) => x.id)).toEqual(["2"]);
    expect(removeToast([t("1")], "x").map((x) => x.id)).toEqual(["1"]);
  });
});

describe("toastDuration", () => {
  it("gives errors longer than success and info", () => {
    expect(toastDuration("success")).toBe(5000);
    expect(toastDuration("info")).toBe(5000);
    expect(toastDuration("error")).toBe(8000);
  });
});
