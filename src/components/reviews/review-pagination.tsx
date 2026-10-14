import { Button } from "@/components/ui/button";
export function ReviewPagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  if (pages <= 1 && page === 1) return null;
  return (
    <nav className="account-actions" aria-label="Review pages">
      <Button
        variant="outline"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </Button>
      <span>
        {page > Math.max(1, pages)
          ? "This page is no longer available"
          : `Page ${page} of ${Math.max(1, pages)}`}
      </span>
      <Button
        variant="outline"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </Button>
    </nav>
  );
}
