
import React, { useState, useEffect } from 'react';
import { X, ArrowRight, User, Phone, Mail, Globe, MapPin } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { User as UserType, Customer, CRMLeadOrigin } from '../types';

interface LeadFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newLeadId?: string) => void;
  leadToEdit?: Customer | null;
  currentUser?: UserType | null;
}

export const LeadFormModal: React.FC<LeadFormModalProps> = ({ isOpen, onClose, onSuccess, leadToEdit, currentUser }) => {
  const [loading, setLoading] = useState(false);
  const [origins, setOrigins] = useState<CRMLeadOrigin[]>([]);

  // B2B Generic Data (Removed vehicle specifics from this quick form)
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    email: '',
    origem: '',
    lead_origin_id: '',
    cidade: '',
    observacao_inicial: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchOrigins();
      if (leadToEdit) {
        populateForm(leadToEdit);
      } else {
        resetForm();
      }
    }
  }, [isOpen, leadToEdit]);

  const fetchOrigins = async () => {
    const { data } = await supabase.from('crm_lead_origins').select('*').eq('active', true).order('name');
    if (data) setOrigins(data as any);
  };

  const populateForm = (customer: Customer) => {
    setFormData({
      nome: customer.nome || '',
      telefone: customer.telefone || '',
      email: customer.email || '',
      origem: customer.origem || '',
      lead_origin_id: customer.lead_origin_id || '',
      cidade: customer.cidade || '',
      observacao_inicial: '' 
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'lead_origin_id') {
       const selectedOrigin = origins.find(o => o.id === value);
       if (selectedOrigin) {
          setFormData(prev => ({ ...prev, lead_origin_id: value, origem: selectedOrigin.name }));
       }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload: any = {
          nome: formData.nome,
          telefone: formData.telefone,
          email: formData.email,
          origem: formData.origem,
          lead_origin_id: formData.lead_origin_id || null,
          cidade: formData.cidade
      };

      let customerId = leadToEdit?.id;

      if (leadToEdit) {
         const { error } = await supabase.from('leads').update(payload).eq('id', leadToEdit.id);
         if (error) throw error;
      } else {
         // Create new Person
         payload.created_at = new Date().toISOString();
         payload.stage = 'novo'; 
         const { data, error } = await supabase.from('leads').insert([payload]).select();
         if (error) throw error;
         customerId = data[0].id;

         // Log observation if any
         if (formData.observacao_inicial) {
            await supabase.from('lead_history').insert([{
               lead_id: customerId,
               descricao: `Obs Inicial: ${formData.observacao_inicial}`,
               categoria: 'usuario'
            }]);
         }

         // AUTOMATIC OPPORTUNITY CREATION
         const oppPayload = {
            lead_id: customerId,
            title: `Oportunidade - ${formData.nome}`,
            stage: 'novo',
            status: 'open',
            user_id: currentUser?.id || null,
            created_at: new Date().toISOString(),
            obs: formData.observacao_inicial ? `Obs Inicial: ${formData.observacao_inicial}` : ''
         };

         const { error: oppError } = await supabase.from('crm_opportunities').insert([oppPayload]);
         if (oppError) {
            console.error('Erro ao criar oportunidade automática:', oppError);
         } else {
            await supabase.from('lead_history').insert([{
               lead_id: customerId,
               descricao: 'Oportunidade criada automaticamente no pipeline (Novo)',
               categoria: 'sistema'
            }]);
         }
      }

      onSuccess(customerId);
      onClose();
      if (!leadToEdit) resetForm();

    } catch (error: any) {
      alert('Erro ao salvar cliente: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '', telefone: '', email: '', origem: '', lead_origin_id: '', cidade: '', observacao_inicial: ''
    });
  };

  if (!isOpen) return null;

  const inputClass = "w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 pl-10 text-white focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all placeholder-zinc-500 text-sm";
  const labelClass = "block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wide";
  const iconClass = "absolute left-3 top-2.5 text-zinc-500";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 rounded-xl w-full max-w-lg shadow-2xl border border-zinc-800 animate-in zoom-in-95 duration-200">
        
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="text-primary-500" /> {leadToEdit ? 'Editar Cliente' : 'Novo Cliente (Lead)'}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X size={24} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelClass}>Nome Completo / Empresa *</label>
            <div className="relative">
              <User size={18} className={iconClass} />
              <input type="text" name="nome" required value={formData.nome} onChange={handleChange} className={inputClass} placeholder="Nome do contato ou empresa" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Telefone *</label>
              <div className="relative">
                <Phone size={18} className={iconClass} />
                <input type="text" name="telefone" required value={formData.telefone} onChange={handleChange} className={inputClass} placeholder="(00) 00000-0000" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Cidade</label>
              <div className="relative">
                <MapPin size={18} className={iconClass} />
                <input type="text" name="cidade" value={formData.cidade} onChange={handleChange} className={inputClass} placeholder="Cidade/UF" />
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Email</label>
            <div className="relative">
              <Mail size={18} className={iconClass} />
              <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputClass} placeholder="cliente@empresa.com" />
            </div>
          </div>

          <div>
            <label className={labelClass}>Origem</label>
            <div className="relative">
              <Globe size={18} className={iconClass} />
              <select name="lead_origin_id" value={formData.lead_origin_id} onChange={handleChange} className={`${inputClass} appearance-none cursor-pointer`}>
                <option value="">Selecione a origem...</option>
                {origins.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          </div>

          {!leadToEdit && (
             <div>
                <label className={labelClass}>Observação Inicial</label>
                <textarea name="observacao_inicial" rows={2} value={formData.observacao_inicial} onChange={handleChange} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-600 text-sm resize-none" placeholder="Nota sobre o contato ou interesse..." />
             </div>
          )}

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-zinc-400 hover:bg-zinc-800">Cancelar</button>
            <button type="submit" disabled={loading} className="flex items-center gap-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium shadow-lg shadow-primary-900/20">
              {loading ? 'Salvando...' : <>{leadToEdit ? 'Atualizar Dados' : 'Salvar'} <ArrowRight size={16} /></>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
