import Link from "next/link";
import { ArrowUpRightIcon, SoccerBallIcon } from "./icons";
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="footer-top">
          <div>
            <Link href="/" className="brand" aria-label="BootVerse home">
              <SoccerBallIcon size={25} weight="bold" aria-hidden="true" />
              <span>BootVerse</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              A closer look at the boots behind the game.
            </p>
          </div>
          <nav aria-label="Footer navigation" className="footer-links">
            <Link href="/boots" className="nav-link">
              Explore Boots <ArrowUpRightIcon aria-hidden="true" />
            </Link>
            <Link href="/community">
              Community <ArrowUpRightIcon size={16} aria-hidden="true" />
            </Link>
            <Link href="/#about" className="nav-link">
              About BootVerse
            </Link>
            <Link href="/#surfaces" className="nav-link">
              Playing surfaces
            </Link>
          </nav>
        </div>
        <div className="footer-bottom">
          <span>© 2026 BootVerse</span>
          <span>Samples are labeled. Unknown details stay unknown.</span>
        </div>
      </div>
    </footer>
  );
}
