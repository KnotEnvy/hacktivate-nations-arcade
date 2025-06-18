// ===== src/app/loading.tsx =====
export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="loading-spinner w-16 h-16 mx-auto mb-4"></div>
        <h2 className="text-2xl font-bold text-white mb-2">Loading Arcade...</h2>
        <p className="text-gray-300">Preparing your gaming experience</p>
      </div>
    </div>
  );
}
