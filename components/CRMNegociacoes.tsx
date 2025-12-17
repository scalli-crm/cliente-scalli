
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Opportunity, User } from '../types';
import { Briefcase, User as UserIcon, RefreshCw, ChevronRight } from 'lucide-react';

interface CRMNegociacoesProps {
  currentUser?: User | null;
  onOpportunityClick: (opp: Opportunity) => void;
}

export const CRMNegociacoes: React.FC<CRMNegociacoesProps> = ({ currentUser, onOpportunityClick }) => {
   const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
   const [loading, setLoading] = useState(true);
   
   useEffect(() => { fetchOpportunities(); }, [currentUser]);

   const fetchOpportunities = async () => {
      setLoading(true);
      try {
         let query = supabase.from('crm_opportunities').select(`*, leads (id, nome, telefone), crm_models (name)`).in('stage', ['proposta', 'negociacao', 'venda', 'perdido']).order('created_at', { ascending: false });
         if (currentUser?.role === 'sales') { query = query.eq('user_id', currentUser.id); }
         const { data, error } = await query;
         if (error) throw error;
         if (data) setOpportunities(data as any);
      } catch (err) { console.error(err); } finally { setLoading(false); }
   };

   const totalValue = opportunities.filter(d => d.stage !== 'perdido' && d.stage !== 'venda').reduce((acc, curr) => acc + (curr.min_price || 0), 0);
   const salesCount = opportunities.filter(d => d.stage === 'venda').length;
   const activeCount = opportunities.filter(d => d.stage === 'negociacao' || d.stage === 'proposta').length;

   if (loading && opportunities.length === 0) { return (<div className="flex items-center justify-center h-full text-zinc-500"><RefreshCw className="animate-spin mr-2" /> Carregando negociações...</div>); }

   return (
      <div className="p-6 h-full overflow-y-auto custom-scrollbar">
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl"><h4 className="text-zinc-400 text-sm font-bold uppercase">Negociações Ativas</h4><p className="text-3xl font-bold text-white mt-2">{activeCount}</p></div>
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl"><h4 className="text-zinc-400 text-sm font-bold uppercase">Pipeline de Valor (Aberto)</h4><p className="text-3xl font-bold text-emerald-500 mt-2">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}</p></div>
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl"><h4 className="text-zinc-400 text-sm font-bold uppercase">Fechamentos no Período</h4><p className="text-3xl font-bold text-blue-500 mt-2">{salesCount}</p></div>
         </div>

         <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center"><h3 className="text-lg font-bold text-white">Oportunidades em Negociação</h3><span className="text-xs text-zinc-500">Clique em "Detalhes" para editar</span></div>
            {opportunities.length === 0 ? (<div className="p-8 text-center text-zinc-500">Nenhuma negociação em andamento encontrada.</div>) : (
               <table className="w-full text-left text-sm text-zinc-400">
                  <thead className="bg-zinc-950 text-zinc-200 uppercase text-xs"><tr><th className="px-6 py-4">Oportunidade / Cliente</th><th className="px-6 py-4">Produto / Interesse</th><th className="px-6 py-4">Valor Proposta</th><th className="px-6 py-4">Etapa</th><th className="px-6 py-4 text-right">Ação</th></tr></thead>
                  <tbody className="divide-y divide-zinc-800">
                     {opportunities.map(opp => (
                        <tr key={opp.id} className="hover:bg-zinc-800/50 transition-colors">
                           <td className="px-6 py-4"><div className="flex flex-col"><span className="font-bold text-white mb-1">{opp.title}</span><div className="flex items-center gap-2 text-zinc-500 text-xs"><UserIcon size={12} /> {opp.leads?.nome || 'Sem cliente'}</div></div></td>
                           <td className="px-6 py-4"><div className="flex items-center gap-2 text-zinc-300"><Briefcase size={14} className="text-primary-500" /> {opp.crm_models?.name || opp.trade_in_description || 'Geral'}</div></td>
                           <td className="px-6 py-4 font-mono text-emerald-500">{opp.min_price ? `R$ ${(opp.min_price).toLocaleString('pt-BR')}` : '-'}</td>
                           <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${opp.stage === 'venda' ? 'bg-emerald-500/10 text-emerald-500' : opp.stage === 'negociacao' ? 'bg-yellow-500/10 text-yellow-500' : opp.stage === 'perdido' ? 'bg-red-500/10 text-red-500' : 'bg-orange-500/10 text-orange-500'}`}>{opp.stage}</span></td>
                           <td className="px-6 py-4 text-right"><button onClick={() => onOpportunityClick(opp)} className="flex items-center justify-end gap-1 ml-auto text-sm font-medium text-primary-500 hover:text-white transition-colors">Detalhes <ChevronRight size={14} /></button></td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            )}
         </div>
      </div>
   );
};
