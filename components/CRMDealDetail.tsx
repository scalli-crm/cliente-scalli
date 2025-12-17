
import React, { useState, useEffect } from 'react';
import { Save, X, User, Phone, Briefcase, Calendar, DollarSign, Clock, Bell, CheckSquare, MessageSquare, History, CheckCircle, AlertTriangle, PlayCircle } from 'lucide-react';
import { Lead, LeadHistory, CRMStage } from '../types';
import { supabase } from '../supabaseClient';
import { formatCurrency, formatDate } from '../utils/formatters';

interface CRMDealDetailProps {
  deal: Lead;
  onClose: () => void;
  onUpdate: () => void;
}

// B2B Stages mapping
const STAGES: { id: CRMStage; label: string }[] = [
  { id: 'novo', label: 'Novo' },
  { id: 'atendimento', label: 'Qualificação' },
  { id: 'visita', label: 'Apresentação' },
  { id: 'test_drive', label: 'Demonstração' },
  { id: 'proposta', label: 'Proposta' },
  { id: 'negociacao', label: 'Negociação' },
  { id: 'venda', label: 'Fechado Ganho' },
  { id: 'perdido', label: 'Perdido' }
];

export const CRMDealDetail: React.FC<CRMDealDetailProps> = ({ deal, onClose, onUpdate }) => {
  const [formData, setFormData] = useState<Partial<Lead>>({});
  const [history, setHistory] = useState<LeadHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleData, setScheduleData] = useState<{
    date: string;
    time: string;
    type: string;
    obs: string;
  }>({ date: '', time: '', type: 'reuniao', obs: '' });

  useEffect(() => {
    if (deal) {
      setFormData(deal);
      if (deal.return_date) {
        const dt = new Date(deal.return_date);
        setReturnDate(dt.toISOString().split('T')[0]);
        setReturnTime(dt.toTimeString().slice(0, 5));
      } else {
        setReturnDate('');
        setReturnTime('');
      }
      fetchHistory();
    }
  }, [deal]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    const { data } = await supabase.from('lead_history').select('*').eq('lead_id', deal.id).order('created_at', { ascending: false });
    if (data) setHistory(data as any);
    setLoadingHistory(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const checked = (e.target as HTMLInputElement).checked;
        setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const saveChanges = async () => {
    setLoading(true);
    try {
      let finalReturnDate = null;
      if (returnDate && returnTime) {
         finalReturnDate = new Date(`${returnDate}T${returnTime}`).toISOString();
      }
      const updates = { ...formData, return_date: finalReturnDate, last_contact_at: new Date().toISOString() };
      const { error } = await supabase.from('leads').update(updates).eq('id', deal.id);
      if (error) throw error;

      if (formData.stage !== deal.stage) {
         await supabase.from('lead_history').insert([{ lead_id: deal.id, descricao: `Mudou etapa de ${deal.stage} para ${formData.stage}`, categoria: 'sistema' }]);
      }
      if (newNote.trim()) {
         await supabase.from('lead_history').insert([{ lead_id: deal.id, descricao: newNote, categoria: 'usuario' }]);
         setNewNote('');
      }
      await fetchHistory();
      onUpdate();
      alert('Lead atualizado com sucesso!');
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const markStatus = async (status: CRMStage) => {
     setFormData(prev => ({ ...prev, stage: status }));
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
       const { error } = await supabase.from('schedule').insert([{
          lead_id: deal.id,
          tipo: scheduleData.type,
          data: scheduleData.date,
          hora: scheduleData.time,
          observacao: scheduleData.obs,
          status: 'agendado'
       }]);
       if (error) throw error;
       await supabase.from('lead_history').insert([{ lead_id: deal.id, descricao: `Agendou ${scheduleData.type.toUpperCase()} para ${formatDate(scheduleData.date)} às ${scheduleData.time}`, categoria: 'agendamento' }]);
       setShowScheduleForm(false);
       onUpdate();
       fetchHistory();
       alert('Agendamento realizado!');
    } catch (err: any) {
       alert("Erro ao salvar agendamento: " + err.message);
    } finally {
       setLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-500 mt-4">
      <div className="bg-sky-500/10 py-2 px-4 border-b border-sky-500/20 flex justify-between items-center">
        <div className="flex items-center gap-3">
           <button onClick={onClose} className="px-4 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-xs font-medium transition-colors">Voltar</button>
           <button onClick={() => setShowScheduleForm(!showScheduleForm)} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 border ${showScheduleForm ? 'bg-purple-600 border-purple-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white hover:border-purple-500'}`}><Calendar size={14} /> Agendar</button>
           <button onClick={saveChanges} disabled={loading} className="px-6 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-2 shadow-lg shadow-primary-900/20">{loading ? 'Salvando...' : <><Save size={14} /> Salvar Alterações</>}</button>
        </div>
        <div className="flex items-center gap-2"><span className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold">ID: {deal.id.substring(0,8)}</span></div>
      </div>

      {showScheduleForm && (
         <div className="p-6 bg-purple-900/10 border-b border-purple-500/20 animate-in slide-in-from-top-2">
            <form onSubmit={handleScheduleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
               <div className="md:col-span-1"><label className="block text-xs text-purple-300 uppercase mb-1 font-bold">Tipo de Agenda</label><select className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-sm text-white focus:ring-1 focus:ring-purple-500 outline-none" value={scheduleData.type} onChange={e => setScheduleData({...scheduleData, type: e.target.value})}><option value="reuniao">Reunião / Demo</option><option value="ligacao">Ligação</option></select></div>
               <div><label className="block text-xs text-purple-300 uppercase mb-1 font-bold">Data</label><input type="date" required className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-sm text-white [color-scheme:dark]" value={scheduleData.date} onChange={e => setScheduleData({...scheduleData, date: e.target.value})}/></div>
               <div><label className="block text-xs text-purple-300 uppercase mb-1 font-bold">Hora</label><input type="time" required className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-sm text-white [color-scheme:dark]" value={scheduleData.time} onChange={e => setScheduleData({...scheduleData, time: e.target.value})}/></div>
               <div className="flex gap-2"><button type="button" onClick={() => setShowScheduleForm(false)} className="px-4 py-2.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white text-sm">Cancelar</button><button type="submit" className="flex-1 px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold shadow-lg">Confirmar</button></div>
            </form>
         </div>
      )}

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 space-y-6">
            <div>
               <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Ações Rápidas</label>
               <div className="flex gap-2">
                  <button onClick={() => markStatus('venda')} className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${formData.stage === 'venda' ? 'bg-emerald-600 text-white ring-2 ring-emerald-400' : 'bg-zinc-800 text-emerald-600 hover:bg-emerald-900/20'}`}><CheckCircle size={20} /> Fechado Ganho</button>
                  <button onClick={() => markStatus('perdido')} className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${formData.stage === 'perdido' ? 'bg-red-600 text-white ring-2 ring-red-400' : 'bg-zinc-800 text-red-600 hover:bg-red-900/20'}`}><AlertTriangle size={20} /> Perdido</button>
               </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 space-y-4">
               <h3 className="text-white font-bold flex items-center gap-2 border-b border-zinc-800 pb-2"><User size={18} className="text-primary-500" /> Dados Principais</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-xs text-zinc-500 uppercase mb-1">Contato / Empresa</label><input type="text" name="nome" value={formData.nome || ''} onChange={handleInputChange} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white" /></div>
                  <div><label className="block text-xs text-zinc-500 uppercase mb-1">Telefone / Zap</label><div className="relative"><input type="text" name="telefone" value={formData.telefone || ''} onChange={handleInputChange} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 pl-9 text-white" /><Phone size={14} className="absolute left-3 top-3 text-zinc-500" /></div></div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-xs text-zinc-500 uppercase mb-1">Interesse / Produto</label><input type="text" name="interesse" value={formData.interesse || ''} onChange={handleInputChange} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white" /></div>
                  <div><label className="block text-xs text-zinc-500 uppercase mb-1">Etapa Pipeline</label><select name="stage" value={formData.stage} onChange={handleInputChange} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white border-l-4 border-l-primary-500 font-bold">{STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-xs text-zinc-500 uppercase mb-1">Valor Potencial Mín</label><input type="number" name="faixa_preco_min" value={formData.faixa_preco_min || ''} onChange={handleInputChange} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white" /></div>
                  <div><label className="block text-xs text-zinc-500 uppercase mb-1">Valor Potencial Máx</label><input type="number" name="faixa_preco_max" value={formData.faixa_preco_max || ''} onChange={handleInputChange} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white" /></div>
               </div>
            </div>

            <div className="bg-zinc-900 border-2 border-primary-900/30 rounded-xl p-5 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none"><Bell size={120} className="text-primary-500" /></div>
               <h3 className="text-white font-bold flex items-center gap-2 mb-4"><Clock size={18} className="text-primary-500" /> Agendar Retorno / Lembrete</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                  <div className="space-y-3">
                     <div><label className="block text-xs text-zinc-400 uppercase mb-1">Data</label><input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white [color-scheme:dark]" /></div>
                     <div><label className="block text-xs text-zinc-400 uppercase mb-1">Hora</label><input type="time" value={returnTime} onChange={e => setReturnTime(e.target.value)} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white [color-scheme:dark]" /></div>
                  </div>
                  <div className="bg-zinc-950/50 p-4 rounded-lg border border-zinc-800">
                     <label className="block text-xs text-zinc-400 uppercase mb-3 font-bold">Alertas</label>
                     <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer group"><input type="checkbox" name="alert_1_day" checked={formData.alert_1_day || false} onChange={handleInputChange} className="w-4 h-4 rounded border-zinc-600 bg-zinc-900" /><span className="text-sm text-zinc-300">Avisar 1 dia antes</span></label>
                        <label className="flex items-center gap-2 cursor-pointer group"><input type="checkbox" name="alert_at_time" checked={formData.alert_at_time || false} onChange={handleInputChange} className="w-4 h-4 rounded border-zinc-600 bg-zinc-900" /><span className="text-sm text-zinc-300">Avisar no momento</span></label>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         <div className="flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="p-4 bg-zinc-900 border-b border-zinc-800"><h3 className="font-bold text-white flex items-center gap-2"><History size={18} className="text-primary-500" /> Histórico</h3></div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
               {loadingHistory ? <p className="text-zinc-500 text-sm text-center">Carregando...</p> : history.map(item => (<div key={item.id} className="flex gap-3"><div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${item.categoria === 'sistema' ? 'border-blue-900 text-blue-500 bg-blue-900/10' : 'border-zinc-700 text-zinc-400 bg-zinc-800'}`}>{item.categoria === 'sistema' ? <PlayCircle size={14} /> : <MessageSquare size={14} />}</div><div><p className="text-sm text-zinc-300">{item.descricao}</p><span className="text-[10px] text-zinc-600">{new Date(item.created_at).toLocaleString('pt-BR')}</span></div></div>))}
            </div>
            <div className="p-4 bg-zinc-900 border-t border-zinc-800"><textarea className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm text-white resize-none outline-none" placeholder="Nova anotação..." rows={2} value={newNote} onChange={e => setNewNote(e.target.value)}></textarea><button onClick={saveChanges} disabled={!newNote.trim()} className="mt-2 w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 rounded-lg text-xs font-bold transition-colors">Adicionar Nota</button></div>
         </div>
      </div>
    </div>
  );
};
