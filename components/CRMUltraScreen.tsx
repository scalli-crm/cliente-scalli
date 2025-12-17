
import React, { useState, useEffect } from 'react';
import { Users, Calendar as CalIcon, CheckCircle, Car, AlertCircle, RefreshCw, Filter, Clock, Search, Layout, List, BarChart2, Briefcase, Zap, ToggleLeft, ToggleRight, X, ChevronDown, Calendar, Eye, EyeOff, Plus } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { Customer, Opportunity, CRMStage, User, CRMPipelineStage, CRMBrand, CRMModel, CRMLeadOrigin } from '../types';
import { CRMKanban } from './CRMKanban';
import { CRMAgenda } from './CRMAgenda';
import { CRMNegociacoes } from './CRMNegociacoes';
import { LeadFormModal } from './LeadFormModal';
import { OpportunityFormModal } from './OpportunityFormModal';
import { QuickActionModal } from './QuickActionModal';
import { CRMLeadDetail } from './CRMLeadDetail';
import { CRMDashboard } from './CRMDashboard';

interface CRMUltraScreenProps {
  currentUser?: User | null;
}

const NavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
   <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
         active 
         ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700' 
         : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
      }`}
   >
      {icon}
      {label}
   </button>
);

export const CRMUltraScreen: React.FC<CRMUltraScreenProps> = ({ currentUser }) => {
  // Navigation Tabs as requested by user
  const [activeTab, setActiveTab] = useState<'pipeline' | 'painel' | 'agenda' | 'negociacoes' | 'leads' | 'oportunidades'>('pipeline');
  
  // Data States
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [pipelineStages, setPipelineStages] = useState<CRMPipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- FILTERS STATE ---
  const [showFilters, setShowFilters] = useState(false);
  const [filterOptions, setFilterOptions] = useState<{
     users: User[];
     brands: CRMBrand[];
     models: CRMModel[];
     origins: CRMLeadOrigin[];
  }>({ users: [], brands: [], models: [], origins: [] });

  const [activeFilters, setActiveFilters] = useState({
     userId: '',
     brandId: '',
     modelId: '',
     originId: '',
     scheduledOnly: false
  });

  // Derived state for models based on selected brand
  const filteredModels = activeFilters.brandId 
     ? filterOptions.models.filter(m => m.brand_id === activeFilters.brandId)
     : [];

  // Settings State
  const [useQuickAction, setUseQuickAction] = useState(() => {
    // Persist preference in localStorage
    return localStorage.getItem('crm_quick_action_mode') !== 'false'; // Default true
  });
  
  const [showFinalStages, setShowFinalStages] = useState(false);

  // Modals & Selections
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isOpportunityModalOpen, setIsOpportunityModalOpen] = useState(false);
  const [isQuickActionModalOpen, setIsQuickActionModalOpen] = useState(false);
  const [isLeadDetailOpen, setIsLeadDetailOpen] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null); 
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [selectedLeadForDetail, setSelectedLeadForDetail] = useState<Customer | null>(null);

  const [searchTerm, setSearchTerm] = useState('');

  // Initial Fetch for Filter Options
  useEffect(() => {
     const fetchFilters = async () => {
        const [u, b, m, o] = await Promise.all([
           supabase.from('users').select('*').eq('active', true).order('name'),
           supabase.from('crm_brands').select('*').eq('active', true).order('name'),
           supabase.from('crm_models').select('*').eq('active', true).order('name'),
           supabase.from('crm_lead_origins').select('*').eq('active', true).order('name')
        ]);
        
        setFilterOptions({
           users: (u.data as any) || [],
           brands: (b.data as any) || [],
           models: (m.data as any) || [],
           origins: (o.data as any) || []
        });
     };
     fetchFilters();
  }, []);

  // Fetch Data based on active tab
  const fetchData = async () => {
    // Skip general fetch for 'painel' as it has internal fetching
    if (activeTab === 'painel') return;

    setLoading(true);
    try {
      // Always fetch pipeline stages configuration to respect "active" flags and order
      const { data: stagesData } = await supabase
         .from('crm_pipeline_stages')
         .select('*')
         .eq('active', true) // Only fetch active stages
         .order('order_index');
      
      if (stagesData) {
         setPipelineStages(stagesData as any);
      }

      if (activeTab === 'leads') {
         // Fetch Customers (Old Leads table)
         let query = supabase.from('leads').select('*').order('created_at', { ascending: false });
         const { data } = await query;
         if (data) setCustomers(data as any);
      } 
      else if (activeTab === 'pipeline' || activeTab === 'oportunidades' || activeTab === 'negociacoes') {
         // Fetch Opportunities with Customer data AND Schedule (Tasks)
         let robustQuery = supabase
            .from('crm_opportunities')
            .select(`
               *, 
               leads (*)
            `)
            .order('created_at', { ascending: false });

         // Filter by User Role (Backend security)
         if (currentUser?.role === 'sales') {
            robustQuery = robustQuery.eq('user_id', currentUser.id);
         }

         // Pipeline Filter: Exclude Lost (Perdido) and Won (Venda) to clean up view
         // Only show active deals in pipeline view
         if (activeTab === 'pipeline') {
             robustQuery = robustQuery.eq('status', 'open');
         }

         const { data: opps } = await robustQuery;
         
         if (opps) {
            // Now fetch schedules for these leads to attach them to opportunities
            const leadIds = opps.map(o => o.lead_id).filter(Boolean);
            if (leadIds.length > 0) {
                const { data: schedules } = await supabase
                  .from('schedule')
                  .select('*')
                  .in('lead_id', leadIds)
                  .eq('status', 'agendado'); // Only pending tasks matter for Kanban alert
                
                // Merge schedules into opportunities
                const mergedOpps = opps.map(opp => ({
                   ...opp,
                   schedule: schedules?.filter(s => s.lead_id === opp.lead_id) || []
                }));
                setOpportunities(mergedOpps as any);
            } else {
                setOpportunities(opps as any);
            }
         }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, currentUser]);

  // Handler: Customer Created
  const handleCustomerSuccess = (newCustomerId?: string) => {
     fetchData();
     // No prompt needed anymore, opportunity is created automatically in LeadFormModal
  };

  const handleOpportunitySuccess = () => {
     fetchData();
     setSelectedCustomer(null);
     setSelectedOpportunity(null);
  };

  // Kanban Drag & Drop
  const handleDrop = async (e: React.DragEvent, newStage: CRMStage) => {
    e.preventDefault();
    const oppId = e.dataTransfer.getData('oppId');
    if (!oppId) return;

    const oldOpp = opportunities.find(o => o.id === oppId);
    if (!oldOpp || oldOpp.stage === newStage) return;

    // Optimistic Update
    setOpportunities(prev => prev.map(o => o.id === oppId ? { ...o, stage: newStage } : o));

    // DB Update
    await supabase.from('crm_opportunities').update({ stage: newStage }).eq('id', oppId);

    // Log History
    if (oldOpp.lead_id) {
       const userName = currentUser?.name || 'Usuário';
       await supabase.from('lead_history').insert([{
          lead_id: oldOpp.lead_id,
          descricao: `${userName} alterou a etapa para ${newStage.toUpperCase()}`,
          categoria: 'sistema'
       }]);
    }
  };

  // Kanban Card Click logic updated
  const handleKanbanCardClick = (opp: Opportunity) => {
     setSelectedOpportunity(opp);
     if (useQuickAction) {
        setIsQuickActionModalOpen(true);
     } else {
        setIsOpportunityModalOpen(true);
     }
  };

  const toggleQuickActionMode = () => {
     const newValue = !useQuickAction;
     setUseQuickAction(newValue);
     localStorage.setItem('crm_quick_action_mode', String(newValue));
  };

  const openLeadDetail = (lead: Customer) => {
     setSelectedLeadForDetail(lead);
     setIsLeadDetailOpen(true);
  };

  // --- FILTERING LOGIC ---
  const filteredCustomers = customers.filter(c => c.nome.toLowerCase().includes(searchTerm.toLowerCase()));
  
  const filteredOpportunities = opportunities.filter(o => {
     // 1. Text Search
     const matchesSearch = o.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           o.leads?.nome.toLowerCase().includes(searchTerm.toLowerCase());
     
     // 2. User Filter (Vendedor)
     const matchesUser = !activeFilters.userId || o.user_id === activeFilters.userId;

     // 3. Brand Filter
     const matchesBrand = !activeFilters.brandId || o.brand_id === activeFilters.brandId;

     // 4. Model Filter
     const matchesModel = !activeFilters.modelId || o.model_id === activeFilters.modelId;

     // 5. Origin Filter (Requires traversing to lead)
     const matchesOrigin = !activeFilters.originId || o.leads?.lead_origin_id === activeFilters.originId;

     // 6. Scheduled Filter (Agendados)
     const matchesScheduled = !activeFilters.scheduledOnly || (o.schedule && o.schedule.some(s => s.status === 'agendado'));

     return matchesSearch && matchesUser && matchesBrand && matchesModel && matchesOrigin && matchesScheduled;
  });

  const clearFilters = () => {
     setActiveFilters({ userId: '', brandId: '', modelId: '', originId: '', scheduledOnly: false });
  };

  const hasActiveFilters = activeFilters.userId || activeFilters.brandId || activeFilters.modelId || activeFilters.originId || activeFilters.scheduledOnly;

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      
      {/* Navigation Bar */}
      <div className="px-6 py-4 border-b border-zinc-800 flex flex-col xl:flex-row justify-between items-center gap-4 bg-zinc-950/50 backdrop-blur-sm sticky top-0 z-20">
         <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800 overflow-x-auto max-w-full">
            <NavButton active={activeTab === 'pipeline'} onClick={() => setActiveTab('pipeline')} icon={<Layout size={16} />} label="1. Pipeline" />
            <NavButton active={activeTab === 'painel'} onClick={() => setActiveTab('painel')} icon={<BarChart2 size={16} />} label="2. Painel" />
            <NavButton active={activeTab === 'agenda'} onClick={() => setActiveTab('agenda')} icon={<CalIcon size={16} />} label="3. Agenda" />
            <NavButton active={activeTab === 'negociacoes'} onClick={() => setActiveTab('negociacoes')} icon={<List size={16} />} label="4. Negociações" />
            <NavButton active={activeTab === 'leads'} onClick={() => setActiveTab('leads')} icon={<Users size={16} />} label="5. Leads" />
            <NavButton active={activeTab === 'oportunidades'} onClick={() => setActiveTab('oportunidades')} icon={<Briefcase size={16} />} label="6. Oportunidades" />
         </div>

         <div className="flex gap-3 w-full xl:w-auto items-center">
            
            {/* Filter Toggle Button */}
            {(activeTab === 'pipeline' || activeTab === 'oportunidades') && (
               <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-2 rounded-lg border transition-colors ${showFilters || hasActiveFilters ? 'bg-zinc-800 text-primary-500 border-primary-500/50' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'}`}
                  title="Filtros Avançados"
               >
                  <Filter size={18} />
               </button>
            )}

            {/* Search - Hide on Dashboard */}
            {activeTab !== 'painel' && (
               <div className="relative flex-1 xl:w-64">
                  <Search className="absolute left-3 top-2.5 text-zinc-500" size={16} />
                  <input 
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                  />
               </div>
            )}

            <button onClick={fetchData} className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white">
               <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            
            {(activeTab === 'leads' || activeTab === 'pipeline' || activeTab === 'oportunidades') && (
               <button 
                  onClick={() => { setSelectedCustomer(null); setIsCustomerModalOpen(true); }} 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg flex items-center gap-2 whitespace-nowrap transition-transform active:scale-95"
               >
                  <Plus size={16} /> Novo Lead
               </button>
            )}
         </div>
      </div>

      {/* ADVANCED FILTER BAR */}
      {showFilters && (activeTab === 'pipeline' || activeTab === 'oportunidades') && (
         <div className="px-6 py-3 bg-zinc-900 border-b border-zinc-800 animate-in slide-in-from-top-2 flex flex-wrap gap-3 items-center">
            
            {/* 1. Vendedor */}
            <div className="relative group">
               <select 
                  value={activeFilters.userId}
                  onChange={e => setActiveFilters({...activeFilters, userId: e.target.value})}
                  className="bg-zinc-950 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-3 py-2 pr-8 appearance-none focus:border-primary-500 focus:outline-none min-w-[140px]"
               >
                  <option value="">Todos Vendedores</option>
                  {filterOptions.users.map(u => (
                     <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
               </select>
               <ChevronDown size={14} className="absolute right-2 top-2.5 text-zinc-500 pointer-events-none" />
            </div>

            {/* 2. Marca */}
            <div className="relative group">
               <select 
                  value={activeFilters.brandId}
                  onChange={e => setActiveFilters({...activeFilters, brandId: e.target.value, modelId: ''})} 
                  className="bg-zinc-950 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-3 py-2 pr-8 appearance-none focus:border-primary-500 focus:outline-none min-w-[140px]"
               >
                  <option value="">Todas Marcas</option>
                  {filterOptions.brands.map(b => (
                     <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
               </select>
               <ChevronDown size={14} className="absolute right-2 top-2.5 text-zinc-500 pointer-events-none" />
            </div>

            {/* 3. Modelo */}
            <div className="relative group">
               <select 
                  value={activeFilters.modelId}
                  onChange={e => setActiveFilters({...activeFilters, modelId: e.target.value})}
                  className="bg-zinc-950 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-3 py-2 pr-8 appearance-none focus:border-primary-500 focus:outline-none min-w-[140px] disabled:opacity-50"
                  disabled={!activeFilters.brandId}
               >
                  <option value="">Todos Modelos</option>
                  {filteredModels.map(m => (
                     <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
               </select>
               <ChevronDown size={14} className="absolute right-2 top-2.5 text-zinc-500 pointer-events-none" />
            </div>

            {/* 4. Origem */}
            <div className="relative group">
               <select 
                  value={activeFilters.originId}
                  onChange={e => setActiveFilters({...activeFilters, originId: e.target.value})}
                  className="bg-zinc-950 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-3 py-2 pr-8 appearance-none focus:border-primary-500 focus:outline-none min-w-[140px]"
               >
                  <option value="">Todas Origens</option>
                  {filterOptions.origins.map(o => (
                     <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
               </select>
               <ChevronDown size={14} className="absolute right-2 top-2.5 text-zinc-500 pointer-events-none" />
            </div>

            {/* 5. Agendados Toggle */}
            <button 
               onClick={() => setActiveFilters({...activeFilters, scheduledOnly: !activeFilters.scheduledOnly})}
               className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${activeFilters.scheduledOnly ? 'bg-purple-600 border-purple-500 text-white' : 'bg-zinc-950 border-zinc-700 text-zinc-400 hover:text-white'}`}
            >
               <Calendar size={14} /> Somente Agendados
            </button>

            {hasActiveFilters && (
               <button 
                  onClick={clearFilters}
                  className="ml-auto text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
               >
                  <X size={12} /> Limpar Filtros
               </button>
            )}
         </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative bg-zinc-900/50 p-4">
         
         {/* 1. PIPELINE (KANBAN DE OPORTUNIDADES) */}
         {activeTab === 'pipeline' && (
            <div className="flex flex-col h-full">
               {/* Unified Toolbar for Kanban */}
               <div className="flex justify-end px-2 mb-2 gap-3">
                  {/* Quick Mode Toggle */}
                  <button 
                     onClick={toggleQuickActionMode}
                     className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-white transition-colors bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800"
                     title={useQuickAction ? "Desativar modal rápido" : "Ativar modal rápido"}
                  >
                     <Zap size={14} className={useQuickAction ? "text-yellow-500 fill-yellow-500" : "text-zinc-600"} />
                     Modo Rápido: 
                     <span className={useQuickAction ? "text-green-500" : "text-zinc-600"}>
                        {useQuickAction ? "ON" : "OFF"}
                     </span>
                     {useQuickAction ? <ToggleRight size={20} className="text-green-500"/> : <ToggleLeft size={20} />}
                  </button>

                  {/* Show Finalized Toggle */}
                  <button 
                     onClick={() => setShowFinalStages(!showFinalStages)}
                     className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all ${
                        showFinalStages 
                        ? 'bg-zinc-800 text-white border-zinc-700' 
                        : 'bg-zinc-900/50 text-zinc-500 border-zinc-800 hover:text-zinc-300'
                     }`}
                  >
                     {showFinalStages ? (
                        <>
                           <EyeOff size={14} /> Ocultar Finalizados
                        </>
                     ) : (
                        <>
                           <Eye size={14} /> Mostrar Finalizados
                        </>
                     )}
                  </button>
               </div>

               <CRMKanban 
                  opportunities={filteredOpportunities} 
                  stagesConfig={pipelineStages}
                  loading={loading}
                  onDrop={handleDrop}
                  onCardClick={handleKanbanCardClick}
                  showFinalStages={showFinalStages}
               />
            </div>
         )}

         {/* 2. PAINEL (DASHBOARD) */}
         {activeTab === 'painel' && (
            <div className="h-full -m-4">
               <CRMDashboard currentUser={currentUser} />
            </div>
         )}

         {/* 5. LEADS LIST */}
         {activeTab === 'leads' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden h-full flex flex-col">
               <div className="p-4 border-b border-zinc-800 bg-zinc-950">
                  <h3 className="text-white font-bold flex items-center gap-2"><Users className="text-primary-500"/> Base de Leads (Pessoas)</h3>
               </div>
               <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-left text-sm text-zinc-400">
                     <thead className="bg-zinc-950 text-zinc-200 uppercase text-xs sticky top-0">
                        <tr>
                           <th className="px-6 py-4">Nome</th>
                           <th className="px-6 py-4">Contato</th>
                           <th className="px-6 py-4">Origem</th>
                           <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-zinc-800">
                        {filteredCustomers.map(c => (
                           <tr key={c.id} className="hover:bg-zinc-800/50">
                              <td className="px-6 py-4 font-medium text-white cursor-pointer hover:text-primary-500" onClick={() => openLeadDetail(c)}>
                                 {c.nome}
                              </td>
                              <td className="px-6 py-4">{c.telefone} <br/> <span className="text-xs text-zinc-600">{c.email}</span></td>
                              <td className="px-6 py-4">{c.origem || '-'}</td>
                              <td className="px-6 py-4 text-right flex justify-end gap-2">
                                 <button 
                                    onClick={() => openLeadDetail(c)}
                                    className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-xs"
                                 >
                                    Ver Perfil
                                 </button>
                                 <button 
                                    onClick={() => { setSelectedCustomer(c); setIsOpportunityModalOpen(true); }}
                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-lg shadow-emerald-900/20"
                                 >
                                    + Oportunidade
                                 </button>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
         )}

         {/* 6. OPORTUNIDADES LIST */}
         {activeTab === 'oportunidades' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden h-full flex flex-col">
               <div className="p-4 border-b border-zinc-800 bg-zinc-950">
                  <h3 className="text-white font-bold flex items-center gap-2"><Briefcase className="text-emerald-500"/> Todas as Oportunidades</h3>
               </div>
               <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-left text-sm text-zinc-400">
                     <thead className="bg-zinc-950 text-zinc-200 uppercase text-xs sticky top-0">
                        <tr>
                           <th className="px-6 py-4">Negócio</th>
                           <th className="px-6 py-4">Cliente</th>
                           <th className="px-6 py-4">Etapa</th>
                           <th className="px-6 py-4 text-center">Status</th>
                           <th className="px-6 py-4 text-right">Ação</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-zinc-800">
                        {filteredOpportunities.map(op => (
                           <tr key={op.id} className="hover:bg-zinc-800/50">
                              <td className="px-6 py-4 font-bold text-white">{op.title}</td>
                              <td className="px-6 py-4 text-zinc-300">{op.leads?.nome}</td>
                              <td className="px-6 py-4">
                                 <span className="px-2 py-1 bg-zinc-800 rounded text-xs uppercase font-bold text-zinc-400">{op.stage}</span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                 {op.status === 'won' && <span className="text-emerald-500 text-xs font-bold uppercase">Ganha</span>}
                                 {op.status === 'lost' && <span className="text-red-500 text-xs font-bold uppercase">Perdida</span>}
                                 {op.status === 'open' && <span className="text-blue-500 text-xs font-bold uppercase">Aberta</span>}
                              </td>
                              <td className="px-6 py-4 text-right">
                                 <button 
                                    onClick={() => { setSelectedOpportunity(op); setIsOpportunityModalOpen(true); }}
                                    className="text-primary-500 hover:text-white text-xs font-bold"
                                 >
                                    Ver Detalhes
                                 </button>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
         )}

         {/* Placeholders for other tabs */}
         {activeTab === 'agenda' && <CRMAgenda />}
         {activeTab === 'negociacoes' && (
            <CRMNegociacoes 
               currentUser={currentUser} 
               onOpportunityClick={(opp) => { setSelectedOpportunity(opp); setIsOpportunityModalOpen(true); }}
            />
         )}

      </div>

      {/* MODALS */}
      <LeadFormModal 
         isOpen={isCustomerModalOpen} 
         onClose={() => { setIsCustomerModalOpen(false); setSelectedCustomer(null); }} 
         onSuccess={handleCustomerSuccess}
         leadToEdit={selectedCustomer}
         currentUser={currentUser}
      />

      {/* Lead Detail Full View */}
      {isLeadDetailOpen && selectedLeadForDetail && (
         <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex justify-end">
            <div className="h-full w-full max-w-4xl relative">
                <CRMLeadDetail 
                   lead={selectedLeadForDetail} 
                   onClose={() => setIsLeadDetailOpen(false)} 
                   onUpdate={fetchData} 
                />
            </div>
         </div>
      )}

      {/* Full Opportunity Edit Modal */}
      {isOpportunityModalOpen && selectedOpportunity && (
          <OpportunityFormModal 
            isOpen={isOpportunityModalOpen}
            onClose={() => { setIsOpportunityModalOpen(false); setSelectedOpportunity(null); }}
            onSuccess={handleOpportunitySuccess}
            customerId={selectedOpportunity.lead_id}
            customerName={selectedOpportunity.leads?.nome}
            opportunityToEdit={selectedOpportunity}
         />
      )}

      {/* Quick Action Modal (New) */}
      <QuickActionModal 
         isOpen={isQuickActionModalOpen}
         onClose={() => setIsQuickActionModalOpen(false)}
         opportunity={selectedOpportunity}
         onSuccess={fetchData}
         currentUser={currentUser}
         onOpenFullDetails={(opp) => {
            setIsQuickActionModalOpen(false);
            setSelectedOpportunity(opp);
            setIsOpportunityModalOpen(true);
         }}
         onOpenHistory={(leadId) => {
            setIsQuickActionModalOpen(false);
            // Need to find the full customer object.
            // Using the leads data embedded in the opportunity
            if (selectedOpportunity && selectedOpportunity.leads) {
               openLeadDetail(selectedOpportunity.leads);
            }
         }}
      />

    </div>
  );
};
