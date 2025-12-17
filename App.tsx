
import React, { Component, useState, useEffect, type ReactNode, type ErrorInfo } from 'react';
import { Plus, BarChart3, Filter, X, RotateCcw, LayoutDashboard, GaugeCircle, Settings, Target, FileSpreadsheet, Briefcase, Car, LogOut, Sun, Moon, LayoutTemplate, Calendar as CalendarIcon, Package, Activity, Lightbulb, Rocket } from 'lucide-react';
import * as XLSX from 'xlsx';
import { DailyRecord, User, AppFeatures, OnboardingClient } from './types';
import { StatsCards } from './components/StatsCards';
import { ChartsSection } from './components/ChartsSection';
import { DataTable } from './components/DataTable';
import { DataEntryModal } from './components/DataEntryModal';
import { MVIDashboard } from './components/MVIDashboard';
import { SettingsScreen } from './components/SettingsScreen';
import { GoalsScreen } from './components/GoalsScreen';
import { MVIMetricsScreen } from './components/MVIMetricsScreen';
import { CRMUltraScreen } from './components/CRMUltraScreen';
import { CRMAgenda } from './components/CRMAgenda';
import { ProductsScreen } from './components/ProductsScreen';
import { LeadFormModal } from './components/LeadFormModal';
import { LoginScreen } from './components/LoginScreen';
import { LandingPagesScreen } from './components/LandingPagesScreen'; 
import { PublicLandingPage } from './components/PublicLandingPage'; 
import { DeshDashboard } from './components/DeshDashboard'; 
import { OnboardingScreen } from './components/OnboardingScreen';
import { ClientOnboardingForm } from './components/ClientOnboardingForm';
import { useTheme, ThemeProvider } from './contexts/ThemeContext'; 
import { supabase } from './supabaseClient';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

interface AppSettings {
  monthlyGoal: number;
  appLogo: string | null;
  googleSheetUrl: string | null;
  enabledFeatures: AppFeatures;
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

interface ErrorBoundaryProps { children?: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState { return { hasError: true, error }; }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) { console.error("ErrorBoundary caught an error", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-4">Algo deu errado.</h2>
          <div className="bg-zinc-900 p-4 rounded text-left text-xs text-red-400 font-mono mb-4 max-w-lg overflow-auto border border-zinc-800">
             {this.state.error?.toString()}
          </div>
          <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="px-4 py-2 bg-zinc-800 text-white rounded-lg border border-zinc-700 hover:bg-zinc-700">Limpar Dados e Recarregar</button>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

function AppContent() {
  const [landingPageSlug, setLandingPageSlug] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lp = params.get('lp');
    if (lp) setLandingPageSlug(lp);
  }, []);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'dashboard' | 'mvi' | 'mvi_metrics' | 'settings' | 'goals' | 'crm_ultra' | 'landing_pages' | 'agenda_view' | 'products' | 'desh' | 'onboarding' | 'client_onboarding'>('dashboard');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false); 
  const [editingRecord, setEditingRecord] = useState<DailyRecord | undefined>(undefined);
  const [crmRefreshKey, setCrmRefreshKey] = useState(0);

  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);

  const [dbSettings, setDbSettings] = useState<AppSettings>({ 
     monthlyGoal: 0, 
     appLogo: null, 
     googleSheetUrl: null, 
     enabledFeatures: DEFAULT_FEATURES 
  });
  const [mviSheets, setMviSheets] = useState<{id: string, name: string, url: string}[]>([]);
  
  // Client Data State
  const [clientOnboardingData, setClientOnboardingData] = useState<OnboardingClient | null>(null);

  // --- SUPABASE AUTH LISTENER ---
  useEffect(() => {
    // 1. Check active session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchUserProfile(session);
      } else {
        setSessionLoading(false);
      }
    });

    // 2. Listen for auth changes (Login, Logout, Signup)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchUserProfile(session);
      } else {
        setCurrentUser(null);
        setSessionLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (session: any) => {
     const userId = session.user.id;
     const email = session.user.email;
     const meta = session.user.user_metadata;

     try {
        // Tenta buscar o perfil no banco público
        const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
        
        if (data) {
           setCurrentUser(data as User);
        } else {
           // --- AUTOCORREÇÃO (SELF-HEALING) ---
           // Se o usuário logou no Auth mas não existe em public.users, cria agora.
           console.warn("Usuário não encontrado na tabela pública. Criando registro de fallback...");
           
           const newUserPayload = {
              id: userId,
              email: email || '',
              name: meta?.name || email?.split('@')[0] || 'Novo Usuário',
              role: (meta?.role as any) || 'sales', // Usa metadados ou padrão 'sales'
              active: true
           };

           // Use upsert to handle race conditions where trigger might have created it
           const { error: insertError } = await supabase.from('users').upsert([newUserPayload], { onConflict: 'id' });
           
           if (!insertError) {
              // Se inseriu com sucesso, define o usuário
              setCurrentUser(newUserPayload as User);
           } else {
              // Se falhar até a inserção manual, usa um objeto temporário para não travar o login
              console.error("Falha na autocorreção:", insertError);
              setCurrentUser(newUserPayload as User);
           }
        }
     } catch (e) {
        console.error("Erro crítico ao buscar perfil:", e);
     } finally {
        setSessionLoading(false);
     }
  };

  const handleLogout = async () => {
     await supabase.auth.signOut();
     setCurrentUser(null);
  };

  useEffect(() => {
    if (currentUser) {
       fetchAppSettings();
       fetchDashboardMetrics();
       
       // Handle Client Role Initial View
       if (currentUser.role === 'client') {
          checkClientOnboardingStatus(currentUser.id);
       }
    }
  }, [currentUser, crmRefreshKey]);

  const checkClientOnboardingStatus = async (userId: string) => {
     try {
        // Fetch full client data to allow editing if it exists
        const { data, error } = await supabase.from('onboarding_clients').select('*').eq('owner_id', userId).limit(1).single();
        
        if (data) {
           setClientOnboardingData(data as OnboardingClient);
           // If completed, go to CRM Ultra (Main page for client)
           setCurrentView('crm_ultra'); 
        } else {
           setClientOnboardingData(null);
           setCurrentView('client_onboarding'); 
        }
     } catch (e) {
        setClientOnboardingData(null);
        setCurrentView('client_onboarding');
     }
  };

  const fetchAppSettings = async () => {
     const { data: config } = await supabase.from('app_config').select('*').limit(1).single();
     if (config) {
        setDbSettings(prev => ({ 
           ...prev, 
           monthlyGoal: config.monthly_goal, 
           appLogo: config.app_logo,
           // Correctly map snake_case from DB to camelCase in state
           enabledFeatures: config.enabled_features ? { ...DEFAULT_FEATURES, ...config.enabled_features } : DEFAULT_FEATURES
        }));
     }

     const { data: sheets } = await supabase.from('integration_sheets').select('*').eq('active', true).order('created_at', { ascending: true });
     
     if (sheets && sheets.length > 0) {
        setMviSheets(sheets);
        setDbSettings(prev => ({ ...prev, googleSheetUrl: sheets[0].url }));
     } else {
        setMviSheets([]);
        setDbSettings(prev => ({ ...prev, googleSheetUrl: null }));
     }
  };

  const fetchDashboardMetrics = async () => {
    setIsLoadingDashboard(true);
    try {
        const { data: leads } = await supabase.from('leads').select('created_at, origem');
        const { data: sales } = await supabase.from('crm_opportunities').select('updated_at, final_price, min_price').eq('status', 'won');
        const { data: schedule } = await supabase.from('schedule').select('data, status');

        const dailyMap: Record<string, DailyRecord> = {};

        const initDay = (dateStr: string) => {
            if (!dailyMap[dateStr]) {
                dailyMap[dateStr] = {
                    id: dateStr,
                    date: dateStr,
                    leads: 0,
                    source: 'CRM Integrado',
                    contacts: 0,
                    scheduled: 0,
                    attended: 0,
                    testDrives: 0,
                    proposals: 0,
                    approvals: 0,
                    sales: 0,
                    revenue: 0,
                    investment: 0
                };
            }
        };

        leads?.forEach(l => {
            const date = l.created_at.split('T')[0];
            initDay(date);
            dailyMap[date].leads += 1;
        });

        sales?.forEach(s => {
            const date = s.updated_at.split('T')[0];
            initDay(date);
            dailyMap[date].sales += 1;
            dailyMap[date].revenue += (s.final_price || s.min_price || 0);
        });

        schedule?.forEach(s => {
            const date = s.data; 
            if (date) {
                initDay(date);
                dailyMap[date].scheduled += 1;
                if (s.status === 'realizado') {
                    dailyMap[date].attended += 1;
                }
            }
        });

        const aggregatedRecords = Object.values(dailyMap).sort((a,b) => b.date.localeCompare(a.date));
        setRecords(aggregatedRecords);

    } catch (err) {
        console.error("Error aggregating dashboard:", err);
    } finally {
        setIsLoadingDashboard(false);
    }
  };

  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  // Set DEFAULT MONTH to CURRENT MONTH
  const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth()));

  const handleToggleFullScreen = () => {
    if (!isFullScreen) {
      document.documentElement.requestFullscreen().catch((err) => console.error(err));
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch((err) => console.error(err));
      setIsFullScreen(false);
    }
  };

  useEffect(() => {
    if (currentView !== 'goals' && isFullScreen) {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      setIsFullScreen(false);
    }
  }, [currentView]);

  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'sales') {
         setCurrentView(dbSettings.enabledFeatures.crm ? 'crm_ultra' : 'dashboard');
      } else if (currentUser.role === 'client') {
         // Logic handled in fetchAppSettings/checkClientOnboardingStatus
      } else {
         setCurrentView('dashboard');
      }
    }
  }, [currentUser]);

  const filteredRecords = records.filter(record => {
    const recordDate = record.date;
    if (selectedMonth !== '') {
      const [, month] = recordDate.split('-'); 
      if ((parseInt(month) - 1) !== parseInt(selectedMonth)) return false;
    }
    const { start, end } = dateRange;
    if (start && recordDate < start) return false;
    if (end && recordDate > end) return false;
    return true;
  });

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filteredRecords);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados de Vendas");
    XLSX.writeFile(wb, "scalli_labs_relatorio_vendas.xlsx");
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => { setSelectedMonth(e.target.value); setDateRange({ start: '', end: '' }); };
  const handleDateRangeChange = (field: 'start' | 'end', value: string) => { setDateRange(prev => ({ ...prev, [field]: value })); setSelectedMonth(''); };
  const clearFilters = () => { setDateRange({ start: '', end: '' }); setSelectedMonth(''); };
  
  const handleSaveSettings = (newSettings?: Partial<AppSettings>) => { 
      if (newSettings) {
          setDbSettings(prev => ({
              ...prev,
              ...newSettings,
              enabledFeatures: newSettings.enabledFeatures || prev.enabledFeatures
          }));
      }
      fetchAppSettings(); 
  };
  
  const handleLeadAdded = () => { 
      setCrmRefreshKey(prev => prev + 1); 
      fetchDashboardMetrics();
  };

  const handleSaveDataEntry = (recordData: Omit<DailyRecord, 'id'>) => {
    // Basic implementation for manual entry if needed, though dashboard is mostly auto now
    const newRecord: DailyRecord = { ...recordData, id: Math.random().toString(36).substr(2, 9) };
    setRecords(prev => [newRecord, ...prev]);
  };

  const hasActiveFilters = dateRange.start || dateRange.end || selectedMonth !== '';

  const LogoComponent = () => {
    if (dbSettings.appLogo) {
      return <div className="flex justify-center p-2"><img src={dbSettings.appLogo} alt="Logo" className="max-h-12 w-auto object-contain" /></div>;
    }
    return (
      <div className="flex items-center gap-2">
         <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-primary-800 rounded-lg flex items-center justify-center shadow-lg"><BarChart3 size={20} className="text-white" /></div>
         <h1 className="text-lg font-bold text-white">Scalli <span className="text-primary-500">Labs</span></h1>
      </div>
    );
  };

  const getCurrentMonthRevenue = () => {
    const now = new Date();
    return records.filter(r => {
        const [year, month, day] = r.date.split('-').map(Number);
        const recordDate = new Date(year, month - 1, day);
        return recordDate.getMonth() === now.getMonth() && recordDate.getFullYear() === now.getFullYear();
      }).reduce((sum, r) => sum + r.revenue, 0);
  };

  const renderContent = () => {
    if (currentView === 'client_onboarding' && currentUser) {
       return (
         <ClientOnboardingForm 
            currentUser={currentUser} 
            initialData={clientOnboardingData} // Pass existing data if available
            onComplete={() => {
                // Refresh data status
                checkClientOnboardingStatus(currentUser.id);
                // Redirect to Main Page (CRM Ultra)
                setCurrentView('crm_ultra');
            }} 
            onCancel={() => {
               // Allow exiting to CRM Home
               setCurrentView('crm_ultra');
            }}
         />
       );
    }

    switch (currentView) {
      case 'dashboard': return <DeshDashboard sheets={mviSheets} dateRange={dateRange} selectedMonth={selectedMonth} />;
      case 'mvi': return <MVIDashboard data={filteredRecords} />;
      case 'mvi_metrics': return <MVIMetricsScreen sheets={mviSheets} />;
      // Desh is now the main dashboard, but keeping route if needed
      case 'desh': return <DeshDashboard sheets={mviSheets} dateRange={dateRange} selectedMonth={selectedMonth} />;
      case 'agenda_view': return <CRMAgenda />;
      case 'crm_ultra': return <CRMUltraScreen key={crmRefreshKey} currentUser={currentUser} />;
      case 'landing_pages': return <LandingPagesScreen />;
      case 'products': return <ProductsScreen />;
      case 'onboarding': return <OnboardingScreen currentUser={currentUser} />;
      case 'settings': return <SettingsScreen onSave={handleSaveSettings} currentUserRole={currentUser?.role || 'sales'} />;
      case 'goals': return <GoalsScreen currentMonthRevenue={getCurrentMonthRevenue()} monthlyGoal={dbSettings.monthlyGoal} logo={dbSettings.appLogo} isFullScreen={isFullScreen} onToggleFullScreen={handleToggleFullScreen} />;
      default: return null;
    }
  };

  if (landingPageSlug) { return <PublicLandingPage slug={landingPageSlug} />; }
  
  // Wait for session check
  if (sessionLoading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">Carregando...</div>;

  if (!currentUser) return <LoginScreen onLogin={() => {}} />; // Handler now managed by useEffect listener

  const role = currentUser.role;
  const features = dbSettings.enabledFeatures;

  // --- ROLE BASED PERMISSIONS ---
  const isClient = role === 'client';

  const canViewDashboard = (role === 'admin' || role === 'manager') && features.dashboard && !isClient;
  
  // Clients can view MVI screens if feature enabled
  const canViewMVI = (role === 'admin' || role === 'manager' || isClient) && features.mvi;
  const canViewMVIMetrics = (role === 'admin' || role === 'manager' || isClient) && features.mvi_metrics;
  
  // Clients see "Relatórios" which points to 'desh' or 'mvi'
  const canViewReports = isClient; 
  
  // Clients CAN now view CRM
  const canViewCRM = features.crm && (role === 'admin' || role === 'manager' || role === 'sales' || isClient);
  
  const canViewGoals = features.goals && !isClient;
  const canViewSettings = role === 'admin';
  const canViewLandingPages = (role === 'admin' || role === 'manager') && features.landing_pages && !isClient;
  const canViewAgenda = features.agenda && !isClient; 
  const canViewProducts = features.products && !isClient;
  const canViewOnboarding = (role === 'admin' || role === 'manager') && features.onboarding && !isClient;

  // Client Specific Onboarding Link (always visible if they are client, to re-view or edit)
  const canViewClientOnboarding = isClient;

  const NavItem = ({ onClick, active, icon, label }: any) => (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
        active 
        ? 'bg-primary-500/10 text-primary-500 border border-primary-500/20' 
        : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-primary-500/30">
      
      {/* If Client Onboarding Form is active, hide sidebar for full focus, unless completed */}
      {!isFullScreen && (currentView !== 'client_onboarding' || (currentView === 'client_onboarding' && role !== 'client')) && (
        <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex-shrink-0 fixed h-full z-40 hidden lg:flex lg:flex-col transition-colors duration-300">
          <div className="h-20 flex items-center justify-center px-6 border-b border-zinc-800 bg-zinc-950">
             <LogoComponent />
          </div>
          
          <nav className="p-4 space-y-2 flex-1">
            
            {/* --- CLIENT SPECIFIC MENU (Restricted to 3 items) --- */}
            {isClient ? (
               <>
                  <button
                     onClick={() => setCurrentView('crm_ultra')}
                     className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                     currentView === 'crm_ultra' 
                        ? 'bg-gradient-to-r from-primary-600 to-primary-800 text-white border border-primary-500/30 shadow-lg shadow-primary-900/20' 
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                     }`}
                  >
                     <Car size={20} />
                     CRM Ultra
                  </button>

                  <NavItem onClick={() => setCurrentView('mvi_metrics')} active={currentView === 'mvi_metrics'} icon={<FileSpreadsheet size={20} />} label="Métricas M.V.I" />
                  
                  <NavItem onClick={() => setCurrentView('client_onboarding')} active={currentView === 'client_onboarding'} icon={<Rocket size={20} />} label="Meu Onboarding" />
               </>
            ) : (
               <>
                  {/* --- STANDARD MENU FOR ADMIN/STAFF --- */}
                  {canViewDashboard && <NavItem onClick={() => setCurrentView('dashboard')} active={currentView === 'dashboard'} icon={<LayoutDashboard size={20} />} label="Visão Geral" />}
                  
                  {canViewAgenda && <NavItem onClick={() => setCurrentView('agenda_view')} active={currentView === 'agenda_view'} icon={<CalendarIcon size={20} />} label="Agenda" />}

                  {canViewMVI && (
                     <NavItem onClick={() => setCurrentView('mvi')} active={currentView === 'mvi'} icon={<GaugeCircle size={20} />} label="Indicadores M.V.I" />
                  )}
                  {canViewMVIMetrics && (
                     <NavItem onClick={() => setCurrentView('mvi_metrics')} active={currentView === 'mvi_metrics'} icon={<FileSpreadsheet size={20} />} label="Métricas M.V.I" />
                  )}

                  {canViewCRM && (
                  <button
                     onClick={() => setCurrentView('crm_ultra')}
                     className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        currentView === 'crm_ultra' 
                        ? 'bg-gradient-to-r from-primary-600 to-primary-800 text-white border border-primary-500/30 shadow-lg shadow-primary-900/20' 
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                     }`}
                  >
                     <Car size={20} />
                     CRM Ultra
                  </button>
                  )}

                  {canViewOnboarding && <NavItem onClick={() => setCurrentView('onboarding')} active={currentView === 'onboarding'} icon={<Lightbulb size={20} />} label="Onboarding & IA" />}

                  {canViewProducts && <NavItem onClick={() => setCurrentView('products')} active={currentView === 'products'} icon={<Package size={20} />} label="Produtos" />}
                  
                  {canViewLandingPages && <NavItem onClick={() => setCurrentView('landing_pages')} active={currentView === 'landing_pages'} icon={<LayoutTemplate size={20} />} label="Páginas de Captura" />}
                  {canViewGoals && <NavItem onClick={() => setCurrentView('goals')} active={currentView === 'goals'} icon={<Target size={20} />} label="Metas Mensais" />}
                  {canViewSettings && <NavItem onClick={() => setCurrentView('settings')} active={currentView === 'settings'} icon={<Settings size={20} />} label="Configurações" />}
               </>
            )}
          </nav>

          <div className="p-4 border-t border-zinc-800">
             <div className="mb-4"><button onClick={toggleTheme} className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"><div className="flex items-center gap-2 text-xs font-bold uppercase">{theme === 'dark' ? <Moon size={14} className="text-blue-400" /> : <Sun size={14} className="text-yellow-500" />}{theme === 'dark' ? 'Modo Escuro' : 'Modo Claro'}</div><div className="w-8 h-4 bg-zinc-800 rounded-full relative"><div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${theme === 'dark' ? 'right-0.5 bg-blue-500' : 'left-0.5 bg-yellow-500'}`}></div></div></button></div>
             <div className="flex items-center justify-between gap-2 mb-3"><div className="flex items-center gap-2 overflow-hidden"><div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold uppercase shrink-0">{currentUser.name.substring(0,2)}</div><div className="flex flex-col overflow-hidden"><span className="text-sm font-medium text-white truncate">{currentUser.name}</span><span className="text-[10px] text-zinc-500 uppercase">{role === 'sales' ? 'Vendedor' : role === 'manager' ? 'Gestor' : role === 'client' ? 'Cliente' : 'Admin'}</span></div></div><button onClick={handleLogout} className="text-zinc-500 hover:text-red-500 transition-colors" title="Sair"><LogOut size={16} /></button></div>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-h-screen ${isFullScreen || (currentView === 'client_onboarding' && role === 'client') ? '' : 'lg:ml-64'}`}>
        
        {/* Mobile Header - HIDDEN IF FULLSCREEN */}
        {!isFullScreen && (
          <header className="lg:hidden sticky top-0 z-30 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur h-16 flex items-center justify-between px-4">
               <div className="flex items-center gap-2">{dbSettings.appLogo ? <img src={dbSettings.appLogo} alt="Logo" className="h-8 w-auto object-contain" /> : <><BarChart3 size={20} className="text-primary-500" /><h1 className="text-lg font-bold text-white">Scalli Labs</h1></>}</div>
               <div className="flex gap-2">
                   {canViewDashboard && <button onClick={() => setCurrentView('dashboard')} className="p-2 rounded text-zinc-500"><LayoutDashboard size={20} /></button>}
                   {canViewCRM && <button onClick={() => setCurrentView('crm_ultra')} className="p-2 rounded text-zinc-500"><Car size={20} /></button>}
                   <button onClick={() => setCurrentUser(null)} className="p-2 rounded text-red-500"><LogOut size={20} /></button>
               </div>
          </header>
        )}
        {(currentView === 'dashboard' || currentView === 'crm_ultra') && !isFullScreen && (
          <div className={`sticky top-0 lg:top-0 z-20 bg-zinc-950/80 backdrop-blur border-b border-zinc-800 px-6 py-4 flex ${currentView === 'crm_ultra' ? 'justify-between items-center' : 'flex-col xl:flex-row items-center justify-between gap-4'}`}>
            <div className="flex items-center gap-3">
               {currentView === 'dashboard' ? (
                  <div><h2 className="text-xl font-bold text-white">Visão Geral de Vendas</h2></div>
               ) : (
                  <div><h2 className="text-xl font-bold text-white flex items-center gap-2"><Car className="text-primary-500" size={24}/> CRM Ultra <span className="px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-400 text-xs uppercase tracking-widest font-bold">Beta</span></h2></div>
               )}
            </div>
            
            {currentView === 'dashboard' && (
               <div className="flex items-center gap-3">
                  <div className="bg-zinc-900 rounded-lg p-1 border border-zinc-800 flex gap-2">
                     <select value={selectedMonth} onChange={handleMonthChange} className="bg-zinc-950 border border-zinc-800 rounded-md py-1.5 pl-3 pr-8 text-xs text-white outline-none"><option value="">Todos os Meses</option>{MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
                     <div className="flex gap-2"><input type="date" value={dateRange.start} onChange={e => handleDateRangeChange('start', e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-md py-1.5 px-2 text-xs text-white outline-none" /><input type="date" value={dateRange.end} onChange={e => handleDateRangeChange('end', e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-md py-1.5 px-2 text-xs text-white outline-none" /></div>
                     {hasActiveFilters && <button onClick={clearFilters} className="px-2 bg-zinc-800 rounded text-zinc-400"><X size={14} /></button>}
                  </div>
                  <div className="flex gap-2"><button onClick={fetchDashboardMetrics} className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white"><RotateCcw size={14} className={isLoadingDashboard ? "animate-spin" : ""} /></button></div>
               </div>
            )}

            {currentView === 'crm_ultra' && (
               <div className="flex items-center gap-3"><button onClick={() => setIsLeadModalOpen(true)} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"><Plus size={16} /> Novo Lead</button></div>
            )}
          </div>
        )}
        <main className={`flex-1 overflow-y-auto ${isFullScreen || currentView === 'crm_ultra' || currentView === 'dashboard' || currentView === 'desh' || currentView === 'mvi_metrics' || currentView === 'mvi' || currentView === 'products' || currentView === 'goals' || currentView === 'onboarding' || currentView === 'client_onboarding' ? 'p-0 bg-zinc-950' : 'p-6'}`}>
          <div className={isFullScreen || currentView === 'crm_ultra' || currentView === 'agenda_view' || currentView === 'dashboard' || currentView === 'desh' || currentView === 'mvi_metrics' || currentView === 'mvi' || currentView === 'products' || currentView === 'goals' || currentView === 'onboarding' || currentView === 'client_onboarding' ? 'w-full h-full' : 'max-w-7xl mx-auto'}>{renderContent()}</div>
        </main>
      </div>
      <DataEntryModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveDataEntry} onDelete={() => {}} initialData={editingRecord} />
      <LeadFormModal isOpen={isLeadModalOpen} onClose={() => setIsLeadModalOpen(false)} onSuccess={handleLeadAdded} currentUser={currentUser} />
    </div>
  );
}
export function App() { return <ErrorBoundary><ThemeProvider><AppContent /></ThemeProvider></ErrorBoundary>; }
