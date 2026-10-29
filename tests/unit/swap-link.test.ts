import { describe, expect, it } from "vitest";
import { swapPagePath, swapPath, swapUrl } from "@/lib/swap-link";

const id = "3f2b8c1e-1d2a-4b5c-9e8f-0a1b2c3d4e5f";

describe("swap links", () => {
  it("uses the short link when the request has a code", () => {
    expect(swapPath({ id, shortCode: "K7P2QX9M" })).toBe("/s/K7P2QX9M");
  });

  it("falls back to the uuid link for requests made before short codes", () => {
    expect(swapPath({ id, shortCode: null })).toBe(`/swap/${id}`);
  });

  it("names the swap page itself by uuid", () => {
    expect(swapPagePath(id)).toBe(`/swap/${id}`);
  });

  it("builds an absolute link from an origin", () => {
    expect(swapUrl("https://example.vercel.app", { id, shortCode: "K7P2QX9M" })).toBe(
      "https://example.vercel.app/s/K7P2QX9M",
    );
    expect(swapUrl("https://example.vercel.app/", { id, shortCode: null })).toBe(
      `https://example.vercel.app/swap/${id}`,
    );
  });
});
