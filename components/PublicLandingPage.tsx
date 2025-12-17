
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { LandingPage, CRMLeadOrigin } from '../types';
import { CheckCircle, Send, User, Phone, Mail, MapPin, BarChart3, AlertCircle } from 'lucide-react';

interface PublicLandingPageProps {
  slug: string;
}

export const PublicLandingPage: React.FC<PublicLandingPageProps> = ({ slug }) => {
  const [pageData, setPageData] = useState<LandingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originName, setOriginName] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    email: '',
    cidade: ''
  });

  useEffect(() => {
    fetchPage();
  }, [slug]);

  const fetchPage = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('landing_pages')
        .select('*')
        .eq('slug', slug)
        .eq('active', true)
        .single();

      if (error) throw error;
      if (data) {
         setPageData(data as LandingPage);
         // Increment View Count (Fire and forget)
         /* Note: This requires a DB function or specific policy, skipping for pure frontend demo */
         
         // Fetch Origin Name if ID exists
         if (data.lead_origin_id) {
            const originRes = await supabase.from('crm_lead_origins').select('name').eq('id', data.lead_origin_id).single();
            if (originRes.data) setOriginName(originRes.data.name);
         }
      }
    } catch (err) {
      console.error(err);
      setError('Página não encontrada ou desativada.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageData) return;
    setSubmitting(true);

    try {
      // 1. Create Lead
      const leadPayload = {
        nome: formData.nome,
        telefone: formData.telefone,
        email: formData.email,
        cidade: formData.cidade,
        origem: originName || 'Landing Page',
        lead_origin_id: pageData.lead_origin_id || null,
        stage: 'novo',
        created_at: new Date().toISOString()
      };

      const { data: leadRes, error: leadError } = await supabase.from('leads').insert([leadPayload]).select();
      if (leadError) throw leadError;
      
      const newLeadId = leadRes[0].id;

      // 2. Create Opportunity
      const oppPayload = {
        lead_id: newLeadId,
        title: `Lead via LP: ${pageData.title}`,
        stage: 'novo',
        status: 'open',
        created_at: new Date().toISOString(),
        obs: `Capturado via página: ${pageData.title}`
      };

      await supabase.from('crm_opportunities').insert([oppPayload]);

      // 3. Log History
      await supabase.from('lead_history').insert([{
         lead_id: newLeadId,
         descricao: `Lead capturado automaticamente via Landing Page: ${pageData.title}`,
         categoria: 'sistema'
      }]);

      setSuccess(true);

    } catch (err: any) {
      alert('Erro ao enviar dados. Tente novamente.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary-500"></div></div>;
  }

  if (error || !pageData) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white p-6 text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Página não encontrada</h1>
        <p className="text-zinc-400">O link pode estar incorreto ou a página foi desativada.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col md:flex-row relative overflow-hidden font-sans">
      
      {/* Background decoration */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary-900/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Left Column: Content */}
      <div className="flex-1 p-8 md:p-16 flex flex-col justify-center relative z-10">
         <div className="max-w-xl mx-auto md:mx-0">
            <div className="flex items-center gap-2 mb-8">
               <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl flex items-center justify-center shadow-lg">
                  <BarChart3 size={20} className="text-white" />
               </div>
               <span className="text-xl font-bold text-white tracking-tight">Scalli Labs</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-black text-white leading-tight mb-6">
               {pageData.headline}
            </h1>
            
            <div className="text-lg text-zinc-400 mb-8 whitespace-pre-wrap leading-relaxed">
               {pageData.description || 'Cadastre-se agora para receber mais informações e falar com um de nossos especialistas.'}
            </div>

            <div className="hidden md:flex gap-4 text-sm text-zinc-500">
               <div className="flex items-center gap-2"><CheckCircle size={16} className="text-primary-500" /> Atendimento Rápido</div>
               <div className="flex items-center gap-2"><CheckCircle size={16} className="text-primary-500" /> Condições Exclusivas</div>
            </div>
         </div>
      </div>

      {/* Right Column: Form */}
      <div className="flex-1 p-6 md:p-12 flex items-center justify-center relative z-10 bg-zinc-900/50 backdrop-blur-sm md:border-l border-zinc-800">
         <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 p-8 rounded-2xl shadow-2xl relative">
            
            {success ? (
               <div className="text-center py-12 animate-in zoom-in duration-300">
                  <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                     <CheckCircle size={40} className="text-emerald-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Cadastro Recebido!</h2>
                  <p className="text-zinc-400">
                     Obrigado pelo interesse. Nossa equipe entrará em contato em breve.
                  </p>
               </div>
            ) : (
               <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="text-center mb-6">
                     <h3 className="text-xl font-bold text-white">Preencha seus dados</h3>
                     <p className="text-sm text-zinc-500">É rápido, fácil e seguro.</p>
                  </div>

                  <div>
                     <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Nome Completo</label>
                     <div className="relative group">
                        <User className="absolute left-3 top-3 text-zinc-600 group-focus-within:text-primary-500 transition-colors" size={18} />
                        <input 
                           type="text" 
                           name="nome"
                           required
                           className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none transition-all"
                           placeholder="Seu nome"
                           value={formData.nome}
                           onChange={handleChange}
                        />
                     </div>
                  </div>

                  <div>
                     <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Telefone / WhatsApp</label>
                     <div className="relative group">
                        <Phone className="absolute left-3 top-3 text-zinc-600 group-focus-within:text-primary-500 transition-colors" size={18} />
                        <input 
                           type="tel" 
                           name="telefone"
                           required
                           className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none transition-all"
                           placeholder="(00) 00000-0000"
                           value={formData.telefone}
                           onChange={handleChange}
                        />
                     </div>
                  </div>

                  <div>
                     <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Email (Opcional)</label>
                     <div className="relative group">
                        <Mail className="absolute left-3 top-3 text-zinc-600 group-focus-within:text-primary-500 transition-colors" size={18} />
                        <input 
                           type="email" 
                           name="email"
                           className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none transition-all"
                           placeholder="seu@email.com"
                           value={formData.email}
                           onChange={handleChange}
                        />
                     </div>
                  </div>

                  <div>
                     <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Cidade</label>
                     <div className="relative group">
                        <MapPin className="absolute left-3 top-3 text-zinc-600 group-focus-within:text-primary-500 transition-colors" size={18} />
                        <input 
                           type="text" 
                           name="cidade"
                           className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none transition-all"
                           placeholder="Cidade/UF"
                           value={formData.cidade}
                           onChange={handleChange}
                        />
                     </div>
                  </div>

                  <button 
                     type="submit" 
                     disabled={submitting}
                     className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary-900/30 transition-all active:scale-95 flex items-center justify-center gap-2 mt-4"
                  >
                     {submitting ? 'Enviando...' : <>{'Quero saber mais'} <Send size={18} /></>}
                  </button>

                  <p className="text-center text-[10px] text-zinc-600 mt-4">
                     Seus dados estão seguros. Não enviamos spam.
                  </p>
               </form>
            )}
         </div>
      </div>

    </div>
  );
};
