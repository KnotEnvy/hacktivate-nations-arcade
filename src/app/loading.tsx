// ===== src/app/loading.tsx =====
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="text-center">
        <div className="loading-spinner mx-auto mb-4 h-10 w-10" />
        <h2 className="font-display text-lg font-bold text-ink">Loading arcade</h2>
        <p className="mt-1 text-sm text-ink-muted">Preparing your cabinet.</p>
      </div>
    </div>
  );
}
