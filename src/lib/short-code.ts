import { randomInt } from "node:crypto";

/**
 * Short codes for swap links (/s/<CODE>). Digits and uppercase letters without the
 * look-alikes 0/O, 1/I/L and U, so a code read aloud or retyped is hard to get wrong.
 * 30 symbols x 8 characters is about 39 bits.
 */
export const SHORT_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
export const SHORT_CODE_LENGTH = 8;

const PATTERN = new RegExp(`^[${SHORT_CODE_ALPHABET}]{${SHORT_CODE_LENGTH}}$`);

/** Returns an integer in [0, max). The default is node:crypto's unbiased randomInt. */
export type RandomIndex = (max: number) => number;

export function generateShortCode(random: RandomIndex = randomInt): string {
  let code = "";
  for (let i = 0; i < SHORT_CODE_LENGTH; i++) code += SHORT_CODE_ALPHABET[random(SHORT_CODE_ALPHABET.length)];
  return code;
}

/** True for a code in canonical form (exactly 8 alphabet characters, uppercase). */
export const isShortCode = (value: string): boolean => PATTERN.test(value);

/** Uppercases and trims a code typed or pasted by a person; null if it cannot be a valid code. */
export function normaliseShortCode(value: string): string | null {
  const code = value.trim().toUpperCase();
  return isShortCode(code) ? code : null;
}
