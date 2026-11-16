import { createHash, randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Random base62, with rejection sampling so no character is likelier than another. */
export function randomToken(length: number): string {
    let out = "";
    while (out.length < length) {
        for (const byte of randomBytes(length * 2)) {
            if (byte < 248 && out.length < length) out += ALPHABET[byte % 62];
        }
    }
    return out;
}

export const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

/** Constant-shape check for things that arrive in URLs. */
export const isSlug = (text: string): boolean => /^[A-Za-z0-9]{12}$/.test(text);
export const isInviteKey = (text: string): boolean => /^[A-Za-z0-9]{32}$/.test(text);
