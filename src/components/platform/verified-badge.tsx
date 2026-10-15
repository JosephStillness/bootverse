import { Badge } from "@/components/ui/badge";
export function VerifiedCreatorBadge({ verified }: {
    verified: boolean;
}) { return verified ? <span title="Creator account ownership was checked. This does not verify review accuracy or purchase history."><Badge variant="outline">Verified Creator</Badge></span> : null; }
