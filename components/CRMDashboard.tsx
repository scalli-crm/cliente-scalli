
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { Opportunity, User, CRMLeadOrigin } from '../types';
import { formatCurrency } from '../utils/formatters';
import { Calendar, TrendingUp, TrendingDown, Award, Clock, CheckCircle2, DollarSign, PieChart } from 'lucide-react';

interface CRMDashboardProps {
  currentUser?: User | null;
}

type DatePreset = 'today' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_year' | 'all';

export const CRMDashboard: React.FC<CRMDashboardProps> = ({ currentUser }) => {
  const [loading, setLoading] = useState(true);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  
  // Filters State
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedOrigin, setSelectedOrigin] = useState('');
  
  // Config Data for dropdowns
  const [users, setUsers] = useState<User[]>([]);
  const [origins, setOrigins] = useState<CRMLeadOrigin[]>([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchOpportunities();
  }, [currentUser]); 

  const fetchInitialData = async () => {
    const [u, o] = await Promise.all([
        supabase.from('users').select('*').eq('active', true),
        supabase.from('crm_lead_origins').select('*').eq('active', true)
    ]);
    if (u.data) setUsers(u.data as any);
    if (o.data) setOrigins(o.data as any);
  };

  const fetchOpportunities = async () => {
    setLoading(true);
    let query = supabase
        .from('crm_opportunities')
        .select(`
            *, 
            leads (id, nome, lead_origin_id, origem),
            users (id, name)
        `);
    
    const { data, error } = await query;
    if (!error && data) {
        setOpportunities(data as any);
    }
    setLoading(false);
  };

  // --- DATE LOGIC ---
  const getDateRange = (preset: DatePreset): { start: Date, end: Date, prevStart: Date, prevEnd: Date } => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    
    let start = new Date(now);
    let end = new Date(now);
    let prevStart = new Date(now);
    let prevEnd = new Date(now);

    switch (preset) {
        case 'today':
            start.setHours(0, 0, 0, 0);
            prevStart.setDate(start.getDate() - 1);
            prevStart.setHours(0,0,0,0);
            prevEnd.setDate(end.getDate() - 1);
            prevEnd.setHours(23,59,59,999);
            break;
        case 'this_week':
            const day = start.getDay(); 
            const diff = start.getDate() - day + (day === 0 ? -6 : 1);
            start.setDate(diff);
            start.setHours(0,0,0,0);
            
            prevStart = new Date(start);
            prevStart.setDate(start.getDate() - 7);
            prevEnd = new Date(end);
            prevEnd.setDate(end.getDate() - 7);
            break;
        case 'last_week':
            start.setDate(start.getDate() - 7 - start.getDay() + 1);
            start.setHours(0,0,0,0);
            end.setDate(end.getDate() - end.getDay() + 7);
            end.setDate(start.getDate() + 6);
            
            prevStart = new Date(start);
            prevStart.setDate(start.getDate() - 7);
            prevEnd = new Date(end);
            prevEnd.setDate(end.getDate() - 7);
            break;
        case 'this_month':
            start.setDate(1);
            start.setHours(0,0,0,0);
            
            prevStart = new Date(start);
            prevStart.setMonth(start.getMonth() - 1);
            prevEnd = new Date(prevStart);
            prevEnd.setMonth(prevStart.getMonth() + 1);
            prevEnd.setDate(0); 
            prevEnd.setHours(23,59,59,999);
            break;
        case 'last_month':
            start.setDate(1);
            start.setMonth(start.getMonth() - 1);
            start.setHours(0,0,0,0);
            end.setDate(0); 
            
            prevStart = new Date(start);
            prevStart.setMonth(start.getMonth() - 1);
            prevEnd = new Date(prevStart);
            prevEnd.setMonth(prevStart.getMonth() + 1);
            prevEnd.setDate(0);
            break;
        case 'this_year':
            start.setMonth(0, 1);
            start.setHours(0,0,0,0);
            prevStart.setFullYear(start.getFullYear() - 1);
            prevEnd.setFullYear(end.getFullYear() - 1);
            break;
        case 'all':
            start = new Date('2020-01-01');
            prevStart = new Date('2019-01-01'); 
            break;
    }

    if (customStart && customEnd && preset === 'all') {
        start = new Date(customStart);
        end = new Date(customEnd);
        end.setHours(23, 59, 59);
        const duration = end.getTime() - start.getTime();
        prevEnd = new Date(start.getTime() - 1);
        prevStart = new Date(prevEnd.getTime() - duration);
    }

    return { start, end, prevStart, prevEnd };
  };

  // --- CALCULATION ENGINE ---
  const metrics = useMemo(() => {
    const { start, end, prevStart, prevEnd } = getDateRange(datePreset);
    
    const filterSet = (opps: Opportunity[], dStart: Date, dEnd: Date) => {
        return opps.filter(o => {
            // Context Filters
            if (selectedUser && o.user_id !== selectedUser) return false;
            if (selectedOrigin && o.leads?.lead_origin_id !== selectedOrigin) return false;
            return true;
        });
    };

    const currentSet = filterSet(opportunities, start, end);
    
    // NOVAS
    const newDeals = currentSet.filter(o => {
        const d = new Date(o.created_at);
        return d >= start && d <= end;
    });
    const prevNewDeals = filterSet(opportunities, prevStart, prevEnd).filter(o => {
        const d = new Date(o.created_at);
        return d >= prevStart && d <= prevEnd;
    });

    // EM ABERTO
    const openDeals = currentSet.filter(o => o.status === 'open');
    const prevOpenDeals = filterSet(opportunities, prevStart, prevEnd).filter(o => o.status === 'open');

    // PERDIDAS
    const lostDeals = currentSet.filter(o => {
        const d = o.updated_at ? new Date(o.updated_at) : new Date(o.created_at);
        return o.status === 'lost' && d >= start && d <= end;
    });
    const prevLostDeals = filterSet(opportunities, prevStart, prevEnd).filter(o => {
        const d = o.updated_at ? new Date(o.updated_at) : new Date(o.created_at);
        return o.status === 'lost' && d >= prevStart && d <= prevEnd;
    });

    // GANHAS
    const wonDeals = currentSet.filter(o => {
        const d = o.updated_at ? new Date(o.updated_at) : new Date(o.created_at);
        return o.status === 'won' && d >= start && d <= end;
    });
    const prevWonDeals = filterSet(opportunities, prevStart, prevEnd).filter(o => {
        const d = o.updated_at ? new Date(o.updated_at) : new Date(o.created_at);
        return o.status === 'won' && d >= prevStart && d <= prevEnd;
    });

    // RANKINGS
    const originStats: Record<string, { revenue: number, count: number }> = {};
    wonDeals.forEach(o => {
        const originName = o.leads?.origem || 'Desconhecido';
        if (!originStats[originName]) originStats[originName] = { revenue: 0, count: 0 };
        originStats[originName].revenue += (o.final_price || o.min_price || 0);
        originStats[originName].count += 1;
    });
    const topOrigins = Object.entries(originStats)
        .map(([name, stat]) => ({ name, ...stat }))
        .sort((a,b) => b.revenue - a.revenue)
        .slice(0, 3);

    const userStats: Record<string, { revenue: number, count: number }> = {};
    wonDeals.forEach(o => {
        const userName = users.find(u => u.id === o.user_id)?.name || 'Sem Responsável';
        if (!userStats[userName]) userStats[userName] = { revenue: 0, count: 0 };
        userStats[userName].revenue += (o.final_price || o.min_price || 0);
        userStats[userName].count += 1;
    });
    const topUsers = Object.entries(userStats)
        .map(([name, stat]) => ({ name, ...stat }))
        .sort((a,b) => b.revenue - a.revenue)
        .slice(0, 3);

    // --- METRICS ---
    
    // 1. Best Conversion Origin (Won / Total Created)
    const createdByOrigin: Record<string, number> = {};
    newDeals.forEach(o => {
        const nm = o.leads?.origem || 'Desconhecido';
        createdByOrigin[nm] = (createdByOrigin[nm] || 0) + 1;
    });
    
    let bestOrigin = { name: '-', rate: 0, total: 0 };
    Object.keys(originStats).forEach(origin => {
        const won = originStats[origin].count;
        const total = createdByOrigin[origin] || won; 
        const rate = (won / total) * 100;
        if (rate > bestOrigin.rate) bestOrigin = { name: origin, rate, total };
    });

    // 2. Average Closing Time
    let totalDays = 0;
    let closedCount = 0;
    wonDeals.forEach(o => {
        if (o.created_at && o.updated_at) {
            const startD = new Date(o.created_at);
            const endD = new Date(o.updated_at);
            const diffTime = Math.abs(endD.getTime() - startD.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            totalDays += diffDays;
            closedCount++;
        }
    });
    const avgCloseTime = closedCount > 0 ? Math.round(totalDays / closedCount) : 0;

    // 3. Ticket Médio (Average Revenue)
    const wonTotalValue = wonDeals.reduce((a,b) => a + (b.final_price || b.min_price || 0), 0);
    const avgTicket = wonDeals.length > 0 ? wonTotalValue / wonDeals.length : 0;

    // 4. TAXA DE FECHAMENTO (Won / Total Created in Pipeline)
    const totalCreated = newDeals.length;
    const closeRate = totalCreated > 0 ? (wonDeals.length / totalCreated) * 100 : 0;

    return {
        new: {
            current: newDeals,
            prevCount: prevNewDeals.length,
            prevValue: prevNewDeals.reduce((a,b) => a + (b.min_price || 0), 0)
        },
        open: {
            current: openDeals,
            prevCount: prevOpenDeals.length,
            prevValue: prevOpenDeals.reduce((a,b) => a + (b.min_price || 0), 0)
        },
        lost: {
            current: lostDeals,
            prevCount: prevLostDeals.length,
            prevValue: prevLostDeals.reduce((a,b) => a + (b.min_price || 0), 0)
        },
        won: {
            current: wonDeals,
            prevCount: prevWonDeals.length,
            prevValue: prevWonDeals.reduce((a,b) => a + (b.final_price || b.min_price || 0), 0)
        },
        topOrigins,
        topUsers,
        bestOrigin,
        avgCloseTime,
        avgTicket,
        closeRate
    };

  }, [opportunities, datePreset, customStart, customEnd, selectedUser, selectedOrigin, users]);

  // Helper
  const sumValue = (opps: Opportunity[], useFinal = false) => opps.reduce((acc, curr) => {
      const val = useFinal ? (curr.final_price || curr.min_price || 0) : (curr.min_price || 0);
      return acc + val;
  }, 0);

  const renderTrend = (current: number, previous: number, inverse = false) => {
      if (previous === 0) return <span className="text-zinc-500 text-[10px]">-</span>;
      const diff = ((current - previous) / previous) * 100;
      const isPositive = diff > 0;
      const isGood = inverse ? !isPositive : isPositive;
      
      return (
          <div className={`flex items-center gap-1 text-[10px] font-bold ${isGood ? 'text-emerald-500' : 'text-red-500'}`}>
              {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(diff).toFixed(1)}%
          </div>
      );
  };

  const PresetButton = ({ id, label }: { id: DatePreset, label: string }) => (
      <button 
        onClick={() => setDatePreset(id)}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${datePreset === id ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
      >
        {label}
      </button>
  );

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-y-auto custom-scrollbar p-6">
      
      {/* 1. Header Filters */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6 shadow-sm">
         <div className="flex flex-col xl:flex-row justify-between gap-4 mb-4 border-b border-zinc-800 pb-4">
            <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <PieChart className="text-primary-500" /> Painel de Avaliação
                </h2>
                <p className="text-xs text-zinc-500 mt-1">Visão 360º do desempenho comercial</p>
            </div>
            <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800 overflow-x-auto max-w-full gap-1">
                <PresetButton id="today" label="Hoje" />
                <PresetButton id="this_week" label="Esta Semana" />
                <PresetButton id="last_week" label="Semana Passada" />
                <PresetButton id="this_month" label="Este Mês" />
                <PresetButton id="last_month" label="Mês Passado" />
                <PresetButton id="this_year" label="Este Ano" />
                <PresetButton id="all" label="Todo Período" />
            </div>
         </div>

         <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1">
                <Calendar size={14} className="text-zinc-500" />
                <input type="date" value={customStart} onChange={e => {setCustomStart(e.target.value); setDatePreset('all');}} className="bg-transparent text-white text-xs outline-none w-24 [color-scheme:dark]" />
                <span className="text-zinc-600 text-xs">até</span>
                <input type="date" value={customEnd} onChange={e => {setCustomEnd(e.target.value); setDatePreset('all');}} className="bg-transparent text-white text-xs outline-none w-24 [color-scheme:dark]" />
            </div>

            <div className="h-6 w-px bg-zinc-800 hidden md:block"></div>

            <select 
                value={selectedUser} 
                onChange={e => setSelectedUser(e.target.value)} 
                className="bg-zinc-950 border border-zinc-800 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-primary-500 min-w-[150px]"
            >
                <option value="">Todos Responsáveis</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>

            <select 
                value={selectedOrigin} 
                onChange={e => setSelectedOrigin(e.target.value)} 
                className="bg-zinc-950 border border-zinc-800 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-primary-500 min-w-[150px]"
            >
                <option value="">Todas Origens</option>
                {origins.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
         </div>
      </div>

      {/* 2. KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
         
         <KPICard 
            title="Novas (Criadas)" 
            count={metrics.new.current.length}
            value={sumValue(metrics.new.current)}
            prevValue={metrics.new.prevValue}
            borderColor="border-t-blue-500"
            subLabel="Valor Estimado"
            trend={renderTrend(sumValue(metrics.new.current), metrics.new.prevValue)}
         />

         <KPICard 
            title="Em Aberto (Pipeline)" 
            count={metrics.open.current.length}
            value={sumValue(metrics.open.current)}
            prevValue={metrics.open.prevValue}
            borderColor="border-t-yellow-500"
            subLabel="Valor em Pipeline"
            trend={renderTrend(sumValue(metrics.open.current), metrics.open.prevValue)}
         />

         <KPICard 
            title="Perdidas" 
            count={metrics.lost.current.length}
            value={sumValue(metrics.lost.current)}
            prevValue={metrics.lost.prevValue}
            borderColor="border-t-red-500"
            subLabel="Valor Estimado"
            trend={renderTrend(sumValue(metrics.lost.current), metrics.lost.prevValue, true)} 
         />

         <KPICard 
            title="Ganhas (Vendas)" 
            count={metrics.won.current.length}
            value={sumValue(metrics.won.current, true)}
            prevValue={metrics.won.prevValue}
            borderColor="border-t-emerald-500"
            subLabel="Valor Realizado"
            trend={renderTrend(sumValue(metrics.won.current, true), metrics.won.prevValue)}
         />

      </div>

      {/* 3. Middle Ranking Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
         
         {/* Top 3 Origens */}
         <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-sm font-bold text-zinc-300 uppercase mb-4 text-center">Top 3 Origens (Volume em Ganhos)</h3>
            <div className="grid grid-cols-2 gap-8">
               {/* By Revenue */}
               <div>
                  <h4 className="text-xs text-zinc-500 font-bold uppercase mb-3 text-center border-b border-zinc-800 pb-2">Receita</h4>
                  <div className="space-y-4">
                     {metrics.topOrigins.map((item, idx) => (
                        <div key={idx} className="flex flex-col items-center">
                           <span className="text-xs font-bold text-white mb-1">{idx + 1}º - {item.name}</span>
                           <span className="text-lg font-bold text-emerald-500">{formatCurrency(item.revenue)}</span>
                        </div>
                     ))}
                     {metrics.topOrigins.length === 0 && <p className="text-xs text-zinc-600 text-center italic">Sem dados</p>}
                  </div>
               </div>
               {/* By Quantity */}
               <div>
                  <h4 className="text-xs text-zinc-500 font-bold uppercase mb-3 text-center border-b border-zinc-800 pb-2">Quantidade</h4>
                  <div className="space-y-4">
                     {metrics.topOrigins.map((item, idx) => (
                        <div key={idx} className="flex flex-col items-center">
                           <span className="text-xs font-bold text-white mb-1">{idx + 1}º - {item.name}</span>
                           <span className="text-lg font-bold text-white">{item.count}</span>
                        </div>
                     ))}
                     {metrics.topOrigins.length === 0 && <p className="text-xs text-zinc-600 text-center italic">Sem dados</p>}
                  </div>
               </div>
            </div>
         </div>

         {/* Top 3 Responsáveis */}
         <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-sm font-bold text-zinc-300 uppercase mb-4 text-center">Top 3 Responsáveis (Fechamento)</h3>
            <div className="grid grid-cols-2 gap-8">
               {/* By Revenue */}
               <div>
                  <h4 className="text-xs text-zinc-500 font-bold uppercase mb-3 text-center border-b border-zinc-800 pb-2">Receita</h4>
                  <div className="space-y-4">
                     {metrics.topUsers.map((item, idx) => (
                        <div key={idx} className="flex flex-col items-center">
                           <span className="text-xs font-bold text-white mb-1">{idx + 1}º - {item.name}</span>
                           <span className="text-lg font-bold text-emerald-500">{formatCurrency(item.revenue)}</span>
                        </div>
                     ))}
                     {metrics.topUsers.length === 0 && <p className="text-xs text-zinc-600 text-center italic">Sem dados</p>}
                  </div>
               </div>
               {/* By Quantity */}
               <div>
                  <h4 className="text-xs text-zinc-500 font-bold uppercase mb-3 text-center border-b border-zinc-800 pb-2">Quantidade</h4>
                  <div className="space-y-4">
                     {metrics.topUsers.map((item, idx) => (
                        <div key={idx} className="flex flex-col items-center">
                           <span className="text-xs font-bold text-white mb-1">{idx + 1}º - {item.name}</span>
                           <span className="text-lg font-bold text-white">{item.count}</span>
                        </div>
                     ))}
                     {metrics.topUsers.length === 0 && <p className="text-xs text-zinc-600 text-center italic">Sem dados</p>}
                  </div>
               </div>
            </div>
         </div>

      </div>

      {/* 4. Bottom Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
         
         <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col items-center text-center">
            <h4 className="text-xs text-zinc-500 font-bold uppercase mb-3">Origem com Maior Taxa de Conversão</h4>
            <div className="flex-1 flex flex-col justify-center items-center">
               <Award size={32} className="text-yellow-500 mb-2" />
               <span className="text-lg font-bold text-white">{metrics.bestOrigin.name}</span>
               <span className="text-3xl font-black text-white mt-1">{metrics.bestOrigin.rate.toFixed(1)}%</span>
               <span className="text-[10px] text-zinc-500 mt-2">Base: {metrics.bestOrigin.total} leads</span>
            </div>
         </div>

         <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col items-center text-center">
            <h4 className="text-xs text-zinc-500 font-bold uppercase mb-3">Tempo Médio para Fechamento</h4>
            <div className="flex-1 flex flex-col justify-center items-center">
               <Clock size={32} className="text-blue-500 mb-2" />
               <span className="text-4xl font-black text-white">{metrics.avgCloseTime} Dias</span>
               <span className="text-[10px] text-zinc-500 mt-2">Desde a criação até a venda</span>
            </div>
         </div>

         <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col items-center text-center">
            <h4 className="text-xs text-zinc-500 font-bold uppercase mb-3">Ticket Médio</h4>
            <div className="flex-1 flex flex-col justify-center items-center">
               <DollarSign size={32} className="text-emerald-500 mb-2" />
               <span className="text-3xl font-black text-white">{formatCurrency(metrics.avgTicket)}</span>
               <span className="text-[10px] text-zinc-500 mt-2">Por venda realizada</span>
            </div>
         </div>

         <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col items-center text-center">
            <h4 className="text-xs text-zinc-500 font-bold uppercase mb-3">TAXA DE FECHAMENTO</h4>
            <div className="flex-1 flex flex-col justify-center items-center">
               <CheckCircle2 size={32} className="text-purple-500 mb-2" />
               <span className="text-4xl font-black text-white">{metrics.closeRate.toFixed(1)}%</span>
               <span className="text-[10px] text-zinc-500 mt-2">Fórmula: Ganhas / Criadas no Pipeline</span>
            </div>
         </div>

      </div>

    </div>
  );
};

const KPICard = ({ title, count, value, prevValue, borderColor, subLabel, trend }: any) => (
    <div className={`bg-zinc-900 border-t-4 ${borderColor} border-x border-b border-zinc-800 rounded-xl p-6 shadow-lg flex flex-col items-center text-center`}>
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">{title} <span className="text-white ml-1">({count})</span></h3>
        <p className="text-2xl font-black text-white mt-2">{formatCurrency(value)}</p>
        <span className="text-[10px] text-zinc-500 uppercase">{subLabel}</span>
        
        <div className="mt-4 flex flex-col items-center gap-1">
            {trend}
            <span className="text-[10px] text-zinc-600">Período Anterior: {formatCurrency(prevValue)}</span>
        </div>
    </div>
);
