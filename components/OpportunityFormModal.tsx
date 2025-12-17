
import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Briefcase, DollarSign, Tag, Users, AlertCircle, Phone, Globe, Calendar, ThumbsUp, ThumbsDown, Check, Clock, StickyNote, Bell, History, Send, CheckCircle, AlertTriangle, Trophy, Search, Package } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { User as UserType, CRMVehicleType, CRMBrand, CRMModel, CRMFuelType, Opportunity, LeadHistory, CRMLossReason, CRMPipelineStage, CRMAppointmentReason, CRMLeadOrigin, Product } from '../types';
import { formatCurrency } from '../utils/formatters';

interface OpportunityFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customerId: string; 
  customerName?: string;
  opportunityToEdit?: Opportunity | null;
}

export const OpportunityFormModal: React.FC<OpportunityFormModalProps> = ({ 
  isOpen, onClose, onSuccess, customerId, customerName, opportunityToEdit 
}) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
  
  // Config Data
  const [users, setUsers] = useState<UserType[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<CRMVehicleType[]>([]); // Using as Contract Type
  const [fuelTypes, setFuelTypes] = useState<CRMFuelType[]>([]); // Using as Segment
  const [origins, setOrigins] = useState<CRMLeadOrigin[]>([]);
  const [lossReasons, setLossReasons] = useState<CRMLossReason[]>([]);
  const [pipelineStages, setPipelineStages] = useState<CRMPipelineStage[]>([]);
  const [appointmentReasons, setAppointmentReasons] = useState<CRMAppointmentReason[]>([]);
  
  // Product Search State
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Opportunity Data
  const [formData, setFormData] = useState<{
    title: string;
    vehicle_type_id: string;
    brand_id: string;
    model_id: string;
    fuel_type_id: string;
    min_price: string;
    max_price: string;
    payment_method: string;
    user_id: string;
    obs: string;
    stage: string;
    status: 'open' | 'won' | 'lost';
    loss_reason_id: string;
    final_price: string;
    sold_vehicle_name: string; // Product Sold
  }>({
    title: '',
    vehicle_type_id: '',
    brand_id: '',
    model_id: '',
    fuel_type_id: '',
    min_price: '',
    max_price: '',
    payment_method: 'faturado',
    user_id: '',
    obs: '',
    stage: 'novo',
    status: 'open',
    loss_reason_id: '',
    final_price: '',
    sold_vehicle_name: ''
  });

  const [clientData, setClientData] = useState({
     telefone: '',
     lead_origin_id: ''
  });

  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleData, setScheduleData] = useState<{
    type: string;
    date: string;
    time: string;
    obs: string;
  }>({ type: 'reuniao', date: '', time: '', obs: '' });

  const [history, setHistory] = useState<LeadHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [note, setNote] = useState('');
  const [taskData, setTaskData] = useState({ title: '', date: '', time: '' });
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
      fetchClientData();
      if (opportunityToEdit) {
        populateForm(opportunityToEdit);
        fetchHistory();
      } else {
        setFormData(prev => ({ 
           ...prev, 
           title: customerName ? `Oportunidade - ${customerName}` : 'Nova Oportunidade',
           stage: 'novo'
        }));
      }
      setIsScheduling(false);
      setScheduleData({ type: 'reuniao', date: '', time: '', obs: '' });
      setActiveTab('details');
      setNote('');
      setTaskData({ title: '', date: '', time: '' });
      setProductSearchTerm('');
      setShowProductSuggestions(false);
    }
  }, [isOpen, opportunityToEdit, customerId]);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowProductSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchConfig = async () => {
    const [t, f, u, o, l, s, a, p] = await Promise.all([
      supabase.from('crm_vehicle_types').select('*').eq('active', true).order('name'),
      supabase.from('crm_fuel_types').select('*').eq('active', true).order('name'),
      supabase.from('users').select('*').eq('active', true).order('name'),
      supabase.from('crm_lead_origins').select('*').eq('active', true).order('name'),
      supabase.from('crm_loss_reasons').select('*').eq('active', true).order('name'),
      supabase.from('crm_pipeline_stages').select('*').eq('active', true).order('order_index'),
      supabase.from('crm_appointment_reasons').select('*').eq('active', true).order('name'),
      supabase.from('products').select('*').eq('active', true).order('name')
    ]);

    if (t.data) setVehicleTypes(t.data as any);
    if (f.data) setFuelTypes(f.data as any);
    if (u.data) setUsers(u.data as any);
    if (o.data) setOrigins(o.data as any);
    if (l.data) setLossReasons(l.data as any);
    if (s.data) setPipelineStages(s.data as any);
    if (p.data) setCatalogProducts(p.data as any);
    
    if (a.data && a.data.length > 0) {
        setAppointmentReasons(a.data as any);
        setScheduleData(prev => ({ ...prev, type: a.data[0].name }));
    }
  };

  const fetchClientData = async () => {
     const { data } = await supabase.from('leads').select('telefone, lead_origin_id').eq('id', customerId).single();
     if (data) {
        setClientData({ telefone: data.telefone || '', lead_origin_id: data.lead_origin_id || '' });
     }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    let { data } = await supabase.from('lead_history').select('*').eq('lead_id', customerId).order('created_at', { ascending: false }).limit(20);
    const safeData = data?.map((item: any) => ({ ...item, descricao: item.descricao || item.description || '' })) || [];
    setHistory(safeData as any);
    setLoadingHistory(false);
  };

  const safeInsertHistory = async (leadId: string, text: string, category: string) => {
      await supabase.from('lead_history').insert([{ lead_id: leadId, descricao: text, categoria: category }]);
  };

  const populateForm = (op: Opportunity) => {
    setFormData({
      title: op.title,
      vehicle_type_id: op.vehicle_type_id || '',
      brand_id: op.brand_id || '',
      model_id: op.model_id || '',
      fuel_type_id: op.fuel_type_id || '',
      min_price: op.min_price ? op.min_price.toString() : '',
      max_price: op.max_price ? op.max_price.toString() : '',
      payment_method: op.payment_method || 'faturado',
      user_id: op.user_id || '',
      obs: op.obs || '',
      stage: op.stage,
      status: op.status,
      loss_reason_id: op.loss_reason_id || '',
      final_price: op.final_price ? op.final_price.toString() : '',
      sold_vehicle_name: op.sold_vehicle_name || ''
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const onlyNums = value.replace(/\D/g, '');
    const floatValue = onlyNums ? parseInt(onlyNums, 10) / 100 : 0;
    setFormData(prev => ({ ...prev, [name]: floatValue }));
  };

  const handleProductSelect = (product: Product) => {
    setFormData(prev => ({
        ...prev,
        title: product.name,
        min_price: product.price ? product.price.toString() : '',
        max_price: product.price ? product.price.toString() : '',
        // We can optionally put the description in obs, but careful not to overwrite user notes
        // obs: prev.obs ? prev.obs : product.description || ''
    }));
    setProductSearchTerm('');
    setShowProductSuggestions(false);
  };

  const setStatus = (status: 'won' | 'lost') => {
     setFormData(prev => ({ ...prev, status: status, stage: status === 'won' ? 'venda' : 'perdido' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (formData.status === 'lost' && !formData.loss_reason_id) {
         alert("Selecione um motivo de perda."); setLoading(false); return;
      }
      if (formData.status === 'won' && !formData.final_price) {
         alert("Insira o valor final da venda."); setLoading(false); return;
      }

      await supabase.from('leads').update({
         telefone: clientData.telefone,
         lead_origin_id: clientData.lead_origin_id || null,
         last_contact_at: new Date().toISOString()
      }).eq('id', customerId);

      const payload: any = {
         lead_id: customerId,
         title: formData.title,
         vehicle_type_id: formData.vehicle_type_id || null,
         // Removing strict dependencies on brand/model for B2B generic
         brand_id: null, 
         model_id: null,
         fuel_type_id: formData.fuel_type_id || null,
         min_price: formData.min_price ? parseFloat(String(formData.min_price)) : null,
         max_price: formData.max_price ? parseFloat(String(formData.max_price)) : null,
         payment_method: formData.payment_method,
         user_id: formData.user_id || null,
         obs: formData.obs,
         stage: formData.stage, 
         status: formData.status,
         loss_reason_id: formData.status === 'lost' ? formData.loss_reason_id : null,
         final_price: formData.status === 'won' ? parseFloat(String(formData.final_price)) : null,
         sold_vehicle_name: formData.status === 'won' ? formData.sold_vehicle_name : null
      };

      if (opportunityToEdit) {
         await supabase.from('crm_opportunities').update(payload).eq('id', opportunityToEdit.id);
      } else {
         await supabase.from('crm_opportunities').insert([payload]);
      }

      if (isScheduling && scheduleData.date && scheduleData.time) {
         await supabase.from('schedule').insert([{
            lead_id: customerId,
            user_id: formData.user_id || null,
            tipo: scheduleData.type,
            data: scheduleData.date,
            hora: scheduleData.time,
            observacao: scheduleData.obs ? `[OPP] ${scheduleData.obs}` : `Agendado via Oportunidade: ${formData.title}`,
            status: 'agendado'
         }]);
         await safeInsertHistory(customerId, `Agendou ${scheduleData.type} para ${scheduleData.date} às ${scheduleData.time}`, 'agendamento');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    setLoadingAction(true);
    try {
        await safeInsertHistory(customerId, `Anotação: ${note}`, 'usuario');
        fetchHistory().catch(console.error);
        setNote('');
    } catch (err) { alert('Erro ao salvar nota.'); } finally { setLoadingAction(false); }
  };

  // Filter products for suggestions
  const filteredProducts = catalogProducts.filter(p => 
    p.name.toLowerCase().includes(productSearchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  const inputClass = "w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent text-sm placeholder-zinc-600";
  const labelClass = "block text-xs font-bold text-zinc-400 mb-1 uppercase tracking-wide";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 rounded-xl w-full max-w-4xl shadow-2xl border border-zinc-800 max-h-[90vh] flex flex-col">
        
        <div className="p-5 border-b border-zinc-800 bg-zinc-950 flex justify-between items-center rounded-t-xl shrink-0">
          <div>
             <h2 className="text-lg font-bold text-white flex items-center gap-2">
               <Briefcase className="text-primary-500" /> {opportunityToEdit ? 'Editar Negociação' : 'Nova Oportunidade B2B'}
             </h2>
             <p className="text-xs text-zinc-500 mt-0.5">Cliente: <span className="text-white font-medium">{customerName}</span></p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors"><X size={24} /></button>
        </div>

        {opportunityToEdit && (
            <div className="flex border-b border-zinc-800 px-6 bg-zinc-950/50 shrink-0">
                <button onClick={() => setActiveTab('details')} className={`pb-3 pt-3 text-sm font-medium transition-colors border-b-2 mr-6 ${activeTab === 'details' ? 'border-primary-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>Detalhes</button>
                <button onClick={() => setActiveTab('history')} className={`pb-3 pt-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'history' ? 'border-primary-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>Histórico</button>
            </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-zinc-900">
            {activeTab === 'details' ? (
                <form id="opp-form" onSubmit={handleSubmit} className="p-6">
                    <div className="mb-6">
                        <label className={labelClass}>Status da Negociação</label>
                        <div className="flex gap-2">
                            {formData.status === 'open' ? (
                                <>
                                    <button type="button" onClick={() => setStatus('won')} className="flex-1 bg-zinc-800 text-emerald-500 hover:bg-zinc-700 py-3 rounded-lg font-bold border border-zinc-700 flex justify-center items-center gap-2"><ThumbsUp size={18} /> Venda Ganha</button>
                                    <button type="button" onClick={() => setStatus('lost')} className="flex-1 bg-zinc-800 text-red-500 hover:bg-zinc-700 py-3 rounded-lg font-bold border border-zinc-700 flex justify-center items-center gap-2"><ThumbsDown size={18} /> Perdida</button>
                                </>
                            ) : (
                                <div className={`flex-1 p-3 rounded-lg flex items-center justify-between border ${formData.status === 'won' ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
                                    <span className={`font-bold ${formData.status === 'won' ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {formData.status === 'won' ? 'Venda Realizada!' : 'Negociação Perdida'}
                                    </span>
                                    <button type="button" onClick={() => { setFormData(prev => ({ ...prev, status: 'open', stage: 'negociacao' })); }} className="text-xs underline text-zinc-400 hover:text-white">Reabrir</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {formData.status === 'won' && (
                        <div className="mb-6 p-5 bg-emerald-950/10 border-2 border-emerald-500/20 rounded-xl">
                            <h4 className="text-emerald-400 font-bold mb-4 flex items-center gap-2"><DollarSign size={18} /> Fechamento</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-emerald-300 uppercase mb-2">Produto/Serviço Vendido</label><input type="text" name="sold_vehicle_name" value={formData.sold_vehicle_name} onChange={handleChange} className="w-full bg-zinc-950 border border-emerald-900/30 rounded-lg p-3 text-white text-sm outline-none" placeholder="Ex: Contrato Anual..." /></div>
                                <div><label className="block text-xs font-bold text-emerald-300 uppercase mb-2">Valor Final (R$)</label><input type="text" name="final_price" value={formatCurrency(Number(formData.final_price))} onChange={handleCurrencyChange} className="w-full bg-zinc-950 border border-emerald-900/30 rounded-lg p-3 text-white text-lg font-bold outline-none" /></div>
                            </div>
                        </div>
                    )}

                    {formData.status === 'lost' && (
                        <div className="mb-6 p-5 bg-red-950/10 border-2 border-red-500/20 rounded-xl">
                            <h4 className="text-red-400 font-bold mb-4 flex items-center gap-2"><AlertTriangle size={18} /> Motivo da Perda</h4>
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                {lossReasons.map(reason => (
                                    <label key={reason.id} className={`cursor-pointer border rounded-lg p-3 flex items-center gap-2 ${formData.loss_reason_id === reason.id ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-400'}`}>
                                        <input type="radio" name="loss_reason_id" value={reason.id} checked={formData.loss_reason_id === reason.id} onChange={handleChange} className="hidden" />
                                        <span className="text-sm font-medium">{reason.name}</span>
                                    </label>
                                ))}
                            </div>
                            <textarea name="obs" value={formData.obs} onChange={handleChange} className="w-full bg-zinc-950 border border-red-900/30 rounded-lg p-3 text-white text-sm outline-none resize-none" rows={2} placeholder="Detalhes..." />
                        </div>
                    )}

                    {/* Generic B2B Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div className="md:col-span-2">
                            <label className={labelClass}>Título da Oportunidade</label>
                            <input type="text" name="title" value={formData.title} onChange={handleChange} required className={inputClass} placeholder="Ex: Contrato Anual de Manutenção" />
                        </div>
                        <div>
                            <label className={labelClass}>Telefone Contato</label>
                            <div className="relative"><Phone size={14} className="absolute left-3 top-2.5 text-zinc-500" /><input type="text" name="telefone" value={clientData.telefone} onChange={(e) => setClientData({...clientData, telefone: e.target.value})} className={`${inputClass} pl-9`} /></div>
                        </div>
                        <div>
                            <label className={labelClass}>Origem</label>
                            <div className="relative"><Globe size={14} className="absolute left-3 top-2.5 text-zinc-500" /><select name="lead_origin_id" value={clientData.lead_origin_id} onChange={(e) => setClientData({...clientData, lead_origin_id: e.target.value})} className={`${inputClass} pl-9`}><option value="">Selecione...</option>{origins.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className={labelClass}>Tipo de Contrato</label>
                            <select name="vehicle_type_id" value={formData.vehicle_type_id} onChange={handleChange} className={inputClass}><option value="">Selecione...</option>{vehicleTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                        </div>
                        
                        {/* PRODUCT CATALOG SEARCHER REPLACING OLD DROPDOWNS */}
                        <div className="md:col-span-3 relative" ref={searchContainerRef}>
                            <label className={labelClass}>Buscar no Catálogo (Produto/Serviço)</label>
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-2.5 text-zinc-500" />
                                <input 
                                    type="text" 
                                    className={`${inputClass} pl-10 focus:ring-primary-500`}
                                    placeholder="Digite para buscar produtos..."
                                    value={productSearchTerm}
                                    onChange={(e) => {
                                        setProductSearchTerm(e.target.value);
                                        setShowProductSuggestions(true);
                                    }}
                                    onFocus={() => setShowProductSuggestions(true)}
                                />
                                {showProductSuggestions && productSearchTerm && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                                        {filteredProducts.length > 0 ? (
                                            filteredProducts.map(prod => (
                                                <div 
                                                    key={prod.id} 
                                                    className="p-3 hover:bg-zinc-800 cursor-pointer border-b border-zinc-800 last:border-0 flex justify-between items-center group"
                                                    onClick={() => handleProductSelect(prod)}
                                                >
                                                    <div>
                                                        <p className="text-sm font-medium text-white group-hover:text-primary-500 transition-colors">{prod.name}</p>
                                                        <p className="text-xs text-zinc-500 truncate max-w-[300px]">{prod.description}</p>
                                                    </div>
                                                    <span className="text-sm font-bold text-emerald-500">{formatCurrency(prod.price)}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-4 text-center text-zinc-500 text-sm">Nenhum produto encontrado.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className={labelClass}>Valor Estimado</label>
                            <input type="text" name="min_price" value={formatCurrency(Number(formData.min_price))} onChange={handleCurrencyChange} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Valor Teto</label>
                            <input type="text" name="max_price" value={formatCurrency(Number(formData.max_price))} onChange={handleCurrencyChange} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Segmento</label>
                            <select name="fuel_type_id" value={formData.fuel_type_id} onChange={handleChange} className={inputClass}><option value="">Selecione...</option>{fuelTypes.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
                        </div>
                        <div>
                            <label className={labelClass}>Responsável</label>
                            <select name="user_id" value={formData.user_id} onChange={handleChange} className={inputClass}><option value="">Sem dono</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
                        </div>
                    </div>

                    <div className="mb-4">
                       <label className={labelClass}>Etapa do Pipeline</label>
                       <select name="stage" value={formData.stage} onChange={handleChange} className={`${inputClass} border-l-4 border-l-primary-500 font-bold bg-zinc-900`} disabled={formData.status !== 'open'}>
                          {pipelineStages.length > 0 ? pipelineStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>) : <option value="">Carregando...</option>}
                       </select>
                    </div>

                    <div className="h-px bg-zinc-800 my-6"></div>

                    {formData.status === 'open' && (
                    <div className={`rounded-xl border transition-all duration-300 mb-6 overflow-hidden ${isScheduling ? 'bg-purple-900/10 border-purple-500/30' : 'bg-zinc-950/30 border-zinc-800'}`}>
                        <div className="p-4 flex items-center gap-3 cursor-pointer select-none hover:bg-zinc-800/30" onClick={() => setIsScheduling(!isScheduling)}>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center ${isScheduling ? 'bg-purple-600 border-purple-600' : 'bg-zinc-900 border-zinc-600'}`}>{isScheduling && <Check size={14} className="text-white" />}</div>
                            <label className={`text-sm font-bold cursor-pointer ${isScheduling ? 'text-purple-400' : 'text-zinc-400'}`}>Agendar Reunião / Demo agora?</label>
                        </div>
                        {isScheduling && (
                            <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div><label className={labelClass}>Tipo</label><select className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-sm text-white outline-none" value={scheduleData.type} onChange={e => setScheduleData({...scheduleData, type: e.target.value})}>{appointmentReasons.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}</select></div>
                                <div><label className={labelClass}>Data</label><input type="date" required={isScheduling} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-sm text-white [color-scheme:dark]" value={scheduleData.date} onChange={e => setScheduleData({...scheduleData, date: e.target.value})} /></div>
                                <div><label className={labelClass}>Hora</label><input type="time" required={isScheduling} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-sm text-white [color-scheme:dark]" value={scheduleData.time} onChange={e => setScheduleData({...scheduleData, time: e.target.value})} /></div>
                            </div>
                        )}
                    </div>
                    )}

                    <label className={labelClass}>Observações Gerais</label>
                    <textarea name="obs" rows={3} value={formData.obs} onChange={handleChange} className={`${inputClass} resize-none`} placeholder="Detalhes do projeto, dores do cliente..." />
                </form>
            ) : (
                <div className="p-5">
                   <form onSubmit={handleSaveNote} className="mb-6"><textarea className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-white text-sm focus:ring-1 focus:ring-primary-500 outline-none resize-none" rows={3} placeholder="Escreva uma observação..." value={note} onChange={e => setNote(e.target.value)}></textarea><div className="flex justify-end mt-2"><button type="submit" disabled={loadingAction || !note.trim()} className="bg-primary-600 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase"><Send size={14} className="inline mr-1"/> Salvar Nota</button></div></form>
                   <div className="space-y-4">
                      {history.map((item, idx) => (
                         <div key={item.id} className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700"><History size={14} className="text-zinc-400"/></div>
                            <div><p className="text-sm text-zinc-300">{item.descricao}</p><span className="text-[10px] text-zinc-600">{item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : 'Agora'}</span></div>
                         </div>
                      ))}
                   </div>
                </div>
            )}
        </div>

        <div className="p-5 border-t border-zinc-800 bg-zinc-950 flex justify-end gap-3 rounded-b-xl shrink-0">
           {activeTab === 'details' ? (
                <>
                    <button type="button" onClick={onClose} className="px-6 py-2 rounded-lg text-zinc-400 hover:bg-zinc-800 transition-colors">Cancelar</button>
                    <button form="opp-form" type="submit" disabled={loading} className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold shadow-lg shadow-primary-900/20 flex items-center gap-2">
                        <Save size={18} /> {loading ? 'Salvando...' : 'Salvar'}
                    </button>
                </>
           ) : (
                <button type="button" onClick={onClose} className="px-6 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors">Fechar</button>
           )}
        </div>

      </div>
    </div>
  );
};
