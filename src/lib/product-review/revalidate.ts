import "server-only";
import { revalidatePath } from "next/cache";
/** Called by route handlers after a committed change to public product visibility or content. */
export function revalidatePublicCatalogue() {
  for (const path of ["/", "/boots", "/compare", "/boot-fit-finder"]) revalidatePath(path);
  // Variant-level evidence is shared by sibling colorways, so refresh every product page.
  revalidatePath("/boots/[slug]", "page");
}
