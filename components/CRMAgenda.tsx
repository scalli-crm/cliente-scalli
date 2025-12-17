
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { ScheduleEvent, Customer, CRMAppointmentReason } from '../types';
import { Calendar as CalendarIcon, Clock, User, Check, X, Edit2, ChevronLeft, ChevronRight, Plus, Search, MapPin, Video, Phone, Filter, MoreHorizontal, CalendarClock, CheckCircle2, ArrowRight, AlertCircle, Timer, ChevronDown, Sunrise, Layout } from 'lucide-react';
import { formatDate } from '../utils/formatters';

type ViewMode = 'board' | 'month' | 'week' | 'day';

export const CRMAgenda: React.FC = () => {
   // Data State
   const [events, setEvents] = useState<ScheduleEvent[]>([]);
   const [loading, setLoading] = useState(true);
   const [leads, setLeads] = useState<Customer[]>([]);
   const [appointmentReasons, setAppointmentReasons] = useState<CRMAppointmentReason[]>([]);
   
   // Calendar State
   const [currentDate, setCurrentDate] = useState(new Date());
   const [selectedDate, setSelectedDate] = useState(new Date());
   const [viewMode, setViewMode] = useState<ViewMode>('board'); // Default to Board View

   // Modal & Form State
   const [isCreateOpen, setIsCreateOpen] = useState(false);
   const [editingEventId, setEditingEventId] = useState<string | null>(null);
   const [createForm, setCreateForm] = useState({
      lead_id: '',
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      type: 'reuniao',
      obs: ''
   });
   const [filteredLeads, setFilteredLeads] = useState<Customer[]>([]);
   const [searchTerm, setSearchTerm] = useState('');
   const [savingCreate, setSavingCreate] = useState(false);
   
   // Postpone Menu State
   const [postponeMenuOpenId, setPostponeMenuOpenId] = useState<string | null>(null);

   // --- INITIALIZATION ---
   useEffect(() => {
      fetchSchedule();
      fetchAppointmentReasons();
   }, []);

   useEffect(() => {
      if (isCreateOpen && leads.length === 0) fetchLeads();
   }, [isCreateOpen]);

   useEffect(() => {
      if (searchTerm) {
         const lower = searchTerm.toLowerCase();
         setFilteredLeads(leads.filter(l => l.nome.toLowerCase().includes(lower) || l.telefone.includes(lower)));
      } else {
         setFilteredLeads(leads.slice(0, 50));
      }
   }, [searchTerm, leads]);

   // Close postpone menu on click outside
   useEffect(() => {
      const handleClickOutside = () => setPostponeMenuOpenId(null);
      if (postponeMenuOpenId) {
         window.addEventListener('click', handleClickOutside);
      }
      return () => window.removeEventListener('click', handleClickOutside);
   }, [postponeMenuOpenId]);

   // --- FETCHERS ---
   const fetchSchedule = async () => {
      setLoading(true);
      try {
         const { data } = await supabase
            .from('schedule')
            .select(`*, leads (nome, telefone, email), users (name)`)
            .neq('status', 'cancelado') // Hide cancelled events
            .order('data', { ascending: true })
            .order('hora', { ascending: true });
         
         if (data) {
            const mapped = data.map((item: any) => ({
               ...item,
               lead_nome: item.leads?.nome || 'Cliente',
               user_name: item.users?.name || null
            }));
            setEvents(mapped);
         }
      } catch (err) {
         console.error('Error fetching schedule:', err);
      } finally {
         setLoading(false);
      }
   };

   const fetchAppointmentReasons = async () => {
      const { data } = await supabase.from('crm_appointment_reasons').select('*').eq('active', true).order('name');
      if (data && data.length > 0) {
         setAppointmentReasons(data as any);
         setCreateForm(prev => ({ ...prev, type: data[0].name }));
      } else {
         setAppointmentReasons([
            { id: '1', name: 'Reunião Presencial', active: true },
            { id: '2', name: 'Videoconferência', active: true },
            { id: '3', name: 'Ligação', active: true }
         ]);
      }
   };

   const fetchLeads = async () => {
      const { data } = await supabase.from('leads').select('id, nome, telefone').order('created_at', { ascending: false });
      if (data) {
         setLeads(data as Customer[]);
         setFilteredLeads(data.slice(0, 50) as Customer[]);
      }
   };

   // --- ACTIONS ---
   const handleCreateSchedule = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!createForm.lead_id) { alert('Selecione um cliente.'); return; }
      setSavingCreate(true);
      try {
         const payload = {
            lead_id: createForm.lead_id,
            tipo: createForm.type,
            data: createForm.date,
            hora: createForm.time,
            observacao: createForm.obs,
            status: 'agendado'
         };

         if (editingEventId) {
            const { error } = await supabase.from('schedule').update(payload).eq('id', editingEventId);
            if (error) throw error;
         } else {
            const { error } = await supabase.from('schedule').insert([payload]);
            if (error) throw error;
            
            await supabase.from('lead_history').insert([{
               lead_id: createForm.lead_id,
               descricao: `Nova Agenda: ${createForm.type} para ${formatDate(createForm.date)} às ${createForm.time}`,
               categoria: 'agendamento'
            }]);
         }

         setIsCreateOpen(false);
         setEditingEventId(null);
         setCreateForm({
            lead_id: '',
            date: new Date().toISOString().split('T')[0],
            time: '09:00',
            type: 'reuniao',
            obs: ''
         });
         fetchSchedule();
      } catch (err: any) {
         alert('Erro ao salvar: ' + err.message);
      } finally {
         setSavingCreate(false);
      }
   };

   const handleEditEvent = (ev: ScheduleEvent) => {
      setEditingEventId(ev.id);
      setCreateForm({
         lead_id: ev.lead_id,
         date: ev.data,
         time: ev.hora,
         type: ev.tipo,
         obs: ev.observacao || ''
      });
      setIsCreateOpen(true);
   };

   const handleMarkDone = async (ev: ScheduleEvent) => {
      const newStatus = ev.status === 'realizado' ? 'agendado' : 'realizado';
      try {
         await supabase.from('schedule').update({ status: newStatus }).eq('id', ev.id);
         setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, status: newStatus } : e));
      } catch (err) {
         console.error(err);
      }
   };

   const handleSmartPostpone = async (ev: ScheduleEvent, type: '1h' | '2h' | 'tomorrow') => {
      const currentDateTime = new Date(`${ev.data}T${ev.hora}`);
      let newDate = new Date(currentDateTime);
      let logMsg = '';

      if (type === '1h') {
         newDate.setHours(newDate.getHours() + 1);
         logMsg = 'Adiado em 1 hora';
      } else if (type === '2h') {
         newDate.setHours(newDate.getHours() + 2);
         logMsg = 'Adiado em 2 horas';
      } else if (type === 'tomorrow') {
         newDate.setDate(newDate.getDate() + 1);
         newDate.setHours(9, 0, 0, 0); // Reset to 09:00 AM next day
         logMsg = 'Adiado para amanhã às 09:00';
      }

      const dateStr = newDate.toISOString().split('T')[0];
      const timeStr = newDate.toTimeString().slice(0, 5); // HH:MM

      try {
         await supabase.from('schedule').update({ data: dateStr, hora: timeStr }).eq('id', ev.id);
         await supabase.from('lead_history').insert([{
            lead_id: ev.lead_id,
            descricao: `Agenda reagendada: ${logMsg} (para ${formatDate(dateStr)} ${timeStr})`,
            categoria: 'agendamento'
         }]);
         fetchSchedule();
      } catch (err) {
         console.error("Erro ao adiar", err);
         alert("Erro ao adiar compromisso.");
      }
   };

   // --- CALENDAR LOGIC ---
   const getDaysInMonth = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const days = new Date(year, month + 1, 0).getDate();
      const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
      
      const res = [];
      for (let i = 0; i < firstDay; i++) res.push(null);
      for (let i = 1; i <= days; i++) res.push(new Date(year, month, i));
      return res;
   };

   const getWeekDays = (date: Date) => {
      const start = new Date(date);
      start.setDate(start.getDate() - start.getDay()); // Go to Sunday
      const res = [];
      for(let i=0; i<7; i++) {
         const d = new Date(start);
         d.setDate(start.getDate() + i);
         res.push(d);
      }
      return res;
   };

   const nextPeriod = () => {
      const newDate = new Date(currentDate);
      if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + 1);
      if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7);
      if (viewMode === 'day') newDate.setDate(newDate.getDate() + 1);
      setCurrentDate(newDate);
      if (viewMode === 'day') setSelectedDate(newDate);
   };

   const prevPeriod = () => {
      const newDate = new Date(currentDate);
      if (viewMode === 'month') newDate.setMonth(newDate.getMonth() - 1);
      if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7);
      if (viewMode === 'day') newDate.setDate(newDate.getDate() - 1);
      setCurrentDate(newDate);
      if (viewMode === 'day') setSelectedDate(newDate);
   };

   const isSameDay = (d1: Date, d2: Date) => {
      return d1.getFullYear() === d2.getFullYear() &&
             d1.getMonth() === d2.getMonth() &&
             d1.getDate() === d2.getDate();
   };

   const getEventsForDay = (date: Date) => {
      const dateStr = date.toISOString().split('T')[0];
      return events.filter(e => e.data === dateStr);
   };

   // --- EVENT STYLING & STATUS LOGIC ---
   const getEventTypeStyles = (type: string) => {
      const t = type.toLowerCase();
      if (t.includes('reuniao') || t.includes('presencial')) {
         return { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500', pill: 'bg-purple-500' };
      }
      if (t.includes('video') || t.includes('demo')) {
         return { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500', pill: 'bg-blue-500' };
      }
      if (t.includes('ligacao') || t.includes('call')) {
         return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500', pill: 'bg-emerald-500' };
      }
      return { bg: 'bg-zinc-800', text: 'text-zinc-400', border: 'border-zinc-500', pill: 'bg-zinc-500' };
   };

   const getEventIcon = (type: string) => {
      const t = type.toLowerCase();
      if (t.includes('reuniao') || t.includes('presencial')) return <MapPin size={14} />;
      if (t.includes('video') || t.includes('demo')) return <Video size={14} />;
      if (t.includes('ligacao') || t.includes('call')) return <Phone size={14} />;
      return <Clock size={14} />;
   };

   // 2. Status Calculado (Time Logic)
   const getEventStatus = (ev: ScheduleEvent) => {
      if (ev.status === 'realizado') {
         return { label: 'CONCLUÍDO', colorClass: 'text-emerald-500', bgClass: 'bg-emerald-500/10', borderClass: 'border-emerald-500', pulse: false, icon: CheckCircle2 };
      }

      const now = new Date();
      const eventTime = new Date(`${ev.data}T${ev.hora}`);
      const diffMinutes = (eventTime.getTime() - now.getTime()) / (1000 * 60);

      // Atrasado (Data/Hora já passou)
      if (diffMinutes < 0) {
         return { label: 'ATRASADA', colorClass: 'text-red-500', bgClass: 'bg-red-500/10', borderClass: 'border-red-500', pulse: true, icon: AlertCircle };
      }
      // Falta Pouco (< 60 min)
      if (diffMinutes <= 60) {
         return { label: 'FALTA POUCO', colorClass: 'text-orange-500', bgClass: 'bg-orange-500/10', borderClass: 'border-orange-500', pulse: true, icon: Timer };
      }
      
      // Padrão (Agendado Futuro)
      return { label: 'AGENDADO', colorClass: 'text-zinc-400', bgClass: 'bg-zinc-800', borderClass: 'border-zinc-700', pulse: false, icon: CalendarClock };
   };

   // --- SUBCOMPONENT: Board Column ---
   const BoardColumn = ({ title, subTitle, dateObj, events }: { title: string, subTitle: string, dateObj: Date, events: ScheduleEvent[] }) => (
      <div className="flex flex-col min-w-[320px] h-full">
         <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <span className="text-sm font-semibold text-zinc-500">{subTitle}</span>
         </div>
         <div className="flex-1 bg-zinc-900 border border-zinc-800 p-4 rounded-xl space-y-4 overflow-y-auto custom-scrollbar">
            {events.length === 0 ? (
               <div className="text-center text-zinc-500 py-8 italic text-sm">Sem agendamentos.</div>
            ) : (
               events.map(ev => {
                  const isDone = ev.status === 'realizado';
                  const styles = getEventTypeStyles(ev.tipo);
                  return (
                     <div 
                        key={ev.id} 
                        onClick={() => handleEditEvent(ev)}
                        className={`bg-zinc-950 p-4 rounded-lg border border-zinc-800 shadow-sm hover:shadow-md hover:border-zinc-700 transition-all cursor-pointer group ${isDone ? 'opacity-60' : ''}`}
                     >
                        <div className="flex items-center justify-between mb-2">
                           <p className={`font-semibold ${isDone ? 'text-zinc-500 line-through' : 'text-white'}`}>{ev.title || ev.tipo}</p>
                           <span className="text-xs text-zinc-500 font-mono">{ev.hora.slice(0,5)}</span>
                        </div>
                        <p className="text-sm text-zinc-400 mb-3 flex items-center gap-1">
                           <User size={12} /> {ev.lead_nome}
                        </p>
                        <div className="flex items-center justify-between">
                           <div className="flex -space-x-2 overflow-hidden">
                              <div className="w-6 h-6 rounded-full bg-zinc-800 border-2 border-zinc-950 flex items-center justify-center text-[10px] text-zinc-400 font-bold uppercase">
                                 {ev.lead_nome?.substring(0,2)}
                              </div>
                           </div>
                           <button 
                              onClick={(e) => { e.stopPropagation(); handleMarkDone(ev); }}
                              className={`text-xs flex items-center gap-1 ${isDone ? 'text-emerald-500' : 'text-zinc-600 group-hover:text-primary-500'}`}
                           >
                              {isDone ? <CheckCircle2 size={16} /> : <div className="w-4 h-4 rounded-full border-2 border-current"></div>}
                           </button>
                        </div>
                     </div>
                  );
               })
            )}
            
            <button 
               onClick={() => {
                  setCreateForm(prev => ({ ...prev, date: dateObj.toISOString().split('T')[0] }));
                  setEditingEventId(null);
                  setIsCreateOpen(true);
               }}
               className="w-full text-center py-3 rounded-lg border-2 border-dashed border-zinc-800 text-zinc-500 hover:bg-zinc-800/50 hover:border-primary-500/50 hover:text-primary-500 transition-colors text-sm font-bold flex items-center justify-center gap-2"
            >
               <Plus size={16} /> Add Novo
            </button>
         </div>
      </div>
   );

   // --- RENDER GRID (MONTH / WEEK) vs LIST (DAY) ---
   const renderCalendarContent = () => {
      
      // --- BOARD VIEW (NEW DEFAULT) ---
      if (viewMode === 'board') {
         const today = new Date();
         const tomorrow = new Date(today);
         tomorrow.setDate(today.getDate() + 1);
         
         const next7Start = new Date(tomorrow);
         next7Start.setDate(tomorrow.getDate() + 1);
         const next7End = new Date(next7Start);
         next7End.setDate(next7Start.getDate() + 6);

         const isBetween = (d: string, start: Date, end: Date) => {
            const date = new Date(d);
            // Reset times for strict date comparison
            const s = new Date(start); s.setHours(0,0,0,0);
            const e = new Date(end); e.setHours(23,59,59,999);
            // Adjust event date timezone offset issue (simple slice)
            const dateStr = d.split('T')[0];
            const sStr = s.toISOString().split('T')[0];
            const eStr = e.toISOString().split('T')[0];
            return dateStr >= sStr && dateStr <= eStr;
         };

         const todayEvents = events.filter(e => e.data === today.toISOString().split('T')[0]);
         const tomorrowEvents = events.filter(e => e.data === tomorrow.toISOString().split('T')[0]);
         const nextEvents = events.filter(e => isBetween(e.data, next7Start, next7End));

         const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };

         return (
            <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar h-full">
               <div className="flex gap-6 h-full px-1 min-w-max">
                  <BoardColumn 
                     title="Hoje" 
                     subTitle={today.toLocaleDateString('pt-BR', dateOptions)} 
                     dateObj={today} 
                     events={todayEvents} 
                  />
                  <BoardColumn 
                     title="Amanhã" 
                     subTitle={tomorrow.toLocaleDateString('pt-BR', dateOptions)} 
                     dateObj={tomorrow} 
                     events={tomorrowEvents} 
                  />
                  <div className="flex flex-col min-w-[320px] h-full">
                     <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white">Próximos 7 Dias</h2>
                        <span className="text-sm font-semibold text-zinc-500">
                           {next7Start.toLocaleDateString('pt-BR', {day:'numeric', month:'short'})} - {next7End.toLocaleDateString('pt-BR', {day:'numeric', month:'short'})}
                        </span>
                     </div>
                     <div className="flex-1 bg-zinc-900 border border-zinc-800 p-4 rounded-xl space-y-4 overflow-y-auto custom-scrollbar">
                        {nextEvents.map(ev => {
                           const isDone = ev.status === 'realizado';
                           return (
                              <div key={ev.id} onClick={() => handleEditEvent(ev)} className={`bg-zinc-950 p-4 rounded-lg border border-zinc-800 shadow-sm hover:border-zinc-700 transition-all cursor-pointer ${isDone ? 'opacity-60' : ''}`}>
                                 <div className="flex items-center justify-between mb-1">
                                    <p className="font-semibold text-white">{ev.title || ev.tipo}</p>
                                    <span className="text-xs text-zinc-500 font-mono">
                                       {new Date(ev.data).toLocaleDateString('pt-BR', {weekday:'short'})}, {ev.hora.slice(0,5)}
                                    </span>
                                 </div>
                                 <p className="text-sm text-zinc-400 mb-2">{ev.lead_nome}</p>
                              </div>
                           );
                        })}
                        <button 
                           onClick={() => {
                              setCreateForm(prev => ({ ...prev, date: next7Start.toISOString().split('T')[0] }));
                              setEditingEventId(null);
                              setIsCreateOpen(true);
                           }}
                           className="w-full text-center py-3 rounded-lg border-2 border-dashed border-zinc-800 text-zinc-500 hover:bg-zinc-800/50 hover:border-primary-500/50 hover:text-primary-500 transition-colors text-sm font-bold"
                        >
                           + Add Futuro
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         );
      }

      // --- DAY VIEW (BOARD STYLE) ---
      if (viewMode === 'day') {
         const dayEvents = getEventsForDay(currentDate);
         
         return (
            <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
               {/* Day Header */}
               <div className="flex justify-between items-end mb-6 pb-4 border-b border-zinc-800">
                  <div>
                     <h3 className="text-3xl font-bold text-white capitalize">
                        {currentDate.toLocaleDateString('pt-BR', { weekday: 'long' })}
                     </h3>
                     <p className="text-zinc-400 text-lg">
                        {currentDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                     </p>
                  </div>
                  <div className="bg-zinc-900 px-4 py-2 rounded-lg border border-zinc-800">
                     <span className="text-sm font-bold text-zinc-300">{dayEvents.length} Compromissos</span>
                  </div>
               </div>

               {/* Day Cards List */}
               <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4 pb-40">
                  {dayEvents.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-64 text-zinc-500 border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/50">
                        <CalendarIcon size={48} className="mb-4 opacity-30" />
                        <p className="text-lg font-medium">Agenda livre para hoje.</p>
                        <button 
                           onClick={() => {
                              setCreateForm(prev => ({ ...prev, date: currentDate.toISOString().split('T')[0] }));
                              setEditingEventId(null);
                              setIsCreateOpen(true);
                           }}
                           className="mt-4 px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-bold transition-colors"
                        >
                           + Agendar Algo
                        </button>
                     </div>
                  ) : (
                     dayEvents.map((ev) => {
                        const typeStyles = getEventTypeStyles(ev.tipo);
                        const status = getEventStatus(ev);
                        const StatusIcon = status.icon;
                        const isDone = ev.status === 'realizado';
                        const isMenuOpen = postponeMenuOpenId === ev.id;

                        // Lateral Line Logic: Use Status Color if critical, else Type Color
                        let lateralColorClass = typeStyles.pill;
                        if (status.label === 'ATRASADA') lateralColorClass = 'bg-red-500';
                        if (status.label === 'FALTA POUCO') lateralColorClass = 'bg-orange-500';
                        if (status.label === 'CONCLUÍDO') lateralColorClass = 'bg-emerald-600';

                        // Card Background Logic: Add subtle tint based on status
                        let cardBgClass = 'bg-zinc-900';
                        if (status.label === 'ATRASADA') cardBgClass = 'bg-red-950/10';
                        if (status.label === 'FALTA POUCO') cardBgClass = 'bg-orange-950/10';

                        return (
                           <div key={ev.id} className={`group relative border rounded-xl p-5 shadow-lg transition-all hover:scale-[1.01] ${cardBgClass} ${isDone ? 'border-zinc-800 opacity-60' : 'border-zinc-800 hover:border-zinc-700'} ${isMenuOpen ? 'z-50' : 'z-0'}`}>
                              
                              {/* Left Accent Bar */}
                              <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${lateralColorClass} ${status.pulse ? 'animate-pulse' : ''}`}></div>
                              
                              <div className="pl-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                                 {/* Time & Title */}
                                 <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                       <span className={`text-lg font-black font-mono tracking-tight ${status.colorClass}`}>
                                          {ev.hora.slice(0,5)}
                                       </span>
                                       
                                       {/* Status Badge */}
                                       <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded flex items-center gap-1 border ${status.colorClass} ${status.bgClass} ${status.borderClass.replace('border', 'border-opacity-30')} ${status.pulse ? 'animate-pulse' : ''}`}>
                                          <StatusIcon size={10} /> {status.label}
                                       </span>

                                       {/* Type Badge */}
                                       <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded flex items-center gap-1 ${typeStyles.bg} ${typeStyles.text} border ${typeStyles.border} border-opacity-30`}>
                                          {getEventIcon(ev.tipo)} {ev.tipo}
                                       </span>
                                    </div>
                                    
                                    <h4 className={`text-lg font-bold ${isDone ? 'text-zinc-500 line-through' : 'text-white'}`}>
                                       {ev.title || `Reunião com ${ev.lead_nome}`}
                                    </h4>
                                    
                                    <div className="flex items-center gap-2 mt-1 text-sm text-zinc-400">
                                       <User size={14} />
                                       <span>{ev.lead_nome}</span>
                                       {ev.user_name && <span className="text-zinc-600 ml-2 border-l border-zinc-700 pl-2">Resp: {ev.user_name.split(' ')[0]}</span>}
                                    </div>
                                    
                                    {ev.observacao && (
                                       <p className="mt-3 text-sm text-zinc-500 bg-black/20 p-2 rounded border border-zinc-800/50 italic max-w-xl">
                                          "{ev.observacao}"
                                       </p>
                                    )}
                                 </div>

                                 {/* Actions Area */}
                                 <div className="flex items-center gap-2 mt-2 md:mt-0">
                                    {/* Done Button */}
                                    <button 
                                       onClick={(e) => { e.stopPropagation(); handleMarkDone(ev); }}
                                       className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                          isDone 
                                          ? 'bg-emerald-900/30 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-900/50' 
                                          : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-emerald-600 hover:border-emerald-500 border border-zinc-700'
                                       }`}
                                       title={isDone ? "Reabrir" : "Marcar como Feito"}
                                    >
                                       {isDone ? <CheckCircle2 size={16} /> : <div className="w-4 h-4 rounded-full border-2 border-current"></div>}
                                       {isDone ? 'Concluído' : 'Concluir'}
                                    </button>

                                    {/* Edit Button */}
                                    <button 
                                       onClick={(e) => { e.stopPropagation(); handleEditEvent(ev); }}
                                       className="p-2.5 rounded-lg bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-blue-600 hover:text-white hover:border-blue-500 transition-all"
                                       title="Editar Detalhes"
                                    >
                                       <Edit2 size={16} />
                                    </button>

                                    {/* Postpone Button with Dropdown */}
                                    {!isDone && (
                                       <div className="relative">
                                          <button 
                                             onClick={(e) => { e.stopPropagation(); setPostponeMenuOpenId(postponeMenuOpenId === ev.id ? null : ev.id); }}
                                             className={`p-2.5 rounded-lg border transition-all ${postponeMenuOpenId === ev.id ? 'bg-orange-600 text-white border-orange-500' : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-orange-600 hover:text-white hover:border-orange-500'}`}
                                             title="Adiar"
                                          >
                                             <CalendarClock size={16} />
                                          </button>
                                          
                                          {/* Dropdown Menu */}
                                          {postponeMenuOpenId === ev.id && (
                                             <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200">
                                                <div className="p-2 bg-zinc-950 border-b border-zinc-800 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-center">
                                                   Adiar Para
                                                </div>
                                                <button onClick={(e) => { e.stopPropagation(); handleSmartPostpone(ev, '1h'); }} className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2 transition-colors">
                                                   <Clock size={14} className="text-orange-500" /> +1 Hora
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); handleSmartPostpone(ev, '2h'); }} className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2 transition-colors border-t border-zinc-800">
                                                   <Clock size={14} className="text-orange-500" /> +2 Horas
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); handleSmartPostpone(ev, 'tomorrow'); }} className="w-full text-left px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2 transition-colors border-t border-zinc-800">
                                                   <Sunrise size={14} className="text-blue-400" /> Amanhã (09:00)
                                                </button>
                                             </div>
                                          )}
                                       </div>
                                    )}
                                 </div>
                              </div>
                           </div>
                        );
                     })
                  )}
                  {/* Add New Button at bottom of list */}
                  <button 
                     onClick={() => {
                        setCreateForm(prev => ({ ...prev, date: currentDate.toISOString().split('T')[0] }));
                        setEditingEventId(null);
                        setIsCreateOpen(true);
                     }}
                     className="w-full py-4 border-2 border-dashed border-zinc-800 rounded-xl text-zinc-500 hover:text-white hover:border-zinc-600 hover:bg-zinc-900 transition-all flex items-center justify-center gap-2 font-bold"
                  >
                     <Plus size={20} /> Adicionar Novo Evento Hoje
                  </button>
               </div>
            </div>
         );
      }

      // --- MONTH GRID VIEW (Original) ---
      let days: (Date | null)[] = [];
      let gridClass = "grid-cols-7 auto-rows-fr";
      days = getDaysInMonth(currentDate);

      return (
         <div className={`grid ${gridClass} gap-px bg-zinc-800 border border-zinc-800 rounded-lg overflow-hidden flex-1 shadow-inner`}>
            {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => (
               <div key={d} className="bg-zinc-950 p-3 text-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800">
                  {d}
               </div>
            ))}
            
            {days.map((day, idx) => {
               if (!day) return <div key={idx} className="bg-zinc-900/30 min-h-[100px]"></div>;
               
               const dayEvents = getEventsForDay(day);
               const isSelected = isSameDay(day, selectedDate);
               const isToday = isSameDay(day, new Date());

               return (
                  <div 
                     key={idx} 
                     onClick={() => { setSelectedDate(day); setViewMode('day'); }}
                     className={`relative group flex flex-col gap-1 p-2 min-h-[120px] cursor-pointer transition-all duration-200 ${isSelected ? 'bg-zinc-800 ring-1 ring-inset ring-primary-500/50 z-10' : 'bg-zinc-900 hover:bg-zinc-800/80'}`}
                  >
                     <div className="flex justify-between items-start">
                        <span className={`text-sm font-bold w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isToday ? 'bg-primary-600 text-white shadow-lg' : 'text-zinc-400 group-hover:text-white'}`}>
                           {day.getDate()}
                        </span>
                     </div>
                     <div className="flex flex-col gap-1.5 mt-1 overflow-y-auto custom-scrollbar max-h-[120px]">
                        {dayEvents.slice(0, 4).map(ev => (
                           <div key={ev.id} className="text-[10px] px-2 py-1.5 rounded-md truncate flex items-center gap-2 border-l-[3px] border-primary-500 bg-zinc-950 text-white">
                              {ev.hora.slice(0,5)} {ev.lead_nome.split(' ')[0]}
                           </div>
                        ))}
                     </div>
                  </div>
               );
            })}
         </div>
      );
   };

   // Side Panel Events (Only relevant for Month mode)
   const selectedDayEvents = getEventsForDay(selectedDate);

   return (
      <div className="flex flex-col lg:flex-row h-full bg-zinc-950 overflow-hidden">
         
         {/* MAIN CONTENT AREA */}
         <div className="flex-1 flex flex-col p-6 h-full overflow-hidden border-r border-zinc-800">
            
            {/* Header Controls */}
            <div className="flex flex-col xl:flex-row justify-between items-center mb-6 gap-4">
               <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                     <CalendarIcon className="text-primary-500" /> Agenda Comercial
                  </h2>
                  {viewMode === 'month' && (
                     <p className="text-zinc-400 text-sm mt-1">
                        {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}
                     </p>
                  )}
               </div>

               <div className="flex items-center gap-4">
                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                     <button onClick={() => setViewMode('board')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${viewMode === 'board' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}>Board</button>
                     <button onClick={() => setViewMode('day')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${viewMode === 'day' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}>Dia</button>
                     <button onClick={() => setViewMode('month')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${viewMode === 'month' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}>Mês</button>
                  </div>

                  {/* Navigation (Only relevant for Month/Day, Board is static relative to today) */}
                  {viewMode !== 'board' && (
                     <div className="flex items-center gap-1">
                        <button onClick={prevPeriod} className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"><ChevronLeft size={18}/></button>
                        <button onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()); }} className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-bold text-zinc-400 hover:text-white transition-colors">Hoje</button>
                        <button onClick={nextPeriod} className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"><ChevronRight size={18}/></button>
                     </div>
                  )}
                  
                  <button 
                     onClick={() => {
                        setCreateForm(prev => ({ ...prev, date: selectedDate.toISOString().split('T')[0] }));
                        setEditingEventId(null);
                        setIsCreateOpen(true);
                     }} 
                     className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-primary-900/20"
                  >
                     <Plus size={18} /> <span className="hidden xl:inline">Novo Evento</span>
                  </button>
               </div>
            </div>

            {/* Calendar Render */}
            <div className="flex-1 overflow-y-auto">
               {renderCalendarContent()}
            </div>
         </div>

         {/* RIGHT PANEL: TIMELINE (Visible ONLY in Month view) */}
         {viewMode === 'month' && (
            <div className="w-full lg:w-[400px] bg-zinc-900/50 border-l border-zinc-800 flex flex-col h-full lg:h-auto backdrop-blur-sm">
               <div className="p-6 border-b border-zinc-800 bg-zinc-900/80">
                  <div className="flex justify-between items-start">
                     <div>
                        <h3 className="text-lg font-bold text-white mb-1">Resumo do Dia</h3>
                        <p className="text-zinc-400 text-sm capitalize">
                           {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                     </div>
                     <div className="bg-zinc-800 px-3 py-1 rounded-full text-xs font-bold text-zinc-300">
                        {selectedDayEvents.length}
                     </div>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
                  {selectedDayEvents.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-full text-zinc-500 opacity-60">
                        <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                           <CalendarIcon size={24} />
                        </div>
                        <p className="text-sm font-medium">Nenhum compromisso.</p>
                        <button 
                           onClick={() => {
                              setCreateForm(prev => ({ ...prev, date: selectedDate.toISOString().split('T')[0] }));
                              setEditingEventId(null);
                              setIsCreateOpen(true);
                           }}
                           className="mt-6 text-xs bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                           + Adicionar
                        </button>
                     </div>
                  ) : (
                     <div className="relative pl-2">
                        {/* Timeline Vertical Line */}
                        <div className="absolute left-[5.5rem] top-2 bottom-2 w-px bg-zinc-800"></div>

                        {selectedDayEvents.map((ev, idx) => {
                           const styles = getEventTypeStyles(ev.tipo);
                           const isDone = ev.status === 'realizado';

                           return (
                              <div key={ev.id} className="flex gap-6 relative group animate-in slide-in-from-right-4 duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                                 {/* Time Column */}
                                 <div className="w-16 text-right pt-2 shrink-0">
                                    <span className={`text-sm font-bold block font-mono ${isDone ? 'text-zinc-600 line-through' : 'text-white'}`}>{ev.hora.slice(0,5)}</span>
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{ev.hora.slice(0,2) > '12' ? 'PM' : 'AM'}</span>
                                 </div>

                                 {/* Timeline Dot */}
                                 <div className={`absolute left-[5.25rem] top-3 w-3 h-3 rounded-full border-2 ${styles.border} bg-zinc-950 z-10 group-hover:scale-125 transition-transform`}></div>

                                 {/* Event Card */}
                                 <div className={`flex-1 bg-zinc-900 border ${isDone ? 'border-zinc-800 opacity-50' : 'border-zinc-800'} p-4 rounded-xl hover:border-zinc-600 transition-all hover:shadow-lg group-hover:-translate-y-0.5 relative`}>
                                    <div className="flex justify-between items-start mb-2">
                                       <div className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${styles.bg} ${styles.text} border border-white/10`}>
                                          {ev.tipo}
                                       </div>
                                       {/* Mini Actions for Side Panel */}
                                       <div className="flex gap-1">
                                          <button onClick={() => handleMarkDone(ev)} className="text-zinc-600 hover:text-emerald-500"><CheckCircle2 size={14}/></button>
                                          <button onClick={() => handleEditEvent(ev)} className="text-zinc-600 hover:text-blue-500"><Edit2 size={14}/></button>
                                       </div>
                                    </div>
                                    
                                    <h4 className={`text-sm font-bold mb-1 leading-tight ${isDone ? 'text-zinc-500 line-through' : 'text-white'}`}>{ev.title || `Reunião com ${ev.lead_nome}`}</h4>
                                    
                                    <div className="flex items-center gap-2 text-xs text-zinc-400 mb-3">
                                       <User size={12} />
                                       <span className="truncate">{ev.lead_nome}</span>
                                    </div>

                                    {ev.observacao && (
                                       <div className="bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/50">
                                          <p className="text-[11px] text-zinc-500 italic leading-relaxed line-clamp-2">
                                             "{ev.observacao}"
                                          </p>
                                       </div>
                                    )}
                                 </div>
                              </div>
                           );
                        })}
                     </div>
                  )}
               </div>
            </div>
         )}

         {/* CREATE / EDIT MODAL */}
         {isCreateOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
               <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg shadow-2xl animate-in zoom-in-95">
                  <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-950 rounded-t-xl">
                     <h3 className="text-white font-bold flex items-center gap-2">
                        <CalendarIcon size={20} className="text-primary-500" /> {editingEventId ? 'Editar Evento' : 'Novo Agendamento'}
                     </h3>
                     <button onClick={() => setIsCreateOpen(false)} className="text-zinc-500 hover:text-white"><X size={20} /></button>
                  </div>
                  <form onSubmit={handleCreateSchedule} className="p-6 space-y-5">
                     <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-2 block">Cliente</label>
                        <div className="relative">
                           <Search className="absolute left-3 top-3 text-zinc-500" size={16} />
                           <input type="text" placeholder="Buscar cliente..." className="w-full bg-zinc-950 border border-zinc-700 rounded-t-lg p-2.5 pl-10 text-sm text-white outline-none focus:bg-zinc-900" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                           <select className="w-full bg-zinc-950 border border-t-0 border-zinc-700 rounded-b-lg p-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-primary-500" value={createForm.lead_id} onChange={e => setCreateForm({...createForm, lead_id: e.target.value})} required size={5}>
                              {filteredLeads.map(l => (<option key={l.id} value={l.id} className="p-1 hover:bg-zinc-800 cursor-pointer">{l.nome} ({l.telefone})</option>))}
                           </select>
                        </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Tipo</label>
                           <select className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-primary-500" value={createForm.type} onChange={e => setCreateForm({...createForm, type: e.target.value})}>
                              {appointmentReasons.map(r => (<option key={r.id} value={r.name}>{r.name}</option>))}
                           </select>
                        </div>
                        <div>
                           <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Hora</label>
                           <input type="time" required className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 text-sm text-white [color-scheme:dark] focus:ring-1 focus:ring-primary-500" value={createForm.time} onChange={e => setCreateForm({...createForm, time: e.target.value})}/>
                        </div>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Data</label>
                        <input type="date" required className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 text-sm text-white [color-scheme:dark] focus:ring-1 focus:ring-primary-500" value={createForm.date} onChange={e => setCreateForm({...createForm, date: e.target.value})}/>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">Observação</label>
                        <input type="text" className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-primary-500" placeholder="Detalhes..." value={createForm.obs} onChange={e => setCreateForm({...createForm, obs: e.target.value})}/>
                     </div>
                     <div className="pt-4 flex gap-2 justify-end border-t border-zinc-800 mt-2">
                        <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">Cancelar</button>
                        <button type="submit" disabled={savingCreate} className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary-900/20 transition-all">
                           {savingCreate ? 'Salvando...' : 'Confirmar'}
                        </button>
                     </div>
                  </form>
               </div>
            </div>
         )}

      </div>
   );
};
