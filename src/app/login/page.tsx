import type { Metadata } from "next";
import { connection } from "next/server";
import { AuthPanel } from "@/components/accounts/auth-panel";
import { authConfigured } from "@/lib/accounts/config";
import { safeReturnPath } from "@/lib/accounts/validation";
export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  return (
    <AuthPanel
      configured={authConfigured()}
      returnTo={safeReturnPath(params.callbackUrl)}
      registering={false}
      failed={!!params.error}
    />
  );
}
