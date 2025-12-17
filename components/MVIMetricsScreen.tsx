
import React, { useEffect, useState, useMemo } from 'react';
import { FileSpreadsheet, RefreshCw, AlertTriangle, ExternalLink, BarChart2, DollarSign, MousePointer2, Eye, Layers, Users, Image, Filter, X, MessageCircle, Percent, Target, Bug, Code, Megaphone, Grid, Download, Trophy, Medal, Zap, PlayCircle, Video, ThumbsUp, Link2, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend 
} from 'recharts';
import { IntegrationSheet } from '../types';

interface MVIMetricsScreenProps {
  sheets: { id: string; name: string; url: string }[];
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/**
 * INTELLIGENT URL PARSER
 * Converts any Google Sheet View/Edit link into a CSV Export Link.
 */
const getCleanCsvUrl = (userInput: string | null): string | null => {
  if (!userInput) return null;

  try {
    const idMatch = userInput.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!idMatch || !idMatch[1]) return null;
    const spreadsheetId = idMatch[1];

    const gidMatch = userInput.match(/[#&?]gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : '0';

    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  } catch (e) {
    console.error("Error parsing URL:", e);
    return null;
  }
};

/**
 * CSV PARSER
 */
const parseCSV = (text: string) => {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  const parseLine = (line: string) => {
    const row: string[] = [];
    let currentVal = '';
    let insideQuote = false;

    for (let charIndex = 0; charIndex < line.length; charIndex++) {
      const char = line[charIndex];

      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        row.push(currentVal.trim().replace(/^"|"$/g, ''));
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    row.push(currentVal.trim().replace(/^"|"$/g, ''));
    return row;
  };

  const headers = parseLine(lines[0]);
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const row = parseLine(line);
    if (row.length > 0) {
      const entry: any = {};
      let hasData = false;
      headers.forEach((header, index) => {
        const val = row[index] || '';
        if (val) hasData = true;
        entry[header] = val;
      });
      if (hasData) data.push(entry);
    }
  }
  return data;
};

/**
 * NUMERIC PARSER (PT-BR SUPPORT)
 */
const parseSheetNumber = (val: string | undefined | number): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;

  let clean = val.replace(/[^\d,.-]/g, '');
  if (!clean) return 0;

  if (clean.includes(',')) {
    clean = clean.replace(/\./g, '');
    clean = clean.replace(',', '.');
  } 

  const result = parseFloat(clean);
  return isNaN(result) ? 0 : result;
};

// Types for Weekly Breakdown
interface WeeklyStats {
  startDate: string;
  endDate: string;
  spend: number;
  impressions: number;
  clicks: number; // Link Clicks
  clicksAll: number; // Clicks (All) - approximate if not avail, usually just Clicks
  conversations: number;
  ctr: number;
  ctrAll: number;
  cpm: number;
  cpr: number;
}

export const MVIMetricsScreen: React.FC<MVIMetricsScreenProps> = ({ sheets }) => {
  const [activeTab, setActiveTab] = useState<'campaign' | 'gender' | 'creative'>('campaign');
  const [showDebug, setShowDebug] = useState(false);
  const [debugTab, setDebugTab] = useState<'campaign' | 'gender' | 'creative'>('campaign');
  
  // Sheet Selection State
  const [selectedSheetId, setSelectedSheetId] = useState<string>('');

  // Data States
  const [campaignData, setCampaignData] = useState<any[]>([]);
  const [genderData, setGenderData] = useState<any[]>([]);
  const [creativeData, setCreativeData] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Filter States - Default to CURRENT MONTH
  const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth()));
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [selectedAdSet, setSelectedAdSet] = useState<string>('');
  
  // Expanded Campaign State
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

  // Initialize Selection based on LocalStorage or Props
  useEffect(() => {
     if (sheets.length > 0) {
        const savedId = localStorage.getItem('mvi_last_sheet_id');
        // Check if saved ID still exists in current sheets
        if (savedId && sheets.find(s => s.id === savedId)) {
           setSelectedSheetId(savedId);
        } else {
           setSelectedSheetId(sheets[0].id);
        }
     } else {
        setSelectedSheetId('');
     }
  }, [sheets]);

  // Handle Sheet Change
  const handleSheetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
     const newId = e.target.value;
     setSelectedSheetId(newId);
     localStorage.setItem('mvi_last_sheet_id', newId);
  };

  // Get current active URL
  const currentSheet = useMemo(() => sheets.find(s => s.id === selectedSheetId), [selectedSheetId, sheets]);
  const activeUrl = useMemo(() => getCleanCsvUrl(currentSheet?.url || null), [currentSheet]);

  const fetchData = async () => {
    if (!activeUrl) return;

    setLoading(true);
    setError(null);

    const fetchSheet = async (url: string | null) => {
      if (!url) return [];
      try {
        const cacheBuster = `&t=${Date.now()}`;
        const res = await fetch(url + cacheBuster);
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        const txt = await res.text();
        return parseCSV(txt);
      } catch (e: any) {
        console.warn(`Failed to load ${url}:`, e);
        throw e;
      }
    };

    try {
      // For now, we assume the single selected sheet URL populates all views. 
      // If the sheet has multiple tabs and the URL points to a specific GID, it loads that GID.
      // Ideally, the user provides a link to the Campaign Data tab, which contains enough info for most views.
      const data = await fetchSheet(activeUrl);

      setCampaignData(data);
      setGenderData(data); // Using same dataset for now (assuming flat structure)
      setCreativeData(data); // Using same dataset

      if (data.length === 0) {
         throw new Error("A planilha parece estar vazia ou não pôde ser lida.");
      }

      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || "Erro ao conectar com Google Sheets.");
      setCampaignData([]);
    } finally {
      setLoading(false);
    }
  };

  // Reload when URL changes
  useEffect(() => {
    if (activeUrl) {
       fetchData();
    }
  }, [activeUrl]);

  // Filtering Logic
  const filterData = (data: any[]) => {
    return data.filter(item => {
      const dayStr = item['Day']; 
      
      if (dayStr && dayStr.length >= 10) {
           if (dateRange.start && dayStr < dateRange.start) return false;
           if (dateRange.end && dayStr > dateRange.end) return false;

           if (selectedMonth !== '') {
             const parts = dayStr.split('-');
             if (parts.length >= 2) {
               const monthIndex = parseInt(parts[1], 10) - 1; 
               if (monthIndex !== parseInt(selectedMonth)) return false;
             }
           }
      }

      if (selectedCampaign !== '' && item['Campaign Name'] !== selectedCampaign) return false;
      if (selectedAdSet !== '' && item['Ad Set Name'] !== selectedAdSet) return false;

      return true;
    });
  };

  const filteredCampaignData = useMemo(() => filterData(campaignData), [campaignData, selectedMonth, dateRange, selectedCampaign, selectedAdSet]);
  const filteredGenderData = useMemo(() => filterData(genderData), [genderData, selectedMonth, dateRange, selectedCampaign, selectedAdSet]);
  const filteredCreativeData = useMemo(() => filterData(creativeData), [creativeData, selectedMonth, dateRange, selectedCampaign, selectedAdSet]);

  // Determine Unique Campaigns (for dropdowns and logic)
  const uniqueCampaigns = useMemo(() => {
    const campaigns = new Set<string>();
    [campaignData, genderData, creativeData].forEach(dataset => {
       dataset.forEach(row => { if (row['Campaign Name']) campaigns.add(row['Campaign Name']); });
    });
    return Array.from(campaigns).sort();
  }, [campaignData, genderData, creativeData]);

  const uniqueAdSets = useMemo(() => {
    const sets = new Set<string>();
    [campaignData, genderData, creativeData].forEach(dataset => {
       dataset.forEach(row => { if (row['Ad Set Name']) sets.add(row['Ad Set Name']); });
    });
    return Array.from(sets).sort();
  }, [campaignData, genderData, creativeData]);

  // --- LOGIC FOR WEEKLY BREAKDOWN ---
  const calculateWeeklyStats = (campaignName: string): WeeklyStats[] => {
    // 1. Get ALL data for this campaign (ignore month filters to get historical context)
    const rawData = campaignData.filter(r => r['Campaign Name'] === campaignName && r['Day']);
    
    if (rawData.length === 0) return [];

    // 2. Find latest date
    const sortedByDate = [...rawData].sort((a, b) => b['Day'].localeCompare(a['Day']));
    const latestDateStr = sortedByDate[0]['Day'];
    const latestDate = new Date(latestDateStr);

    const weeks: WeeklyStats[] = [];

    // 3. Generate 4 buckets of 7 days
    for (let i = 0; i < 4; i++) {
       const endDate = new Date(latestDate);
       endDate.setDate(latestDate.getDate() - (i * 7));
       
       const startDate = new Date(endDate);
       startDate.setDate(endDate.getDate() - 6);

       const startStr = startDate.toISOString().split('T')[0];
       const endStr = endDate.toISOString().split('T')[0];

       // Filter data for this range
       const weekData = rawData.filter(r => r['Day'] >= startStr && r['Day'] <= endStr);

       // Aggregate
       let spend = 0, imp = 0, clicks = 0, clicksAll = 0, msgs = 0;
       
       weekData.forEach(r => {
          spend += parseSheetNumber(r['Amount Spent']);
          imp += parseSheetNumber(r['Impressions']);
          clicks += parseSheetNumber(r['Link Clicks']);
          clicksAll += parseSheetNumber(r['Clicks (All)'] || r['Clicks']); // Fallback
          msgs += parseSheetNumber(r['Messaging Conversations Started']);
       });

       weeks.push({
         startDate: startStr,
         endDate: endStr,
         spend,
         impressions: imp,
         clicks,
         clicksAll,
         conversations: msgs,
         ctr: imp > 0 ? (clicks / imp) * 100 : 0,
         ctrAll: imp > 0 ? (clicksAll / imp) * 100 : 0,
         cpm: imp > 0 ? (spend / imp) * 1000 : 0,
         cpr: msgs > 0 ? spend / msgs : 0
       });
    }

    // Return reversed so index 0 is the OLDEST, and index 3 is NEWEST (Current)
    // This allows the UI to render from Oldest -> Newest (Left -> Right)
    return weeks.reverse();
  };

  // Summary Calculation (for top cards)
  const summary = useMemo(() => {
    let spend = 0, impressions = 0, reach = 0, clicks = 0, msgs = 0;
    let pageEngagement = 0, lpViews = 0;
    let totalCtrSum = 0;
    let rowCount = 0;
    
    filteredCampaignData.forEach(row => {
      spend += parseSheetNumber(row['Amount Spent']);
      impressions += parseSheetNumber(row['Impressions']);
      reach += parseSheetNumber(row['Reach']);
      clicks += parseSheetNumber(row['Link Clicks']);
      msgs += parseSheetNumber(row['Messaging Conversations Started']);
      pageEngagement += parseSheetNumber(row['Page Engagement']);
      lpViews += parseSheetNumber(row['Landing Page Views']);

      totalCtrSum += parseSheetNumber(row['CTR (Link Click-Through Rate)']);
      rowCount++;
    });

    const ctr = rowCount > 0 ? totalCtrSum / rowCount : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
    const costPerMsg = msgs > 0 ? spend / msgs : 0;
    const connectRate = clicks > 0 ? (lpViews / clicks) * 100 : 0;

    return { spend, impressions, reach, clicks, msgs, ctr, cpc, cpm, costPerMsg, pageEngagement, lpViews, connectRate };
  }, [filteredCampaignData]);

  // Gender Data Logic...
  const genderChartData = useMemo(() => {
    const map = new Map();
    filteredGenderData.forEach(row => {
      const gender = row['Gender'] || 'Desconhecido';
      const results = parseSheetNumber(row['Messaging Conversations Started']);
      map.set(gender, (map.get(gender) || 0) + results);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredGenderData]);

  const genderTotals = useMemo(() => {
    let female = 0, male = 0;
    filteredGenderData.forEach(row => {
      const gender = (row['Gender'] || '').toLowerCase();
      const val = parseSheetNumber(row['Messaging Conversations Started']);
      if (gender.includes('female') || gender.includes('mulher') || gender.includes('women')) female += val;
      else if (gender.includes('male') || gender.includes('homem') || gender.includes('man')) male += val;
    });
    return { female, male };
  }, [filteredGenderData]);

  const ageChartData = useMemo(() => {
    const map = new Map();
    filteredGenderData.forEach(row => {
      const age = row['Age'] || 'Desconhecido';
      const results = parseSheetNumber(row['Messaging Conversations Started']);
      map.set(age, (map.get(age) || 0) + results);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [filteredGenderData]);

  // Creative Aggregation Logic...
  const aggregatedCreatives = useMemo(() => {
    const map = new Map<string, { 
      adName: string, clicks: number, impressions: number, msgs: number, spend: number, reach: number, 
      video3Sec: number, video75: number, video95: number,
      pageEngagement: number, lpViews: number
    }>();

    filteredCreativeData.forEach(row => {
      const name = row['Ad Name'];
      if (!name) return;
      const current = map.get(name) || { 
        adName: name, clicks: 0, impressions: 0, msgs: 0, spend: 0, reach: 0, 
        video3Sec: 0, video75: 0, video95: 0,
        pageEngagement: 0, lpViews: 0
      };

      current.clicks += parseSheetNumber(row['Link Clicks']);
      current.impressions += parseSheetNumber(row['Impressions']);
      current.msgs += parseSheetNumber(row['Messaging Conversations Started']);
      current.spend += parseSheetNumber(row['Amount Spent']);
      current.reach += parseSheetNumber(row['Reach']); 
      current.pageEngagement += parseSheetNumber(row['Page Engagement']);
      current.lpViews += parseSheetNumber(row['Landing Page Views']);
      
      current.video3Sec += parseSheetNumber(row['3-Second Video Views'] || row['3-Second Video Plays']);
      current.video75 += parseSheetNumber(row['Video Watches at 75%'] || row['Video Plays at 75%']);
      current.video95 += parseSheetNumber(row['Video Watches at 95%'] || row['Video Plays at 95%']);

      map.set(name, current);
    });

    return Array.from(map.values()).map(item => ({
      ...item,
      ctr: item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0,
      cpc: item.clicks > 0 ? item.spend / item.clicks : 0,
      cpm: item.impressions > 0 ? (item.spend / item.impressions) * 1000 : 0,
      connectRate: item.clicks > 0 ? (item.lpViews / item.clicks) * 100 : 0,
      impactRate: item.impressions > 0 ? (item.video3Sec / item.impressions) * 100 : 0,
      storyRate: item.impressions > 0 ? (item.video75 / item.impressions) * 100 : 0,
      offerRate: item.impressions > 0 ? (item.video95 / item.impressions) * 100 : 0,
      ctaRate: item.video95 > 0 ? (item.clicks / item.video95) * 100 : 0,
    }));
  }, [filteredCreativeData]);

  const top3Ctr = useMemo(() => [...aggregatedCreatives].sort((a,b) => b.ctr - a.ctr).slice(0,3), [aggregatedCreatives]);
  const top3Results = useMemo(() => [...aggregatedCreatives].sort((a,b) => b.msgs - a.msgs).slice(0,3), [aggregatedCreatives]);
  const top3ConnectRate = useMemo(() => [...aggregatedCreatives].sort((a,b) => b.connectRate - a.connectRate).slice(0,3), [aggregatedCreatives]);

  // Aggregation for Campaigns (For the main table)
  const aggregatedCampaignsForTable = useMemo(() => {
    const map = new Map<string, { 
        name: string, spend: number, clicks: number, impressions: number, 
        msgs: number, lpViews: number, reach: number 
    }>();

    filteredCampaignData.forEach(row => {
        const name = row['Campaign Name'];
        if (!name) return;
        const current = map.get(name) || { name, spend: 0, clicks: 0, impressions: 0, msgs: 0, lpViews: 0, reach: 0 };
        
        current.spend += parseSheetNumber(row['Amount Spent']);
        current.clicks += parseSheetNumber(row['Link Clicks']);
        current.impressions += parseSheetNumber(row['Impressions']);
        current.msgs += parseSheetNumber(row['Messaging Conversations Started']);
        current.lpViews += parseSheetNumber(row['Landing Page Views']);
        // Reach is tricky to sum, usually we take max or sum if days are unique, but sum is approx ok for display
        current.reach += parseSheetNumber(row['Reach']); 

        map.set(name, current);
    });
    
    return Array.from(map.values()).map(c => ({
        ...c,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        connectRate: c.clicks > 0 ? (c.lpViews / c.clicks) * 100 : 0,
        cpr: c.msgs > 0 ? c.spend / c.msgs : 0
    })).sort((a,b) => b.spend - a.spend); // Sort by spend default
  }, [filteredCampaignData]);

  // Aggregation for Top 3 Charts
  const topCampaignsByConv = useMemo(() => {
    const data = aggregatedCampaignsForTable.map(c => ({
        ...c,
        convRate: c.clicks > 0 ? (c.msgs / c.clicks) * 100 : 0
    }));
    return data
      .filter(c => c.clicks > 5) 
      .sort((a, b) => b.convRate - a.convRate)
      .slice(0, 3);
  }, [aggregatedCampaignsForTable]);


  // Funnel Rankings... (Existing Code)
  const funnelRankings = useMemo(() => {
    const minImp = 20; 
    
    const impact = [...aggregatedCreatives].filter(c => c.impressions > minImp).sort((a,b) => b.impactRate - a.impactRate).slice(0, 5);
    const story = [...aggregatedCreatives].filter(c => c.impressions > minImp).sort((a,b) => b.storyRate - a.storyRate).slice(0, 5);
    const offer = [...aggregatedCreatives].filter(c => c.impressions > minImp).sort((a,b) => b.offerRate - a.offerRate).slice(0, 5);
    const cta = [...aggregatedCreatives].filter(c => c.video95 > 0).sort((a,b) => b.ctaRate - a.ctaRate).slice(0, 5);

    return { impact, story, offer, cta };
  }, [aggregatedCreatives]);

  // Export
  const handleExportCsv = () => {
    let dataToExport: any[] = [];
    let fileName = 'export_mvi';

    switch(activeTab) {
      case 'campaign': dataToExport = filteredCampaignData; fileName = 'mvi_campanhas'; break;
      case 'gender': dataToExport = filteredGenderData; fileName = 'mvi_genero_publico'; break;
      case 'creative': dataToExport = aggregatedCreatives; fileName = 'mvi_criativos_agregado'; break;
    }

    if (dataToExport.length === 0) {
      alert("Nenhum dado disponível para exportar na aba atual com os filtros selecionados.");
      return;
    }

    const headers = Object.keys(dataToExport[0]);
    const csvRows = [
      headers.join(','), 
      ...dataToExport.map(row => {
        return headers.map(fieldName => {
          const value = row[fieldName]?.toString() || '';
          const escaped = value.replace(/"/g, '""');
          return `"${escaped}"`;
        }).join(',');
      })
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearFilters = () => {
    setSelectedMonth(''); 
    setDateRange({ start: '', end: '' });
    setSelectedCampaign('');
    setSelectedAdSet('');
  };
  
  const hasActiveFilters = selectedMonth !== '' || dateRange.start !== '' || dateRange.end !== '' || selectedCampaign !== '' || selectedAdSet !== '';
  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMonth(e.target.value);
    setDateRange({ start: '', end: '' });
  };
  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
    setSelectedMonth('');
  };
  
  const debugData = debugTab === 'campaign' ? campaignData : debugTab === 'gender' ? genderData : creativeData;
  const pulseStyle = `
    @keyframes subtle-pulse {
      0%, 100% { box-shadow: 0 0 0 0px rgba(234, 179, 8, 0.4); transform: scale(1); }
      50% { box-shadow: 0 0 0 4px rgba(234, 179, 8, 0.1); transform: scale(1.02); }
    }
    .champion-pulse {
      animation: subtle-pulse 3s infinite;
      border-color: rgba(234, 179, 8, 0.8) !important;
      background: linear-gradient(to bottom right, rgba(234, 179, 8, 0.15), rgba(0,0,0,0));
    }
    .metric-card-glow {
       box-shadow: 0 0 10px rgba(59, 130, 246, 0.1);
    }
  `;

  const toggleCampaignExpand = (campaignName: string) => {
    if (expandedCampaign === campaignName) {
      setExpandedCampaign(null);
    } else {
      setExpandedCampaign(campaignName);
    }
  };

  const TrendIndicator = ({ current, previous, inverse = false }: { current: number, previous: number, inverse?: boolean }) => {
     if (previous === 0) return <span className="text-zinc-600">-</span>;
     
     const diff = current - previous;
     const percentage = (diff / previous) * 100;
     const isGood = inverse ? percentage < 0 : percentage > 0;
     
     if (Math.abs(percentage) < 1) return <span className="text-zinc-500 text-[10px]"><Minus size={10} className="inline"/> 0%</span>;

     const colorClass = isGood ? 'text-emerald-500' : 'text-red-500';
     const Icon = percentage > 0 ? TrendingUp : TrendingDown;

     return (
        <span className={`${colorClass} text-[10px] font-bold flex items-center gap-0.5`}>
           <Icon size={10} /> {Math.abs(percentage).toFixed(1)}%
        </span>
     );
  };

  if (sheets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-zinc-900 rounded-xl border border-zinc-800 p-8 text-center">
        <div className="bg-zinc-800 p-4 rounded-full mb-4">
           <FileSpreadsheet size={48} className="text-zinc-500" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Configuração Necessária</h3>
        <p className="text-zinc-400 max-w-md mb-6">
          Nenhuma planilha configurada. Vá em <strong>Configurações</strong> para adicionar links do Google Sheets.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <style>{pulseStyle}</style>

      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-lg">
        <div className="flex items-center gap-3 w-full xl:w-auto border-b xl:border-0 border-zinc-800 pb-4 xl:pb-0">
          <div className="p-2 bg-purple-500/10 rounded-lg shrink-0">
             <FileSpreadsheet className="text-purple-500" size={24} />
          </div>
          <div className="flex-1">
             <h3 className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-1">
               Base de Dados Selecionada
             </h3>
             <div className="relative">
                <select 
                   value={selectedSheetId} 
                   onChange={handleSheetChange}
                   className="bg-zinc-950 border border-zinc-700 text-white font-medium rounded-lg py-1.5 pl-3 pr-8 text-sm focus:ring-1 focus:ring-purple-500 outline-none w-full xl:min-w-[250px] appearance-none cursor-pointer hover:bg-zinc-800 transition-colors"
                >
                   {sheets.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                   ))}
                </select>
                <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-zinc-500">
                   <ChevronDown size={14} />
                </div>
             </div>
             {lastUpdated && (
                <p className="text-[10px] text-zinc-600 mt-1">
                   Atualizado: {lastUpdated.toLocaleTimeString()}
                </p>
             )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col gap-3 w-full xl:w-auto">
             <div className="flex flex-col sm:flex-row flex-wrap items-center gap-2 justify-end w-full">
               
               <div className="hidden sm:flex items-center gap-2 text-zinc-400 bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-800">
                  <Filter size={14} className="text-primary-500" />
                  <span className="text-xs uppercase font-bold tracking-wider">Filtros</span>
               </div>
               
               <div className="relative w-full sm:w-48">
                 <select
                    value={selectedCampaign}
                    onChange={(e) => setSelectedCampaign(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 pl-3 pr-8 text-xs text-white focus:ring-1 focus:ring-primary-500 outline-none appearance-none cursor-pointer"
                  >
                    <option value="">Todas Campanhas</option>
                    {uniqueCampaigns.map((c, i) => (
                      <option key={i} value={c}>{c}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-zinc-500">
                    <Megaphone size={12} />
                  </div>
               </div>

               <div className="relative w-full sm:w-40">
                 <select
                    value={selectedAdSet}
                    onChange={(e) => setSelectedAdSet(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 pl-3 pr-8 text-xs text-white focus:ring-1 focus:ring-primary-500 outline-none appearance-none cursor-pointer"
                  >
                    <option value="">Todos Conjuntos</option>
                    {uniqueAdSets.map((c, i) => (
                      <option key={i} value={c}>{c}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-zinc-500">
                    <Grid size={12} />
                  </div>
               </div>

               <select
                  value={selectedMonth}
                  onChange={handleMonthChange}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-3 text-xs text-white focus:ring-1 focus:ring-primary-500 outline-none w-full sm:w-32"
                >
                  <option value="">Todos Meses</option>
                  {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>

                <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                  <input 
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => handleDateRangeChange('start', e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-2 text-xs text-white outline-none w-full [color-scheme:dark]"
                  />
                  <input 
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => handleDateRangeChange('end', e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-2 text-xs text-white outline-none w-full [color-scheme:dark]"
                  />
                </div>
             </div>

             <div className="flex gap-2 w-full justify-end border-t border-zinc-800 pt-3 xl:border-0 xl:pt-0">
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 transition-colors text-xs flex items-center gap-1">
                    <X size={12} /> Limpar
                  </button>
                )}

               <button 
                 onClick={fetchData} 
                 disabled={loading}
                 className="p-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                 title="Forçar Atualização"
               >
                 <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                 {loading && <span className="text-xs">Carregando...</span>}
               </button>

               <button 
                 onClick={handleExportCsv}
                 className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                 title={`Exportar CSV (${activeTab})`}
               >
                 <Download size={14} />
               </button>

               <button 
                 onClick={() => setShowDebug(!showDebug)} 
                 className={`p-2 rounded-lg transition-colors ${showDebug ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                 title="Modo Debug / Inspeção"
               >
                 <Bug size={14} />
               </button>
             </div>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3 text-red-400">
           <AlertTriangle size={24} />
           <p className="text-sm">{error}</p>
        </div>
      )}

      {/* DEBUG PANEL */}
      {showDebug && (
        <div className="bg-black/80 backdrop-blur border border-yellow-500/30 p-6 rounded-xl font-mono text-xs text-zinc-300 space-y-6 animate-in slide-in-from-top-4">
           <div className="flex items-center gap-2 text-yellow-500 font-bold border-b border-yellow-500/20 pb-2">
             <Bug size={16} /> 
             <h3>PAINEL DE DEPURAÇÃO DE DADOS</h3>
           </div>
           
           <div className="flex gap-2">
             <button onClick={() => setDebugTab('campaign')} className={`px-3 py-1 rounded ${debugTab === 'campaign' ? 'bg-yellow-500 text-black font-bold' : 'bg-zinc-800'}`}>Campanha</button>
             <button onClick={() => setDebugTab('gender')} className={`px-3 py-1 rounded ${debugTab === 'gender' ? 'bg-yellow-500 text-black font-bold' : 'bg-zinc-800'}`}>Gênero (Público)</button>
             <button onClick={() => setDebugTab('creative')} className={`px-3 py-1 rounded ${debugTab === 'creative' ? 'bg-yellow-500 text-black font-bold' : 'bg-zinc-800'}`}>Criativos</button>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-zinc-500 font-bold mb-2">1. SHEET SELECIONADO</h4>
                <div className="space-y-1 bg-zinc-900 p-3 rounded border border-zinc-800 overflow-hidden text-[10px] break-all">
                  <p><span className="text-blue-400">Nome:</span> {currentSheet?.name}</p>
                  <p><span className="text-blue-400">URL Ativa:</span> {activeUrl || 'Nenhuma'}</p>
                </div>

                <h4 className="text-zinc-500 font-bold mt-4 mb-2">2. STATUS DO DATASET ATUAL: <span className="text-yellow-400 uppercase">{debugTab}</span></h4>
                <div className="space-y-1 bg-zinc-900 p-3 rounded border border-zinc-800">
                  <p>Registros Totais: <span className="text-white">{debugData.length}</span></p>
                </div>
              </div>

              <div>
                <h4 className="text-zinc-500 font-bold mb-2">3. CABEÇALHOS DETECTADOS (Linha 1)</h4>
                <div className="bg-zinc-900 p-3 rounded border border-zinc-800 overflow-x-auto">
                   <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="font-bold text-yellow-500 border-b border-zinc-700 pb-1">NOME DO CAMPO (Header)</div>
                      <div className="font-bold text-green-500 border-b border-zinc-700 pb-1">VALOR (Exemplo Linha 1)</div>
                      
                      {debugData.length > 0 ? Object.keys(debugData[0]).map((key, i) => (
                        <React.Fragment key={i}>
                          <div className="text-zinc-300 break-words pr-2">{key}</div>
                          <div className="text-zinc-500 break-words border-l border-zinc-800 pl-2">{String(debugData[0][key]).substring(0, 50)}</div>
                        </React.Fragment>
                      )) : (
                        <div className="col-span-2 text-red-500 py-2">Nenhum dado encontrado neste dataset. Verifique o link.</div>
                      )}
                   </div>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* Main KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-6">
        <KpiCard label="Investimento" value={formatCurrency(summary.spend)} icon={<DollarSign size={16} />} color="blue" />
        <KpiCard label="Impressões" value={formatNumber(summary.impressions)} icon={<Eye size={16} />} color="zinc" />
        <KpiCard label="Cliques (Link)" value={formatNumber(summary.clicks)} icon={<MousePointer2 size={16} />} color="zinc" />
        <KpiCard label="CTR (Médio)" value={`${summary.ctr.toFixed(2)}%`} icon={<Percent size={16} />} color="emerald" />
        <KpiCard label="CPC (Médio)" value={formatCurrency(summary.cpc)} icon={<Target size={16} />} color="zinc" />
        <KpiCard label="CPM (Médio)" value={formatCurrency(summary.cpm)} icon={<Layers size={16} />} color="zinc" />
        <KpiCard label="Conversas" value={formatNumber(summary.msgs)} icon={<MessageCircle size={16} />} color="green" />
        <KpiCard label="Custo/Conv." value={formatCurrency(summary.costPerMsg)} icon={<DollarSign size={16} />} color="green" />
      </div>

      {/* NEW METRICS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex items-center justify-between shadow-lg">
           <div>
              <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Page Engagement</p>
              <h3 className="text-2xl font-bold text-white">{formatNumber(summary.pageEngagement)}</h3>
           </div>
           <div className="p-3 bg-purple-500/10 rounded-full text-purple-500">
              <ThumbsUp size={24} />
           </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex items-center justify-between shadow-lg">
           <div>
              <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Connect Rate (LP Views / Clicks)</p>
              <h3 className="text-2xl font-bold text-orange-500">{summary.connectRate.toFixed(1)}%</h3>
              <p className="text-xs text-zinc-500 mt-1">Total LP Views: {formatNumber(summary.lpViews)}</p>
           </div>
           <div className="p-3 bg-orange-500/10 rounded-full text-orange-500">
              <Link2 size={24} />
           </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-zinc-800 flex gap-6 overflow-x-auto">
        <TabButton active={activeTab === 'campaign'} onClick={() => setActiveTab('campaign')} icon={<BarChart2 size={18} />} label="Visão Geral" />
        <TabButton active={activeTab === 'gender'} onClick={() => setActiveTab('gender')} icon={<Users size={18} />} label="Público (Gênero/Idade)" />
        <TabButton active={activeTab === 'creative'} onClick={() => setActiveTab('creative')} icon={<Image size={18} />} label="Performance Criativos" />
      </div>

      {/* TAB CONTENT */}
      <div className="min-h-[400px]">
        
        {/* TAB 1: CAMPAIGN OVERVIEW */}
        {activeTab === 'campaign' && (
          <div className="space-y-6">
               
               {/* 1. Top 3 Campaigns (Conversion Rate) */}
               <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 relative overflow-hidden">
                  <div className="flex items-center gap-2 mb-4 relative z-10">
                    <Zap className="text-yellow-500" size={20} />
                    <h4 className="text-white font-semibold">Top 3 Campanhas (Taxa Conv. Leads)</h4>
                  </div>
                  {/* Champion Highlight BG */}
                  {topCampaignsByConv.length > 0 && (
                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
                  )}

                  <div className="h-[200px] w-full relative z-10">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <BarChart data={topCampaignsByConv} layout="vertical" margin={{left: 40, right: 20}}>
                         <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                         <XAxis type="number" stroke="#71717a" />
                         <YAxis 
                            dataKey="name" 
                            type="category" 
                            stroke="#fff" 
                            width={200} 
                            tickFormatter={(val) => val.length > 50 ? val.substring(0, 50) + '...' : val} 
                         />
                         <Tooltip 
                            contentStyle={{backgroundColor: '#18181b', borderColor: '#3f3f46'}} 
                            formatter={(val:number) => val.toFixed(2) + '%'} 
                         />
                         <Bar dataKey="convRate" fill="#eab308" radius={[0, 4, 4, 0]} name="Conv. %" barSize={32}>
                            {topCampaignsByConv.map((entry, index) => (
                                <Cell key={index} fill={index === 0 ? '#eab308' : '#713f12'} />
                            ))}
                         </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
               </div>

               {/* 2. Total Campaigns Table */}
               <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
               <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
                  <h4 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
                    <Grid size={16} /> Performance por Campanha (Mês Atual)
                  </h4>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-xs text-zinc-400">
                   <thead className="bg-zinc-950 text-zinc-200 uppercase">
                      <tr>
                        <th className="px-4 py-4 w-10"></th>
                        <th className="px-4 py-4">Campanha</th>
                        <th className="px-4 py-4 text-right">Valor Gasto</th>
                        <th className="px-4 py-4 text-right">Conversas</th>
                        <th className="px-4 py-4 text-right">Custo/Res.</th>
                        <th className="px-4 py-4 text-right">CTR</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-zinc-800">
                      {aggregatedCampaignsForTable.length === 0 ? (
                        <tr><td colSpan={7} className="px-6 py-8 text-center">Nenhum dado encontrado para o período.</td></tr>
                      ) : (
                        aggregatedCampaignsForTable.map((row, i) => {
                          const isExpanded = expandedCampaign === row.name;
                          const weeklyStats = isExpanded ? calculateWeeklyStats(row.name) : [];

                          return (
                            <React.Fragment key={i}>
                            <tr 
                               className={`hover:bg-zinc-800/50 cursor-pointer transition-colors ${isExpanded ? 'bg-zinc-800/30' : ''}`}
                               onClick={() => toggleCampaignExpand(row.name)}
                            >
                              <td className="px-4 py-4 text-center">
                                 {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </td>
                              <td className="px-4 py-4 font-medium text-white max-w-[200px] overflow-hidden text-ellipsis" title={row.name}>
                                 {row.name}
                              </td>
                              <td className="px-4 py-4 text-right text-emerald-500 font-medium">
                                {formatCurrency(row.spend)}
                              </td>
                              <td className="px-4 py-4 text-right font-bold text-white">{formatNumber(row.msgs)}</td>
                              <td className="px-4 py-4 text-right text-blue-400">{formatCurrency(row.cpr)}</td>
                              <td className="px-4 py-4 text-right">{row.ctr.toFixed(2)}%</td>
                            </tr>
                            {isExpanded && (
                               <tr className="bg-black/40 animate-in slide-in-from-top-2 duration-300">
                                  <td colSpan={6} className="p-4">
                                     <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                        {weeklyStats.map((week, idx) => {
                                           // Compare with previous week (if exists)
                                           const prevWeek = idx > 0 ? weeklyStats[idx - 1] : undefined;
                                           
                                           // Format date range nicely
                                           const sDate = new Date(week.startDate);
                                           const eDate = new Date(week.endDate);
                                           const dateLabel = `De ${sDate.getDate().toString().padStart(2,'0')}/${(sDate.getMonth()+1).toString().padStart(2,'0')} a ${eDate.getDate().toString().padStart(2,'0')}/${(eDate.getMonth()+1).toString().padStart(2,'0')}/${eDate.getFullYear()}`;

                                           return (
                                              <div key={idx} className="bg-zinc-900/80 border border-blue-900/30 rounded-lg p-3 shadow-lg metric-card-glow ring-1 ring-blue-500/20">
                                                 <div className="border-b border-zinc-800 pb-2 mb-2">
                                                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{dateLabel}</p>
                                                 </div>
                                                 
                                                 <div className="space-y-3">
                                                    <div className="flex justify-between items-end">
                                                       <div>
                                                          <p className="text-[10px] text-zinc-500 uppercase">Investimento</p>
                                                          <p className="text-sm font-bold text-white">{formatCurrency(week.spend)}</p>
                                                       </div>
                                                       {prevWeek && <TrendIndicator current={week.spend} previous={prevWeek.spend} />}
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2">
                                                       <div>
                                                          <p className="text-[10px] text-zinc-500 uppercase">CTR (Todos)</p>
                                                          <div className="flex items-center gap-1">
                                                            <p className="text-sm font-bold text-white">{week.ctrAll.toFixed(2)}%</p>
                                                            {prevWeek && <TrendIndicator current={week.ctrAll} previous={prevWeek.ctrAll} />}
                                                          </div>
                                                       </div>
                                                       <div>
                                                          <p className="text-[10px] text-zinc-500 uppercase">CTR (Link)</p>
                                                          <div className="flex items-center gap-1">
                                                            <p className="text-sm font-bold text-zinc-300">{week.ctr.toFixed(2)}%</p>
                                                            {prevWeek && <TrendIndicator current={week.ctr} previous={prevWeek.ctr} />}
                                                          </div>
                                                       </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2">
                                                       <div>
                                                          <p className="text-[10px] text-zinc-500 uppercase">CPM</p>
                                                          <div className="flex items-center gap-1">
                                                            <p className="text-sm font-bold text-white">{formatCurrency(week.cpm)}</p>
                                                            {prevWeek && <TrendIndicator current={week.cpm} previous={prevWeek.cpm} inverse />}
                                                          </div>
                                                       </div>
                                                       <div>
                                                          <p className="text-[10px] text-zinc-500 uppercase">Resultados</p>
                                                          <div className="flex items-center gap-1">
                                                            <p className="text-sm font-bold text-white">{week.conversations}</p>
                                                            {prevWeek && <TrendIndicator current={week.conversations} previous={prevWeek.conversations} />}
                                                          </div>
                                                       </div>
                                                    </div>

                                                    <div>
                                                       <p className="text-[10px] text-zinc-500 uppercase">Custo por Conversa</p>
                                                       <div className="flex items-center gap-2">
                                                          <p className="text-lg font-bold text-white">{formatCurrency(week.cpr)}</p>
                                                          {prevWeek && <TrendIndicator current={week.cpr} previous={prevWeek.cpr} inverse />}
                                                       </div>
                                                    </div>
                                                 </div>
                                              </div>
                                           );
                                        })}
                                        {weeklyStats.length === 0 && (
                                           <div className="col-span-4 text-center py-8 text-zinc-500 text-xs">
                                              Dados insuficientes para gerar histórico de 4 semanas.
                                           </div>
                                        )}
                                     </div>
                                  </td>
                               </tr>
                            )}
                            </React.Fragment>
                          );
                        })
                      )}
                   </tbody>
                 </table>
               </div>
             </div>
          </div>
        )}

        {/* TAB 2: GENDER & AGE */}
        {activeTab === 'gender' && (
           <div className="space-y-6">
               {/* NEW: Gender Totals Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl flex items-center justify-between border-l-4 border-l-pink-500">
                  <div>
                    <p className="text-xs font-bold text-zinc-400 uppercase">Mulheres (Msg)</p>
                    <h3 className="text-2xl font-bold text-white">{formatNumber(genderTotals.female)}</h3>
                  </div>
                  <Users className="text-pink-500" />
               </div>
               <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl flex items-center justify-between border-l-4 border-l-blue-500">
                  <div>
                    <p className="text-xs font-bold text-zinc-400 uppercase">Homens (Msg)</p>
                    <h3 className="text-2xl font-bold text-white">{formatNumber(genderTotals.male)}</h3>
                  </div>
                  <Users className="text-blue-500" />
               </div>
            </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gender Chart */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                 <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <Users size={20} className="text-primary-500" />
                    Distribuição por Gênero (Conversas)
                 </h3>
                 <div className="h-[300px] w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                       <PieChart>
                          <Pie data={genderChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                             {genderChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#ec4899' : '#3b82f6'} />
                             ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', color: '#fff' }} />
                          <Legend />
                       </PieChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              {/* Age Chart */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                 <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <BarChart2 size={20} className="text-primary-500" />
                    Faixa Etária (Conversas)
                 </h3>
                 <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                       <BarChart data={ageChartData} layout="vertical" margin={{ left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                          <XAxis type="number" stroke="#71717a" />
                          <YAxis dataKey="name" type="category" stroke="#fff" width={60} />
                          <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', color: '#fff' }} cursor={{fill: '#ffffff10'}} />
                          <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>
           </div>
        )}

        {/* TAB 3: CREATIVE PERFORMANCE */}
        {activeTab === 'creative' && (
           <div className="space-y-8">
               {/* 1. FUNIL M.V.I (IMPACTO -> CTA) */}
             <div className="space-y-4">
                <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-600 flex items-center gap-2">
                  <Medal size={24} className="text-yellow-500" /> 
                  FUNIL M.V.I (Top 5 Criativos)
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                  
                  {/* Bloco 1: IMPACTO (3s / Imp) */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col h-full">
                     <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-800">
                        <Zap size={18} className="text-blue-400" />
                        <h4 className="font-bold text-zinc-300 text-sm">IMPACTO (3s/Imp)</h4>
                     </div>
                     <div className="space-y-3 flex-1">
                        {funnelRankings.impact.map((item, idx) => (
                           <div key={idx} className={`p-3 rounded-lg flex justify-between items-center text-xs ${idx === 0 ? 'champion-pulse border border-yellow-500/30' : 'bg-zinc-950 border border-zinc-800'}`}>
                              <div className="flex flex-col gap-0.5 max-w-[70%]">
                                 <span className={idx === 0 ? 'text-yellow-400 font-bold' : 'text-zinc-300'}>
                                   {idx === 0 && <Trophy size={10} className="inline mr-1 mb-0.5" />}
                                   {item.adName}
                                 </span>
                                 <span className="text-zinc-500">{formatNumber(item.video3Sec)} visualizações</span>
                              </div>
                              <span className={`font-bold ${idx === 0 ? 'text-yellow-400 text-lg' : 'text-blue-400'}`}>
                                {item.impactRate.toFixed(1)}%
                              </span>
                           </div>
                        ))}
                     </div>
                  </div>

                  {/* Bloco 2: HISTÓRIA (75% / Imp) */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col h-full">
                     <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-800">
                        <Video size={18} className="text-purple-400" />
                        <h4 className="font-bold text-zinc-300 text-sm">HISTÓRIA (75%/Imp)</h4>
                     </div>
                     <div className="space-y-3 flex-1">
                        {funnelRankings.story.map((item, idx) => (
                           <div key={idx} className={`p-3 rounded-lg flex justify-between items-center text-xs ${idx === 0 ? 'champion-pulse border border-yellow-500/30' : 'bg-zinc-950 border border-zinc-800'}`}>
                              <div className="flex flex-col gap-0.5 max-w-[70%]">
                                 <span className={idx === 0 ? 'text-yellow-400 font-bold' : 'text-zinc-300'}>
                                   {idx === 0 && <Trophy size={10} className="inline mr-1 mb-0.5" />}
                                   {item.adName}
                                 </span>
                                 <span className="text-zinc-500">{formatNumber(item.video75)} retenções (75%)</span>
                              </div>
                              <span className={`font-bold ${idx === 0 ? 'text-yellow-400 text-lg' : 'text-purple-400'}`}>
                                {item.storyRate.toFixed(1)}%
                              </span>
                           </div>
                        ))}
                     </div>
                  </div>

                  {/* Bloco 3: OFERTA (95% / Imp) */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col h-full">
                     <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-800">
                        <Target size={18} className="text-emerald-400" />
                        <h4 className="font-bold text-zinc-300 text-sm">OFERTA (95%/Imp)</h4>
                     </div>
                     <div className="space-y-3 flex-1">
                        {funnelRankings.offer.map((item, idx) => (
                           <div key={idx} className={`p-3 rounded-lg flex justify-between items-center text-xs ${idx === 0 ? 'champion-pulse border border-yellow-500/30' : 'bg-zinc-950 border border-zinc-800'}`}>
                              <div className="flex flex-col gap-0.5 max-w-[70%]">
                                 <span className={idx === 0 ? 'text-yellow-400 font-bold' : 'text-zinc-300'}>
                                   {idx === 0 && <Trophy size={10} className="inline mr-1 mb-0.5" />}
                                   {item.adName}
                                 </span>
                                 <span className="text-zinc-500">{formatNumber(item.video95)} retenções (95%)</span>
                              </div>
                              <span className={`font-bold ${idx === 0 ? 'text-yellow-400 text-lg' : 'text-emerald-400'}`}>
                                {item.offerRate.toFixed(1)}%
                              </span>
                           </div>
                        ))}
                     </div>
                  </div>

                  {/* Bloco 4: CTA (Clicks / 95%) */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col h-full">
                     <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-800">
                        <MousePointer2 size={18} className="text-pink-400" />
                        <h4 className="font-bold text-zinc-300 text-sm">CTA (Clicks/95%)</h4>
                     </div>
                     <div className="space-y-3 flex-1">
                        {funnelRankings.cta.map((item, idx) => (
                           <div key={idx} className={`p-3 rounded-lg flex justify-between items-center text-xs ${idx === 0 ? 'champion-pulse border border-yellow-500/30' : 'bg-zinc-950 border border-zinc-800'}`}>
                              <div className="flex flex-col gap-0.5 max-w-[70%]">
                                 <span className={idx === 0 ? 'text-yellow-400 font-bold' : 'text-zinc-300'}>
                                   {idx === 0 && <Trophy size={10} className="inline mr-1 mb-0.5" />}
                                   {item.adName}
                                 </span>
                                 <span className="text-zinc-500">{item.clicks} cliques / {item.video95} (95%)</span>
                              </div>
                              <span className={`font-bold ${idx === 0 ? 'text-yellow-400 text-lg' : 'text-pink-400'}`}>
                                {item.ctaRate.toFixed(1)}%
                              </span>
                           </div>
                        ))}
                     </div>
                  </div>

                </div>
             </div>

              {/* Top 3 Rankings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <RankingCard title="Top 3 CTR" data={top3Ctr} metricKey="ctr" suffix="%" color="blue" icon={<MousePointer2 size={18} />} />
                 <RankingCard title="Top 3 Conversas" data={top3Results} metricKey="msgs" suffix="" color="green" icon={<MessageCircle size={18} />} />
                 <RankingCard title="Top 3 Connect Rate" data={top3ConnectRate} metricKey="connectRate" suffix="%" color="orange" icon={<Link2 size={18} />} />
              </div>

              {/* Detailed Table */}
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                 <div className="p-4 border-b border-zinc-800">
                    <h3 className="font-bold text-white flex items-center gap-2">
                       <Image size={20} className="text-primary-500" /> Detalhamento de Criativos
                    </h3>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-zinc-400">
                       <thead className="bg-zinc-950 text-zinc-200 uppercase text-xs font-semibold">
                          <tr>
                             <th className="px-4 py-3">Nome do Criativo</th>
                             <th className="px-4 py-3 text-right text-blue-400">CTR</th>
                             <th className="px-4 py-3 text-right">Connect Rate</th>
                             <th className="px-4 py-3 text-right">Impacto (3s)</th>
                             <th className="px-4 py-3 text-right">Story (75%)</th>
                             <th className="px-4 py-3 text-right">Offer (95%)</th>
                             <th className="px-4 py-3 text-right text-emerald-500">Conversas</th>
                             <th className="px-4 py-3 text-right">Gasto</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-zinc-800">
                          {aggregatedCreatives.map((row, i) => (
                             <tr key={i} className="hover:bg-zinc-800/50">
                                <td className="px-4 py-3 font-medium text-white max-w-[250px] truncate" title={row.adName}>{row.adName}</td>
                                <td className="px-4 py-3 text-right font-bold text-blue-400">{row.ctr.toFixed(2)}%</td>
                                <td className="px-4 py-3 text-right text-orange-400 font-medium">{row.connectRate.toFixed(1)}%</td>
                                <td className="px-4 py-3 text-right">{row.impactRate.toFixed(1)}%</td>
                                <td className="px-4 py-3 text-right">{row.storyRate.toFixed(1)}%</td>
                                <td className="px-4 py-3 text-right">{row.offerRate.toFixed(1)}%</td>
                                <td className="px-4 py-3 text-right font-bold text-emerald-500">{row.msgs}</td>
                                <td className="px-4 py-3 text-right">{formatCurrency(row.spend)}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>
        )}

      </div>
    </div>
  );
};

// --- Subcomponents ---

const KpiCard = ({ label, value, icon, color }: { label: string, value: string, icon: React.ReactNode, color: string }) => {
   const colorClasses: Record<string, string> = {
      blue: 'text-blue-500 bg-blue-500/10',
      green: 'text-emerald-500 bg-emerald-500/10',
      emerald: 'text-emerald-400 bg-emerald-500/10',
      zinc: 'text-zinc-400 bg-zinc-800',
      orange: 'text-orange-500 bg-orange-500/10',
      purple: 'text-purple-500 bg-purple-500/10',
   };

   const activeClass = colorClasses[color] || colorClasses.zinc;
   const textColor = activeClass.split(' ')[0];

   return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between shadow-lg hover:border-zinc-700 transition-colors">
         <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">{label}</span>
            <div className={`p-1.5 rounded-md ${activeClass}`}>
               {icon}
            </div>
         </div>
         <span className={`text-xl font-bold ${textColor} truncate`}>{value}</span>
      </div>
   );
};

const TabButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
   <button 
      onClick={onClick}
      className={`flex items-center gap-2 pb-3 text-sm font-medium transition-colors relative ${active ? 'text-primary-500' : 'text-zinc-400 hover:text-white'}`}
   >
      {icon}
      {label}
      {active && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary-500 rounded-t-full"></span>}
   </button>
);

const RankingCard = ({ title, data, metricKey, suffix, color, icon }: any) => {
   // Dynamic colors for bars
   const getBarColor = (index: number) => {
      if (index === 0) return color === 'blue' ? 'bg-blue-500' : color === 'green' ? 'bg-emerald-500' : 'bg-orange-500';
      if (index === 1) return color === 'blue' ? 'bg-blue-600' : color === 'green' ? 'bg-emerald-600' : 'bg-orange-600';
      return color === 'blue' ? 'bg-blue-700' : color === 'green' ? 'bg-emerald-700' : 'bg-orange-700';
   };

   return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col">
         <h4 className="text-zinc-300 font-bold mb-4 flex items-center gap-2">
            {icon} {title}
         </h4>
         <div className="space-y-4 flex-1">
            {data.length === 0 ? <p className="text-zinc-500 text-sm">Sem dados</p> : data.map((item: any, i: number) => (
               <div key={i} className="relative">
                  <div className="flex justify-between text-xs mb-1">
                     <span className="text-white font-medium truncate max-w-[70%]">{item.adName}</span>
                     <span className="text-zinc-300 font-mono">{item[metricKey].toFixed(metricKey === 'msgs' ? 0 : 2)}{suffix}</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                     <div 
                        className={`h-full rounded-full ${getBarColor(i)}`} 
                        style={{ width: `${(item[metricKey] / (data[0][metricKey] || 1)) * 100}%` }}
                     ></div>
                  </div>
               </div>
            ))}
         </div>
      </div>
   );
};
