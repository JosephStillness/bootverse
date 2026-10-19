"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRightIcon, ListIcon, SoccerBallIcon } from "./icons";
import { Sheet, SheetClose } from "./ui/sheet";
import { Button, buttonVariants } from "./ui/button";

const links = [
  { href: "/", label: "Home" },
  { href: "/boots", label: "Explore Boots" },
  { href: "/compare", label: "Compare boots" },
  { href: "/boot-fit-finder", label: "Boot Fit Finder" },
  { href: "/community", label: "Community" },
  { href: "/creators", label: "Creators" },
  { href: "/#about", label: "About BootVerse" },
  { href: "/account", label: "My account" },
];
export function Navbar() {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link href="/" className="brand" aria-label="BootVerse home">
          <SoccerBallIcon size={25} weight="bold" aria-hidden="true" />
          <span>BootVerse</span>
        </Link>
        <nav aria-label="Main navigation" className="desktop-nav">
          <Link
            href="/"
            className="nav-link"
            aria-current={pathname === "/" ? "page" : undefined}
          >
            Home
          </Link>
          <Link
            href="/community"
            className="nav-link"
            aria-current={
              pathname.startsWith("/community") ? "page" : undefined
            }
          >
            Community
          </Link>
          <Link href="/boot-fit-finder" className="nav-link" aria-current={pathname === "/boot-fit-finder" ? "page" : undefined}>Boot Fit Finder</Link>
          <Link href="/creators" className="nav-link" aria-current={pathname.startsWith("/creators") ? "page" : undefined}>Creators</Link>
          <Link href="/compare" className="nav-link" aria-current={pathname === "/compare" ? "page" : undefined}>Compare</Link>
          <Link href="/#about" className="nav-link">
            About
          </Link>
          <Link
            href="/account"
            className="nav-link"
            aria-current={pathname === "/account" ? "page" : undefined}
          >
            My account
          </Link>
          <Link
            href="/boots"
            className={buttonVariants({ variant: "default" })}
            aria-current={pathname.startsWith("/boots") ? "page" : undefined}
          >
            Explore Boots <ArrowUpRightIcon aria-hidden="true" />
          </Link>
        </nav>
        <div className="mobile-nav">
          <Sheet
            title="Menu"
            description="Explore the BootVerse catalogue."
            trigger={
              <Button variant="outline" size="icon" aria-label="Open menu">
                <ListIcon size={22} aria-hidden="true" />
              </Button>
            }
          >
            <nav aria-label="Mobile navigation" className="mobile-links">
              {links.map((link) => (
                <SheetClose
                  key={link.href}
                  nativeButton={false}
                  role="link"
                  render={
                    <Link
                      href={link.href}
                      className="mobile-nav-link"
                      aria-current={
                        link.href === pathname ||
                        (link.href !== "/" &&
                          !link.href.includes("#") &&
                          pathname.startsWith(`${link.href}/`))
                          ? "page"
                          : undefined
                      }
                    >
                      {link.label}
                      <ArrowUpRightIcon size={20} aria-hidden="true" />
                    </Link>
                  }
                />
              ))}
            </nav>
            <p className="mt-8 text-sm text-muted-foreground">
              Football boots, clearly explained. Our first collection contains
              eight unverified samples.
            </p>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
