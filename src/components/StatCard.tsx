import type { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: { value: number; label: string };
  color?: 'blue' | 'red' | 'green' | 'yellow' | 'purple' | 'slate';
  subtitle?: string;
}

const colorMap = {
  blue: { icon: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', val: 'text-blue-700' },
  red: { icon: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', val: 'text-red-700' },
  green: { icon: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100', val: 'text-green-700' },
  yellow: { icon: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-100', val: 'text-yellow-700' },
  purple: { icon: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100', val: 'text-purple-700' },
  slate: { icon: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', val: 'text-slate-700' },
};

export default function StatCard({ title, value, icon, trend, color = 'blue', subtitle }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md hover:border-slate-300 transition-all duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl ${c.bg} ${c.border} border flex items-center justify-center ${c.icon} text-xl`}>
          {icon}
        </div>
        {trend && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${trend.value >= 0 ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
            {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-3xl font-bold text-slate-900 tracking-tight">{value}</p>
        <p className="text-sm text-slate-500 mt-1">{title}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
