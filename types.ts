
import React from 'react';

export type UserRole = 'admin' | 'manager' | 'sales' | 'client';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password?: string;
  active: boolean;
}

export interface AppFeatures {
  dashboard: boolean;
  mvi: boolean;
  mvi_metrics: boolean;
  crm: boolean;
  products: boolean;
  landing_pages: boolean;
  goals: boolean;
  agenda: boolean;
  onboarding: boolean;
}

// --- APP CONFIGURATION ---
export interface AppConfig {
  id: string;
  monthly_goal: number;
  app_logo: string | null;
  enabled_features?: AppFeatures; // New JSONB field
}

export interface IntegrationSheet {
  id: string;
  name: string;
  url: string;
  active: boolean;
  created_at?: string;
}

// --- ONBOARDING & AI ---
export interface OnboardingClient {
  id: string;
  business_name: string;
  business_type: string; // E-commerce, Info, Local, Serviço
  offer_main: string;
  target_audience: string;
  sales_process: string; // WhatsApp, Direct, Página de Vendas
  platforms: string[]; // Facebook, Instagram
  created_at: string;
  active: boolean;
  status?: 'pending' | 'completed'; // New field
  details?: any; // Stores full form data JSON
  owner_id?: string; // Links to the User (Client)
}

export interface OnboardingCampaign {
  id: string;
  client_id: string;
  analysis_summary: {
    awareness_level: string;
    funnel_stage: string;
    campaign_objective: string;
  };
  angles: {
    title: string;
    pain: string;
    desire: string;
    differential: string;
    headline: string;
    short_copy: string;
    long_copy: string;
    cta: string;
    creative_ideas: string[];
    format_suggestion: string;
  }[];
  video_script: {
    hook: string;
    body: string;
    cta: string;
    visual_description: string;
  };
  visual_creative: {
    scene: string;
    text_overlay: string;
    hook: string;
  };
  created_at: string;
}

// --- LANDING PAGES ---
export interface LandingPage {
  id: string;
  title: string;
  slug: string;
  headline: string;
  description?: string;
  active: boolean;
  lead_origin_id?: string;
  created_at: string;
  views?: number;
  conversions?: number;
}

// --- PRODUTOS ---
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  active: boolean;
  created_at: string;
  category_id?: string;
  crm_brands?: CRMBrand; // Relacionamento com Categoria
}

// Stages now generic
export type CRMStage = 'novo' | 'atendimento' | 'visita' | 'test_drive' | 'proposta' | 'negociacao' | 'venda' | 'perdido';

// --- CRM CONFIG TYPES (Mapped to B2B Concepts) ---
// CRMBrand -> Categoria / Linha de Produto
export interface CRMBrand {
  id: string;
  name: string;
  active: boolean;
}

// CRMModel -> Produto / Serviço
export interface CRMModel {
  id: string;
  brand_id: string;
  name: string;
  active: boolean;
  crm_brands?: CRMBrand;
}

export interface CRMPipelineStage {
  id: string;
  name: string;
  color: string;
  order_index: number;
  active: boolean;
  is_system: boolean;
}

export interface CRMLossReason {
  id: string;
  name: string;
  active: boolean;
}

export interface CRMWinReason {
  id: string;
  name: string;
  active: boolean;
}

// CRMFuelType -> Segmento de Mercado
export interface CRMFuelType {
  id: string;
  name: string;
  active: boolean;
}

export interface CRMLeadOrigin {
  id: string;
  name: string;
  active: boolean;
}

// CRMVehicleType -> Tipo de Contrato
export interface CRMVehicleType {
  id: string;
  name: string;
  active: boolean;
}

export interface CRMAppointmentReason {
  id: string;
  name: string;
  active: boolean;
}

// Entidade PESSOA (Cliente/Lead)
export interface Lead {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  origem?: string;
  cidade?: string;
  estado?: string;
  created_at: string;
  lead_origin_id?: string;
  stage: string; 
  interesse?: string; // Produto de interesse
  ano_min?: number; // Legacy Car field (Hidden in UI)
  ano_max?: number; // Legacy Car field (Hidden in UI)
  faixa_preco_min?: number;
  faixa_preco_max?: number;
  vendedor_id?: string;
  return_date?: string;
  last_contact_at?: string;
  alert_1_day?: boolean;
  alert_1_hour?: boolean;
  alert_at_time?: boolean;
}

export type Customer = Lead;

export interface ScheduleEvent {
  id: string;
  lead_id: string;
  lead_nome?: string;
  user_id?: string;
  user_name?: string;
  title?: string;
  tipo: string;
  data: string;
  hora: string;
  observacao?: string;
  status: 'agendado' | 'realizado' | 'cancelado';
}

// Entidade NEGÓCIO (Oportunidade)
export interface Opportunity {
  id: string;
  lead_id: string;
  title: string;
  
  // Detalhes do Produto/Serviço (Mapeados)
  vehicle_type_id?: string; // Mapped to Contract Type
  brand_id?: string;        // Mapped to Category
  model_id?: string;        // Mapped to Product/Service
  fuel_type_id?: string;    // Mapped to Segment
  min_year?: number;        // Legacy
  max_year?: number;        // Legacy
  
  // Valores
  min_price?: number;
  max_price?: number;
  
  // Fechamento
  final_price?: number;
  sold_vehicle_name?: string; // Product Sold Name

  // Comercial
  payment_method?: 'avista' | 'financiado' | 'consorcio' | 'troca_financiamento' | 'faturado' | string;
  has_trade_in?: boolean; // Legacy
  trade_in_description?: string; // Legacy
  
  // Gestão
  stage: CRMStage;
  status: 'open' | 'won' | 'lost';
  loss_reason_id?: string;
  user_id?: string;
  obs?: string;
  
  created_at: string;
  updated_at?: string;

  // Joins
  leads?: Customer;
  users?: User;
  crm_brands?: CRMBrand;
  crm_models?: CRMModel;
  
  schedule?: ScheduleEvent[]; 
}

export interface LeadHistory {
  id: string;
  lead_id: string;
  descricao: string;
  categoria: 'sistema' | 'usuario' | 'agendamento';
  created_at: string;
}

export interface DailyRecord {
  id: string;
  date: string;
  leads: number;
  source: string;
  contacts: number;
  scheduled: number;
  attended: number;
  testDrives: number; // Mapped to Meetings/Demos
  proposals: number; 
  approvals: number;
  sales: number;
  revenue: number;
  investment: number;
}

export interface KPIData {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color?: string;
}

export type SortField = keyof DailyRecord;
export type SortOrder = 'asc' | 'desc';
