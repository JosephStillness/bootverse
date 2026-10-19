import type { Metadata } from "next";
import "@fontsource/geist/latin-400.css";
import "@fontsource/geist/latin-500.css";
import "@fontsource/geist/latin-600.css";
import "@fontsource/geist/latin-700.css";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { ComparisonProvider } from "@/components/comparison/selection";
import { Footer } from "@/components/footer";
export const metadata: Metadata = {
  title: {
    default: "BootVerse | Explore the boot catalogue",
    template: "%s | BootVerse",
  },
  description:
    "Explore published football boot variants by brand, silo, tier and outsole. Compare sourced details and community experiences; sample configurations and unknowns are labeled.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <ComparisonProvider><Navbar />
        <main id="main">{children}</main>
        <Footer /></ComparisonProvider>
      </body>
    </html>
  );
}
