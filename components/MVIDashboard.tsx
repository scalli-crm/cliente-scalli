
import React from 'react';
import { DailyRecord } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { Users, TrendingUp, DollarSign, Calendar, Clock, CheckCircle, Briefcase, FileText, Activity } from 'lucide-react';

interface MVIDashboardProps {
  data: DailyRecord[];
}

export const MVIDashboard: React.FC<MVIDashboardProps> = ({ data }) => {
  // Aggregate Data
  const totals = data.reduce((acc, curr) => ({
    leads: acc.leads + curr.leads,
    scheduled: acc.scheduled + curr.scheduled,
    attended: acc.attended + curr.attended,
    testDrives: acc.testDrives + curr.testDrives, // Mapeado para Demos/Reuniões
    proposals: acc.proposals + (curr.proposals || 0),
    approvals: acc.approvals + curr.approvals,
    sales: acc.sales + curr.sales,
    investment: acc.investment + curr.investment,
  }), {
    leads: 0, scheduled: 0, attended: 0, testDrives: 0, proposals: 0, approvals: 0, sales: 0, investment: 0
  });

  // Safe division to avoid Infinity/NaN
  const calcRate = (num: number, den: number): string => {
    return den > 0 ? ((num / den) * 100).toFixed(1) : '0.0';
  };

  const calcCost = (cost: number, qtd: number): string => {
    return qtd > 0 ? formatCurrency(cost / qtd) : 'R$ 0,00';
  };

  // Top KPIs
  const conversionRate = calcRate(totals.sales, totals.leads);
  const costPerLead = calcCost(totals.investment, totals.leads);
  const costPerSale = calcCost(totals.investment, totals.sales);

  // Section 1: Funnel
  const schedulingRate = calcRate(totals.scheduled, totals.leads);
  const attendanceRate = calcRate(totals.attended, totals.scheduled);
  const attendanceToSale = calcRate(totals.sales, totals.attended);

  // Section 2: Diagnostics
  // testDrives -> Reuniões/Demos
  const demoToSale = calcRate(totals.sales, totals.testDrives);
  const proposalToSale = calcRate(totals.sales, totals.proposals);
  const approvalToSale = calcRate(totals.sales, totals.approvals);
  const attendanceToDemo = calcRate(totals.testDrives, totals.attended);
  const demoToProposal = calcRate(totals.proposals, totals.testDrives);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      
      {/* 3. Indicadores Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-zinc-400 text-xs uppercase font-bold tracking-wider mb-1">Total de Leads</p>
              <h3 className="text-4xl font-bold text-white">{formatNumber(totals.leads)}</h3>
            </div>
            <div className="p-3 bg-zinc-800 rounded-lg text-zinc-400">
              <Users size={20} />
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-lg">
           <div className="flex justify-between items-start">
            <div>
              <p className="text-zinc-400 text-xs uppercase font-bold tracking-wider mb-1">Taxa de Conversão Geral</p>
              <h3 className="text-4xl font-bold text-emerald-500">{conversionRate}%</h3>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-500">
              <TrendingUp size={20} />
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-lg">
           <div className="flex justify-between items-start">
            <div>
              <p className="text-zinc-400 text-xs uppercase font-bold tracking-wider mb-1">Custo por Lead</p>
              <h3 className="text-3xl font-bold text-white">{costPerLead}</h3>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500">
              <DollarSign size={20} />
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-lg">
           <div className="flex justify-between items-start">
            <div>
              <p className="text-zinc-400 text-xs uppercase font-bold tracking-wider mb-1">CAC (Custo/Venda)</p>
              <h3 className="text-3xl font-bold text-white">{costPerSale}</h3>
            </div>
            <div className="p-3 bg-red-500/10 rounded-lg text-red-500">
              <DollarSign size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* 4. SEÇÃO 1: FUNIL PRINCIPAL */}
      <div>
        <h2 className="text-xl font-bold text-primary-500 mb-1">SEÇÃO 1: FUNIL PRINCIPAL</h2>
        <p className="text-zinc-500 text-sm mb-4">Eficiência de Agendamento e Comparecimento</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 relative overflow-hidden group hover:border-zinc-700 transition-colors">
            <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
               <Calendar className="text-zinc-600" size={24} />
            </div>
            <p className="text-zinc-400 font-medium mb-2">Taxa de Agendamento</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-5xl font-bold text-blue-400">{schedulingRate}%</h3>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 relative overflow-hidden group hover:border-zinc-700 transition-colors">
             <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
               <Clock className="text-zinc-600" size={24} />
            </div>
            <p className="text-zinc-400 font-medium mb-2">Taxa de Comparecimento</p>
             <div className="flex items-baseline gap-2">
              <h3 className="text-5xl font-bold text-blue-400">{attendanceRate}%</h3>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 relative overflow-hidden group hover:border-zinc-700 transition-colors">
             <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
               <DollarSign className="text-zinc-600" size={24} />
            </div>
            <p className="text-zinc-400 font-medium mb-2">Conversão Comparecimento → Venda</p>
             <div className="flex items-baseline gap-2">
              <h3 className="text-5xl font-bold text-blue-400">{attendanceToSale}%</h3>
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO 2: MÉTRICAS DE DIAGNÓSTICO */}
      <div>
        <h2 className="text-xl font-bold text-red-500 mb-1">SEÇÃO 2: DIAGNÓSTICO DE VENDAS</h2>
        <p className="text-zinc-500 text-sm mb-4">Métricas de qualidade do processo comercial</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="bg-[#1a0f0f] border border-red-900/30 rounded-xl p-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-20">
               <Briefcase className="text-red-500" size={24} />
            </div>
            <p className="text-zinc-300 font-medium mb-2 flex items-center gap-2">
              Reunião/Demo <span className="text-zinc-500">→</span> Venda
            </p>
            <h3 className="text-5xl font-bold text-red-500">{demoToSale}%</h3>
          </div>

          <div className="bg-[#1a0f0f] border border-red-900/30 rounded-xl p-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-20">
               <FileText className="text-red-500" size={24} />
            </div>
            <p className="text-zinc-300 font-medium mb-2 flex items-center gap-2">
              Proposta <span className="text-zinc-500">→</span> Venda
            </p>
            <h3 className="text-5xl font-bold text-red-500">{proposalToSale}%</h3>
          </div>

          <div className="bg-[#1a0f0f] border border-red-900/30 rounded-xl p-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-20">
               <CheckCircle className="text-red-500" size={24} />
            </div>
            <p className="text-zinc-300 font-medium mb-2 flex items-center gap-2">
              Aprovação Final <span className="text-zinc-500">→</span> Venda
            </p>
            <h3 className="text-5xl font-bold text-red-500">{approvalToSale}%</h3>
          </div>

          <div className="bg-[#1a0f0f] border border-red-900/30 rounded-xl p-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-20">
               <Activity className="text-red-500" size={24} />
            </div>
            <p className="text-zinc-300 font-medium mb-2 flex items-center gap-2">
              Comparecimento <span className="text-zinc-500">→</span> Reunião
            </p>
            <h3 className="text-5xl font-bold text-red-500">{attendanceToDemo}%</h3>
          </div>

          <div className="bg-[#1a0f0f] border border-red-900/30 rounded-xl p-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-20">
               <TrendingUp className="text-red-500" size={24} />
            </div>
            <p className="text-zinc-300 font-medium mb-2 flex items-center gap-2">
              Reunião <span className="text-zinc-500">→</span> Proposta
            </p>
            <h3 className="text-5xl font-bold text-red-500">{demoToProposal}%</h3>
          </div>

        </div>
      </div>

    </div>
  );
};
