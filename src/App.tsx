import React, { Component, useState, useEffect, type ReactNode, type ErrorInfo } from 'react';
import { Plus, BarChart3, Filter, X, RotateCcw, LayoutDashboard, GaugeCircle, Settings, Target, FileSpreadsheet, Briefcase, Car, LogOut, Sun, Moon } from 'lucide-react';
import * as XLSX from 'xlsx';
import { DailyRecord, User } from './types';
import { StatsCards } from './components/StatsCards';
import { ChartsSection } from './components/ChartsSection';
import { DataTable } from './components/DataTable';
import { DataEntryModal } from './components/DataEntryModal';
import { MVIDashboard } from './components/MVIDashboard';
import { SettingsScreen } from './components/SettingsScreen';
import { GoalsScreen } from './components/GoalsScreen';
import { MVIMetricsScreen } from './components/MVIMetricsScreen';
import { CRMUltraScreen } from './components/CRMUltraScreen';
import { LeadFormModal } from './components/LeadFormModal';
import { LoginScreen } from './components/LoginScreen';
import { useTheme, ThemeProvider } from './contexts/ThemeContext'; // Import Theme Hook

// Initial dummy data to populate the dashboard for demonstration
const INITIAL_DATA: DailyRecord[] = [
  {
    id: '1',
    date: '2023-10-01',
    leads: 45,
    source: 'Facebook Ads',
    contacts: 40,
    scheduled: 12,
    attended: 8,
    testDrives: 6,
    proposals: 4,
    approvals: 4,
    sales: 2,
    revenue: 120000,
    investment: 1500
  },
  {
    id: '2',
    date: '2023-10-02',
    leads: 52,
    source: 'Google Ads',
    contacts: 48,
    scheduled: 15,
    attended: 10,
    testDrives: 8,
    proposals: 6,
    approvals: 5,
    sales: 3,
    revenue: 185000,
    investment: 1600
  },
  {
    id: '3',
    date: '2023-10-03',
    leads: 38,
    source: 'Instagram',
    contacts: 35,
    scheduled: 8,
    attended: 6,
    testDrives: 5,
    proposals: 2,
    approvals: 2,
    sales: 1,
    revenue: 55000,
    investment: 1200
  },
  {
    id: '4',
    date: '2023-10-04',
    leads: 65,
    source: 'Facebook Ads',
    contacts: 60,
    scheduled: 20,
    attended: 15,
    testDrives: 12,
    proposals: 10,
    approvals: 8,
    sales: 5,
    revenue: 310000,
    investment: 2000
  },
  {
    id: '5',
    date: '2023-10-05',
    leads: 55,
    source: 'Indicação',
    contacts: 55,
    scheduled: 18,
    attended: 14,
    testDrives: 10,
    proposals: 8,
    approvals: 7,
    sales: 4,
    revenue: 240000,
    investment: 1800
  }
];

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

interface AppSettings {
  monthlyGoal: number;
  appLogo: string | null;
  googleSheetUrl: string | null;
}

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-4">Algo deu errado.</h2>
          <p className="text-zinc-400 mb-6 max-w-md">
            Ocorreu um erro ao carregar a aplicação. Tente recarregar ou limpar os dados locais.
          </p>
          <div className="bg-zinc-900 p-4 rounded-lg mb-6 text-left max-w-lg w-full overflow-auto border border-zinc-800">
            <code className="text-xs text-red-400 font-mono">
              {this.state.error?.toString()}
            </code>
          </div>
          <button
            onClick={() => {
              localStorage.clear(); // Clear all to be safe
              window.location.reload();
            }}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors border border-zinc-700"
          >
            Limpar Dados e Recarregar
          </button>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

function AppContent() {
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [currentView, setCurrentView] = useState<'dashboard' | 'mvi' | 'mvi_metrics' | 'settings' | 'goals' | 'crm_ultra'>('dashboard');
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Theme Context
  const { theme, toggleTheme } = useTheme();

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false); // For Daily Records
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false); // For CRM Leads
  const [editingRecord, setEditingRecord] = useState<DailyRecord | undefined>(undefined);
  
  // Refresh Trigger for CRM
  const [crmRefreshKey, setCrmRefreshKey] = useState(0);

  // --- Records State ---
  const [records, setRecords] = useState<DailyRecord[]>(() => {
    try {
      const saved = localStorage.getItem('redpulse_data');
      if (!saved) return INITIAL_DATA;
      
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return INITIAL_DATA;
      
      // Sanitize data
      return parsed.map(item => ({
        ...item,
        date: item.date || new Date().toISOString().split('T')[0],
        leads: Number(item.leads) || 0,
        sales: Number(item.sales) || 0,
        revenue: Number(item.revenue) || 0,
        investment: Number(item.investment) || 0,
        scheduled: Number(item.scheduled) || 0,
        contacts: Number(item.contacts) || 0,
        attended: Number(item.attended) || 0,
        testDrives: Number(item.testDrives) || 0,
        proposals: Number(item.proposals) || 0,
        approvals: Number(item.approvals) || 0,
      }));
    } catch (e) {
      console.error("Failed to load data", e);
      return INITIAL_DATA;
    }
  });

  // --- Settings State ---
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('exclusive_labs_settings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load settings", e);
    }
    return { monthlyGoal: 0, appLogo: null, googleSheetUrl: null };
  });

  
  // Filters state
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // Persist Records
  useEffect(() => {
    localStorage.setItem('redpulse_data', JSON.stringify(records));
  }, [records]);

  // Persist Settings
  useEffect(() => {
    try {
      localStorage.setItem('exclusive_labs_settings', JSON.stringify(settings));
    } catch (e) {
      console.error("Failed to save settings, likely quota exceeded due to image size", e);
      alert("Aviso: A imagem pode ser muito grande para salvar. Tente uma imagem menor.");
    }
  }, [settings]);

  // Handle Full Screen
  const handleToggleFullScreen = () => {
    if (!isFullScreen) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error("Error attempting to enable fullscreen:", err);
      });
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
           console.error("Error attempting to exit fullscreen:", err);
        });
      }
      setIsFullScreen(false);
    }
  };

  // Exit full screen if view changes
  useEffect(() => {
    if (currentView !== 'goals' && isFullScreen) {
      if (document.exitFullscreen) {
         document.exitFullscreen().catch(() => {});
      }
      setIsFullScreen(false);
    }
  }, [currentView]);

  // Set initial view based on role
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'sales') {
        setCurrentView('crm_ultra');
      } else {
        setCurrentView('dashboard');
      }
    }
  }, [currentUser]);

  // Filter records
  const filteredRecords = records.filter(record => {
    const recordDate = record.date;
    
    // 1. Month Filter
    if (selectedMonth !== '') {
      const [, month] = recordDate.split('-'); 
      const recordMonthIndex = parseInt(month) - 1; 
      
      if (recordMonthIndex !== parseInt(selectedMonth)) {
        return false;
      }
    }

    // 2. Date Range Filter
    const { start, end } = dateRange;
    if (start && recordDate < start) return false;
    if (end && recordDate > end) return false;
    
    return true;
  });

  const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  };

  const handleSave = (recordData: Omit<DailyRecord, 'id'>) => {
    if (editingRecord) {
      setRecords(prev => prev.map(r => r.id === editingRecord.id ? { ...recordData, id: r.id } : r));
    } else {
      const newRecord: DailyRecord = {
        ...recordData,
        id: generateId()
      };
      setRecords(prev => [...prev, newRecord]);
    }
  };

  const handleEdit = (record: DailyRecord) => {
    setEditingRecord(record);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setRecords(prev => {
      const filtered = prev.filter(r => String(r.id) !== String(id));
      return filtered;
    });

    if (editingRecord && String(editingRecord.id) === String(id)) {
      setEditingRecord(undefined);
    }
  };

  const handleResetData = () => {
    if (window.confirm('Isso restaurará os dados de exemplo iniciais e apagará suas alterações atuais. Deseja continuar?')) {
      setRecords(INITIAL_DATA);
      setDateRange({ start: '', end: '' });
      setSelectedMonth('');
    }
  };

  const handleAddNew = () => {
    setEditingRecord(undefined);
    setIsModalOpen(true);
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filteredRecords);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados de Vendas");
    XLSX.writeFile(wb, "exclusive_labs_relatorio_vendas.xlsx");
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMonth(e.target.value);
    setDateRange({ start: '', end: '' }); 
  };

  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
    setSelectedMonth(''); 
  };

  const clearFilters = () => {
    setDateRange({ start: '', end: '' });
    setSelectedMonth('');
  };

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
  };

  // Called when a new lead is added via modal
  const handleLeadAdded = () => {
    setCrmRefreshKey(prev => prev + 1); // Triggers re-render/re-fetch in CRMUltraScreen
  };

  const hasActiveFilters = dateRange.start || dateRange.end || selectedMonth !== '';

  const LogoComponent = () => {
    if (settings.appLogo) {
      return (
        <div className="flex items-center justify-center p-2">
          <img 
            src={settings.appLogo} 
            alt="Logo" 
            className="max-h-12 w-auto object-contain" 
          />
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
         <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-primary-800 rounded-lg flex items-center justify-center shadow-lg shadow-primary-900/50">
             <BarChart3 size={20} className="text-white !text-white" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-white !text-white">
            Exclusive <span className="text-primary-500">Labs</span>
          </h1>
      </div>
    );
  };

  // Calculate current month sales for Goals Screen
  const getCurrentMonthRevenue = () => {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11
    const currentYear = now.getFullYear();

    return records
      .filter(r => {
        // Parse date string "YYYY-MM-DD"
        // Create date object at midnight local time to match logic
        const [year, month, day] = r.date.split('-').map(Number);
        const recordDate = new Date(year, month - 1, day);
        
        return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
      })
      .reduce((sum, r) => sum + r.revenue, 0);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'mvi':
        return <MVIDashboard data={filteredRecords} />;
      case 'mvi_metrics':
        return <MVIMetricsScreen campaignUrl={settings.googleSheetUrl} genderUrl={settings.googleSheetUrl} creativeUrl={settings.googleSheetUrl} />;
      case 'crm_ultra':
        return <CRMUltraScreen key={crmRefreshKey} currentUser={currentUser} />;
      case 'settings':
        return <SettingsScreen settings={settings} onSave={handleSaveSettings} currentUserRole={currentUser?.role || 'sales'} />;
      case 'goals':
        return (
          <GoalsScreen 
            currentMonthRevenue={getCurrentMonthRevenue()} 
            monthlyGoal={settings.monthlyGoal}
            logo={settings.appLogo}
            isFullScreen={isFullScreen}
            onToggleFullScreen={handleToggleFullScreen}
          />
        );
      default:
        return (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <StatsCards data={filteredRecords} />
            <ChartsSection data={filteredRecords} />
            <DataTable 
              data={filteredRecords} 
              onEdit={handleEdit} 
              onDelete={handleDelete}
              onExport={handleExport}
            />
          </div>
        );
    }
  };

  const getTitle = () => {
    switch(currentView) {
      case 'dashboard': return 'Visão Geral de Vendas';
      case 'mvi': return 'Indicadores M.V.I';
      case 'mvi_metrics': return 'Métricas M.V.I (Planilha)';
      case 'crm_ultra': return 'CRM Ultra - Gestão de Pipeline';
      case 'goals': return 'Acompanhamento de Metas';
      case 'settings': return 'Configurações';
      default: return 'Dashboard';
    }
  };

  // AUTH CHECK
  if (!currentUser) {
    return <LoginScreen onLogin={setCurrentUser} />;
  }

  // --- ROLE BASED PERMISSIONS ---
  const role = currentUser.role;

  const canViewDashboard = role === 'admin' || role === 'manager';
  const canViewMVI = role === 'admin' || role === 'manager';
  const canViewCRM = role === 'admin' || role === 'manager' || role === 'sales';
  const canViewGoals = role === 'admin' || role === 'manager' || role === 'sales';
  const canViewSettings = role === 'admin';

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-primary-500/30">
      
      {/* Sidebar - HIDDEN IF FULLSCREEN */}
      {!isFullScreen && (
        <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex-shrink-0 fixed h-full z-40 hidden lg:flex lg:flex-col transition-colors duration-300">
          <div className="h-20 flex items-center justify-center px-6 border-b border-zinc-800 bg-zinc-950">
             <LogoComponent />
          </div>
          
          <nav className="p-4 space-y-2 flex-1">
            
            {/* Dashboard Link - Admin/Manager Only */}
            {canViewDashboard && (
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  currentView === 'dashboard' 
                    ? 'bg-primary-500/10 text-primary-500 border border-primary-500/20' 
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <LayoutDashboard size={20} />
                Visão Geral
              </button>
            )}
            
            {/* MVI Links - Admin/Manager Only */}
            {canViewMVI && (
              <>
                <button
                  onClick={() => setCurrentView('mvi')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    currentView === 'mvi' 
                      ? 'bg-primary-500/10 text-primary-500 border border-primary-500/20' 
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <GaugeCircle size={20} />
                  Indicadores M.V.I
                </button>

                <button
                  onClick={() => setCurrentView('mvi_metrics')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    currentView === 'mvi_metrics' 
                      ? 'bg-primary-500/10 text-primary-500 border border-primary-500/20' 
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <FileSpreadsheet size={20} />
                  Métricas M.V.I
                </button>
              </>
            )}

            {/* CRM - Everyone */}
            {canViewCRM && (
              <button
                onClick={() => setCurrentView('crm_ultra')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  currentView === 'crm_ultra' 
                    ? 'bg-gradient-to-r from-red-600 to-red-800 text-white border border-red-500/30 shadow-lg shadow-red-900/20' 
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <Car size={20} />
                CRM Ultra
              </button>
            )}

            {/* Goals - Everyone */}
            {canViewGoals && (
              <button
                onClick={() => setCurrentView('goals')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  currentView === 'goals' 
                    ? 'bg-primary-500/10 text-primary-500 border border-primary-500/20' 
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <Target size={20} />
                Metas Mensais
              </button>
            )}

            {/* Settings - Admin Only */}
            {canViewSettings && (
              <button
                onClick={() => setCurrentView('settings')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  currentView === 'settings' 
                    ? 'bg-primary-500/10 text-primary-500 border border-primary-500/20' 
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <Settings size={20} />
                Configurações
              </button>
            )}
          </nav>

          <div className="p-4 border-t border-zinc-800">
             
             {/* THEME TOGGLE */}
             <div className="mb-4">
                <button 
                  onClick={toggleTheme}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
                >
                   <div className="flex items-center gap-2 text-xs font-bold uppercase">
                      {theme === 'dark' ? <Moon size={14} className="text-blue-400" /> : <Sun size={14} className="text-yellow-500" />}
                      {theme === 'dark' ? 'Modo Escuro' : 'Modo Claro'}
                   </div>
                   <div className="w-8 h-4 bg-zinc-800 rounded-full relative">
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${theme === 'dark' ? 'right-0.5 bg-blue-500' : 'left-0.5 bg-yellow-500'}`}></div>
                   </div>
                </button>
             </div>

             <div className="flex items-center justify-between gap-2 mb-3">
                 <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold uppercase shrink-0">
                      {currentUser.name.substring(0,2)}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-medium text-white truncate">{currentUser.name}</span>
                      <span className="text-[10px] text-zinc-500 uppercase">{role === 'sales' ? 'Vendedor' : role === 'manager' ? 'Gestor' : 'Admin'}</span>
                    </div>
                 </div>
                 <button onClick={() => setCurrentUser(null)} className="text-zinc-500 hover:text-red-500 transition-colors" title="Sair">
                    <LogOut size={16} />
                 </button>
             </div>
             <div className="flex items-center gap-2 text-zinc-500 text-xs">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span>Sistema Online v3.5</span>
             </div>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-h-screen ${isFullScreen ? '' : 'lg:ml-64'}`}>
        
        {/* Mobile Header - HIDDEN IF FULLSCREEN */}
        {!isFullScreen && (
          <header className="lg:hidden sticky top-0 z-30 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur h-16 flex items-center justify-between px-4">
               <div className="flex items-center gap-2">{settings.appLogo ? <img src={settings.appLogo} alt="Logo" className="h-8 w-auto object-contain" /> : <><BarChart3 size={20} className="text-primary-500" /><h1 className="text-lg font-bold text-white">Exclusive Labs</h1></>}</div>
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
                  <div><h2 className="text-xl font-bold text-white flex items-center gap-2"><Car className="text-red-500" size={24}/> CRM Ultra <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs uppercase tracking-widest font-bold">Beta</span></h2></div>
               )}
            </div>
            
            {currentView === 'dashboard' && (
               <div className="flex items-center gap-3">
                  <div className="bg-zinc-900 rounded-lg p-1 border border-zinc-800 flex gap-2">
                     <select value={selectedMonth} onChange={handleMonthChange} className="bg-zinc-950 border border-zinc-800 rounded-md py-1.5 pl-3 pr-8 text-xs text-white outline-none"><option value="">Todos os Meses</option>{MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
                     <div className="flex gap-2"><input type="date" value={dateRange.start} onChange={e => handleDateRangeChange('start', e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-md py-1.5 px-2 text-xs text-white outline-none" /><input type="date" value={dateRange.end} onChange={e => handleDateRangeChange('end', e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-md py-1.5 px-2 text-xs text-white outline-none" /></div>
                     {hasActiveFilters && <button onClick={clearFilters} className="px-2 bg-zinc-800 rounded text-zinc-400"><X size={14} /></button>}
                  </div>
                  <div className="flex gap-2"><button onClick={handleResetData} className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white"><RotateCcw size={14} /></button><button onClick={handleAddNew} className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium"><Plus size={16} /> Novo</button></div>
               </div>
            )}

            {currentView === 'crm_ultra' && (
               <div className="flex items-center gap-3"><button onClick={() => setIsLeadModalOpen(true)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"><Plus size={16} /> Novo Lead</button></div>
            )}
          </div>
        )}
        <main className={`flex-1 overflow-y-auto ${isFullScreen || currentView === 'crm_ultra' ? 'p-0 bg-zinc-950' : 'p-6'}`}>
          <div className={isFullScreen || currentView === 'crm_ultra' ? 'w-full h-full' : 'max-w-7xl mx-auto'}>{renderContent()}</div>
        </main>
      </div>
      <DataEntryModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} onDelete={handleDelete} initialData={editingRecord} />
      <LeadFormModal isOpen={isLeadModalOpen} onClose={() => setIsLeadModalOpen(false)} onSuccess={handleLeadAdded} currentUser={currentUser} />
    </div>
  );
}
export function App() { return <ErrorBoundary><ThemeProvider><AppContent /></ThemeProvider></ErrorBoundary>; }