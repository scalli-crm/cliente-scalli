
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Users, DollarSign, Target, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { formatCurrency, formatNumber } from '../utils/formatters';

interface DeshDashboardProps {
  sheets: { id: string; name: string; url: string }[];
  dateRange: { start: string; end: string };
  selectedMonth: string;
}

// --- HELPERS ---
const parseSheetNumber = (val: string | undefined | number): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  let clean = val.replace(/[^\d,.-]/g, '');
  if (!clean) return 0;
  if (clean.includes(',')) {
    clean = clean.replace(/\./g, '');
    clean = clean.replace(',', '.');
  } 
  return parseFloat(clean) || 0;
};

const parseCSV = (text: string) => {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];
  // Parse headers safely
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
    const row = parseLine(lines[i]);
    if (row.length === headers.length) {
      const entry: any = {};
      headers.forEach((h, idx) => entry[h] = row[idx]);
      data.push(entry);
    }
  }
  return data;
};

export const DeshDashboard: React.FC<DeshDashboardProps> = ({ sheets, dateRange, selectedMonth }) => {
  const [loading, setLoading] = useState(true);
  const [crmData, setCrmData] = useState<{ leads: any[], sales: any[] }>({ leads: [], sales: [] });
  const [mviData, setMviData] = useState<any[]>([]);

  // Standard System Colors
  const colors = {
    brandBlue: '#3b82f6',   // blue-500
    brandOrange: '#f97316', // orange-500
    brandYellow: '#eab308', // yellow-500
    brandTeal: '#14b8a6',   // teal-500
    brandGreen: '#22c55e',  // green-500
  };

  useEffect(() => {
    fetchUnifiedData();
  }, [sheets]); 

  const fetchUnifiedData = async () => {
    setLoading(true);
    try {
        // 1. CRM DATA
        const { data: leads } = await supabase.from('leads').select('id, origem, created_at');
        const { data: sales } = await supabase.from('crm_opportunities').select('final_price, min_price, created_at, updated_at, status').eq('status', 'won');
        
        setCrmData({
            leads: leads || [],
            sales: sales || []
        });

        // 2. MVI DATA - Try to fetch from the first sheet available
        if (sheets.length > 0) {
            const urlMatch = sheets[0].url.match(/\/d\/([a-zA-Z0-9-_]+)/);
            const gidMatch = sheets[0].url.match(/[#&?]gid=([0-9]+)/);
            if (urlMatch) {
               const exportUrl = `https://docs.google.com/spreadsheets/d/${urlMatch[1]}/export?format=csv&gid=${gidMatch ? gidMatch[1] : '0'}`;
               const res = await fetch(exportUrl + `&t=${Date.now()}`);
               if (res.ok) {
                  const text = await res.text();
                  const parsed = parseCSV(text);
                  setMviData(parsed);
               }
            }
        }
    } catch (e) {
        console.error("Erro ao carregar dados unificados", e);
    } finally {
        setLoading(false);
    }
  };

  // --- FILTER LOGIC ---
  const isDateInFilter = (dateStr: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      
      if (selectedMonth !== '') {
          const filterMonth = parseInt(selectedMonth); 
          if (d.getMonth() !== filterMonth) return false;
          if (d.getFullYear() !== new Date().getFullYear()) return false;
      }

      if (dateRange.start) {
          const startDate = new Date(dateRange.start);
          if (d < startDate) return false;
      }
      if (dateRange.end) {
          const endDate = new Date(dateRange.end);
          endDate.setHours(23, 59, 59, 999);
          if (d > endDate) return false;
      }

      return true;
  };

  // --- CALCULATED METRICS ---
  const filteredMetrics = useMemo(() => {
      const filteredLeads = crmData.leads.filter(l => isDateInFilter(l.created_at));
      const filteredSales = crmData.sales.filter(s => isDateInFilter(s.updated_at || s.created_at)); 
      const totalRevenue = filteredSales.reduce((acc, curr) => acc + (curr.final_price || curr.min_price || 0), 0);

      let totalSpend = 0;
      mviData.forEach((r: any) => {
          const date = r['Day'];
          if (isDateInFilter(date)) {
              // Robust check for Spend Column (matches MVIMetrics logic)
              const spend = parseSheetNumber(r['Amount Spent'] || r['Valor Gasto'] || r['Cost'] || 0);
              totalSpend += spend;
          }
      });

      const conversionRate = filteredLeads.length > 0 ? ((filteredSales.length / filteredLeads.length) * 100) : 0;
      const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
      const cpl = filteredLeads.length > 0 ? totalSpend / filteredLeads.length : 0;
      const cac = filteredSales.length > 0 ? totalSpend / filteredSales.length : 0;
      const ticket = filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0;

      return {
          leadsCount: filteredLeads.length,
          salesCount: filteredSales.length,
          revenue: totalRevenue,
          spend: totalSpend,
          roas,
          conversionRate,
          cpl,
          cac,
          ticket
      };
  }, [crmData, mviData, dateRange, selectedMonth]);

  // --- CHART DATA ---
  const chartData = useMemo(() => {
      const merged = new Map();
      const showDays = selectedMonth !== '' || (dateRange.start && dateRange.end);

      const getKey = (dateStr: string) => {
          const d = new Date(dateStr);
          if (showDays) {
              return d.getDate().toString(); 
          }
          return d.toLocaleString('pt-BR', { month: 'short' }); 
      };

      if (!showDays) {
          for (let i=0; i<12; i++) {
             const d = new Date();
             d.setMonth(i);
             const key = d.toLocaleString('pt-BR', { month: 'short' });
             merged.set(key, { name: key, sales: 0, spend: 0, sortIdx: i });
          }
      }

      crmData.sales.filter(s => isDateInFilter(s.updated_at || s.created_at)).forEach(s => {
          const key = getKey(s.updated_at || s.created_at);
          if (!merged.has(key)) merged.set(key, { name: key, sales: 0, spend: 0, sortIdx: 0 });
          merged.get(key).sales += (s.final_price || s.min_price || 0);
      });

      mviData.forEach(r => {
          const date = r['Day'];
          if (isDateInFilter(date)) {
              const key = getKey(date);
              if (!merged.has(key)) merged.set(key, { name: key, sales: 0, spend: 0, sortIdx: 0 });
              merged.get(key).spend += parseSheetNumber(r['Amount Spent'] || r['Valor Gasto'] || r['Cost'] || 0);
          }
      });

      let res = Array.from(merged.values());
      
      if (!showDays) {
          res.sort((a,b) => a.sortIdx - b.sortIdx);
      } else {
          res.sort((a,b) => parseInt(a.name) - parseInt(b.name));
      }

      return res;
  }, [crmData, mviData, filteredMetrics]); 

  const leadSourceData = useMemo(() => {
      const counts: Record<string, number> = {};
      crmData.leads.filter(l => isDateInFilter(l.created_at)).forEach(l => {
          const origin = l.origem || 'Outros';
          counts[origin] = (counts[origin] || 0) + 1;
      });
      const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
      const top4 = sorted.slice(0, 4).map(s => ({ name: s[0], value: s[1] }));
      const others = sorted.slice(4).reduce((acc, curr) => acc + curr[1], 0);
      if (others > 0) top4.push({ name: 'Outros', value: others });
      return top4;
  }, [crmData, filteredMetrics]);

  const PIE_COLORS = [colors.brandBlue, colors.brandGreen, colors.brandOrange, colors.brandYellow, colors.brandTeal];

  if (loading && crmData.leads.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center h-96 text-zinc-500 gap-4">
              <RefreshCw className="animate-spin text-primary-500" size={32} />
              <p>Sincronizando dados de vendas e campanhas...</p>
          </div>
      );
  }

  // Common card style matching the system
  const cardClass = "bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl relative overflow-hidden group hover:border-zinc-700 transition-all duration-300";

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
        
        {/* METRICS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            
            {/* Leads Card */}
            <div className={cardClass}>
               <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-blue-500/10"></div>
               <div className="flex justify-between items-start relative z-10">
                  <span className="text-zinc-400 font-bold text-xs uppercase tracking-widest">Total Leads</span>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-500">
                     <Users size={20} />
                  </div>
               </div>
               <p className="text-4xl font-black mt-4 text-white relative z-10">{formatNumber(filteredMetrics.leadsCount)}</p>
            </div>

            {/* Sales Card */}
            <div className={cardClass}>
               <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-orange-500/10"></div>
               <div className="flex justify-between items-start relative z-10">
                  <span className="text-zinc-400 font-bold text-xs uppercase tracking-widest">Vendas</span>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-500/10 text-orange-500">
                     <Target size={20} />
                  </div>
               </div>
               <div className="mt-4 relative z-10">
                  <p className="text-4xl font-black text-white">{formatNumber(filteredMetrics.salesCount)}</p>
                  <span className="text-xs text-green-500 mt-1 flex items-center gap-1 font-bold bg-green-500/10 w-fit px-2 py-0.5 rounded">
                     <TrendingUp size={12} /> {filteredMetrics.conversionRate.toFixed(1)}% Conv.
                  </span>
               </div>
            </div>

            {/* Revenue Card */}
            <div className={cardClass}>
               <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-emerald-500/10"></div>
               <div className="flex justify-between items-start relative z-10">
                  <span className="text-zinc-400 font-bold text-xs uppercase tracking-widest">Receita</span>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-500">
                     <DollarSign size={20} />
                  </div>
               </div>
               <p className="text-3xl font-black mt-4 text-white relative z-10 truncate" title={formatCurrency(filteredMetrics.revenue)}>
                  {formatCurrency(filteredMetrics.revenue)}
               </p>
            </div>

            {/* ROAS & Spend */}
            <div className={`${cardClass} lg:col-span-2 flex items-center justify-around`}>
               <div className="text-center relative flex-1">
                  <div className="flex items-end justify-center space-x-1 h-8 mb-2">
                     <div className="w-1.5 bg-teal-500 rounded-full animate-pulse h-[60%]"></div>
                     <div className="w-1.5 bg-teal-500 rounded-full animate-pulse delay-75 h-[80%]"></div>
                     <div className="w-1.5 bg-teal-500 rounded-full animate-pulse delay-150 h-[40%]"></div>
                     <div className="w-1.5 bg-teal-500 rounded-full animate-pulse delay-200 h-[100%]"></div>
                  </div>
                  <p className={`text-sm font-bold ${filteredMetrics.roas >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>{filteredMetrics.roas.toFixed(2)}x</p>
                  <p className="text-2xl font-black text-white mt-1">ROAS</p>
                  <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider font-bold">Retorno / Gasto</p>
               </div>

               <div className="h-16 w-px bg-zinc-800"></div>

               <div className="text-center flex-1">
                  <div className="flex items-end justify-center space-x-1 h-8 mb-2">
                     <div className="w-1.5 bg-red-500 rounded-full h-[70%]"></div>
                     <div className="w-1.5 bg-red-500 rounded-full h-[50%]"></div>
                     <div className="w-1.5 bg-red-500 rounded-full h-[90%]"></div>
                     <div className="w-1.5 bg-red-500 rounded-full h-[60%]"></div>
                  </div>
                  <p className="text-sm font-bold text-red-400">Investido</p>
                  <p className="text-2xl font-black text-white mt-1 truncate">{formatCurrency(filteredMetrics.spend)}</p>
                  <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider font-bold">Mídia (Planilha)</p>
               </div>
            </div>

            {/* Performance Chart */}
            <div className={`${cardClass} lg:col-span-3`}>
               <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-white">Desempenho de Campanhas</h2>
                  <div className="flex gap-4 text-xs font-medium">
                     <span className="flex items-center gap-1 text-zinc-400"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Vendas</span>
                     <span className="flex items-center gap-1 text-zinc-400"><div className="w-2 h-2 rounded-full bg-red-500"></div> Gasto</span>
                  </div>
               </div>
               <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={chartData} margin={{top: 10, right: 10, left: 0, bottom: 0}}>
                        <defs>
                           <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                           </linearGradient>
                           <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                           </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis dataKey="name" stroke="#71717a" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                        <YAxis stroke="#71717a" tick={{fontSize: 12}} tickFormatter={(val) => `R$${val/1000}k`} axisLine={false} tickLine={false} />
                        <Tooltip 
                           contentStyle={{backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff', borderRadius: '8px'}} 
                           formatter={(val: number) => formatCurrency(val)}
                        />
                        <Area type="monotone" dataKey="sales" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSales)" strokeWidth={3} />
                        <Area type="monotone" dataKey="spend" stroke="#ef4444" fillOpacity={1} fill="url(#colorSpend)" strokeWidth={3} />
                     </AreaChart>
                  </ResponsiveContainer>
               </div>
            </div>

            {/* Lead Distribution */}
            <div className={`${cardClass} lg:col-span-2`}>
               <h2 className="text-lg font-bold text-white mb-6">Origem dos Leads</h2>
               <div className="flex flex-col sm:flex-row items-center gap-8 h-[250px]">
                  <div className="w-full h-full flex-shrink-0 relative">
                     <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                           <Pie
                              data={leadSourceData}
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                              stroke="none"
                           >
                              {leadSourceData.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                              ))}
                           </Pie>
                           <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '12px', color: '#a1a1aa'}} />
                           <Tooltip contentStyle={{backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff', borderRadius: '8px'}} />
                        </PieChart>
                     </ResponsiveContainer>
                  </div>
               </div>
            </div>

            {/* Secondary Metrics */}
            <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
               <MetricItem label="CPL (Custo/Lead)" value={formatCurrency(filteredMetrics.cpl)} icon={<Users size={16}/>} color="blue" />
               <MetricItem label="Ticket Médio" value={formatCurrency(filteredMetrics.ticket)} icon={<Target size={16}/>} color="teal" />
               <MetricItem label="CAC (Mídia)" value={formatCurrency(filteredMetrics.cac)} icon={<TrendingDown size={16}/>} color="orange" />
               <MetricItem label="Lucro (Mídia)" value={formatCurrency(filteredMetrics.revenue - filteredMetrics.spend)} icon={<DollarSign size={16}/>} color="yellow" />
            </div>

        </div>
    </div>
  );
};

const MetricItem = ({ label, value, icon, color }: any) => {
    const colors: any = {
        blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        teal: 'text-teal-500 bg-teal-500/10 border-teal-500/20',
        orange: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
        yellow: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
    };
    return (
        <div className={`p-5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors group shadow-lg`}>
            <div className="flex justify-between items-start mb-2">
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{label}</span>
                <div className={`p-1.5 rounded-md ${colors[color]}`}>{icon}</div>
            </div>
            <p className="text-xl font-black text-white">{value}</p>
        </div>
    );
};
