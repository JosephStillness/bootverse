import { isIP } from "node:net";
import { AccessError } from "./authorization";

export function trustedClientIp(request: Request): string | null {
  const header = process.env.AUTH_TRUSTED_IP_HEADER;
  if (!header) return null;
  if (!["x-real-ip", "cf-connecting-ip"].includes(header))
    throw new Error("Invalid AUTH_TRUSTED_IP_HEADER configuration.");
  // Enable only behind a proxy that overwrites this header and prevents direct access.
  const ip = request.headers.get(header)?.trim();
  if (!ip || !isIP(ip)) throw new AccessError(403, "Invalid client address.");
  // Canonicalize IPv6 so spelling differences do not produce separate rate buckets.
  return isIP(ip) === 6 ? new URL(`http://[${ip}]/`).hostname : ip;
}
