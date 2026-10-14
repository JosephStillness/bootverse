import Link from "next/link";
export default function ReviewNotFound() {
  return (
    <div className="shell community-page">
      <div className="community-empty">
        <h1>Review not found.</h1>
        <p>This review is unavailable or has been removed.</p>
        <Link href="/boots" className="text-link">
          Explore boots
        </Link>
      </div>
    </div>
  );
}
