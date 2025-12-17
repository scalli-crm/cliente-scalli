
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { User } from '../types';
import { BarChart3, Lock, Mail, Loader2, AlertCircle, ArrowRight, User as UserIcon } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
       if (isSignUp) {
          // SIGN UP LOGIC
          // Enviamos 'role: sales' nos metadados para que o Trigger do banco (handle_new_user)
          // possa criar o usuário na tabela public.users automaticamente com os dados corretos.
          const { data, error } = await supabase.auth.signUp({
             email,
             password,
             options: {
                data: { 
                  name,
                  role: 'sales' 
                }
             }
          });

          if (error) throw error;

          alert('Cadastro realizado com sucesso! Se necessário, verifique seu email.');
          setIsSignUp(false);
       } else {
          // SIGN IN LOGIC
          const { data, error } = await supabase.auth.signInWithPassword({
             email,
             password
          });

          if (error) throw error;
       }
       
       // The onAuthStateChange listener in App.tsx will handle the redirect/state update
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro na autenticação. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary-900/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl p-8 animate-in fade-in zoom-in duration-500 relative z-10">
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-900/50 mb-4 transform rotate-3">
             <BarChart3 size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Scalli <span className="text-primary-500">Labs</span>
          </h1>
          <p className="text-zinc-500 text-sm mt-2">
            {isSignUp ? 'Crie sua conta para começar' : 'Faça login para acessar o sistema'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          
          {isSignUp && (
            <div className="space-y-2 animate-in slide-in-from-top-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Nome Completo</label>
              <div className="relative group">
                <UserIcon className="absolute left-3 top-3 text-zinc-500 group-focus-within:text-primary-500 transition-colors" size={20} />
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all placeholder:text-zinc-600"
                  placeholder="Seu nome"
                  required={isSignUp}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Email Corporativo</label>
            <div className="relative group">
              <Mail className="absolute left-3 top-3 text-zinc-500 group-focus-within:text-primary-500 transition-colors" size={20} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all placeholder:text-zinc-600"
                placeholder="nome@empresa.com"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Senha</label>
            <div className="relative group">
              <Lock className="absolute left-3 top-3 text-zinc-500 group-focus-within:text-primary-500 transition-colors" size={20} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent transition-all placeholder:text-zinc-600"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2 text-red-400 text-sm animate-in slide-in-from-left-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-primary-900/20 flex items-center justify-center gap-2 group active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : (
              <>
                {isSignUp ? 'Criar Conta' : 'Entrar no Sistema'}
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
            className="text-sm text-zinc-500 hover:text-white transition-colors"
          >
            {isSignUp ? 'Já tem uma conta? Faça Login' : 'Não tem conta? Crie uma agora'}
          </button>
        </div>
      </div>
    </div>
  );
};
