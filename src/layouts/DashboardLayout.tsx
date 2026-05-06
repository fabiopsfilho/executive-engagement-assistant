import { Outlet } from 'react-router-dom';

/**
 * DashboardLayout provides the three-panel structure for the application.
 * - Panel 1 (left): Account Selector
 * - Panel 2 (center): Intelligence Dashboard
 * - Panel 3 (right): Engagement Plan Generator
 */
export function DashboardLayout() {
  return (
    <div className="min-h-screen bg-dark-900 flex flex-col">
      {/* Header */}
      <header className="bg-dark-800 border-b border-dark-600 px-6 py-3 flex items-center gap-3">
        <img src="/aws-logo.svg" alt="AWS" className="h-6" />
        <h1 className="text-sm font-semibold text-white">
          T&C Executive Engagement Assistant
        </h1>
      </header>

      {/* Main content area - renders child routes */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
