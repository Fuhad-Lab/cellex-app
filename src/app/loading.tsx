/**
 * Root loading state — shows during page navigation.
 * Sleek minimal design: black loading dots on white.
 */
export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] bg-white">
      <div className="loading-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
}
