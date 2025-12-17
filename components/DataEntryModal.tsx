
import React, { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import { DailyRecord } from '../types';
import { formatCurrency } from '../utils/formatters';

interface DataEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: Omit<DailyRecord, 'id'>) => void;
  onDelete: (id: string) => void;
  initialData?: DailyRecord;
}

const emptyRecord = {
  date: new Date().toISOString().split('T')[0],
  leads: 0,
  source: '',
  contacts: 0,
  scheduled: 0,
  attended: 0,
  testDrives: 0,
  proposals: 0,
  approvals: 0,
  sales: 0,
  revenue: 0,
  investment: 0,
};

export const DataEntryModal: React.FC<DataEntryModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  onDelete,
  initialData 
}) => {
  const [formData, setFormData] = useState<Omit<DailyRecord, 'id'>>(emptyRecord);

  useEffect(() => {
    if (initialData) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...rest } = initialData;
      setFormData(rest);
    } else {
      setFormData(emptyRecord);
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const onlyNums = value.replace(/\D/g, '');
    const floatValue = onlyNums ? parseInt(onlyNums, 10) / 100 : 0;
    setFormData(prev => ({ ...prev, [name]: floatValue }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const handleDeleteClick = () => {
    if (initialData?.id) {
      if (window.confirm('Tem certeza que deseja excluir este registro permanentemente?')) {
        onDelete(initialData.id);
        onClose();
      }
    }
  };

  const inputClass = "w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all";
  const labelClass = "block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wide";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 rounded-xl w-full max-w-3xl shadow-2xl border border-zinc-800 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-zinc-900 p-6 border-b border-zinc-800 flex justify-between items-center z-10">
          <h2 className="text-xl font-bold text-white">
            {initialData ? 'Editar Registro' : 'Novo Registro Diário'}
          </h2>
          <button onClick={onClose} type="button" className="text-zinc-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Section 1: Basic Info */}
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
              <label className={labelClass}>Data</label>
              <input 
                type="date" 
                name="date" 
                required
                value={formData.date}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Fonte de Tráfego</label>
              <input 
                type="text" 
                name="source" 
                placeholder="Ex: Facebook, Google, Outbound"
                value={formData.source}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>

          <div className="h-px bg-zinc-800 md:col-span-2 my-2"></div>

          {/* Section 2: Metrics */}
          <div>
            <label className={labelClass}>Leads (Total)</label>
            <input 
              type="number" 
              name="leads" 
              min="0"
              value={formData.leads}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Contatos Realizados</label>
            <input 
              type="number" 
              name="contacts" 
              min="0"
              value={formData.contacts}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Agendados</label>
            <input 
              type="number" 
              name="scheduled" 
              min="0"
              value={formData.scheduled}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Compareceu</label>
            <input 
              type="number" 
              name="attended" 
              min="0"
              value={formData.attended}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

           <div>
            <label className={labelClass}>Reuniões/Demos</label>
            <input 
              type="number" 
              name="testDrives" 
              min="0"
              value={formData.testDrives}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Propostas Realizadas</label>
            <input 
              type="number" 
              name="proposals" 
              min="0"
              value={formData.proposals}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Aprovação / Fechamento</label>
            <input 
              type="number" 
              name="approvals" 
              min="0"
              value={formData.approvals}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          {/* Empty div for grid alignment if needed */}
          <div className="hidden md:block"></div>

          <div className="h-px bg-zinc-800 md:col-span-2 my-2"></div>

          {/* Section 3: Financials */}
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className={labelClass}>Vendas (Qtd)</label>
              <input 
                type="number" 
                name="sales" 
                min="0"
                value={formData.sales}
                onChange={handleChange}
                className={`${inputClass} border-emerald-500/50 focus:ring-emerald-500`}
              />
            </div>

            <div>
              <label className={labelClass}>Investimento em Mídia</label>
              <input 
                type="text" 
                inputMode="numeric"
                name="investment" 
                value={formatCurrency(formData.investment)}
                onChange={handleCurrencyChange}
                className={inputClass}
                placeholder="R$ 0,00"
              />
            </div>

            <div>
              <label className={labelClass}>Faturamento Total</label>
              <input 
                type="text" 
                inputMode="numeric"
                name="revenue" 
                value={formatCurrency(formData.revenue)}
                onChange={handleCurrencyChange}
                className={`${inputClass} border-blue-500/50 focus:ring-blue-500`}
                placeholder="R$ 0,00"
              />
            </div>
          </div>

          <div className="md:col-span-2 flex flex-col-reverse md:flex-row justify-between items-center gap-4 mt-6">
            <div>
              {initialData?.id && (
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors border border-red-500/20 w-full md:w-auto justify-center font-medium"
                >
                  <Trash2 size={18} />
                  Excluir Registro
                </button>
              )}
            </div>
            
            <div className="flex gap-3 w-full md:w-auto justify-end">
              <button 
                type="button" 
                onClick={onClose}
                className="px-6 py-2 rounded-lg text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="flex items-center gap-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-lg shadow-primary-900/20 transition-all font-medium"
              >
                <Save size={18} />
                Salvar Dados
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
