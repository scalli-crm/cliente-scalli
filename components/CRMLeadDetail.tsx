
import React, { useState, useEffect } from 'react';
import { X, Phone, MessageCircle, Calendar, Clock, Edit2, Save, Trash2, Send, CheckCircle, AlertTriangle, Car, History, Pencil, ExternalLink } from 'lucide-react';
import { Lead, LeadHistory, ScheduleEvent, CRMAppointmentReason } from '../types';
import { supabase } from '../supabaseClient';
import { formatDate } from '../utils/formatters';
import { LeadFormModal } from './LeadFormModal';

interface CRMLeadDetailProps {
  lead: Lead;
  onClose: () => void;
  onUpdate: () => void; // Trigger refresh parent
}

export const CRMLeadDetail: React.FC<CRMLeadDetailProps> = ({ lead, onClose, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'timeline' | 'notes'>('timeline');
  const [history, setHistory] = useState<LeadHistory[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [appointmentReasons, setAppointmentReasons] = useState<CRMAppointmentReason[]>([]);

  // States for Quick Actions
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleData, setScheduleData] = useState<{
    date: string;
    time: string;
    type: string;
    obs: string;
  }>({ date: '', time: '', type: 'visita', obs: '' });

  useEffect(() => {
    fetchHistory();
    fetchAppointmentReasons();
  }, [lead.id]);

  const fetchAppointmentReasons = async () => {
     const { data } = await supabase.from('crm_appointment_reasons').select('*').eq('active', true).order('name');
     if (data && data.length > 0) {
        setAppointmentReasons(data as any);
        setScheduleData(prev => ({ ...prev, type: data[0].name.toLowerCase() }));
     } else {
        // Fallback defaults
        setAppointmentReasons([
           { id: '1', name: 'Visita na Loja', active: true },
           { id: '2', name: 'Test-Drive', active: true },
           { id: '3', name: 'Ligação', active: true }
        ]);
     }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    
    // Tenta buscar ordenado
    let { data, error } = await supabase
      .from('lead_history')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false });
    
    // Fallback se faltar a coluna created_at
    if (error && error.code === '42703') {
       console.warn("Retrying history fetch without sort due to missing column.");
       const res = await supabase
          .from('lead_history')
          .select('*')
          .eq('lead_id', lead.id);
       data = res.data;
       error = res.error;
    }

    // Normaliza os dados (descricao vs description)
    const safeData = data?.map((item: any) => ({
       ...item,
       descricao: item.descricao || item.description || ''
    })) || [];

    setHistory(safeData as any);
    setLoadingHistory(false);
  };

  // Função auxiliar robusta para inserir histórico (Reutilizável)
  const safeInsertHistory = async (leadId: string, text: string, category: string) => {
      // Tentativa 1: Schema Padrão (descricao, categoria)
      let { error } = await supabase.from('lead_history').insert([{
          lead_id: leadId,
          descricao: text,
          categoria: category
      }]);

      // Tentativa 2: Se falhar (PGRST204), tenta 'description'
      if (error && error.code === 'PGRST204') {
          const retryEnglish = await supabase.from('lead_history').insert([{
              lead_id: leadId,
              description: text,
              category: category
          }]);
          error = retryEnglish.error;

          // Tentativa 3: Se ainda falhar, tenta sem categoria
          if (error && error.code === 'PGRST204') {
             const retrySimple = await supabase.from('lead_history').insert([{
                lead_id: leadId,
                descricao: `[${category}] ${text}`
             }]);
             error = retrySimple.error;
          }
      }

      if (error) throw error;
  };

  const addHistory = async (text: string, category: 'sistema' | 'usuario' | 'agendamento' = 'usuario') => {
     // 1. Optimistic Update
     const tempItem: LeadHistory = {
        id: Math.random().toString(),
        lead_id: lead.id,
        descricao: text,
        categoria: category,
        created_at: new Date().toISOString()
     };
     setHistory(prev => [tempItem, ...prev]);

     try {
       // 2. Real Update Robust
       await safeInsertHistory(lead.id, text, category);
       
       // Sync real data silently
       fetchHistory().catch(console.error);
     } catch (err: any) {
       console.error("Erro ao adicionar histórico:", err);
       alert(`Nota adicionada apenas visualmente. Erro no banco: ${err.message || err.code}`);
     }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    
    setLoadingAction(true);
    await addHistory(noteInput, 'usuario');
    setNoteInput('');
    setLoadingAction(false);
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAction(true);
    
    try {
       const { error } = await supabase.from('schedule').insert([{
          lead_id: lead.id,
          tipo: scheduleData.type,
          data: scheduleData.date,
          hora: scheduleData.time,
          observacao: scheduleData.obs,
          status: 'agendado'
       }]);

       if (error) throw error;

       await addHistory(`Agendou ${scheduleData.type} para ${formatDate(scheduleData.date)} às ${scheduleData.time}`, 'agendamento');
       
       // Update lead stage if relevant and matches exact string from legacy system
       // Note: Dynamic reasons might not trigger stage changes automatically if names differ
       const typeLower = scheduleData.type.toLowerCase();
       if (typeLower.includes('visita') && lead.stage !== 'visita' && lead.stage !== 'venda' && lead.stage !== 'negociacao') {
          await supabase.from('leads').update({ stage: 'visita' }).eq('id', lead.id);
          onUpdate();
       } else if (typeLower.includes('test-drive') || typeLower.includes('test drive') && lead.stage !== 'test_drive' && lead.stage !== 'venda' && lead.stage !== 'negociacao') {
          await supabase.from('leads').update({ stage: 'test_drive' }).eq('id', lead.id);
          onUpdate();
       }

       setShowScheduleForm(false);
       alert('Agendamento realizado com sucesso!');
    } catch (err: any) {
       console.error("Erro ao agendar:", err);
       alert("Erro ao salvar agendamento. " + err.message);
    } finally {
       setLoadingAction(false);
    }
  };

  const handleLost = async () => {
    if (confirm('Marcar lead como PERDIDO?')) {
       await supabase.from('leads').update({ stage: 'perdido' }).eq('id', lead.id);
       await addHistory('Marcou lead como Perdido', 'sistema');
       onUpdate();
       onClose();
    }
  };

  // Render History List Logic to allow reuse
  const renderHistoryList = () => (
    <div className="space-y-0 mt-4">
      {loadingHistory && history.length === 0 ? (
          <p className="text-center text-zinc-500 text-sm py-4">Carregando histórico...</p>
      ) : history.length === 0 ? (
          <p className="text-center text-zinc-500 text-sm py-4">Nenhuma atividade registrada.</p>
      ) : (
          history.map((item, idx) => (
            <div key={item.id} className="flex gap-4 group relative pb-6 last:pb-0">
                {/* Connecting Line */}
                {idx !== history.length - 1 && (
                  <div className="absolute left-4 top-8 bottom-0 w-px bg-zinc-800 group-last:hidden"></div>
                )}
                
                {/* Icon */}
                <div className={`w-8 h-8 rounded-full border-2 shrink-0 flex items-center justify-center z-10 bg-zinc-900 ${
                  item.categoria === 'sistema' ? 'border-blue-900 text-blue-500' :
                  item.categoria === 'agendamento' ? 'border-purple-900 text-purple-500' :
                  'border-zinc-700 text-zinc-300'
                }`}>
                  {item.categoria === 'agendamento' ? <Calendar size={14} /> : 
                    item.categoria === 'sistema' ? <History size={14} /> : 
                    <MessageCircle size={14} />}
                </div>

                {/* Content */}
                <div className="flex-1 pt-1">
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap">{item.descricao}</p>
                  <span className="text-[10px] text-zinc-600 mt-1 block">
                      {item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : 'Agora'}
                  </span>
                </div>
            </div>
          ))
      )}
      
      {/* Creation Node */}
      {!loadingHistory && (
          <div className="flex gap-4 relative pt-6">
            <div className="w-8 h-8 rounded-full border-2 border-emerald-900 text-emerald-500 shrink-0 flex items-center justify-center z-10 bg-zinc-900">
                <CheckCircle size={14} />
            </div>
            <div className="flex-1 pt-1">
                <p className="text-sm text-zinc-300">Lead criado no sistema</p>
                <span className="text-[10px] text-zinc-600 mt-1 block">
                  {new Date(lead.created_at).toLocaleString('pt-BR')}
                </span>
            </div>
          </div>
      )}
    </div>
  );

  return (
    <>
    {/* Increased width to 800px for a more "complete" feel */}
    <div className="fixed inset-y-0 right-0 w-full md:w-[800px] bg-zinc-900 border-l border-zinc-800 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
      
      {/* Header */}
      <div className="p-6 border-b border-zinc-800 flex justify-between items-start bg-zinc-950">
        <div>
           <div className="flex items-center gap-3 mb-1">
             <h2 className="text-2xl font-bold text-white">{lead.nome}</h2>
             {lead.stage && (
               <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-md uppercase font-bold tracking-wider border border-zinc-700">
                 {lead.stage.replace('_', ' ')}
               </span>
             )}
           </div>
           <p className="text-sm text-zinc-400 flex items-center gap-2">
             <Car size={16} className="text-primary-500" /> {lead.interesse || 'Interesse não informado'}
           </p>
        </div>
        <div className="flex items-center gap-2">
           <button 
               onClick={() => setIsEditModalOpen(true)}
               className="flex items-center gap-2 text-sm bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors shadow-lg shadow-primary-900/20"
            >
               <Pencil size={16} /> Editar Completo
            </button>
            <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
               <X size={24} />
            </button>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="grid grid-cols-4 gap-1 p-2 border-b border-zinc-800 bg-zinc-900">
         <button className="flex flex-col items-center gap-1 p-3 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-green-500 transition-colors group" title="WhatsApp">
            <MessageCircle size={20} className="group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium">WhatsApp</span>
         </button>
         <button className="flex flex-col items-center gap-1 p-3 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-blue-500 transition-colors group" title="Ligar">
            <Phone size={20} className="group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium">Ligar</span>
         </button>
         <button onClick={() => setShowScheduleForm(!showScheduleForm)} className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-colors group ${showScheduleForm ? 'bg-zinc-800 text-purple-500' : 'hover:bg-zinc-800 text-zinc-400 hover:text-purple-500'}`} title="Agendar">
            <Calendar size={20} className="group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium">Agendar</span>
         </button>
         <button onClick={handleLost} className="flex flex-col items-center gap-1 p-3 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-red-500 transition-colors group" title="Perdido">
            <AlertTriangle size={20} className="group-hover:scale-110 transition-transform" />
            <span className="text-xs font-medium">Perdido</span>
         </button>
      </div>

      {/* Schedule Form (Collapsible) */}
      {showScheduleForm && (
         <div className="p-6 bg-zinc-800/30 border-b border-zinc-800 animate-in slide-in-from-top-2">
            <form onSubmit={handleSchedule} className="space-y-4">
               <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock size={16} className="text-purple-500" /> Novo Agendamento
               </h4>
               <div className="flex flex-col md:flex-row gap-3">
                  <select 
                     className="bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 text-sm text-white flex-1 focus:ring-1 focus:ring-purple-500 outline-none"
                     value={scheduleData.type}
                     onChange={e => setScheduleData({...scheduleData, type: e.target.value})}
                  >
                     {appointmentReasons.map(r => (
                        <option key={r.id} value={r.name}>{r.name}</option>
                     ))}
                  </select>
                  <input 
                     type="date" 
                     className="bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 text-sm text-white [color-scheme:dark] focus:ring-1 focus:ring-purple-500 outline-none"
                     required
                     value={scheduleData.date}
                     onChange={e => setScheduleData({...scheduleData, date: e.target.value})}
                  />
                  <input 
                     type="time" 
                     className="bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 text-sm text-white [color-scheme:dark] focus:ring-1 focus:ring-purple-500 outline-none"
                     required
                     value={scheduleData.time}
                     onChange={e => setScheduleData({...scheduleData, time: e.target.value})}
                  />
               </div>
               <input 
                  type="text"
                  placeholder="Observação (Ex: Cliente prefere carro automático)"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 text-sm text-white focus:ring-1 focus:ring-purple-500 outline-none"
                  value={scheduleData.obs}
                  onChange={e => setScheduleData({...scheduleData, obs: e.target.value})}
               />
               <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowScheduleForm(false)} className="text-sm text-zinc-400 hover:text-white px-4 py-2">Cancelar</button>
                  <button type="submit" disabled={loadingAction} className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-lg shadow-purple-900/20">
                     {loadingAction ? 'Salvando...' : 'Confirmar Agendamento'}
                  </button>
               </div>
            </form>
         </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 px-6">
         <button onClick={() => setActiveTab('timeline')} className={`pb-3 pt-4 text-sm font-medium transition-colors border-b-2 mr-6 ${activeTab === 'timeline' ? 'border-primary-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
            Linha do Tempo
         </button>
         <button onClick={() => setActiveTab('info')} className={`pb-3 pt-4 text-sm font-medium transition-colors border-b-2 ${activeTab === 'info' ? 'border-primary-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
            Dados do Cliente
         </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-zinc-900 custom-scrollbar">
         
         {/* TIMELINE TAB */}
         {activeTab === 'timeline' && (
            <div className="space-y-8">
               
               {/* Note Input */}
               <form onSubmit={handleAddNote} className="flex gap-3 items-start">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700">
                     <Edit2 size={16} className="text-zinc-400" />
                  </div>
                  <div className="flex-1">
                     <div className="relative">
                        <textarea 
                           className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none shadow-inner"
                           placeholder="Escreva uma nota, resumo de ligação ou observação..."
                           rows={3}
                           value={noteInput}
                           onChange={e => setNoteInput(e.target.value)}
                        />
                        <button 
                           type="submit" 
                           disabled={!noteInput.trim() || loadingAction} 
                           className="absolute bottom-3 right-3 bg-primary-600 hover:bg-primary-700 text-white p-2 rounded-lg transition-colors disabled:opacity-50 disabled:hidden"
                        >
                           <Send size={14} />
                        </button>
                     </div>
                  </div>
               </form>

               {renderHistoryList()}
            </div>
         )}

         {/* INFO TAB */}
         {activeTab === 'info' && (
            <div className="space-y-8">
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                     <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Contato</h3>
                     <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-4">
                        <InfoRow label="Nome" value={lead.nome} />
                        <div className="h-px bg-zinc-900"></div>
                        <InfoRow label="Telefone" value={lead.telefone} copy />
                        <div className="h-px bg-zinc-900"></div>
                        <InfoRow label="Email" value={lead.email || '-'} />
                     </div>
                  </div>

                  <div className="md:col-span-2">
                     <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 mt-2">Interesse</h3>
                     <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-4">
                        <InfoRow label="Veículo" value={lead.interesse} highlight />
                        <div className="h-px bg-zinc-900"></div>
                        <div className="grid grid-cols-2 gap-4">
                           <InfoRow label="Ano Mín" value={lead.ano_min || '-'} />
                           <InfoRow label="Ano Máx" value={lead.ano_max || '-'} />
                        </div>
                        <div className="h-px bg-zinc-900"></div>
                        <div className="grid grid-cols-2 gap-4">
                           <InfoRow label="Preço Mín" value={lead.faixa_preco_min ? `R$ ${lead.faixa_preco_min}` : '-'} />
                           <InfoRow label="Preço Máx" value={lead.faixa_preco_max ? `R$ ${lead.faixa_preco_max}` : '-'} />
                        </div>
                     </div>
                  </div>

                  <div>
                     <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 mt-2">Origem</h3>
                     <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                        <InfoRow label="Canal" value={lead.origem} />
                     </div>
                  </div>
                  <div>
                     <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 mt-2">Sistema</h3>
                     <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                        <InfoRow label="ID" value={lead.id} small />
                     </div>
                  </div>
               </div>

               <div className="border-t border-zinc-800 pt-6">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Histórico Completo</h3>
                  {renderHistoryList()}
               </div>
            </div>
         )}

      </div>
    </div>

    {/* EDIT MODAL */}
    <LeadFormModal 
       isOpen={isEditModalOpen}
       onClose={() => setIsEditModalOpen(false)}
       onSuccess={() => {
          onUpdate(); // Refresh parent lists
          fetchHistory(); // Also fetch history as edit logs an event
       }}
       leadToEdit={lead}
    />
    </>
  );
};

const InfoRow = ({ label, value, copy, highlight, small }: any) => (
   <div className="flex justify-between items-center">
      <span className="text-sm text-zinc-500">{label}</span>
      <div className="flex items-center gap-2">
         <span className={`text-right ${highlight ? 'text-white font-bold' : 'text-zinc-300'} ${small ? 'text-xs font-mono' : 'text-sm'}`}>
            {value}
         </span>
         {copy && (
            <button 
               onClick={() => {navigator.clipboard.writeText(value); alert('Copiado!')}} 
               className="text-zinc-600 hover:text-primary-500 transition-colors"
               title="Copiar"
            >
               <div className="w-4 h-4 border border-current rounded flex items-center justify-center text-[8px]">C</div>
            </button>
         )}
      </div>
   </div>
);
