import { useState } from 'react';
import { MOCK_MAINTENANCE } from '../data/mockData';
import type { MaintenanceTask } from '../types';
import StatusBadge from '../components/StatusBadge';
import { MdBuild, MdPlayArrow, MdEdit, MdCheckCircle, MdPerson, MdGroup } from 'react-icons/md';

export default function Maintenance() {
  const [tasks, setTasks] = useState<MaintenanceTask[]>(MOCK_MAINTENANCE);

  const startRepair = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id
      ? { ...t, status: 'in_progress', progress: 5, startTime: new Date().toISOString() }
      : t
    ));
  };

  const updateProgress = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id && t.progress < 95
      ? { ...t, progress: Math.min(t.progress + 20, 90) }
      : t
    ));
  };

  const markFixed = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id
      ? { ...t, status: 'completed', progress: 100, completionTime: new Date().toISOString() }
      : t
    ));
  };

  const progressColor = (p: number) => p >= 80 ? 'bg-green-500' : p >= 40 ? 'bg-blue-500' : 'bg-yellow-500';

  const summary = {
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Maintenance Updates</h1>
        <p className="text-slate-500 text-sm mt-0.5">Track repair progress and team assignments</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending', count: summary.pending, color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
          { label: 'In Progress', count: summary.in_progress, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
          { label: 'Completed', count: summary.completed, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
        ].map(s => (
          <div key={s.label} className={`bg-[#1E293B] border ${s.border} rounded-xl p-4 ${s.bg}`}>
            <p className={`text-3xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-[#1E293B] border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700/50 flex items-center gap-2">
          <MdBuild className="text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Repair Task Management</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800/20">
                {['Fault ID', 'Station / Track', 'Fault Type', 'Assigned Team', 'Engineer', 'Progress', 'Status', 'ETA', 'Actions'].map(h => (
                  <th key={h} className="text-left text-xs text-slate-500 font-medium px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {tasks.map(t => (
                <tr key={t.id} className="hover:bg-slate-700/10 transition-colors">
                  <td className="px-4 py-4 font-mono text-xs text-blue-400 whitespace-nowrap">{t.faultId}</td>
                  <td className="px-4 py-4">
                    <p className="text-slate-300 text-xs whitespace-nowrap">{t.stationName.split(' ')[0]}</p>
                    <p className="text-slate-600 text-[11px] font-mono">{t.trackId}</p>
                  </td>
                  <td className="px-4 py-4 text-slate-400 text-xs whitespace-nowrap">{t.faultType}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-slate-300 whitespace-nowrap">
                      <MdGroup className="text-slate-500" />{t.assignedTeam}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 whitespace-nowrap">
                      <MdPerson className="text-slate-600" />{t.engineer}
                    </div>
                  </td>
                  <td className="px-4 py-4 min-w-32">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${progressColor(t.progress)}`} style={{ width: `${t.progress}%` }} />
                      </div>
                      <span className="text-xs text-slate-400 w-8 text-right">{t.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-4"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-4 text-xs text-slate-500 whitespace-nowrap">
                    {t.completionTime ? new Date(t.completionTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5">
                      {t.status === 'pending' && (
                        <button onClick={() => startRepair(t.id)} className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/20 text-blue-400 text-xs rounded-lg transition-colors whitespace-nowrap">
                          <MdPlayArrow className="text-sm" /> Start
                        </button>
                      )}
                      {t.status === 'in_progress' && (
                        <>
                          <button onClick={() => updateProgress(t.id)} className="flex items-center gap-1 px-2.5 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 text-yellow-400 text-xs rounded-lg transition-colors whitespace-nowrap">
                            <MdEdit className="text-sm" /> Update
                          </button>
                          <button onClick={() => markFixed(t.id)} className="flex items-center gap-1 px-2.5 py-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 text-xs rounded-lg transition-colors whitespace-nowrap">
                            <MdCheckCircle className="text-sm" /> Fixed
                          </button>
                        </>
                      )}
                      {t.status === 'completed' && (
                        <span className="text-xs text-green-400 flex items-center gap-1"><MdCheckCircle /> Done</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
