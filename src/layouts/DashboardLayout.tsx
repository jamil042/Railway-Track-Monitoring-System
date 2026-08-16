import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function DashboardLayout() {
  const { isAuthenticated } = useAuth();
  const { loading, error, refresh } = useData();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar onMenuToggle={() => setSidebarOpen(o => !o)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <div className="w-8 h-8 border-[3px] border-slate-200 border-t-blue-600 rounded-full animate-spin mb-3" />
              <p className="text-sm">Loading system data…</p>
            </div>
          ) : error ? (
            <div className="max-w-md mx-auto mt-20 bg-white border border-red-200 rounded-2xl p-6 text-center shadow-sm">
              <p className="text-red-600 font-semibold mb-1">Connection error</p>
              <p className="text-sm text-slate-500 mb-4">{error}</p>
              <button
                onClick={() => refresh()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
