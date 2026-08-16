interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const CONFIG: Record<string, { label: string; classes: string; dot: string }> = {
  safe: { label: 'Safe', classes: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  warning: { label: 'Warning', classes: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  critical: { label: 'Critical', classes: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  active: { label: 'Active', classes: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  under_maintenance: { label: 'Under Maintenance', classes: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  fixed: { label: 'Fixed', classes: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  pending: { label: 'Pending', classes: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
  in_progress: { label: 'In Progress', classes: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  completed: { label: 'Completed', classes: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  operational: { label: 'Operational', classes: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  degraded: { label: 'Degraded', classes: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  low: { label: 'Low', classes: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  medium: { label: 'Medium', classes: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  high: { label: 'High', classes: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const cfg = CONFIG[status] ?? { label: status, classes: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' };
  const pad = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${cfg.classes} ${pad}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot} ${status === 'critical' || status === 'active' ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  );
}
