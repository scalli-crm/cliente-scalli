import React from 'react';
import { Users, DollarSign, TrendingUp, CreditCard, BarChart2, Activity } from 'lucide-react';
import { DailyRecord } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface StatsCardsProps {
  data: DailyRecord[];
}

export const StatsCards: React.FC<StatsCardsProps> = ({ data }) => {
  const totalLeads = data.reduce((acc, curr) => acc + curr.leads, 0);
  const totalSales = data.reduce((acc, curr) => acc + curr.sales, 0);
  const totalRevenue = data.reduce((acc, curr) => acc + curr.revenue, 0);
  
  // Calculate simple conversion rate
  const conversionRate = totalLeads > 0 ? ((totalSales / totalLeads) * 100).toFixed(1) : '0';

  const cardClass = "relative overflow-hidden bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:border-zinc-700 group";
  const glowClass = "absolute -top-10 -right-10 w-40 h-40 rounded-full blur-[60px] opacity-20 transition-opacity duration-500 group-hover:opacity-40";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      
      {/* LEADS CARD - Primary Yellow Glow (Brand Color) */}
      <div className={cardClass}>
        <div className={`${glowClass} bg-primary-600`}></div>
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Total de Leads</p>
              <h3 className="text-3xl font-black text-white mt-1">{formatNumber(totalLeads)}</h3>
            </div>
            <div className="p-3 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl text-white shadow-lg shadow-primary-900/30">
              <Users size={22} />
            </div>
          </div>
          <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 w-[70%]"></div>
          </div>
          <p className="text-[10px] text-zinc-500 mt-2 flex items-center gap-1">
            <Activity size={10} className="text-primary-500" /> Fluxo constante
          </p>
        </div>
      </div>

      {/* SALES CARD - Emerald Glow */}
      <div className={cardClass}>
        <div className={`${glowClass} bg-emerald-500`}></div>
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Vendas Totais</p>
              <h3 className="text-3xl font-black text-white mt-1">{formatNumber(totalSales)}</h3>
            </div>
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl text-white shadow-lg shadow-emerald-900/30">
              <TrendingUp size={22} />
            </div>
          </div>
          <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 w-[45%]"></div>
          </div>
          <p className="text-[10px] text-zinc-500 mt-2">
            Performance de fechamento
          </p>
        </div>
      </div>

      {/* REVENUE CARD - Blue Glow */}
      <div className={cardClass}>
        <div className={`${glowClass} bg-blue-500`}></div>
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Faturamento</p>
              <h3 className="text-3xl font-black text-white mt-1">{formatCurrency(totalRevenue)}</h3>
            </div>
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl text-white shadow-lg shadow-blue-900/30">
              <DollarSign size={22} />
            </div>
          </div>
          <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 w-[85%]"></div>
          </div>
          <p className="text-[10px] text-zinc-500 mt-2">
            Receita bruta acumulada
          </p>
        </div>
      </div>

      {/* CONVERSION CARD - Violet Glow */}
      <div className={cardClass}>
        <div className={`${glowClass} bg-violet-500`}></div>
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Conversão</p>
              <h3 className="text-3xl font-black text-white mt-1">{conversionRate}%</h3>
            </div>
            <div className="p-3 bg-gradient-to-br from-violet-500 to-violet-700 rounded-xl text-white shadow-lg shadow-violet-900/30">
              <BarChart2 size={22} />
            </div>
          </div>
          <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500" style={{ width: `${Math.min(parseFloat(conversionRate), 100)}%` }}></div>
          </div>
          <p className="text-[10px] text-zinc-500 mt-2">
            Leads convertidos em vendas
          </p>
        </div>
      </div>

    </div>
  );
};