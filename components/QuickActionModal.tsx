import React, { useState, useEffect } from 'react';
import { X, Send, CheckCircle, ExternalLink, StickyNote, Bell, History, Flag, Clock, ArrowRight } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { Opportunity, LeadHistory, User } from '../types';
import { formatDate } from '../utils/formatters';

interface QuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunity: Opportunity | null;
  onOpenFullDetails: (opp: Opportunity) => void;
  onOpenHistory?: (leadId: string) => void;
  onSuccess: () => void;
  currentUser?: User | null;
}

export const QuickActionModal: React.FC<QuickActionModalProps> = ({ 
  isOpen, onClose, opportunity, onOpenFullDetails, onSuccess, currentUser, onOpenHistory 
}) => {
  const [activeTab, setActiveTab] = useState<'note' | 'task'>('note');
  const [note, setNote] = useState('');
  const [taskData, setTaskData] = useState({ title: '', date: '', time: '' });
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<LeadHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (isOpen && opportunity) {
      fetchHistory();
      // Reset states
      setActiveTab('note');
      setNote('');
      setTaskData({ title: '', date: '', time: '' });
    }
  }, [isOpen, opportunity]);

  const fetchHistory = async () => {
    if (!opportunity) return;
    setLoadingHistory(true);
    
    // Tenta buscar ordenado por data
    let { data, error } = await supabase
      .from('lead_history')
      .select('*')
      .eq('lead_id', opportunity.lead_id)
      .order('created_at', { ascending: false })
      .limit(5);
    
    // Fallback: Se der erro de coluna inexistente (42703), busca sem ordenar
    if (error && error.code === '42703') {
       console.warn("Coluna created_at ausente no histórico. Buscando sem ordenação.");
       const retry = await supabase
          .from('lead_history')
          .select('*')
          .eq('lead_id', opportunity.lead_id)
          .limit(5);
       data = retry.data;
       error = retry.error;
    }
    
    if (error) {
       console.error("Erro ao buscar histórico:", error);
    }
    
    // Mapeia description -> descricao se necessário para evitar erros de renderização
    const safeData = data?.map((item: any) => ({
        ...item,
        descricao: item.descricao || item.description || ''
    })) || [];
    
    setHistory(safeData as any);
    setLoadingHistory(false);
  };

  // Função auxiliar robusta para inserir histórico
  const safeInsertHistory = async (leadId: string, text: string, category: string) => {
      // Tentativa 1: Schema Padrão (descricao, categoria)
      let { error } = await supabase.from('lead_history').insert([{
          lead_id: leadId,
          descricao: text,
          categoria: category
      }]);

      // Tentativa 2: Se falhar (PGRST204 - Coluna não encontrada), tenta 'description' (Inglês)
      if (error && error.code === 'PGRST204') {
          console.warn("Tentativa 1 falhou (coluna descricao?). Tentando 'description'...");
          const retryEnglish = await supabase.from('lead_history').insert([{
              lead_id: leadId,
              description: text,
              category: category
          }]);
          
          error = retryEnglish.error;

          // Tentativa 3: Se ainda falhar, tenta inserir APENAS descricao (sem categoria, que pode ser o erro)
          if (error && error.code === 'PGRST204') {
             console.warn("Tentativa 2 falhou. Tentando inserir sem categoria na coluna descricao...");
             const retrySimple = await supabase.from('lead_history').insert([{
                lead_id: leadId,
                descricao: `[${category}] ${text}`
             }]);
             error = retrySimple.error;
          }
      }

      if (error) throw error;
  };

  if (!isOpen || !opportunity) return null;

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    setLoading(true);
    
    const userName = currentUser?.name || 'Usuário';
    const desc = `${userName} fez uma anotação: ${note}`;

    // 1. Atualização Otimista (Mostra na tela antes de salvar)
    const optimisticItem: LeadHistory = {
       id: Math.random().toString(), // ID temporário
       lead_id: opportunity.lead_id,
       descricao: desc,
       categoria: 'usuario',
       created_at: new Date().toISOString()
    };
    setHistory(prev => [optimisticItem, ...prev]);
    setNote(''); // Limpa o campo imediatamente

    try {
      // 2. Salva no Banco usando função robusta
      await safeInsertHistory(opportunity.lead_id, desc, 'usuario');

      onSuccess();
      // Recarrega silenciosamente para pegar o ID real, se possível
      fetchHistory().catch(console.error);
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao salvar nota no banco: ${err.message || err.code}. Mas ela foi exibida temporariamente.`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskData.title || !taskData.date || !taskData.time) return;
    setLoading(true);
    
    const userName = currentUser?.name || 'Usuário';
    const taskDesc = `${userName} criou a tarefa: ${taskData.title} para ${formatDate(taskData.date)}`;

    // 1. Atualização Otimista
    const optimisticItem: LeadHistory = {
       id: Math.random().toString(),
       lead_id: opportunity.lead_id,
       descricao: taskDesc,
       categoria: 'agendamento',
       created_at: new Date().toISOString()
    };
    setHistory(prev => [optimisticItem, ...prev]);
    
    // Armazena dados do form para limpar
    const formBackup = { ...taskData };
    setTaskData({ title: '', date: '', time: '' });

    try {
      const { error: schedError } = await supabase.from('schedule').insert([{
        lead_id: opportunity.lead_id,
        user_id: opportunity.user_id,
        tipo: 'tarefa',
        title: formBackup.title,
        data: formBackup.date,
        hora: formBackup.time,
        status: 'agendado',
        observacao: `Tarefa criada via Pipeline por ${userName}`
      }]);

      if (schedError) throw schedError;

      await safeInsertHistory(opportunity.lead_id, taskDesc, 'agendamento');

      onSuccess();
      fetchHistory().catch(console.error);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao criar tarefa: ' + (err.message || err.code));
    } finally {
      setLoading(false);
    }
  };

  // Helper to parse description for bold name highlighting
  const renderHistoryContent = (text: string) => {
     if (!text) return <span className="text-zinc-500 italic">Sem descrição</span>;

     const actions = ['alterou', 'criou', 'fez', 'agendou', 'atualizou', 'moveu'];
     let name = '';
     let action = text;

     for (const verb of actions) {
        const index = text.indexOf(` ${verb} `);
        if (index > -1) {
           name = text.substring(0, index);
           action = text.substring(index);
           break;
        }
     }

     if (name) {
        return (
           <>
              <span className="font-bold text-zinc-200">{name}</span>
              <span className="text-zinc-400">{action}</span>
           </>
        );
     }
     
     if (text.toLowerCase().includes('negociação criada')) {
        return <span className="font-bold text-zinc-200">{text}</span>;
     }

     return <span className="text-zinc-300">{text}</span>;
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-white font-bold">{opportunity.title}</h3>
            <p className="text-xs text-zinc-500">{opportunity.leads?.nome}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/50 shrink-0">
          <button 
            onClick={() => setActiveTab('note')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'note' ? 'text-primary-500 border-b-2 border-primary-500 bg-primary-500/5' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <StickyNote size={16} /> Anotação
          </button>
          <button 
            onClick={() => setActiveTab('task')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'task' ? 'text-primary-500 border-b-2 border-primary-500 bg-primary-500/5' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <Bell size={16} /> Tarefa
          </button>
        </div>

        {/* Scrollable Content Area: Input + History */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            
            {/* Input Form */}
            <div className="p-5 bg-zinc-900 border-b border-zinc-800">
              {activeTab === 'note' ? (
                <form onSubmit={handleSaveNote}>
                  <textarea
                    autoFocus
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-white text-sm focus:ring-1 focus:ring-primary-500 outline-none resize-none placeholder-zinc-600"
                    rows={3}
                    placeholder="Escreva uma observação rápida sobre o cliente..."
                    value={note}
                    onChange={e => setNote(e.target.value)}
                  ></textarea>
                  <div className="flex justify-end mt-3">
                    <button 
                      type="submit" 
                      disabled={loading || !note.trim()} 
                      className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 disabled:opacity-50 uppercase tracking-wide"
                    >
                      {loading ? 'Salvando...' : <><Send size={14} /> Salvar Nota</>}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleSaveTask} className="space-y-3">
                  <div>
                    <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">O que precisa ser feito?</label>
                    <input 
                      type="text" 
                      autoFocus
                      required
                      placeholder="Ex: Ligar para confirmar, Enviar contrato..."
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 text-white text-sm focus:ring-1 focus:ring-primary-500 outline-none"
                      value={taskData.title}
                      onChange={e => setTaskData({...taskData, title: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Data</label>
                      <input 
                        type="date" 
                        required
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 text-white text-sm [color-scheme:dark] focus:ring-1 focus:ring-primary-500 outline-none"
                        value={taskData.date}
                        onChange={e => setTaskData({...taskData, date: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 uppercase font-bold mb-1 block">Hora</label>
                      <input 
                        type="time" 
                        required
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 text-white text-sm [color-scheme:dark] focus:ring-1 focus:ring-primary-500 outline-none"
                        value={taskData.time}
                        onChange={e => setTaskData({...taskData, time: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end mt-3">
                    <button 
                      type="submit" 
                      disabled={loading} 
                      className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 disabled:opacity-50 uppercase tracking-wide"
                    >
                      {loading ? 'Agendando...' : <><CheckCircle size={14} /> Criar Tarefa</>}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Timeline History Section */}
            <div className="p-5 bg-zinc-900/50">
               <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-zinc-500">
                     <History size={14} />
                     <span className="text-xs font-bold uppercase tracking-wider">Histórico Recente (5)</span>
                     {loadingHistory && <span className="text-[10px] animate-pulse">Atualizando...</span>}
                  </div>
                  {onOpenHistory && (
                     <button onClick={() => onOpenHistory(opportunity.lead_id)} className="text-[10px] text-primary-500 hover:text-white flex items-center gap-1">
                        Ver Tudo <ArrowRight size={10} />
                     </button>
                  )}
               </div>

               {history.length === 0 ? (
                  <p className="text-center text-zinc-600 text-xs italic py-2">Nenhum histórico recente.</p>
               ) : (
                  <div className="relative pl-2">
                     {/* Continuous Line */}
                     <div className="absolute left-[7px] top-2 bottom-4 w-0.5 bg-zinc-800"></div>

                     {history.map((item, idx) => {
                        let dotClass = 'bg-zinc-500';
                        let Icon = null;
                        const desc = item.descricao || ''; // Defensive

                        if (desc.toLowerCase().includes('negociação criada')) {
                           dotClass = 'bg-pink-500';
                           Icon = Flag;
                        } else if (idx === 0) {
                           dotClass = 'bg-purple-500';
                        }

                        return (
                           <div key={item.id} className="relative pl-8 pb-6 last:pb-0">
                              {/* Dot */}
                              <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full ${dotClass} ring-4 ring-zinc-900 flex items-center justify-center z-10`}>
                                 {Icon && <Icon size={8} className="text-white" />}
                              </div>
                              
                              {/* Content */}
                              <div>
                                 <p className="text-sm leading-snug">
                                    {renderHistoryContent(desc)}
                                 </p>
                                 <span className="text-[10px] text-zinc-600 mt-1 block font-medium">
                                    {item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : 'Agora'}
                                 </span>
                              </div>
                           </div>
                        );
                     })}
                  </div>
               )}
            </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-zinc-900 border-t border-zinc-800 flex justify-center shrink-0">
          <button 
            onClick={() => { onClose(); onOpenFullDetails(opportunity); }}
            className="text-xs text-zinc-400 hover:text-white flex items-center gap-2 transition-colors py-1.5 px-3 rounded hover:bg-zinc-800 uppercase font-bold tracking-wider"
          >
            <ExternalLink size={12} /> Abrir Oportunidade Completa
          </button>
        </div>

      </div>
    </div>
  );
};