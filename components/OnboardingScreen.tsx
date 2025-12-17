
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { OnboardingClient, OnboardingCampaign, User } from '../types';
import { GoogleGenAI } from "@google/genai";
import { 
  Plus, ChevronRight, Lightbulb, Users, Target, Rocket, FileText, Video, PlayCircle, 
  FolderOpen, Wand2, X, RefreshCw, Briefcase, Filter, Image, Link as LinkIcon, 
  CheckCircle2, AlertTriangle, Facebook, Instagram, Globe, MessageCircle, BarChart3, 
  Database, Lock, Layout, ExternalLink, Copy, Hash, Smartphone, MapPin, DollarSign, StickyNote, Edit2, Search, Check
} from 'lucide-react';
import { ClientOnboardingForm } from './ClientOnboardingForm';

interface OnboardingScreenProps {
   currentUser: User;
}

// Helper para acessar dados dentro do JSONB 'details' com segurança
const getDetail = (client: OnboardingClient, key: string, fallback: string = '') => {
  return client.details && client.details[key] ? client.details[key] : fallback;
};

// Componente de Badge de Status de Acesso
const AccessBadge = ({ label, value, type = 'id' }: { label: string, value: string, type?: 'id' | 'link' }) => {
  const [copied, setCopied] = useState(false);
  const hasAccess = value && value.length > 2;

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg group hover:border-zinc-700 transition-all">
      <div className="flex flex-col overflow-hidden max-w-[85%]">
        <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-0.5">{label}</span>
        <div className="flex items-center gap-2">
           {hasAccess ? (
             <>
               <span className="text-sm font-mono text-zinc-300 truncate" title={value}>
                  {type === 'link' ? 'Link Configurado' : value}
               </span>
               <button 
                  onClick={handleCopy} 
                  className="text-zinc-600 hover:text-white transition-colors p-1 rounded hover:bg-zinc-800"
                  title="Copiar"
               >
                  {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
               </button>
             </>
           ) : (
             <span className="text-sm text-zinc-600 italic">Não configurado</span>
           )}
        </div>
      </div>
      <div className="pl-2">
         {hasAccess ? (
            type === 'link' ? (
               <a href={value} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-400 p-1.5 bg-blue-500/10 rounded-md">
                  <ExternalLink size={14} />
               </a>
            ) : (
               <div className="text-emerald-500 bg-emerald-500/10 p-1.5 rounded-md flex items-center gap-1 text-[10px] font-bold border border-emerald-500/20">
                  <CheckCircle2 size={12} /> OK
               </div>
            )
         ) : (
            <div className="text-zinc-600 bg-zinc-800 p-1.5 rounded-md">
               <X size={14} />
            </div>
         )}
      </div>
    </div>
  );
};

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ currentUser }) => {
  const [clients, setClients] = useState<OnboardingClient[]>([]);
  const [selectedClient, setSelectedClient] = useState<OnboardingClient | null>(null);
  const [campaign, setCampaign] = useState<OnboardingCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); // New state for Edit Modal
  const [generating, setGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    const { data } = await supabase.from('onboarding_clients').select('*').eq('active', true).order('created_at', { ascending: false });
    if (data) setClients(data as OnboardingClient[]);
    setLoading(false);
  };

  const fetchCampaign = async (clientId: string) => {
    const { data } = await supabase.from('onboarding_campaigns').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1).single();
    if (data) setCampaign(data as OnboardingCampaign);
    else setCampaign(null);
  };

  const handleSelectClient = (client: OnboardingClient) => {
    setSelectedClient(client);
    fetchCampaign(client.id);
  };

  // Function to refresh selected client data after edit
  const handleEditComplete = async () => {
     setIsEditModalOpen(false);
     if (selectedClient) {
        // Fetch fresh data for the selected client
        const { data } = await supabase.from('onboarding_clients').select('*').eq('id', selectedClient.id).single();
        if (data) {
           setSelectedClient(data as OnboardingClient);
        }
     }
     fetchClients(); // Refresh the main list too
  };

  const generateStrategy = async () => {
    if (!selectedClient) return;
    setGenerating(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const details = selectedClient.details || {};
      
      const prompt = `
        ATUE COMO UM ESTRATEGISTA DE TRÁFEGO PAGO E COPYWRITING SÊNIOR.
        
        Analise os dados deste cliente e gere uma estratégia completa de campanha.
        
        DADOS DO CLIENTE:
        - Nome: ${selectedClient.business_name}
        - Segmento: ${getDetail(selectedClient, 'segment')}
        - Oferta Principal: ${selectedClient.offer_main}
        - Dores/Problema: ${getDetail(selectedClient, 'problem_solved')}
        - Diferenciais: ${getDetail(selectedClient, 'differentiators')}
        - Público-Alvo: ${selectedClient.target_audience}
        - Objeções: ${getDetail(selectedClient, 'objections')}
        - Objetivo de Campanha: ${getDetail(selectedClient, 'campaign_objective')}
        
        SAÍDA OBRIGATÓRIA (JSON ESTRITO):
        {
          "analysis_summary": {
            "awareness_level": "Nível de consciência (Ex: Inconsciente, Consciente do Problema...)",
            "funnel_stage": "Etapa do Funil (Ex: Topo - Atração, Fundo - Conversão)",
            "campaign_objective": "Objetivo Técnico (Ex: Conversão em Leads, Mensagens WhatsApp)"
          },
          "angles": [
            {
              "title": "Nome do Ângulo (Ex: Foco na Dor)",
              "pain": "Qual dor este ângulo ataca?",
              "desire": "Qual desejo desperta?",
              "differential": "Qual diferencial destaca?",
              "headline": "Título chamativo para o anúncio (Ad Headline)",
              "short_copy": "Texto curto para Instagram/Stories (até 150 caracteres)",
              "long_copy": "Legenda completa para Feed (AIDA structure)",
              "cta": "Chamada para ação específica",
              "creative_ideas": ["Ideia visual 1", "Ideia visual 2"],
              "format_suggestion": "Formato ideal (Ex: Vídeo Reels, Carrossel)"
            },
            { ... repetido para ângulo 2 ... },
            { ... repetido para ângulo 3 ... }
          ],
          "video_script": {
            "hook": "Gancho visual e verbal (0-3s)",
            "body": "Desenvolvimento do roteiro (3-45s)",
            "cta": "Fechamento (45-60s)",
            "visual_description": "Descrição do que aparece na tela (B-Roll, Lettering, Cenário)"
          },
          "visual_creative": {
            "scene": "Descrição detalhada da imagem estática para designer",
            "text_overlay": "Texto que vai escrito na imagem (Headline visual)",
            "hook": "Elemento visual que chama atenção"
          }
        }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
           responseMimeType: "application/json"
        }
      });

      const jsonText = response.text;
      if (!jsonText) throw new Error("Sem resposta da IA");

      const strategyData = JSON.parse(jsonText);

      const { data, error } = await supabase.from('onboarding_campaigns').insert([{
        client_id: selectedClient.id,
        ...strategyData
      }]).select();

      if (error) throw error;
      if (data) setCampaign(data[0] as OnboardingCampaign);

    } catch (err: any) {
      console.error(err);
      alert("Erro ao gerar estratégia: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  // --- FILTER CLIENTS ---
  const filteredClients = clients.filter(client => {
    const term = searchTerm.toLowerCase();
    return (
        client.business_name.toLowerCase().includes(term) ||
        client.business_type.toLowerCase().includes(term) ||
        client.offer_main.toLowerCase().includes(term) ||
        client.target_audience.toLowerCase().includes(term)
    );
  });

  // --- LISTA DE CLIENTES (HOME) ---
  if (!selectedClient) {
    return (
      <div className="p-8 animate-in fade-in">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
              <Rocket className="text-primary-500" size={32} /> Central de Estratégia
            </h2>
            <p className="text-zinc-400 text-sm mt-1">Selecione um cliente para acessar o Painel de Inteligência.</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
             <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-3 text-zinc-500" size={18} />
                <input 
                   type="text" 
                   placeholder="Buscar cliente..." 
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all placeholder:text-zinc-600"
                />
             </div>
             <button onClick={() => setIsModalOpen(true)} className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary-900/20 transition-transform active:scale-95 whitespace-nowrap">
               <Plus size={20} /> <span className="hidden md:inline">Novo Onboarding</span>
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading ? (
             <div className="col-span-full text-center py-20 text-zinc-500">Carregando carteira de clientes...</div>
          ) : filteredClients.length === 0 ? (
             <div className="col-span-full flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/50">
                <Rocket size={48} className="text-zinc-600 mb-4 opacity-50" />
                <p className="text-zinc-400 font-medium">
                   {searchTerm ? 'Nenhum cliente encontrado para a busca.' : 'Nenhum cliente cadastrado ainda.'}
                </p>
             </div>
          ) : (
             filteredClients.map(client => (
            <div key={client.id} onClick={() => handleSelectClient(client)} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 cursor-pointer hover:border-primary-500/50 hover:bg-zinc-800/80 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-primary-500/10 transition-colors"></div>
              
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-primary-500 font-bold text-xl uppercase shadow-inner">
                  {client.business_name.substring(0, 2)}
                </div>
                <div className="bg-zinc-950 border border-zinc-800 rounded-full px-3 py-1 flex items-center gap-1">
                   <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                   <span className="text-[10px] font-bold text-zinc-400 uppercase">Ativo</span>
                </div>
              </div>
              
              <h3 className="text-lg font-bold text-white mb-1 relative z-10 truncate" title={client.business_name}>{client.business_name}</h3>
              <p className="text-xs text-zinc-500 mb-4 relative z-10 flex items-center gap-1">
                 <Briefcase size={12} /> {client.business_type}
              </p>
              
              <div className="flex gap-2 relative z-10">
                {client.platforms.slice(0, 3).map(p => (
                  <span key={p} className="text-[10px] bg-zinc-950 text-zinc-400 px-2 py-1 rounded border border-zinc-800">{p}</span>
                ))}
                {client.platforms.length > 3 && <span className="text-[10px] text-zinc-500">+</span>}
              </div>
            </div>
          )))}
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in overflow-y-auto">
            <div className="w-full max-w-5xl my-8">
               <ClientOnboardingForm 
                  currentUser={currentUser} 
                  onComplete={() => { setIsModalOpen(false); fetchClients(); }} 
                  onCancel={() => setIsModalOpen(false)}
               />
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- DASHBOARD DE ESTRATÉGIA (CLIENT VIEW) ---
  return (
    <div className="h-full flex flex-col bg-zinc-950 animate-in slide-in-from-right duration-300">
      
      {/* Top Bar */}
      <div className="bg-zinc-900/80 backdrop-blur border-b border-zinc-800 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button onClick={() => setSelectedClient(null)} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors">
            <ChevronRight className="rotate-180" size={20} />
          </button>
          <div>
             <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {selectedClient.business_name}
                <span className="text-[10px] bg-primary-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Cliente</span>
             </h2>
             <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2">
               <Briefcase size={12} /> {selectedClient.business_type} • <Target size={12} /> {selectedClient.offer_main}
             </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
           
           {/* Edit Data Button */}
           <button 
              onClick={() => setIsEditModalOpen(true)}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 border border-zinc-700 transition-all"
           >
              <Edit2 size={16} /> Editar Dados
           </button>

           <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-500 border-l border-zinc-800 pl-4">
              <span className="flex items-center gap-1"><Database size={12}/> ID: {selectedClient.id.substring(0,8)}</span>
           </div>
           
           <button 
              onClick={generateStrategy} 
              disabled={generating} 
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-purple-900/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed w-full md:w-auto justify-center"
           >
              {generating ? <RefreshCw className="animate-spin" size={18} /> : <Wand2 size={18} />}
              {generating ? 'IA Trabalhando...' : campaign ? 'Regerar Estratégia' : 'Gerar Estratégia IA'}
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
         <div className="max-w-7xl mx-auto space-y-8">
            
            {/* 1. INFRAESTRUTURA & ACESSOS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               
               {/* Col 1: Raio-X do Negócio */}
               <div className="space-y-6">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-full blur-2xl"></div>
                     <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Target className="text-blue-500" size={16} /> Raio-X do Negócio
                     </h3>
                     
                     <div className="space-y-4">
                        <InfoItem label="Público-Alvo (Avatar)" value={selectedClient.target_audience} icon={<Users size={14}/>} />
                        
                        <div className="grid grid-cols-2 gap-4">
                           <InfoItem label="Região" value={getDetail(selectedClient, 'region', 'Brasil')} icon={<MapPin size={14}/>} />
                           <InfoItem label="Ticket Médio" value={getDetail(selectedClient, 'ticket_avg', '-')} icon={<DollarSign size={14}/>} />
                        </div>

                        <InfoItem label="Dores Principais" value={getDetail(selectedClient, 'problem_solved', 'Não informado')} icon={<AlertTriangle size={14}/>} />
                        <InfoItem label="Funil de Vendas" value={selectedClient.sales_process} icon={<Filter size={14}/>} />
                        <InfoItem label="Verba Mensal" value={getDetail(selectedClient, 'current_ad_budget', 'R$ -')} icon={<Database size={14}/>} highlight />
                     </div>

                     {getDetail(selectedClient, 'observations') && (
                        <div className="mt-4 pt-4 border-t border-zinc-800">
                           <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                              <StickyNote size={12}/> Observações
                           </p>
                           <p className="text-xs text-zinc-400 italic line-clamp-4 bg-zinc-950/50 p-2 rounded border border-zinc-800/50">
                              "{getDetail(selectedClient, 'observations')}"
                           </p>
                        </div>
                     )}
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg">
                     <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                        <LinkIcon className="text-zinc-400" size={16} /> Links Importantes
                     </h3>
                     <div className="space-y-2">
                        <AccessBadge label="Site Oficial" value={getDetail(selectedClient, 'site_link')} type="link" />
                        <AccessBadge label="Instagram" value={getDetail(selectedClient, 'instagram_link')} type="link" />
                        <AccessBadge label="Facebook Page" value={getDetail(selectedClient, 'facebook_page_link')} type="link" />
                        <AccessBadge label="Drive / Materiais" value={getDetail(selectedClient, 'drive_link')} type="link" />
                     </div>
                  </div>
               </div>

               {/* Col 2: Infraestrutura de Rastreamento (Onde a mágica técnica acontece) */}
               <div className="space-y-6">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg border-t-4 border-t-emerald-600">
                     <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Database className="text-emerald-500" size={16} /> Infraestrutura & Tracking
                     </h3>
                     
                     <div className="space-y-3">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase mt-4 mb-2 flex items-center gap-1"><BarChart3 size={12}/> Google Stack</h4>
                        <AccessBadge label="Google Analytics 4" value={getDetail(selectedClient, 'ga4_id')} />
                        <AccessBadge label="Google Tag Manager" value={getDetail(selectedClient, 'gtm_id')} />
                        
                        <h4 className="text-xs font-bold text-zinc-500 uppercase mt-4 mb-2 flex items-center gap-1"><Facebook size={12}/> Meta Stack</h4>
                        <AccessBadge label="Pixel ID" value={getDetail(selectedClient, 'fb_pixel_id')} />
                        <AccessBadge label="Ad Account ID" value={getDetail(selectedClient, 'ad_account_id')} />
                        <AccessBadge label="Business Manager ID" value={getDetail(selectedClient, 'bm_id')} />
                     </div>
                  </div>
               </div>

               {/* Col 3: Contatos & Login */}
               <div className="space-y-6">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg">
                     <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Lock className="text-orange-500" size={16} /> Acessos & Login
                     </h3>
                     
                     <div className="bg-zinc-950 rounded-lg p-4 border border-zinc-800 mb-4">
                        <div className="flex items-center gap-2 mb-2 text-zinc-400 text-xs font-bold uppercase">
                           <Globe size={12} /> Acesso ao Site / LP
                        </div>
                        {getDetail(selectedClient, 'site_login') ? (
                           <div className="flex justify-between items-center bg-zinc-900 p-2 rounded border border-zinc-800">
                              <span className="text-zinc-300 text-xs font-mono">******** (Oculto)</span>
                              <div className="flex gap-2">
                                 <button 
                                    className="text-zinc-500 hover:text-white" 
                                    title="Copiar"
                                    onClick={() => {
                                       navigator.clipboard.writeText(getDetail(selectedClient, 'site_login'));
                                       alert('Dados de acesso copiados!');
                                    }}
                                 >
                                    <Copy size={12}/>
                                 </button>
                              </div>
                           </div>
                        ) : (
                           <span className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={12}/> Não informado</span>
                        )}
                        <p className="text-[10px] text-zinc-600 mt-2">Nunca compartilhe senhas por print.</p>
                     </div>

                     <div className="space-y-2">
                        <div className="p-3 bg-green-500/5 border border-green-500/10 rounded-lg flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 shrink-0">
                              <MessageCircle size={16} />
                           </div>
                           <div className="overflow-hidden">
                              <p className="text-xs font-bold text-zinc-400 uppercase">WhatsApp Ads</p>
                              <div className="flex items-center gap-2">
                                 <p className="text-sm text-white truncate">{getDetail(selectedClient, 'whatsapp_ads') || 'Não informado'}</p>
                                 {getDetail(selectedClient, 'whatsapp_ads') && (
                                    <button 
                                       onClick={() => navigator.clipboard.writeText(getDetail(selectedClient, 'whatsapp_ads'))}
                                       className="text-zinc-600 hover:text-green-500"
                                    >
                                       <Copy size={12} />
                                    </button>
                                 )}
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>

            </div>

            {/* 2. ESTRATÉGIA IA (FULL WIDTH) */}
            <div className="border-t border-zinc-800 pt-8">
               <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg shadow-lg">
                     <Wand2 size={24} className="text-white" />
                  </div>
                  <div>
                     <h3 className="text-2xl font-bold text-white">Inteligência Artificial</h3>
                     <p className="text-zinc-400 text-sm">Diagnóstico, Ângulos e Criativos gerados automaticamente.</p>
                  </div>
               </div>

               {campaign ? (
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                     
                     {/* DIAGNÓSTICO */}
                     <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-4">
                           <div className="p-3 bg-yellow-500/10 rounded-lg text-yellow-500"><Lightbulb size={20}/></div>
                           <div>
                              <p className="text-xs text-zinc-500 font-bold uppercase">Nível de Consciência</p>
                              <p className="text-white font-medium">{campaign.analysis_summary.awareness_level}</p>
                           </div>
                        </div>
                        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-4">
                           <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500"><Filter size={20}/></div>
                           <div>
                              <p className="text-xs text-zinc-500 font-bold uppercase">Etapa do Funil</p>
                              <p className="text-white font-medium">{campaign.analysis_summary.funnel_stage}</p>
                           </div>
                        </div>
                        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-4">
                           <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-500"><Target size={20}/></div>
                           <div>
                              <p className="text-xs text-zinc-500 font-bold uppercase">Objetivo Técnico</p>
                              <p className="text-white font-medium">{campaign.analysis_summary.campaign_objective}</p>
                           </div>
                        </div>
                     </div>

                     {/* COPY & ANGLES */}
                     <div className="xl:col-span-2 space-y-6">
                        {campaign.angles.map((angle, idx) => (
                           <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 relative overflow-hidden group hover:border-zinc-700 transition-colors">
                              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-indigo-500"></div>
                              <div className="flex justify-between items-start mb-4">
                                 <h4 className="text-lg font-bold text-white flex items-center gap-2">
                                    <span className="text-purple-400">#{idx + 1}</span> {angle.title}
                                 </h4>
                                 <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded border border-zinc-700">{angle.format_suggestion}</span>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                                 <div className="space-y-2">
                                    <p className="text-xs text-zinc-500 font-bold uppercase">Dor / Problema</p>
                                    <p className="text-sm text-zinc-300 bg-zinc-950 p-2 rounded border border-zinc-800">{angle.pain}</p>
                                 </div>
                                 <div className="space-y-2">
                                    <p className="text-xs text-zinc-500 font-bold uppercase">Desejo / Solução</p>
                                    <p className="text-sm text-zinc-300 bg-zinc-950 p-2 rounded border border-zinc-800">{angle.desire}</p>
                                 </div>
                              </div>

                              <div className="space-y-4">
                                 <div>
                                    <div className="flex items-center gap-2 mb-1">
                                       <Hash size={12} className="text-zinc-500" />
                                       <span className="text-xs font-bold text-zinc-400 uppercase">Headline (Título)</span>
                                    </div>
                                    <p className="text-white font-bold text-lg">{angle.headline}</p>
                                 </div>
                                 <div>
                                    <div className="flex items-center gap-2 mb-1">
                                       <FileText size={12} className="text-zinc-500" />
                                       <span className="text-xs font-bold text-zinc-400 uppercase">Copy Longa (Legenda)</span>
                                    </div>
                                    <p className="text-sm text-zinc-400 whitespace-pre-wrap leading-relaxed bg-zinc-950/50 p-3 rounded border border-zinc-800/50">{angle.long_copy}</p>
                                 </div>
                                 <div className="flex items-center gap-2 pt-2">
                                    <span className="text-xs font-bold text-emerald-500 uppercase bg-emerald-500/10 px-2 py-1 rounded">CTA: {angle.cta}</span>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>

                     {/* CREATIVE & SCRIPT */}
                     <div className="space-y-6">
                        {/* Video Script */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-lg border-t-4 border-t-pink-500">
                           <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                              <Video className="text-pink-500" size={18} /> Roteiro de Vídeo (Reels)
                           </h4>
                           <div className="space-y-4 relative">
                              <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-zinc-800"></div>
                              
                              <div className="relative pl-8">
                                 <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-400 font-bold">1</div>
                                 <p className="text-xs text-pink-400 font-bold uppercase mb-1">Gancho (0-3s)</p>
                                 <p className="text-sm text-white">{campaign.video_script.hook}</p>
                              </div>
                              <div className="relative pl-8">
                                 <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-400 font-bold">2</div>
                                 <p className="text-xs text-zinc-500 font-bold uppercase mb-1">Conteúdo</p>
                                 <p className="text-sm text-zinc-300">{campaign.video_script.body}</p>
                              </div>
                              <div className="relative pl-8">
                                 <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-400 font-bold">3</div>
                                 <p className="text-xs text-emerald-500 font-bold uppercase mb-1">CTA</p>
                                 <p className="text-sm text-white font-bold">{campaign.video_script.cta}</p>
                              </div>
                           </div>
                           <div className="mt-4 p-3 bg-zinc-950 rounded-lg border border-zinc-800 text-xs text-zinc-400 italic">
                              <span className="not-italic font-bold text-zinc-300 block mb-1">Direção Visual:</span>
                              {campaign.video_script.visual_description}
                           </div>
                        </div>

                        {/* Static Creative */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-lg border-t-4 border-t-orange-500">
                           <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                              <Image className="text-orange-500" size={18} /> Criativo Estático
                           </h4>
                           <div className="space-y-4">
                              <div>
                                 <p className="text-xs text-zinc-500 font-bold uppercase mb-1">Cenário / Imagem</p>
                                 <p className="text-sm text-zinc-300">{campaign.visual_creative.scene}</p>
                              </div>
                              <div>
                                 <p className="text-xs text-zinc-500 font-bold uppercase mb-1">Texto na Imagem (Overlay)</p>
                                 <div className="bg-black/40 p-3 rounded border border-zinc-700 text-center">
                                    <p className="text-lg font-black text-white uppercase leading-tight">{campaign.visual_creative.text_overlay}</p>
                                 </div>
                              </div>
                              <div>
                                 <p className="text-xs text-zinc-500 font-bold uppercase mb-1">Elemento de Gancho</p>
                                 <p className="text-sm text-orange-400 font-medium">{campaign.visual_creative.hook}</p>
                              </div>
                           </div>
                        </div>
                     </div>

                  </div>
               ) : (
                  <div className="h-64 flex flex-col items-center justify-center bg-zinc-900/50 border border-zinc-800 rounded-2xl border-dashed">
                     <Wand2 size={48} className="text-zinc-700 mb-4 opacity-50" />
                     <p className="text-zinc-500 font-medium mb-2">Nenhuma estratégia gerada ainda.</p>
                     <p className="text-zinc-600 text-sm max-w-md text-center">Clique em "Gerar Estratégia IA" no topo para analisar o perfil do cliente e criar campanhas.</p>
                  </div>
               )}
            </div>

         </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && selectedClient && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in overflow-y-auto">
            <div className="w-full max-w-5xl my-8">
               <ClientOnboardingForm 
                  currentUser={currentUser} 
                  initialData={selectedClient}
                  onComplete={handleEditComplete}
                  onCancel={() => setIsEditModalOpen(false)}
               />
            </div>
         </div>
      )}
    </div>
  );
};

const InfoItem = ({ label, value, icon, highlight }: any) => {
   const [copied, setCopied] = useState(false);

   const handleCopy = () => {
      if (!value || value === '-' || value === 'Não informado') return;
      navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
   };

   const showCopy = value && value.length > 3 && value !== 'Não informado' && value !== '-';

   return (
      <div className={`p-3 rounded-lg border ${highlight ? 'bg-blue-500/10 border-blue-500/20' : 'bg-zinc-950 border-zinc-800'} group`}>
         <div className="flex items-center gap-2 mb-1 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
            {icon} {label}
         </div>
         <div className="flex items-center justify-between gap-2">
            <div className={`text-sm ${highlight ? 'text-blue-200 font-bold' : 'text-zinc-300'}`}>
               {value}
            </div>
            {showCopy && (
               <button 
                  onClick={handleCopy} 
                  className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-white transition-all p-1"
                  title="Copiar"
               >
                  {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
               </button>
            )}
         </div>
      </div>
   );
};
