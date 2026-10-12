"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRightIcon, SoccerBallIcon } from "./icons";

export function Navbar() {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <div className="shell flex h-[76px] items-center justify-between gap-4">
        <Link href="/" className="brand" aria-label="BootVerse home">
          <SoccerBallIcon size={28} weight="duotone" aria-hidden="true" />
          Boot<span>Verse</span>
          <span className="brand-period">.</span>
        </Link>
        <nav
          aria-label="Main navigation"
          className="flex items-center gap-2 md:gap-7"
        >
          <Link
            href="/"
            className="nav-link home-link"
            aria-current={pathname === "/" ? "page" : undefined}
          >
            Home
          </Link>
          <Link
            href="/boots"
            className="nav-link"
            aria-current={pathname.startsWith("/boots") ? "page" : undefined}
          >
            Catalogue <ArrowUpRightIcon aria-hidden="true" />
          </Link>
          <Link href="/#about" className="nav-link">
            About
          </Link>
        </nav>
      </div>
    </header>
  );
}
