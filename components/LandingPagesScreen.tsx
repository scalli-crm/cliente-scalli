
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { LandingPage, CRMLeadOrigin } from '../types';
import { Plus, Link as LinkIcon, Edit2, Trash2, ExternalLink, Copy, Eye, LayoutTemplate, X, Save, Check } from 'lucide-react';

export const LandingPagesScreen: React.FC = () => {
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [origins, setOrigins] = useState<CRMLeadOrigin[]>([]);
  
  // Edit State
  const [editingPage, setEditingPage] = useState<LandingPage | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    headline: '',
    description: '',
    lead_origin_id: '',
    active: true
  });

  useEffect(() => {
    fetchPages();
    fetchOrigins();
  }, []);

  const fetchPages = async () => {
    setLoading(true);
    const { data } = await supabase.from('landing_pages').select('*').order('created_at', { ascending: false });
    if (data) setPages(data as any);
    setLoading(false);
  };

  const fetchOrigins = async () => {
    const { data } = await supabase.from('crm_lead_origins').select('*').eq('active', true);
    if (data) setOrigins(data as any);
  };

  const handleOpenModal = (page?: LandingPage) => {
    if (page) {
      setEditingPage(page);
      setFormData({
        title: page.title,
        slug: page.slug,
        headline: page.headline,
        description: page.description || '',
        lead_origin_id: page.lead_origin_id || '',
        active: page.active
      });
    } else {
      setEditingPage(null);
      setFormData({
        title: '',
        slug: '',
        headline: '',
        description: '',
        lead_origin_id: '',
        active: true
      });
    }
    setIsModalOpen(true);
  };

  const generateSlug = (title: string) => {
    return title.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[^a-z0-9\s-]/g, "") // Remove invalid chars
      .trim().replace(/\s+/g, "-"); // Replace spaces with -
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    // Auto-generate slug only if creating new page
    if (!editingPage) {
       setFormData(prev => ({ ...prev, title: newTitle, slug: generateSlug(newTitle) }));
    } else {
       setFormData(prev => ({ ...prev, title: newTitle }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.slug) return alert('Slug é obrigatório');

    try {
      const payload = {
        title: formData.title,
        slug: formData.slug,
        headline: formData.headline,
        description: formData.description,
        lead_origin_id: formData.lead_origin_id || null,
        active: formData.active
      };

      if (editingPage) {
        await supabase.from('landing_pages').update(payload).eq('id', editingPage.id);
      } else {
        await supabase.from('landing_pages').insert([payload]);
      }

      setIsModalOpen(false);
      fetchPages();
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta página?')) {
      await supabase.from('landing_pages').delete().eq('id', id);
      fetchPages();
    }
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/?lp=${slug}`;
    navigator.clipboard.writeText(url);
    alert('Link copiado: ' + url);
  };

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500">
      
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-xl">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <LayoutTemplate className="text-primary-500" /> Páginas de Captura
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            Crie links personalizados para campanhas e capture leads automaticamente no CRM.
          </p>
        </div>
        <button 
          onClick={() => handleOpenModal()} 
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-primary-900/20"
        >
          <Plus size={18} /> Nova Página
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? <p className="text-zinc-500">Carregando...</p> : pages.map(page => (
          <div key={page.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-all group">
            <div className="p-5 border-b border-zinc-800 bg-zinc-950/50">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-white text-lg truncate" title={page.title}>{page.title}</h3>
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${page.active ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                  {page.active ? 'Ativa' : 'Inativa'}
                </span>
              </div>
              <a 
                href={`?lp=${page.slug}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 truncate"
              >
                <LinkIcon size={12} /> /{page.slug}
              </a>
            </div>
            
            <div className="p-5 space-y-4">
               <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Visualizações</span>
                  <span className="text-white font-mono">0</span> 
                  {/* Note: Views requires backend logic to increment */}
               </div>
               <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Headline</span>
                  <span className="text-zinc-300 truncate max-w-[150px]" title={page.headline}>{page.headline}</span>
               </div>
            </div>

            <div className="p-4 bg-zinc-950/30 border-t border-zinc-800 flex gap-2">
               <button onClick={() => copyLink(page.slug)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 rounded text-xs font-bold flex justify-center items-center gap-2 border border-zinc-700">
                  <Copy size={14} /> Copiar
               </button>
               <a href={`?lp=${page.slug}`} target="_blank" rel="noreferrer" className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 rounded text-xs font-bold flex justify-center items-center gap-2 border border-zinc-700">
                  <Eye size={14} /> Ver
               </a>
               <button onClick={() => handleOpenModal(page)} className="p-2 bg-zinc-800 hover:bg-zinc-700 text-blue-400 rounded border border-zinc-700">
                  <Edit2 size={16} />
               </button>
               <button onClick={() => handleDelete(page.id)} className="p-2 bg-zinc-800 hover:bg-zinc-700 text-red-400 rounded border border-zinc-700">
                  <Trash2 size={16} />
               </button>
            </div>
          </div>
        ))}
        {!loading && pages.length === 0 && (
           <div className="col-span-full py-12 text-center text-zinc-500 border-2 border-dashed border-zinc-800 rounded-xl">
              <LayoutTemplate size={48} className="mx-auto mb-4 opacity-50" />
              <p>Nenhuma página de captura criada.</p>
           </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
               <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <LayoutTemplate className="text-primary-500" size={20} />
                  {editingPage ? 'Editar Página' : 'Nova Página de Captura'}
               </h3>
               <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
               <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Título Interno</label>
                  <input required type="text" value={formData.title} onChange={handleTitleChange} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-primary-500 outline-none" placeholder="Ex: Campanha Black Friday" />
               </div>
               
               <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">URL (Slug)</label>
                  <div className="flex items-center">
                     <span className="bg-zinc-800 border border-r-0 border-zinc-700 text-zinc-500 p-2.5 rounded-l-lg text-sm">/</span>
                     <input required type="text" value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} className="w-full bg-zinc-950 border border-zinc-700 rounded-r-lg p-2.5 text-white focus:ring-1 focus:ring-primary-500 outline-none" placeholder="campanha-black-friday" />
                  </div>
               </div>

               <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Headline (Título Público)</label>
                  <input required type="text" value={formData.headline} onChange={e => setFormData({...formData, headline: e.target.value})} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-primary-500 outline-none" placeholder="Ex: Oferta Exclusiva Honda Civic" />
               </div>

               <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Descrição / Corpo</label>
                  <textarea rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-primary-500 outline-none" placeholder="Detalhes da oferta..." />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Origem do Lead</label>
                     <select value={formData.lead_origin_id} onChange={e => setFormData({...formData, lead_origin_id: e.target.value})} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-primary-500 outline-none">
                        <option value="">Nenhuma (Padrão)</option>
                        {origins.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                     </select>
                  </div>
                  <div className="flex items-end">
                     <label className="flex items-center gap-2 cursor-pointer p-2.5 bg-zinc-950 border border-zinc-700 rounded-lg w-full">
                        <input type="checkbox" checked={formData.active} onChange={e => setFormData({...formData, active: e.target.checked})} className="w-4 h-4 rounded text-primary-600 focus:ring-primary-600 bg-zinc-800 border-zinc-600" />
                        <span className="text-sm text-white font-medium">Página Ativa</span>
                     </label>
                  </div>
               </div>

               <div className="pt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-zinc-400 hover:text-white">Cancelar</button>
                  <button type="submit" className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2">
                     <Save size={18} /> Salvar
                  </button>
               </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
