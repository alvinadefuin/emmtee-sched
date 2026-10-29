/**
 * The one place swap links are built. Requests made before short codes existed have no
 * code and keep their original /swap/<uuid> link, which also always keeps working.
 */
export type SwapLinkTarget = { id: string; shortCode: string | null };

/** The swap page itself; /s/<code> redirects here. */
export const swapPagePath = (id: string): string => `/swap/${id}`;

/** The link to show or share: the short link when the request has a code. */
export const swapPath = (swap: SwapLinkTarget): string =>
  swap.shortCode ? `/s/${swap.shortCode}` : swapPagePath(swap.id);

export const swapUrl = (origin: string, swap: SwapLinkTarget): string => `${origin.replace(/\/+$/, "")}${swapPath(swap)}`;
