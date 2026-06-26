import { randomInt } from "crypto";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function createPickupCode(length: number) {
  let code = "";

  for (let index = 0; index < length; index += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }

  return code;
}

export async function createUniquePickupCode(
  length: number,
  exists: (code: string) => Promise<boolean>
) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = createPickupCode(length);
    if (!(await exists(code))) {
      return code;
    }
  }

  throw new Error("Unable to allocate a unique pickup code.");
}
