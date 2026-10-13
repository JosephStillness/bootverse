import type { Metadata } from "next";
import { connection } from "next/server";
import { AuthPanel } from "@/components/accounts/auth-panel";
import { authConfigured } from "@/lib/accounts/config";
export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: false },
};
export default async function Register() {
  await connection();
  return (
    <AuthPanel
      configured={authConfigured()}
      returnTo="/account"
      registering
      failed={false}
    />
  );
}
