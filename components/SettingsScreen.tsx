
import React, { useState, useRef, useEffect } from 'react';
import { Save, Upload, Image as ImageIcon, Trash2, AlertCircle, FileSpreadsheet, Link as LinkIcon, Users, Plus, Shield, Check, X, User, Settings as SettingsIcon, Database, List, GitCommit, Frown, Smile, ToggleLeft, ToggleRight, Car, Search, Pencil, Fuel, Globe, Truck, Image, Edit2, Lock, RefreshCw, Calendar, Briefcase, Tag, Box, Layout, Menu as MenuIcon, Palette, Zap } from 'lucide-react';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { supabase } from '../supabaseClient';
import { User as UserType, CRMBrand, CRMModel, CRMPipelineStage, CRMLossReason, CRMWinReason, CRMFuelType, CRMLeadOrigin, CRMVehicleType, IntegrationSheet, CRMAppointmentReason, AppFeatures } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface SettingsData {
  monthlyGoal: number;
  appLogo: string | null;
  googleSheetUrl: string | null;
  creativeMetricsUrl: string | null;
  enabledFeatures?: AppFeatures;
}

interface SettingsScreenProps {
  settings?: SettingsData; 
  onSave?: (newSettings: SettingsData) => void;
  currentUserRole: 'admin' | 'manager' | 'sales';
}

const DEFAULT_FEATURES: AppFeatures = {
  dashboard: true,
  mvi: true,
  mvi_metrics: true,
  crm: true,
  products: true,
  landing_pages: true,
  goals: true,
  agenda: true,
  onboarding: true,
};

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ currentUserRole, onSave }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'users' | 'crm-config' | 'menu-config'>('general');
  const [crmSection, setCrmSection] = useState<'brands' | 'models' | 'pipeline' | 'loss' | 'win' | 'fuel' | 'origins' | 'types' | 'appointment_reasons'>('brands');
  
  // Theme Context
  const { layoutTheme, setLayoutTheme } = useTheme();

  // General & DB States
  const [configId, setConfigId] = useState<string | null>(null);
  const [goal, setGoal] = useState<number>(0);
  const [logo, setLogo] = useState<string | null>(null);
  const [features, setFeatures] = useState<AppFeatures>(DEFAULT_FEATURES);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dbUrl, setDbUrl] = useState('');
  const [dbKey, setDbKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [sheets, setSheets] = useState<IntegrationSheet[]>([]);
  const [sheetName, setSheetName] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [editingSheet, setEditingSheet] = useState<IntegrationSheet | null>(null);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'sales', active: true });

  // CRM Config State
  const [brands, setBrands] = useState<CRMBrand[]>([]);
  const [models, setModels] = useState<CRMModel[]>([]);
  const [stages, setStages] = useState<CRMPipelineStage[]>([]);
  const [lossReasons, setLossReasons] = useState<CRMLossReason[]>([]);
  const [winReasons, setWinReasons] = useState<CRMWinReason[]>([]);
  const [fuelTypes, setFuelTypes] = useState<CRMFuelType[]>([]);
  const [leadOrigins, setLeadOrigins] = useState<CRMLeadOrigin[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<CRMVehicleType[]>([]);
  const [appointmentReasons, setAppointmentReasons] = useState<CRMAppointmentReason[]>([]);
  const [loadingCrm, setLoadingCrm] = useState(false);
  
  const [newItemName, setNewItemName] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [editingItem, setEditingItem] = useState<{ id: string, name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch General Config ONLY on mount (or role change), NOT on tab change
  useEffect(() => {
    if (currentUserRole === 'admin') {
      fetchGeneralConfig();
      fetchSheets();
      loadDbSettings();
    }
  }, [currentUserRole]);

  // Fetch Tab Specific Data when Tab Changes
  useEffect(() => {
    if (currentUserRole === 'admin') {
      if (activeTab === 'users') fetchUsers();
      if (activeTab === 'crm-config') fetchCrmData();
    }
  }, [currentUserRole, activeTab]);

  const loadDbSettings = () => {
     const storedUrl = localStorage.getItem('custom_supabase_url');
     const storedKey = localStorage.getItem('custom_supabase_key');
     if (storedUrl) setDbUrl(storedUrl);
     if (storedKey) setDbKey(storedKey);
  };

  const handleSaveDbConnection = () => {
     if (!dbUrl.trim() || !dbKey.trim()) {
        if(confirm('Campos vazios irão restaurar a conexão padrão do sistema. Deseja continuar?')) {
           localStorage.removeItem('custom_supabase_url');
           localStorage.removeItem('custom_supabase_key');
           window.location.reload();
        }
        return;
     }
     if (confirm('Atenção: Ao salvar, o sistema irá recarregar para aplicar a nova conexão. Certifique-se de que os dados estão corretos.')) {
        localStorage.setItem('custom_supabase_url', dbUrl.trim());
        localStorage.setItem('custom_supabase_key', dbKey.trim());
        window.location.reload();
     }
  };

  const fetchGeneralConfig = async () => {
    setLoadingConfig(true);
    const { data, error } = await supabase.from('app_config').select('*').limit(1).single();
    if (data) {
        setConfigId(data.id);
        setGoal(data.monthly_goal);
        setLogo(data.app_logo);
        // Load features if they exist, otherwise use defaults
        if (data.enabled_features) {
           setFeatures({ ...DEFAULT_FEATURES, ...data.enabled_features });
        }
    } else if (!data && !error) {
        const { data: newData } = await supabase.from('app_config').insert([{ monthly_goal: 0 }]).select().single();
        if (newData) setConfigId(newData.id);
    }
    setLoadingConfig(false);
  };

  const fetchSheets = async () => {
    setLoadingSheets(true);
    const { data } = await supabase.from('integration_sheets').select('*').order('created_at');
    if (data) setSheets(data as IntegrationSheet[]);
    setLoadingSheets(false);
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: true });
    if (data) setUsers(data as UserType[]);
    setLoadingUsers(false);
  };

  const fetchCrmData = async () => {
    setLoadingCrm(true);
    const [b, m, s, l, w, f, o, t, a] = await Promise.all([
      supabase.from('crm_brands').select('*').order('name'),
      supabase.from('crm_models').select('*, crm_brands(name)').order('name'),
      supabase.from('crm_pipeline_stages').select('*').order('order_index'),
      supabase.from('crm_loss_reasons').select('*').order('name'),
      supabase.from('crm_win_reasons').select('*').order('name'),
      supabase.from('crm_fuel_types').select('*').order('name'),
      supabase.from('crm_lead_origins').select('*').order('name'),
      supabase.from('crm_vehicle_types').select('*').order('name'),
      supabase.from('crm_appointment_reasons').select('*').order('name')
    ]);

    if (b.data) setBrands(b.data as any);
    if (m.data) setModels(m.data as any);
    if (s.data) setStages(s.data as any);
    if (l.data) setLossReasons(l.data as any);
    if (w.data) setWinReasons(w.data as any);
    if (f.data) setFuelTypes(f.data as any);
    if (o.data) setLeadOrigins(o.data as any);
    if (t.data) setVehicleTypes(t.data as any);
    if (a.data) setAppointmentReasons(a.data as any);
    setLoadingCrm(false);
  };

  const handleSaveGeneral = async () => {
      if (!configId) return;
      try {
          const { error } = await supabase.from('app_config').update({ 
             monthly_goal: goal, 
             app_logo: logo,
             enabled_features: features // Save features JSON
          }).eq('id', configId);
          
          if (error) throw error;
          
          // Notify parent component to update state immediately
          if (onSave) onSave({ 
             monthlyGoal: goal, 
             appLogo: logo, 
             googleSheetUrl: null, 
             creativeMetricsUrl: null,
             enabledFeatures: features
          });
          
          alert('Configurações salvas com sucesso!');
      } catch (err: any) {
          alert('Erro ao salvar: ' + err.message);
      }
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    const floatValue = value ? parseInt(value, 10) / 100 : 0;
    setGoal(floatValue);
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError(null);
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError("O arquivo é muito grande. Use uma imagem menor que 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setLogo(reader.result as string);
      reader.readAsDataURL(file);
    }
  };
  const handleRemoveLogo = () => { setLogo(null); if (fileInputRef.current) fileInputRef.current.value = ''; };
  const handleSaveSheet = async () => {
      if (!sheetName.trim() || !sheetUrl.trim()) return alert('Preencha nome e link da planilha.');
      try {
          if (editingSheet) await supabase.from('integration_sheets').update({ name: sheetName, url: sheetUrl }).eq('id', editingSheet.id);
          else await supabase.from('integration_sheets').insert([{ name: sheetName, url: sheetUrl, active: true }]);
          setSheetName(''); setSheetUrl(''); setEditingSheet(null); await fetchSheets();
          if (onSave) onSave({ monthlyGoal: goal, appLogo: logo, googleSheetUrl: null, creativeMetricsUrl: null, enabledFeatures: features });
      } catch (err: any) { alert('Erro ao salvar planilha: ' + err.message); }
  };
  const handleEditSheet = (sheet: IntegrationSheet) => { setEditingSheet(sheet); setSheetName(sheet.name); setSheetUrl(sheet.url); };
  const handleDeleteSheet = async (id: string) => {
      if (confirm('Tem certeza que deseja remover este link?')) { await supabase.from('integration_sheets').delete().eq('id', id); await fetchSheets(); if (onSave) onSave({ monthlyGoal: goal, appLogo: logo, googleSheetUrl: null, creativeMetricsUrl: null, enabledFeatures: features }); }
  };
  
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try { 
       // 1. Create User in Supabase Auth
       const { data, error } = await supabase.auth.signUp({
          email: newUser.email,
          password: newUser.password,
          options: {
             data: {
                name: newUser.name,
                role: newUser.role
             }
          }
       });

       if (error) throw error;

       // 2. FALLBACK MANUAL DE SEGURANÇA: 
       // Se o Trigger SQL falhar, forçamos a inserção na tabela users aqui.
       if (data.user) {
          const { error: upsertError } = await supabase.from('users').upsert({
             id: data.user.id,
             email: newUser.email,
             name: newUser.name,
             role: newUser.role as any,
             active: true
          }, { onConflict: 'id' });
          
          if (upsertError) {
             console.warn("Aviso: Falha no fallback manual (pode ser permissão RLS), mas o usuário Auth foi criado.", upsertError);
          }
       }
       
       alert('Usuário criado com sucesso!'); 
       
       setShowUserForm(false); 
       setNewUser({ name: '', email: '', password: '', role: 'sales', active: true }); 
       
       // Reload list
       setTimeout(fetchUsers, 1000);
    } catch (err: any) { 
       console.error(err);
       alert('Erro ao criar usuário: ' + err.message); 
    }
  };

  const handleDeleteUser = async (id: string) => { 
     // Note: This only deletes from public.users. Deleting from auth.users requires Admin API or Dashboard.
     if (window.confirm('Excluir perfil do sistema? (A conta de login deve ser removida no painel Supabase)')) { 
        const { error } = await supabase.from('users').delete().eq('id', id); 
        if (!error) fetchUsers(); 
     } 
  };

  const getTableForSection = () => {
    switch(crmSection) {
      case 'brands': return 'crm_brands';
      case 'models': return 'crm_models';
      case 'pipeline': return 'crm_pipeline_stages';
      case 'loss': return 'crm_loss_reasons';
      case 'win': return 'crm_win_reasons';
      case 'fuel': return 'crm_fuel_types';
      case 'origins': return 'crm_lead_origins';
      case 'types': return 'crm_vehicle_types';
      case 'appointment_reasons': return 'crm_appointment_reasons';
      default: return 'crm_brands';
    }
  };

  const getCurrentList = () => {
    switch(crmSection) {
      case 'brands': return brands;
      case 'models': return models;
      case 'pipeline': return stages;
      case 'loss': return lossReasons;
      case 'win': return winReasons;
      case 'fuel': return fuelTypes;
      case 'origins': return leadOrigins;
      case 'types': return vehicleTypes;
      case 'appointment_reasons': return appointmentReasons;
      default: return [];
    }
  };

  const addItem = async () => {
    if (!newItemName.trim()) return;
    let table = getTableForSection();
    let payload: any = { name: newItemName, active: true };
    if (crmSection === 'models') {
        if(!selectedBrandId) { alert('Selecione uma categoria/linha'); return; }
        payload = { ...payload, brand_id: selectedBrandId };
    }
    if (crmSection === 'pipeline') {
        payload = { ...payload, order_index: stages.length, color: 'bg-zinc-500' };
    }
    const { error } = await supabase.from(table).insert([payload]);
    if (error) alert('Erro: ' + error.message);
    else { setNewItemName(''); fetchCrmData(); }
  };

  const toggleActive = async (id: string, currentStatus: boolean, table: string) => {
    await supabase.from(table).update({ active: !currentStatus }).eq('id', id);
    fetchCrmData();
  };

  const deleteCrmItem = async (id: string, table: string) => {
    if (confirm('Excluir?')) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) alert('Erro: ' + error.message);
      else fetchCrmData();
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem || !editingItem.name.trim()) return;
    const table = getTableForSection();
    const { error } = await supabase.from(table).update({ name: editingItem.name }).eq('id', editingItem.id);
    if (!error) { setEditingItem(null); fetchCrmData(); }
  };

  const toggleFeature = (key: keyof AppFeatures) => {
     setFeatures(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // --- CHANGED TITLES FOR B2B ---
  const getSectionTitle = () => {
     switch(crmSection) {
        case 'brands': return 'Linhas de Produto / Categorias'; // Was Marcas
        case 'models': return 'Produtos / Serviços'; // Was Modelos
        case 'pipeline': return 'Pipeline de Vendas';
        case 'loss': return 'Motivos de Perda';
        case 'win': return 'Motivos de Ganho';
        case 'fuel': return 'Segmentos de Mercado'; // Was Combustíveis
        case 'origins': return 'Origens do Lead';
        case 'types': return 'Tipos de Contrato'; // Was Tipos de Veículo
        case 'appointment_reasons': return 'Motivos de Agendamento';
        default: return '';
     }
  };

  if (currentUserRole !== 'admin') {
     return <div className="p-8 text-center text-red-500">Acesso negado.</div>
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto mb-12">
      
      {/* Header and Tabs */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-white">Configurações do Sistema</h2>
        <p className="text-zinc-400">Central de controle da plataforma.</p>
      </div>

      <div className="flex border-b border-zinc-800 gap-6 overflow-x-auto">
        <button onClick={() => setActiveTab('general')} className={`pb-3 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === 'general' ? 'text-primary-500' : 'text-zinc-400 hover:text-white'}`}>Geral & Metas{activeTab === 'general' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary-500 rounded-t-full"></span>}</button>
        <button onClick={() => setActiveTab('menu-config')} className={`pb-3 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === 'menu-config' ? 'text-primary-500' : 'text-zinc-400 hover:text-white'}`}>Menu & Módulos{activeTab === 'menu-config' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary-500 rounded-t-full"></span>}</button>
        <button onClick={() => setActiveTab('users')} className={`pb-3 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === 'users' ? 'text-primary-500' : 'text-zinc-400 hover:text-white'}`}>Gestão de Usuários{activeTab === 'users' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary-500 rounded-t-full"></span>}</button>
        <button onClick={() => setActiveTab('crm-config')} className={`pb-3 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === 'crm-config' ? 'text-primary-500' : 'text-zinc-400 hover:text-white'}`}>Configurações CRM{activeTab === 'crm-config' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary-500 rounded-t-full"></span>}</button>
      </div>

      {/* General & Users Tabs */}
      {activeTab === 'general' && (
        <div className="grid grid-cols-1 gap-8 animate-in slide-in-from-bottom-2">
          
          {/* THEME SELECTOR - NEW */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-lg">
             <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Palette size={20} className="text-primary-500" /> Tema Visual
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                   onClick={() => setLayoutTheme('default')}
                   className={`p-4 rounded-xl border flex items-center gap-4 transition-all ${layoutTheme === 'default' ? 'bg-zinc-800 border-primary-500 ring-1 ring-primary-500' : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-800'}`}
                >
                   <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500 to-orange-600 shadow-lg"></div>
                   <div className="text-left">
                      <h4 className="text-white font-bold">Padrão (Amber)</h4>
                      <p className="text-xs text-zinc-400">Estilo clássico, tons quentes e amigáveis.</p>
                   </div>
                   {layoutTheme === 'default' && <Check size={20} className="ml-auto text-primary-500" />}
                </button>

                <button 
                   onClick={() => setLayoutTheme('addash')}
                   className={`p-4 rounded-xl border flex items-center gap-4 transition-all ${layoutTheme === 'addash' ? 'bg-[#23230f] border-[#f9f906] ring-1 ring-[#f9f906]' : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-800'}`}
                >
                   <div className="w-12 h-12 rounded-full bg-[#f9f906] shadow-[0_0_15px_rgba(249,249,6,0.4)] flex items-center justify-center">
                      <Zap size={20} className="text-black" fill="black" />
                   </div>
                   <div className="text-left">
                      <h4 className="text-white font-bold">AdDash (Neon)</h4>
                      <p className="text-xs text-zinc-400">Alto contraste, moderno e vibrante.</p>
                   </div>
                   {layoutTheme === 'addash' && <Check size={20} className="ml-auto text-[#f9f906]" />}
                </button>
             </div>
          </div>

          {/* DB Connection */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-lg border-l-4 border-l-blue-500">
             <div className="flex justify-between items-start mb-4"><h3 className="text-lg font-semibold text-white flex items-center gap-2"><Database size={18} className="text-blue-500" />Conexão com Banco de Dados (Supabase)</h3></div>
             <p className="text-sm text-zinc-400 mb-4">Configure aqui as credenciais do seu projeto Supabase. Alterar esses dados irá reiniciar a aplicação.</p>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div className="flex-1"><label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Project URL</label><input type="text" value={dbUrl} onChange={e => setDbUrl(e.target.value)} placeholder="https://your-project.supabase.co" className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none"/></div>
                <div className="flex-1 relative"><label className="block text-xs font-bold text-zinc-500 uppercase mb-1">API Key (Anon/Public)</label><div className="relative"><Lock size={14} className="absolute left-3 top-2.5 text-zinc-600" /><input type={showKey ? "text" : "password"} value={dbKey} onChange={e => setDbKey(e.target.value)} placeholder="eyJh..." className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-9 pr-10 py-2 text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none"/><button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-2.5 text-zinc-500 hover:text-white">{showKey ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}</button></div></div>
                <button onClick={handleSaveDbConnection} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 text-sm h-[38px]"><RefreshCw size={16} /> Salvar e Reconectar</button>
             </div>
          </div>
          {/* App Config */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-lg relative">
            <div className="flex justify-between items-start mb-6"><h3 className="text-lg font-semibold text-white flex items-center gap-2"><span className="w-1 h-6 bg-primary-500 rounded-full"></span>Metas e Aparência</h3><button onClick={handleSaveGeneral} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"><Save size={16} /> Salvar Geral</button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div><label className="block text-sm font-medium text-zinc-400 mb-2 uppercase tracking-wide">Meta de Faturamento Mensal</label><input type="text" inputMode="numeric" value={formatCurrency(goal)} onChange={handleCurrencyChange} className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-4 pr-4 py-3 text-white text-lg focus:outline-none focus:ring-2 focus:ring-primary-600" placeholder="R$ 0,00"/></div>
                <div><label className="block text-sm font-medium text-zinc-400 mb-2 uppercase tracking-wide">Logo da Empresa</label><div className="flex items-center gap-4"><div className="w-24 h-24 bg-zinc-950 rounded-lg border border-zinc-700 flex items-center justify-center overflow-hidden relative group">{logo ? (<><img src={logo} alt="Logo" className="max-h-full max-w-full object-contain" /><button onClick={handleRemoveLogo} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-red-500"><Trash2 size={20}/></button></>) : (<ImageIcon size={24} className="text-zinc-600" />)}</div><div className="flex-1"><input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" id="logo-upload" /><label htmlFor="logo-upload" className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg cursor-pointer text-sm text-zinc-300 transition-colors w-fit"><Upload size={16} /> Carregar Nova</label>{error && <p className="text-xs text-red-400 mt-2">{error}</p>}</div></div></div>
            </div>
          </div>
          {/* Sheets Manager */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><span className="w-1 h-6 bg-green-500 rounded-full"></span>Conexões M.V.I (Google Sheets)</h3>
            <div className="bg-zinc-950/50 rounded-lg p-4 mb-6 border border-zinc-800/50"><div className="flex gap-3 items-end flex-wrap md:flex-nowrap"><div className="w-full md:flex-1"><label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Nome da Planilha</label><input type="text" value={sheetName} onChange={e => setSheetName(e.target.value)} placeholder="Ex: Campanhas Principais" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-green-500"/></div><div className="w-full md:flex-[2]"><label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Link Público (Google Sheets)</label><div className="relative"><LinkIcon size={16} className="absolute left-3 top-2.5 text-zinc-600" /><input type="text" value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-white focus:outline-none focus:border-green-500"/></div></div><button onClick={handleSaveSheet} className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 h-[42px]">{editingSheet ? <Save size={18}/> : <Plus size={18}/>}{editingSheet ? 'Atualizar' : 'Adicionar'}</button>{editingSheet && (<button onClick={() => { setEditingSheet(null); setSheetName(''); setSheetUrl(''); }} className="bg-zinc-800 text-zinc-400 px-3 py-2 rounded-lg h-[42px]"><X size={18}/></button>)}</div></div>
            <div className="space-y-2">{loadingSheets ? <p className="text-zinc-500 text-sm">Carregando links...</p> : sheets.map(sheet => (<div key={sheet.id} className="flex items-center justify-between p-3 bg-zinc-800/30 border border-zinc-800 rounded-lg group hover:border-zinc-700 transition-colors"><div className="flex items-center gap-3 overflow-hidden"><div className="p-2 bg-green-500/10 rounded-lg text-green-500"><FileSpreadsheet size={20} /></div><div className="flex flex-col overflow-hidden"><span className="font-bold text-white text-sm">{sheet.name}</span><span className="text-xs text-zinc-500 truncate max-w-[300px]">{sheet.url}</span></div></div><div className="flex items-center gap-2"><button onClick={() => handleEditSheet(sheet)} className="p-2 hover:bg-blue-500/10 text-zinc-500 hover:text-blue-500 rounded-lg transition-colors"><Edit2 size={16} /></button><button onClick={() => handleDeleteSheet(sheet.id)} className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-lg transition-colors"><Trash2 size={16} /></button></div></div>))}{sheets.length === 0 && !loadingSheets && (<div className="text-center py-8 text-zinc-600 italic">Nenhuma planilha conectada.</div>)}</div>
          </div>
        </div>
      )}

      {/* NEW TAB: MENU & FEATURES CONFIGURATION */}
      {activeTab === 'menu-config' && (
         <div className="animate-in slide-in-from-bottom-2">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-lg p-6">
               <div className="flex justify-between items-start mb-6">
                  <div>
                     <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <MenuIcon className="text-primary-500" size={20} />
                        Visibilidade de Módulos (Menu)
                     </h3>
                     <p className="text-sm text-zinc-400 mt-1">
                        Ative ou desative funcionalidades conforme a necessidade do negócio. 
                        Itens desligados desaparecerão do menu para todos os usuários.
                     </p>
                  </div>
                  <button onClick={handleSaveGeneral} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                     <Save size={16} /> Salvar Alterações
                  </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <FeatureToggle label="Visão Geral (Dashboard)" description="Painel principal com gráficos de vendas e leads." checked={features.dashboard} onChange={() => toggleFeature('dashboard')} />
                  <FeatureToggle label="Agenda" description="Calendário de atividades e tarefas." checked={features.agenda} onChange={() => toggleFeature('agenda')} />
                  <FeatureToggle label="CRM Ultra" description="Pipeline de vendas, Kanban e gestão de oportunidades." checked={features.crm} onChange={() => toggleFeature('crm')} />
                  <FeatureToggle label="Indicadores M.V.I" description="Métricas de marketing e performance de tráfego." checked={features.mvi} onChange={() => toggleFeature('mvi')} />
                  <FeatureToggle label="Métricas M.V.I (Planilha)" description="Dashboard avançado baseado em Google Sheets." checked={features.mvi_metrics} onChange={() => toggleFeature('mvi_metrics')} />
                  <FeatureToggle label="Produtos" description="Catálogo de produtos e serviços." checked={features.products} onChange={() => toggleFeature('products')} />
                  <FeatureToggle label="Onboarding & IA" description="Criação de estratégias e copy com inteligência artificial." checked={features.onboarding} onChange={() => toggleFeature('onboarding')} />
                  <FeatureToggle label="Páginas de Captura" description="Gerador de landing pages internas." checked={features.landing_pages} onChange={() => toggleFeature('landing_pages')} />
                  <FeatureToggle label="Metas Mensais" description="Tela de acompanhamento de meta visual." checked={features.goals} onChange={() => toggleFeature('goals')} />
               </div>
            </div>
         </div>
      )}
      
      {activeTab === 'users' && (
         <div className="animate-in slide-in-from-bottom-2">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-lg overflow-hidden">
               <div className="p-6 border-b border-zinc-800 flex justify-between items-center"><div><h3 className="text-lg font-semibold text-white flex items-center gap-2"><Users className="text-primary-500" size={20} />Usuários do Sistema</h3></div><button onClick={() => setShowUserForm(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors text-sm font-medium"><Plus size={16} /> Novo Usuário</button></div>
               {showUserForm && (<div className="p-6 bg-zinc-950/50 border-b border-zinc-800 animate-in slide-in-from-top-4"><form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end"><div><label className="block text-xs font-medium text-zinc-400 mb-1 uppercase">Nome</label><input required type="text" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-primary-500 outline-none" /></div><div><label className="block text-xs font-medium text-zinc-400 mb-1 uppercase">Email</label><input required type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-primary-500 outline-none" /></div><div><label className="block text-xs font-medium text-zinc-400 mb-1 uppercase">Senha</label><input required type="text" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-primary-500 outline-none" /></div><div><label className="block text-xs font-medium text-zinc-400 mb-1 uppercase">Nível</label><select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-primary-500 outline-none"><option value="sales">Vendedor</option><option value="manager">Gestor</option><option value="admin">Admin</option><option value="client">Cliente</option></select></div><div className="md:col-span-2 flex gap-2 justify-end mt-2"><button type="button" onClick={() => setShowUserForm(false)} className="px-4 py-2 text-zinc-400 hover:text-white">Cancelar</button><button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">Criar no Auth</button></div></form></div>)}
               <div className="overflow-x-auto"><table className="w-full text-left text-sm text-zinc-400"><thead className="bg-zinc-950 text-zinc-200 uppercase text-xs"><tr><th className="px-6 py-4">Nome</th><th className="px-6 py-4">Email</th><th className="px-6 py-4">Cargo</th><th className="px-6 py-4 text-center">Ações</th></tr></thead><tbody className="divide-y divide-zinc-800">{loadingUsers ? <tr><td colSpan={4} className="px-6 py-8 text-center">Carregando...</td></tr> : users.map(user => (<tr key={user.id} className="hover:bg-zinc-800/50"><td className="px-6 py-4 font-medium text-white">{user.name}</td><td className="px-6 py-4">{user.email}</td><td className="px-6 py-4 uppercase text-xs font-bold">{user.role}</td><td className="px-6 py-4 text-center"><button onClick={() => handleDeleteUser(user.id)} className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded"><Trash2 size={16} /></button></td></tr>))}</tbody></table></div>
            </div>
         </div>
      )}

      {/* TAB: CRM CONFIGURATION */}
      {activeTab === 'crm-config' && (
         <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in slide-in-from-bottom-2">
            <div className="lg:col-span-1 space-y-2">
               <button onClick={() => { setCrmSection('brands'); setEditingItem(null); }} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${crmSection === 'brands' ? 'bg-primary-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}><Briefcase size={18} /> Categorias/Linhas</button>
               <button onClick={() => { setCrmSection('models'); setEditingItem(null); }} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${crmSection === 'models' ? 'bg-primary-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}><Box size={18} /> Produtos/Serviços</button>
               <button onClick={() => { setCrmSection('types'); setEditingItem(null); }} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${crmSection === 'types' ? 'bg-primary-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}><FileSpreadsheet size={18} /> Tipos de Contrato</button>
               <button onClick={() => { setCrmSection('fuel'); setEditingItem(null); }} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${crmSection === 'fuel' ? 'bg-primary-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}><Tag size={18} /> Segmentos</button>
               <button onClick={() => { setCrmSection('origins'); setEditingItem(null); }} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${crmSection === 'origins' ? 'bg-primary-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}><Globe size={18} /> Origens</button>
               <button onClick={() => { setCrmSection('appointment_reasons'); setEditingItem(null); }} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${crmSection === 'appointment_reasons' ? 'bg-primary-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}><Calendar size={18} /> Motivos Agendamento</button>
               <div className="h-px bg-zinc-800 my-2"></div>
               <button onClick={() => { setCrmSection('pipeline'); setEditingItem(null); }} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${crmSection === 'pipeline' ? 'bg-primary-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}><GitCommit size={18} /> Pipeline</button>
               <button onClick={() => { setCrmSection('loss'); setEditingItem(null); }} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${crmSection === 'loss' ? 'bg-primary-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}><Frown size={18} /> Motivos Perda</button>
               <button onClick={() => { setCrmSection('win'); setEditingItem(null); }} className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${crmSection === 'win' ? 'bg-primary-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'}`}><Smile size={18} /> Motivos Ganho</button>
            </div>

            <div className="lg:col-span-3 bg-zinc-900 border border-zinc-800 rounded-xl p-6 min-h-[500px]">
               {loadingCrm ? <div className="flex items-center justify-center h-full text-zinc-500">Carregando...</div> : (
                  <>
                     {(crmSection !== 'models' && crmSection !== 'pipeline') && (
                        <div>
                           <h3 className="text-xl font-bold text-white mb-4">{getSectionTitle()}</h3>
                           <div className="flex gap-2 mb-6">
                              <input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Novo item..." className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-white focus:ring-1 focus:ring-primary-500 outline-none" />
                              <button onClick={addItem} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"><Plus size={18} /> Adicionar</button>
                           </div>
                           <div className="space-y-2">
                              {getCurrentList().map((item: any) => (
                                 <div key={item.id} className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-lg group hover:border-zinc-700 transition-colors">
                                    {editingItem?.id === item.id ? (
                                        <div className="flex items-center gap-2 flex-1 mr-2">
                                            <input type="text" value={editingItem.name} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm text-white flex-1" autoFocus />
                                            <button onClick={handleUpdateItem} className="p-1 text-green-500 hover:bg-green-500/10 rounded"><Check size={16} /></button>
                                            <button onClick={() => setEditingItem(null)} className="p-1 text-red-500 hover:bg-red-500/10 rounded"><X size={16} /></button>
                                        </div>
                                    ) : (
                                        <span className={`text-sm flex-1 ${!item.active ? 'text-zinc-500 line-through' : 'text-white'}`}>{item.name}</span>
                                    )}
                                    <div className="flex items-center gap-2">
                                       {editingItem?.id !== item.id && <button onClick={() => setEditingItem({ id: item.id, name: item.name })} className="p-1.5 text-zinc-500 hover:text-blue-500 hover:bg-blue-500/10 rounded"><Pencil size={16} /></button>}
                                       <button onClick={() => toggleActive(item.id, item.active, getTableForSection())} className={`p-1.5 rounded transition-colors ${item.active ? 'text-green-500 hover:bg-green-500/10' : 'text-zinc-500 hover:bg-zinc-800'}`}>{item.active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}</button>
                                       <button onClick={() => deleteCrmItem(item.id, getTableForSection())} className="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded"><Trash2 size={16} /></button>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        </div>
                     )}
                     
                     {crmSection === 'models' && (
                        <div>
                           <h3 className="text-xl font-bold text-white mb-4">Cadastro de Produtos / Serviços</h3>
                           <div className="flex flex-col md:flex-row gap-2 mb-6">
                              <select value={selectedBrandId} onChange={e => setSelectedBrandId(e.target.value)} className="bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-white outline-none w-full md:w-1/3">
                                 <option value="">Selecione a Categoria</option>
                                 {brands.filter(b => b.active).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                              </select>
                              <input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Nome do Produto..." className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-white outline-none" />
                              <button onClick={addItem} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"><Plus size={18} /> Adicionar</button>
                           </div>
                           <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                              {models.map((item) => (
                                 <div key={item.id} className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-lg group hover:border-zinc-700 transition-colors">
                                    <div className="flex flex-col flex-1">
                                        <span className={`text-sm ${!item.active ? 'text-zinc-500 line-through' : 'text-white'}`}>{item.name}</span>
                                        <span className="text-xs text-zinc-500">{item.crm_brands?.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                       <button onClick={() => toggleActive(item.id, item.active, 'crm_models')} className={`p-1.5 rounded ${item.active ? 'text-green-500' : 'text-zinc-500'}`}>{item.active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}</button>
                                       <button onClick={() => deleteCrmItem(item.id, 'crm_models')} className="p-1.5 text-zinc-500 hover:text-red-500"><Trash2 size={16} /></button>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        </div>
                     )}
                     
                     {crmSection === 'pipeline' && (
                        <div>
                           <h3 className="text-xl font-bold text-white mb-4">Pipeline de Vendas</h3>
                           <div className="flex gap-2 mb-6">
                              <input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Nova etapa..." className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2 text-white outline-none" />
                              <button onClick={addItem} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium"><Plus size={18} /> Adicionar</button>
                           </div>
                           <div className="space-y-2">
                              {stages.map((stage) => (
                                 <div key={stage.id} className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-lg group hover:border-zinc-700 transition-colors">
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className={`w-3 h-3 rounded-full ${stage.color.replace('bg-', 'bg-') || 'bg-zinc-500'}`}></div>
                                        <span className={`text-sm ${!stage.active ? 'text-zinc-500 line-through' : 'text-white'}`}>{stage.name}</span>
                                        {stage.is_system && <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded border border-zinc-700">Sistema</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                       {!stage.is_system && <button onClick={() => toggleActive(stage.id, stage.active, 'crm_pipeline_stages')} className={`p-1.5 rounded ${stage.active ? 'text-green-500' : 'text-zinc-500'}`}>{stage.active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}</button>}
                                       {!stage.is_system && <button onClick={() => deleteCrmItem(stage.id, 'crm_pipeline_stages')} className="p-1.5 text-zinc-500 hover:text-red-500"><Trash2 size={16} /></button>}
                                    </div>
                                 </div>
                              ))}
                           </div>
                        </div>
                     )}
                  </>
               )}
            </div>
         </div>
      )}

    </div>
  );
};

const FeatureToggle = ({ label, description, checked, onChange }: { label: string, description: string, checked: boolean, onChange: () => void }) => (
   <div 
      className={`p-4 rounded-lg border flex justify-between items-start cursor-pointer transition-all ${checked ? 'bg-zinc-950 border-primary-500/30' : 'bg-zinc-950 border-zinc-800 opacity-60 hover:opacity-100'}`}
      onClick={onChange}
   >
      <div className="flex-1 pr-4">
         <h4 className={`text-sm font-bold mb-1 ${checked ? 'text-white' : 'text-zinc-400'}`}>{label}</h4>
         <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <div className={`w-10 h-5 rounded-full relative transition-colors ${checked ? 'bg-primary-600' : 'bg-zinc-700'}`}>
         <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${checked ? 'left-6' : 'left-1'}`}></div>
      </div>
   </div>
);
