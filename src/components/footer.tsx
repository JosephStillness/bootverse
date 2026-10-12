import Link from "next/link";
import { SoccerBallIcon, ArrowUpRightIcon } from "./icons";
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <Link href="/" className="brand">
              <SoccerBallIcon size={25} aria-hidden="true" />
              Boot<span>Verse</span>.
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              For the love of the game. And the boots.
            </p>
          </div>
          <nav aria-label="Footer navigation" className="flex gap-6">
            <Link className="nav-link" href="/boots">
              Catalogue <ArrowUpRightIcon aria-hidden="true" />
            </Link>
            <Link className="nav-link" href="/#about">
              About BootVerse
            </Link>
          </nav>
        </div>
        <div className="footer-bottom">
          <span>© 2026 BootVerse</span>
          <span>Sample catalogue. No verified product claims.</span>
        </div>
      </div>
    </footer>
  );
}
