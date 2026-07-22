interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const CONFIG: Record<string, { label: string; classes: string; dot: string }> = {
  safe: { label: 'Safe', classes: 'bg-green-500/15 text-green-400 border-green-500/30', dot: 'bg-green-400' },
  warning: { label: 'Warning', classes: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', dot: 'bg-yellow-400' },
  critical: { label: 'Critical', classes: 'bg-red-500/15 text-red-400 border-red-500/30', dot: 'bg-red-400' },
  active: { label: 'Active', classes: 'bg-red-500/15 text-red-400 border-red-500/30', dot: 'bg-red-400' },
  under_maintenance: { label: 'Under Maintenance', classes: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', dot: 'bg-yellow-400' },
  fixed: { label: 'Fixed', classes: 'bg-green-500/15 text-green-400 border-green-500/30', dot: 'bg-green-400' },
  pending: { label: 'Pending', classes: 'bg-slate-500/15 text-slate-400 border-slate-500/30', dot: 'bg-slate-400' },
  in_progress: { label: 'In Progress', classes: 'bg-blue-500/15 text-blue-400 border-blue-500/30', dot: 'bg-blue-400' },
  completed: { label: 'Completed', classes: 'bg-green-500/15 text-green-400 border-green-500/30', dot: 'bg-green-400' },
  operational: { label: 'Operational', classes: 'bg-green-500/15 text-green-400 border-green-500/30', dot: 'bg-green-400' },
  degraded: { label: 'Degraded', classes: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', dot: 'bg-yellow-400' },
  low: { label: 'Low', classes: 'bg-blue-500/15 text-blue-400 border-blue-500/30', dot: 'bg-blue-400' },
  medium: { label: 'Medium', classes: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', dot: 'bg-yellow-400' },
  high: { label: 'High', classes: 'bg-orange-500/15 text-orange-400 border-orange-500/30', dot: 'bg-orange-400' },
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const cfg = CONFIG[status] ?? { label: status, classes: 'bg-slate-500/15 text-slate-400 border-slate-500/30', dot: 'bg-slate-400' };
  const pad = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${cfg.classes} ${pad}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === 'critical' || status === 'active' ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  );
}
