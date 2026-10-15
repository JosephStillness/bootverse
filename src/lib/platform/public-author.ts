export const publicAuthorSelect = {
    profile: { select: { username: true, displayName: true, images: { where: { status: "PUBLISHED" as const, state: "READY" as const }, select: { id: true }, take: 1 } } },
    creator: { select: { status: true, verificationStatus: true } },
} as const;
export function authorDTO(author: {
    profile: {
        username: string;
        displayName: string;
        images: {
            id: string;
        }[];
    } | null;
    creator: {
        status: string;
        verificationStatus: string;
    } | null;
}) {
    return { ...author.profile!, verifiedCreator: author.creator?.status === "PUBLISHED" && author.creator.verificationStatus === "APPROVED" };
}
