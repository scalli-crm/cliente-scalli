
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { User, OnboardingClient } from '../types';
import { 
  Building2, Target, Users, Megaphone, FileText, 
  ChevronRight, ChevronLeft, CheckCircle, Upload, Send, Loader2, Briefcase,
  Smile, PlayCircle, Image, User as UserIcon, Rocket, Check, Link as LinkIcon, DollarSign, BarChart3, Save, X
} from 'lucide-react';

interface ClientOnboardingFormProps {
  currentUser: User;
  onComplete: () => void;
  onCancel?: () => void; 
  initialData?: OnboardingClient | null;
}

const STEPS = [
  { id: 1, title: 'Boas-vindas', icon: <Smile size={18} /> },
  { id: 2, title: 'Dados Básicos', icon: <Building2 size={18} /> },
  { id: 3, title: 'Negócio', icon: <Briefcase size={18} /> },
  { id: 4, title: 'Oferta & Público', icon: <Target size={18} /> },
  { id: 5, title: 'Processo Vendas', icon: <Megaphone size={18} /> },
  { id: 6, title: 'Plataformas', icon: <PlayCircle size={18} /> },
  { id: 7, title: 'Materiais', icon: <FileText size={18} /> },
  { id: 8, title: 'Confirmação', icon: <CheckCircle size={18} /> },
];

// --- COMPONENT HELPERS ---
const SectionTitle = ({ title, sub }: { title: string, sub?: string }) => (
  <div className="mb-6">
    <h2 className="text-xl font-bold text-white mb-1">{title}</h2>
    {sub && <p className="text-sm text-zinc-400">{sub}</p>}
  </div>
);

const SubSectionTitle = ({ title, icon }: { title: string, icon?: React.ReactNode }) => (
  <div className="mt-6 mb-3 flex items-center gap-2 border-b border-zinc-800 pb-2">
    {icon && <div className="text-primary-500">{icon}</div>}
    <h3 className="text-sm font-bold text-white uppercase tracking-wider">{title}</h3>
  </div>
);

const Label = ({ children, required }: any) => (
  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1.5 tracking-wide">
    {children} {required && <span className="text-red-500">*</span>}
  </label>
);

const Input = ({ name, label, placeholder, type = 'text', required, value, onChange }: any) => (
  <div className="mb-4">
    {label && <Label required={required}>{label}</Label>}
    <input 
      type={type} 
      name={name} 
      value={value} 
      onChange={onChange} 
      placeholder={placeholder}
      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary-600 outline-none transition-all placeholder-zinc-600"
    />
  </div>
);

const TextArea = ({ name, label, placeholder, rows = 3, value, onChange }: any) => (
  <div className="mb-4">
    <Label>{label}</Label>
    <textarea 
      name={name} 
      rows={rows}
      value={value} 
      onChange={onChange} 
      placeholder={placeholder}
      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary-600 outline-none transition-all placeholder-zinc-600 resize-none"
    />
  </div>
);

const Select = ({ name, label, options, value, onChange }: any) => (
  <div className="mb-4">
    <Label>{label}</Label>
    <select 
      name={name} 
      value={value} 
      onChange={onChange} 
      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:ring-2 focus:ring-primary-600 outline-none"
    >
      {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  </div>
);

export const ClientOnboardingForm: React.FC<ClientOnboardingFormProps> = ({ currentUser, onComplete, onCancel, initialData }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [clientUsers, setClientUsers] = useState<User[]>([]);
  
  // Admin Mode: Check if user is admin to enable client selection
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'manager';

  // Form State - Flattened structure
  const [formData, setFormData] = useState({
    // Step 2: Dados Básicos
    owner_id: currentUser.role === 'client' ? currentUser.id : '',
    business_name: '',
    responsible_name: currentUser.name,
    segment: '',
    region: '',
    ticket_avg: '',
    client_status: 'Operando', // Operando, Começando, Pausado

    // Step 3: Negócio
    business_type: 'Serviço', // Serviço, Produto Físico, Digital, Assinatura
    main_offer: '',
    problem_solved: '',
    differentiators: '',
    social_proof: '',
    objections: '',

    // Step 4: Vendas/Público
    target_audience_desc: '',
    
    // Step 5: Processo Vendas
    sales_model: 'WhatsApp', // WhatsApp, Direct, LP, Vendedor
    whatsapp_ads: '', // New Question 4
    funnel_structure: '',
    closing_time: '',
    main_cta: '',
    ad_offer: '',

    // Step 6: Plataformas & Tracking
    platforms: [] as string[],
    
    // Links (New Questions 1, 2, 3, 7)
    instagram_link: '',
    facebook_page_link: '',
    site_link: '',
    lp_links: '',
    
    // Budget & History (New Questions 5, 6, 6.1)
    has_invested_ads: 'Não',
    past_ad_spend: '',
    current_ad_budget: '',

    // Access & Tracking (New Questions 7.1, 8, 9, 10)
    site_login: '',
    ga4_id: '',
    gtm_id: '',
    fb_pixel_id: '',
    
    // IDs (Existing)
    campaign_objective: 'Mensagens',
    creative_type: 'Vídeo e Imagem',
    communication_tone: '',
    ad_account_id: '',
    bm_id: '',

    // Step 7: Materiais & Obs
    drive_link: '',
    observations: '', // New Question 11
    uploaded_files: [] as { name: string, type: string, tags: string[] }[]
  });

  // Fetch client users for Admin selection
  useEffect(() => {
    if (isAdmin) {
      const fetchUsers = async () => {
        const { data } = await supabase.from('users').select('*').eq('role', 'client').eq('active', true).order('name');
        if (data) setClientUsers(data as User[]);
      };
      fetchUsers();
    }
  }, [isAdmin]);

  // Populate data on Edit Mode
  useEffect(() => {
    if (initialData) {
        // Merge details (full form data) with top-level columns
        const details = initialData.details || {};
        setFormData(prev => ({
            ...prev,
            ...details,
            // Ensure essential top-level columns override if needed
            business_name: initialData.business_name || details.business_name || '',
            business_type: initialData.business_type || details.business_type || '',
            main_offer: initialData.offer_main || details.main_offer || '',
            target_audience_desc: initialData.target_audience || details.target_audience_desc || '',
            sales_model: initialData.sales_process || details.sales_model || '',
            platforms: initialData.platforms || details.platforms || [],
            owner_id: initialData.owner_id || details.owner_id || '',
        }));
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>, field: string, value: string) => {
    const list = (formData as any)[field] as string[];
    if (e.target.checked) {
      setFormData({ ...formData, [field]: [...list, value] });
    } else {
      setFormData({ ...formData, [field]: list.filter(item => item !== value) });
    }
  };

  const handleFileUploadSimulated = (type: string) => {
    const fileName = `arquivo_simulado_${Math.floor(Math.random() * 1000)}.${type === 'logo' ? 'png' : 'pdf'}`;
    const newFile = {
      name: fileName,
      type: type,
      tags: ['novo', 'upload', type]
    };
    setFormData(prev => ({
      ...prev,
      uploaded_files: [...prev.uploaded_files, newFile]
    }));
  };

  const nextStep = () => {
    // Basic Validation
    if (currentStep === 2 && !formData.business_name) return alert('Nome da empresa é obrigatório');
    if (currentStep === 2 && isAdmin && !formData.owner_id) return alert('Selecione o cliente responsável (ou crie um usuário antes).');
    
    if (currentStep < 8) setCurrentStep(c => c + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(c => c - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const dbPayload = {
        business_name: formData.business_name,
        business_type: formData.business_type,
        offer_main: formData.main_offer,
        target_audience: formData.target_audience_desc,
        sales_process: formData.sales_model,
        platforms: formData.platforms,
        owner_id: formData.owner_id || (currentUser.role === 'client' ? currentUser.id : null), 
        status: 'completed',
        details: {
          ...formData, // Save everything else in JSONB
          submitted_at: new Date().toISOString()
        }
      };

      if (initialData) {
         // UPDATE
         const { error } = await supabase.from('onboarding_clients').update(dbPayload).eq('id', initialData.id);
         if (error) throw error;
      } else {
         // INSERT
         const { error } = await supabase.from('onboarding_clients').insert([dbPayload]);
         if (error) throw error;
      }
      
      setCompleted(true);
      setTimeout(() => {
         onComplete();
      }, 1500);

    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (completed) {
     return (
        <div className="flex flex-col items-center justify-center min-h-[400px] bg-zinc-950 p-6 text-center animate-in zoom-in duration-500 rounded-2xl">
           <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mb-6">
              <CheckCircle size={48} className="text-green-500" />
           </div>
           <h2 className="text-3xl font-bold text-white mb-2">{initialData ? 'Dados Atualizados!' : 'Cadastro Realizado!'}</h2>
           <p className="text-zinc-400 max-w-md mb-8">
              As informações foram salvas com sucesso.
           </p>
           <button onClick={onComplete} className="bg-primary-600 text-white px-8 py-3 rounded-lg font-bold">
              Concluir
           </button>
        </div>
     );
  }

  return (
    <div className="flex flex-col items-center py-2 px-4 w-full max-w-5xl mx-auto">
      
      {/* Header & Progress */}
      <div className="w-full mb-8">
         <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
               <Briefcase className="text-primary-500" /> {initialData ? 'Editar Onboarding' : 'Setup & Onboarding'}
            </h1>
            <div className="flex items-center gap-4">
               <span className="text-zinc-500 text-sm font-mono hidden sm:block">Passo {currentStep} de 8</span>
               {onCancel && (
                  <button 
                     onClick={onCancel} 
                     className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
                     title="Fechar / Cancelar"
                  >
                     <span className="text-xs font-bold uppercase hidden sm:block">Fechar</span>
                     <X size={18} />
                  </button>
               )}
            </div>
         </div>
         
         {/* Progress Bar */}
         <div className="relative pt-1">
            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-zinc-900">
               <div style={{ width: `${(currentStep / 8) * 100}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary-600 transition-all duration-500"></div>
            </div>
         </div>
         
         {/* Steps Icons */}
         <div className="flex justify-between px-2 overflow-x-auto pb-2 no-scrollbar gap-4">
            {STEPS.map((step) => (
               <div key={step.id} className={`flex flex-col items-center gap-2 min-w-[60px] ${step.id === currentStep ? 'text-white' : step.id < currentStep ? 'text-primary-500' : 'text-zinc-700'}`}>
                  <div className={`p-2 rounded-full border-2 ${step.id === currentStep ? 'border-primary-600 bg-primary-600/10' : step.id < currentStep ? 'border-primary-600 bg-primary-600' : 'border-zinc-800 bg-zinc-900'} transition-all`}>
                     {React.cloneElement(step.icon as any, { size: 16, className: step.id < currentStep ? 'text-black' : '' })}
                  </div>
                  <span className="text-[10px] font-bold uppercase hidden md:block whitespace-nowrap">{step.title}</span>
               </div>
            ))}
         </div>
      </div>

      {/* Form Card */}
      <div className="w-full bg-zinc-900/50 border border-zinc-800 p-6 md:p-8 rounded-2xl shadow-2xl backdrop-blur-sm animate-in slide-in-from-bottom-4 duration-500 min-h-[500px] flex flex-col">
         
         <div className="flex-1">
            {/* Step 1: Boas-vindas */}
            {currentStep === 1 && (
                <div className="flex flex-col items-center justify-center text-center h-full py-10 animate-in fade-in">
                   <div className="w-20 h-20 bg-primary-500/10 rounded-full flex items-center justify-center mb-6">
                      <Rocket size={40} className="text-primary-500" />
                   </div>
                   <h2 className="text-3xl font-bold text-white mb-4">{initialData ? 'Modo de Edição' : 'Bem-vindo ao Onboarding'}</h2>
                   <p className="text-zinc-400 max-w-md text-lg leading-relaxed">
                      {initialData 
                        ? 'Você está editando as informações deste cliente. Revise os dados e salve as alterações.' 
                        : 'Vamos configurar a conta para maximizar os resultados. Este processo leva cerca de 5 minutos.'
                      }
                   </p>
                   {isAdmin && !initialData && (
                      <div className="mt-4 p-2 bg-blue-900/20 text-blue-300 text-sm rounded border border-blue-500/20">
                         Modo Admin: Você poderá selecionar o cliente na próxima etapa.
                      </div>
                   )}
                </div>
            )}

            {/* Step 2: Dados Básicos */}
            {currentStep === 2 && (
                <div className="animate-in fade-in">
                   <SectionTitle title="1. Cadastro de Cliente" sub="Dados essenciais para identificação." />
                   
                   {/* Admin Select Logic - Only allow changing owner if creating new, usually locked on edit */}
                   {isAdmin && (
                      <div className={`mb-6 p-4 bg-blue-900/10 border border-blue-500/20 rounded-lg ${initialData ? 'opacity-50 pointer-events-none' : ''}`}>
                         <Label>Vincular a qual usuário? (Admin)</Label>
                         <div className="relative">
                            <UserIcon className="absolute left-3 top-2.5 text-zinc-500" size={16} />
                            <select 
                               name="owner_id" 
                               value={formData.owner_id} 
                               onChange={handleChange}
                               className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 pl-10 text-white focus:ring-1 focus:ring-blue-500 outline-none appearance-none"
                               disabled={!!initialData}
                            >
                               <option value="">Selecione um cliente cadastrado...</option>
                               {clientUsers.map(user => (
                                  <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                               ))}
                            </select>
                         </div>
                      </div>
                   )}

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input name="business_name" label="Nome da Empresa / Negócio" placeholder="Ex: Clínica Sorriso" required value={formData.business_name} onChange={handleChange} />
                      <Input name="responsible_name" label="Nome do Responsável" placeholder="Quem tomará as decisões?" value={formData.responsible_name} onChange={handleChange} />
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input name="segment" label="Segmento de Atuação" placeholder="Ex: Odontologia, Moda, SaaS" value={formData.segment} onChange={handleChange} />
                      <Input name="region" label="Região de Atuação" placeholder="Ex: São Paulo Capital ou Brasil Todo" value={formData.region} onChange={handleChange} />
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input name="ticket_avg" label="Ticket Médio (R$)" placeholder="Valor médio de venda" value={formData.ticket_avg} onChange={handleChange} />
                      <Select name="client_status" label="Situação Atual" options={['Operando', 'Começando Agora', 'Pausado / Reestruturando']} value={formData.client_status} onChange={handleChange} />
                   </div>
                </div>
            )}

            {/* Step 3: Negócio */}
            {currentStep === 3 && (
               <div className="animate-in fade-in">
                  <SectionTitle title="2. Modelo de Negócio" sub="Entendendo como a empresa funciona." />
                  <Select name="business_type" label="Tipo de Negócio" options={['Serviço', 'Produto Físico (E-commerce)', 'Produto Digital (Info)', 'Assinatura / Recorrência', 'Negócio Local']} value={formData.business_type} onChange={handleChange} />
                  
                  <TextArea name="problem_solved" label="Qual problema principal o produto resolve?" placeholder="Descreva a dor que cura no cliente..." rows={3} value={formData.problem_solved} onChange={handleChange} />
                  <TextArea name="differentiators" label="Diferenciais Competitivos" placeholder="Por que comprar de você e não do concorrente?" rows={3} value={formData.differentiators} onChange={handleChange} />
                  <TextArea name="social_proof" label="Provas Sociais (Depoimentos/Cases)" placeholder="O que clientes falam? Quantos já atendeu?" rows={2} value={formData.social_proof} onChange={handleChange} />
               </div>
            )}

            {/* Step 4: Oferta e Público */}
            {currentStep === 4 && (
               <div className="animate-in fade-in">
                  <SectionTitle title="3. Oferta & Público" sub="Quem compra e o que vendemos." />
                  
                  <Input name="main_offer" label="Oferta Principal (O que vamos anunciar?)" placeholder="Ex: Implante com avaliação grátis + Parcelamento 12x" required value={formData.main_offer} onChange={handleChange} />
                  
                  <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 mb-4">
                     <Label>Público-Alvo (Avatar)</Label>
                     <p className="text-xs text-zinc-500 mb-2">Descreva idade, gênero, interesses e comportamentos.</p>
                     <textarea 
                        name="target_audience_desc" 
                        rows={4} 
                        value={formData.target_audience_desc} 
                        onChange={handleChange} 
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-white focus:ring-1 focus:ring-primary-500 outline-none resize-none" 
                        placeholder="Ex: Mulheres, 30-50 anos, classe AB, interessadas em estética e bem-estar..."
                     />
                  </div>

                  <TextArea name="objections" label="Principais Objeções" placeholder="O que impede o cliente de comprar? (Preço, confiança, tempo...)" rows={3} value={formData.objections} onChange={handleChange} />
               </div>
            )}

            {/* Step 5: Processo de Vendas */}
            {currentStep === 5 && (
               <div className="animate-in fade-in">
                  <SectionTitle title="4. Processo Comercial" sub="Como o lead vira cliente." />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <Select name="sales_model" label="Modelo de Venda Principal" options={['WhatsApp (Comercial)', 'Direct Instagram', 'Landing Page (Venda Direta)', 'Formulário (Qualificação)', 'Ligação Telefônica']} value={formData.sales_model} onChange={handleChange} />
                     <Input name="whatsapp_ads" label="WhatsApp para Anúncios" placeholder="(00) 00000-0000" value={formData.whatsapp_ads} onChange={handleChange} />
                  </div>
                  
                  <TextArea name="funnel_structure" label="Descreva o Funil Resumidamente" placeholder="Ex: Lead clica no anúncio -> Cai no WhatsApp -> SDR qualifica -> Agendamento -> Venda" rows={3} value={formData.funnel_structure} onChange={handleChange} />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <Input name="closing_time" label="Tempo Médio de Fechamento" placeholder="Ex: 2 dias, Imediato..." value={formData.closing_time} onChange={handleChange} />
                     <Input name="main_cta" label="Chamada para Ação (CTA) Ideal" placeholder="Ex: 'Agendar Avaliação', 'Comprar Agora'" value={formData.main_cta} onChange={handleChange} />
                  </div>
                  
                  <Input name="ad_offer" label="Oferta Exclusiva para Anúncios? (Opcional)" placeholder="Se tiver algo diferente da oferta principal..." value={formData.ad_offer} onChange={handleChange} />
               </div>
            )}

            {/* Step 6: Plataformas e Acessos */}
            {currentStep === 6 && (
               <div className="animate-in fade-in">
                  <SectionTitle title="5. Plataformas & Tracking" sub="Onde e como vamos anunciar e rastrear." />
                  
                  {/* --- Grupo: Presença Digital --- */}
                  <SubSectionTitle title="1. Presença Digital" icon={<LinkIcon size={16} />} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <Input name="instagram_link" label="Link Perfil Instagram" placeholder="https://instagram.com/..." value={formData.instagram_link} onChange={handleChange} />
                     <Input name="facebook_page_link" label="Link Página Facebook" placeholder="https://facebook.com/..." value={formData.facebook_page_link} onChange={handleChange} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <Input name="site_link" label="Link do Site Oficial" placeholder="https://meusite.com.br" value={formData.site_link} onChange={handleChange} />
                     <Input name="lp_links" label="Links Landing Pages" placeholder="https://lp.meusite.com/oferta" value={formData.lp_links} onChange={handleChange} />
                  </div>

                  {/* --- Grupo: Plataformas & Seleção --- */}
                  <div className="my-6">
                     <Label>Onde vamos anunciar?</Label>
                     <div className="flex gap-4 mt-2 flex-wrap">
                        <label className="flex items-center gap-2 cursor-pointer bg-zinc-900 border border-zinc-700 px-4 py-3 rounded-lg hover:border-primary-500 transition-colors">
                           <input type="checkbox" checked={formData.platforms.includes('Facebook')} onChange={(e) => handleCheckboxChange(e, 'platforms', 'Facebook')} className="w-4 h-4 rounded text-primary-600 bg-zinc-800" />
                           <span className="text-sm text-white">Facebook Ads</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer bg-zinc-900 border border-zinc-700 px-4 py-3 rounded-lg hover:border-primary-500 transition-colors">
                           <input type="checkbox" checked={formData.platforms.includes('Instagram')} onChange={(e) => handleCheckboxChange(e, 'platforms', 'Instagram')} className="w-4 h-4 rounded text-primary-600 bg-zinc-800" />
                           <span className="text-sm text-white">Instagram Ads</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer bg-zinc-900 border border-zinc-700 px-4 py-3 rounded-lg hover:border-primary-500 transition-colors">
                           <input type="checkbox" checked={formData.platforms.includes('Google')} onChange={(e) => handleCheckboxChange(e, 'platforms', 'Google')} className="w-4 h-4 rounded text-primary-600 bg-zinc-800" />
                           <span className="text-sm text-white">Google Ads</span>
                        </label>
                     </div>
                  </div>

                  {/* --- Grupo: Histórico e Verba --- */}
                  <SubSectionTitle title="2. Histórico & Verba" icon={<DollarSign size={16} />} />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <Select name="has_invested_ads" label="Já investiu em anúncios?" options={['Não', 'Sim, pouco', 'Sim, com consistência']} value={formData.has_invested_ads} onChange={handleChange} />
                     <Input name="past_ad_spend" label="Média investida (Mensal)" placeholder="R$ 0,00" value={formData.past_ad_spend} onChange={handleChange} />
                     <Input name="current_ad_budget" label="Verba Disponível Atual" placeholder="R$ 0,00" value={formData.current_ad_budget} onChange={handleChange} />
                  </div>

                  {/* --- Grupo: Rastreamento & Acessos --- */}
                  <SubSectionTitle title="3. Rastreamento & Acessos" icon={<BarChart3 size={16} />} />
                  <div className="p-4 border border-yellow-500/20 bg-yellow-500/5 rounded-lg mb-4">
                     <p className="text-xs text-zinc-400 mb-3">Preencha com os IDs ou deixe em branco se precisar que nossa equipe crie/configure.</p>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input name="ga4_id" label="Google Analytics (GA4 ID)" placeholder="G-XXXXXXXX" value={formData.ga4_id} onChange={handleChange} />
                        <Input name="gtm_id" label="Tag Manager (GTM ID)" placeholder="GTM-XXXXXX" value={formData.gtm_id} onChange={handleChange} />
                        <Input name="fb_pixel_id" label="Pixel do Facebook (ID)" placeholder="1234567890" value={formData.fb_pixel_id} onChange={handleChange} />
                     </div>
                     <div className="mt-2">
                        <Input name="site_login" label="Acesso Site/Landing Page (Login)" placeholder="URL + Usuário/Senha (Se necessário instalação de pixel)" value={formData.site_login} onChange={handleChange} />
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <Input name="ad_account_id" label="ID Conta de Anúncios (FB)" placeholder="1234567890" value={formData.ad_account_id} onChange={handleChange} />
                     <Input name="bm_id" label="ID Business Manager (BM)" placeholder="9876543210" value={formData.bm_id} onChange={handleChange} />
                  </div>
               </div>
            )}

            {/* Step 7: Materiais */}
            {currentStep === 7 && (
               <div className="animate-in fade-in">
                  <SectionTitle title="6. Documentos & Materiais" sub="Identidade visual e criativos." />
                  
                  <div className="mb-6">
                     <Label>Upload de Arquivos (Simulado)</Label>
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                        <button onClick={() => handleFileUploadSimulated('logo')} className="flex flex-col items-center justify-center p-4 bg-zinc-900 border border-dashed border-zinc-700 rounded-xl hover:bg-zinc-800 hover:border-primary-500 transition-all gap-2 group">
                           <Upload size={20} className="text-zinc-500 group-hover:text-primary-500" />
                           <span className="text-xs text-zinc-400 font-medium">Logo</span>
                        </button>
                        <button onClick={() => handleFileUploadSimulated('manual_marca')} className="flex flex-col items-center justify-center p-4 bg-zinc-900 border border-dashed border-zinc-700 rounded-xl hover:bg-zinc-800 hover:border-primary-500 transition-all gap-2 group">
                           <FileText size={20} className="text-zinc-500 group-hover:text-primary-500" />
                           <span className="text-xs text-zinc-400 font-medium">Manual Marca</span>
                        </button>
                        <button onClick={() => handleFileUploadSimulated('criativos')} className="flex flex-col items-center justify-center p-4 bg-zinc-900 border border-dashed border-zinc-700 rounded-xl hover:bg-zinc-800 hover:border-primary-500 transition-all gap-2 group">
                           <Image size={20} className="text-zinc-500 group-hover:text-primary-500" />
                           <span className="text-xs text-zinc-400 font-medium">Criativos</span>
                        </button>
                        <button onClick={() => handleFileUploadSimulated('contrato')} className="flex flex-col items-center justify-center p-4 bg-zinc-900 border border-dashed border-zinc-700 rounded-xl hover:bg-zinc-800 hover:border-primary-500 transition-all gap-2 group">
                           <Briefcase size={20} className="text-zinc-500 group-hover:text-primary-500" />
                           <span className="text-xs text-zinc-400 font-medium">Contrato</span>
                        </button>
                     </div>
                  </div>

                  {/* List of "Uploaded" files */}
                  {formData.uploaded_files.length > 0 && (
                     <div className="mb-6 space-y-2">
                        <Label>Arquivos Selecionados:</Label>
                        {formData.uploaded_files.map((file, idx) => (
                           <div key={idx} className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                              <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 bg-zinc-800 rounded flex items-center justify-center text-zinc-500">
                                    {file.type === 'logo' || file.type === 'criativos' ? <Image size={14} /> : <FileText size={14} />}
                                 </div>
                                 <div>
                                    <p className="text-sm text-white font-medium">{file.name}</p>
                                    <div className="flex gap-1">
                                       {file.tags.map(t => <span key={t} className="text-[9px] bg-zinc-800 px-1.5 rounded text-zinc-400 uppercase">{t}</span>)}
                                    </div>
                                 </div>
                              </div>
                              <CheckCircle size={16} className="text-green-500" />
                           </div>
                        ))}
                     </div>
                  )}

                  <Input name="drive_link" label="Link do Google Drive / Dropbox (Alternativo)" placeholder="https://..." value={formData.drive_link} onChange={handleChange} />
                  
                  <div className="mt-6 border-t border-zinc-800 pt-4">
                     <TextArea name="observations" label="Observações Gerais" placeholder="Algo mais que precisamos saber? Preferências, restrições..." rows={4} value={formData.observations} onChange={handleChange} />
                  </div>
               </div>
            )}

            {/* Step 8: Confirmação */}
            {currentStep === 8 && (
               <div className="animate-in fade-in h-full flex flex-col justify-center items-center text-center">
                  <div className="w-20 h-20 bg-primary-600 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-primary-900/30 animate-pulse">
                     <Check size={40} className="text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-2">Tudo Pronto!</h2>
                  <p className="text-zinc-400 max-w-md text-lg">
                     Revise as informações se necessário. Ao clicar em finalizar, o setup será {initialData ? 'atualizado' : 'iniciado'}.
                  </p>
                  
                  <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 mt-8 w-full max-w-md text-left">
                     <h4 className="text-sm font-bold text-white mb-4 border-b border-zinc-800 pb-2">Resumo</h4>
                     <div className="space-y-2 text-sm text-zinc-400">
                        <p><strong className="text-zinc-300">Empresa:</strong> {formData.business_name}</p>
                        <p><strong className="text-zinc-300">Responsável:</strong> {isAdmin ? (clientUsers.find(u => u.id === formData.owner_id)?.name || 'Admin') : currentUser.name}</p>
                        <p><strong className="text-zinc-300">Oferta:</strong> {formData.main_offer}</p>
                        <p><strong className="text-zinc-300">Plataformas:</strong> {formData.platforms.join(', ')}</p>
                        <p><strong className="text-zinc-300">Arquivos:</strong> {formData.uploaded_files.length} anexados</p>
                        <p><strong className="text-zinc-300">Verba:</strong> {formData.current_ad_budget || 'Não informado'}</p>
                     </div>
                  </div>
               </div>
            )}
         </div>

         {/* Navigation Footer */}
         <div className="flex justify-between mt-8 pt-6 border-t border-zinc-800 items-center">
            <div className="flex gap-2">
               {/* Back Button */}
               <button 
                  onClick={prevStep} 
                  disabled={currentStep === 1 || loading}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold transition-colors ${currentStep === 1 ? 'opacity-0 pointer-events-none' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
               >
                  <ChevronLeft size={16} /> Voltar
               </button>
               
               {/* Cancel Button (Visible on Step 1 or explicitly requested) */}
               {currentStep === 1 && onCancel && (
                  <button 
                     onClick={onCancel}
                     className="px-6 py-3 rounded-lg text-sm font-bold text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                     Cancelar
                  </button>
               )}
            </div>

            {currentStep < 8 ? (
               <button 
                  onClick={nextStep}
                  className="bg-zinc-100 hover:bg-white text-black px-8 py-3 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
               >
                  Próximo <ChevronRight size={16} />
               </button>
            ) : (
               <button 
                  onClick={handleSubmit}
                  disabled={loading}
                  className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary-900/30 transition-all active:scale-95"
               >
                  {loading ? (
                     <>Enviando... <Loader2 size={16} className="animate-spin" /></>
                  ) : (
                     <>Finalizar e {initialData ? 'Atualizar' : 'Enviar'} <Send size={16} /></>
                  )}
               </button>
            )}
         </div>

      </div>
    </div>
  );
};
