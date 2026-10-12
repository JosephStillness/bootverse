"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { catalogueReturnPath } from "@/lib/boots/catalogue";
import { ArrowLeftIcon } from "./icons";
export function CatalogueBackLink() {
  const params = useSearchParams();
  return (
    <Link className="text-link" href={catalogueReturnPath(params.get("from"))}>
      <ArrowLeftIcon size={18} aria-hidden="true" />
      Back to boots
    </Link>
  );
}
