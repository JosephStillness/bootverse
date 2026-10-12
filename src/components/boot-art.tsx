import Image from "next/image";
import { cn } from "@/lib/utils";
export function BootArt({
  hero = false,
  eager = false,
  sizes,
  className,
}: {
  hero?: boolean;
  eager?: boolean;
  sizes?: string;
  className?: string;
}) {
  const loadEarly = hero || eager;
  return (
    <div className={cn("boot-art", hero && "hero-art", className)}>
      <Image
        src="/images/boot-concept.png"
        alt="Unbranded football boot concept artwork, not a photograph of this sample product"
        fill
        sizes={
          sizes ??
          (hero
            ? "(max-width: 767px) 100vw, 55vw"
            : "(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw")
        }
        loading={loadEarly ? "eager" : "lazy"}
        fetchPriority={loadEarly ? "high" : "auto"}
        className="object-contain"
      />
    </div>
  );
}
