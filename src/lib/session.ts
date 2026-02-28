import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "ti_admin_session";
const EXPIRY = "7d";

function getSecret(): Uint8Array {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || pw.length < 12) {
    throw new Error(
      "ADMIN_PASSWORD must be set and at least 12 characters (use 32+ for production)",
    );
  }
  return new TextEncoder().encode(pw);
}

export async function createAdminToken(): Promise<string> {
  return new SignJWT({ admin: true })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(EXPIRY)
    .sign(getSecret());
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}

export async function getAdminSession(): Promise<{ admin: boolean } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const valid = await verifyAdminToken(token);
  return valid ? { admin: true } : null;
}

export { COOKIE_NAME };
