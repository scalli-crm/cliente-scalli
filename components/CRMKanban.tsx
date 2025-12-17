
import React, { useState } from 'react';
import { Opportunity, CRMStage, ScheduleEvent, CRMPipelineStage } from '../types';
import { Clock, DollarSign, Users, Calendar, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

interface CRMKanbanProps {
  opportunities: Opportunity[];
  stagesConfig: CRMPipelineStage[];
  onDrop: (e: React.DragEvent, stage: CRMStage) => void;
  onCardClick: (opp: Opportunity) => void;
  loading: boolean;
  showFinalStages: boolean;
}

// B2B Default Stages
const DEFAULT_STAGES: { id: CRMStage; label: string; color: string; countColor: string }[] = [
  { id: 'novo', label: 'Novo', color: 'border-blue-500', countColor: 'bg-blue-500' },
  { id: 'atendimento', label: 'Qualificação', color: 'border-indigo-500', countColor: 'bg-indigo-500' },
  { id: 'visita', label: 'Apresentação', color: 'border-purple-500', countColor: 'bg-purple-500' },
  { id: 'test_drive', label: 'Demonstração', color: 'border-pink-500', countColor: 'bg-pink-500' },
  { id: 'proposta', label: 'Proposta', color: 'border-orange-500', countColor: 'bg-orange-500' },
  { id: 'negociacao', label: 'Negociação', color: 'border-yellow-500', countColor: 'bg-yellow-500' },
  { id: 'venda', label: 'Fechado Ganho', color: 'border-emerald-500', countColor: 'bg-emerald-500' },
  { id: 'perdido', label: 'Perdido', color: 'border-red-500', countColor: 'bg-red-500' }
];

export const CRMKanban: React.FC<CRMKanbanProps> = ({ opportunities, stagesConfig, onDrop, onCardClick, loading, showFinalStages }) => {
  const getUpcomingTask = (schedule: ScheduleEvent[] | undefined) => {
    if (!schedule || schedule.length === 0) return null;
    const pending = schedule.filter(s => s.status === 'agendado');
    if (pending.length === 0) return null;
    pending.sort((a, b) => new Date(`${a.data}T${a.hora}`).getTime() - new Date(`${b.data}T${b.hora}`).getTime());
    const nextTask = pending[0];
    const taskDate = new Date(`${nextTask.data}T${nextTask.hora}`);
    const now = new Date();
    const diffHours = (taskDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    const isLate = diffHours < 0;
    const isToday = taskDate.toDateString() === now.toDateString();
    return { ...nextTask, isLate, isToday };
  };

  const handleDragStart = (e: React.DragEvent, oppId: string) => {
    e.dataTransfer.setData('oppId', oppId);
  };

  const getRelativeTime = (dateStr: string) => {
    if (!dateStr) return 'Novo';
    const diffMs = new Date().getTime() - new Date(dateStr).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? `${diffDays}d atrás` : 'Hoje';
  };

  const getStageStyle = (colorString: string) => {
      const base = colorString.replace('bg-', '').replace('border-', '').replace('text-', '').split('-')[0];
      switch(base) {
          case 'blue': return { border: 'border-blue-500', badge: 'bg-blue-500', text: 'text-white', header: 'from-blue-500/10 to-blue-900/5' };
          case 'indigo': return { border: 'border-indigo-500', badge: 'bg-indigo-500', text: 'text-white', header: 'from-indigo-500/10 to-indigo-900/5' };
          case 'purple': return { border: 'border-purple-500', badge: 'bg-purple-500', text: 'text-white', header: 'from-purple-500/10 to-purple-900/5' };
          case 'pink': return { border: 'border-pink-500', badge: 'bg-pink-500', text: 'text-white', header: 'from-pink-500/10 to-pink-900/5' };
          case 'rose': return { border: 'border-rose-500', badge: 'bg-rose-500', text: 'text-white', header: 'from-rose-500/10 to-rose-900/5' };
          case 'orange': return { border: 'border-orange-500', badge: 'bg-orange-500', text: 'text-white', header: 'from-orange-500/10 to-orange-900/5' };
          case 'yellow': return { border: 'border-yellow-500', badge: 'bg-yellow-500', text: 'text-black', header: 'from-yellow-500/10 to-yellow-900/5' };
          case 'emerald': case 'green': return { border: 'border-emerald-500', badge: 'bg-emerald-500', text: 'text-white', header: 'from-emerald-500/10 to-emerald-900/5' };
          case 'red': return { border: 'border-red-500', badge: 'bg-red-500', text: 'text-white', header: 'from-red-500/10 to-red-900/5' };
          default: return { border: 'border-zinc-600', badge: 'bg-zinc-600', text: 'text-zinc-200', header: 'from-zinc-800 to-zinc-900' };
      }
  };

  let activeStages: { id: string; label: string; style: any }[] = [];
  if (stagesConfig && stagesConfig.length > 0) {
     activeStages = stagesConfig.map(s => ({ id: s.id, label: s.name, style: getStageStyle(s.color || 'zinc') }));
  } else {
     activeStages = DEFAULT_STAGES.map(s => ({ id: s.id, label: s.label, style: getStageStyle(s.color) }));
  }

  const visibleStages = showFinalStages 
    ? activeStages 
    : activeStages.filter(stage => {
        const lowerId = stage.id.toLowerCase();
        return lowerId !== 'venda' && lowerId !== 'perdido';
    });

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-x-auto pb-4 h-full">
        <div className="flex gap-4 min-w-[max-content] h-full px-1">
          {visibleStages.map((stage) => {
            const stageOpps = opportunities.filter(o => o.stage === stage.id);
            const totalValue = stageOpps.reduce((acc, curr) => acc + (curr.min_price || 0), 0);
            const style = stage.style;

            return (
              <div 
                key={stage.id} 
                className="w-80 flex-shrink-0 flex flex-col h-full"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, stage.id as CRMStage)}
              >
                <div className={`flex flex-col mb-3 bg-zinc-900 rounded-lg p-3 shadow-md border-t-4 ${style.border} relative overflow-hidden group`}>
                  <div className={`absolute inset-0 bg-gradient-to-b ${style.header} opacity-50`}></div>
                  <div className="flex justify-between items-center mb-1 relative z-10">
                     <h4 className="font-bold text-white text-sm uppercase tracking-wide flex items-center gap-2">{stage.label}</h4>
                     <span className={`${style.badge} ${style.text} text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm`}>{stageOpps.length}</span>
                  </div>
                  {totalValue > 0 && <p className="text-xs text-zinc-400 font-mono relative z-10">{formatCurrency(totalValue)}</p>}
                </div>
                <div className={`flex-1 bg-zinc-900/30 rounded-xl border border-zinc-800/50 p-2 space-y-3 overflow-y-auto custom-scrollbar`}>
                  {loading && opportunities.length === 0 ? <div className="animate-pulse p-4 text-center text-zinc-500 text-xs">Carregando...</div> : stageOpps.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-xs italic border-2 border-dashed border-zinc-800/50 rounded-lg pointer-events-none opacity-50 min-h-[100px]"><span className="mb-1">Vazio</span></div> : null}
                  {stageOpps.map(opp => {
                    const upcomingTask = getUpcomingTask(opp.schedule);
                    return (
                      <div key={opp.id} draggable onDragStart={(e) => handleDragStart(e, opp.id)} onClick={() => onCardClick(opp)} className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg shadow-sm hover:border-zinc-600 hover:shadow-lg transition-all cursor-pointer group relative select-none hover:-translate-y-1 duration-200">
                        <div className="flex justify-between items-start mb-2 pr-4"><h5 className="font-bold text-white text-sm leading-tight line-clamp-2 w-full">{opp.title}</h5></div>
                        <p className="text-xs text-zinc-400 mb-2 flex items-center gap-1.5 truncate"><Users size={12} className="text-zinc-500 shrink-0"/> {opp.leads?.nome || 'Cliente sem nome'}</p>
                        <div className="bg-black/30 rounded p-1.5 mb-2 border border-zinc-800/50 flex justify-between items-center"><span className="text-[10px] text-zinc-500 flex items-center gap-1"><DollarSign size={10} /> Valor</span><span className="text-xs font-mono text-emerald-500 font-bold">{opp.min_price ? formatCurrency(opp.min_price) : 'R$ -'}</span></div>
                        {upcomingTask && (<div className={`mt-2 mb-2 p-1.5 rounded text-[10px] font-medium border flex items-center gap-1.5 ${upcomingTask.isLate ? 'bg-red-500/10 border-red-500/30 text-red-400' : upcomingTask.isToday ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>{upcomingTask.isLate ? <AlertTriangle size={10} /> : <Calendar size={10} />}<span className="truncate flex-1">{upcomingTask.title || upcomingTask.tipo.toUpperCase()}</span><span>{upcomingTask.hora.substring(0,5)}</span></div>)}
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-800 justify-between"><span className="text-[9px] font-bold text-zinc-500 uppercase bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">{opp.payment_method || 'N/A'}</span><span className={`text-[10px] flex items-center gap-1 text-zinc-600`}><Clock size={10} /> {getRelativeTime(opp.created_at)}</span></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
