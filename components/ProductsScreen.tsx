
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Product, CRMBrand } from '../types';
import { Plus, Package, Edit2, Trash2, Search, X, Save, Tag, FileText, DollarSign, Briefcase } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

export const ProductsScreen: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CRMBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    active: true,
    category_id: ''
  });

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from('crm_brands').select('*').eq('active', true).order('name');
    if (data) setCategories(data as CRMBrand[]);
  };

  const fetchProducts = async () => {
    setLoading(true);
    // Tenta trazer o nome da categoria junto (se a relação existir no banco)
    const { data, error } = await supabase.from('products').select('*, crm_brands(name)').order('name', { ascending: true });
    
    if (!error && data) {
        setProducts(data as Product[]);
    } else {
        // Fallback caso a relação não exista ou erro
        const { data: simpleData } = await supabase.from('products').select('*').order('name', { ascending: true });
        if (simpleData) setProducts(simpleData as Product[]);
    }
    setLoading(false);
  };

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        description: product.description,
        price: product.price,
        active: product.active,
        category_id: product.category_id || ''
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        description: '',
        price: 0,
        active: true,
        category_id: ''
      });
    }
    setIsModalOpen(true);
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    const floatValue = value ? parseInt(value, 10) / 100 : 0;
    setFormData(prev => ({ ...prev, price: floatValue }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert('Nome do produto é obrigatório');

    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        price: formData.price,
        active: formData.active,
        category_id: formData.category_id || null
      };

      if (editingProduct) {
        await supabase.from('products').update(payload).eq('id', editingProduct.id);
      } else {
        await supabase.from('products').insert([payload]);
      }

      setIsModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
      await supabase.from('products').delete().eq('id', id);
      fetchProducts();
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-xl shadow-lg">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="text-primary-500" /> Catálogo de Produtos
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            Gerencie os produtos e serviços disponíveis para venda B2B.
          </p>
        </div>
        <button 
          onClick={() => handleOpenModal()} 
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-primary-900/20"
        >
          <Plus size={18} /> Novo Produto
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-3 text-zinc-500" size={18} />
        <input 
          type="text" 
          placeholder="Buscar produto por nome ou descrição..." 
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-primary-600 outline-none"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Product List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? <p className="text-zinc-500 col-span-full text-center py-10">Carregando produtos...</p> : filteredProducts.map(product => (
          <div key={product.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-all group flex flex-col h-full shadow-lg">
            <div className="p-5 flex-1">
              <div className="flex justify-between items-start mb-2">
                <div>
                    {product.crm_brands && (
                        <span className="text-[10px] uppercase font-bold text-primary-500 tracking-wider mb-1 block">
                            {product.crm_brands.name}
                        </span>
                    )}
                    <h3 className="font-bold text-white text-lg truncate pr-2" title={product.name}>{product.name}</h3>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${product.active ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                  {product.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <p className="text-sm text-zinc-400 line-clamp-3 mb-4 min-h-[3rem]">
                {product.description || 'Sem descrição.'}
              </p>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(product.price)}
              </div>
            </div>

            <div className="p-4 bg-zinc-950/30 border-t border-zinc-800 flex gap-2">
               <button onClick={() => handleOpenModal(product)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 rounded-lg text-xs font-bold flex justify-center items-center gap-2 border border-zinc-700 transition-colors">
                  <Edit2 size={14} /> Editar
               </button>
               <button onClick={() => handleDelete(product.id)} className="p-2 bg-zinc-800 hover:bg-zinc-700 text-red-400 hover:text-red-500 rounded-lg border border-zinc-700 transition-colors">
                  <Trash2 size={16} />
               </button>
            </div>
          </div>
        ))}
        
        {!loading && filteredProducts.length === 0 && (
           <div className="col-span-full py-16 text-center text-zinc-500 border-2 border-dashed border-zinc-800 rounded-xl">
              <Package size={48} className="mx-auto mb-4 opacity-50" />
              <p>Nenhum produto encontrado.</p>
           </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
               <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Package className="text-primary-500" size={20} />
                  {editingProduct ? 'Editar Produto' : 'Novo Produto'}
               </h3>
               <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
               
               <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Categoria do Produto</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-2.5 text-zinc-500" size={16} />
                    <select 
                        value={formData.category_id}
                        onChange={e => setFormData({...formData, category_id: e.target.value})}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 pl-10 text-white focus:ring-1 focus:ring-primary-500 outline-none appearance-none"
                    >
                        <option value="">Sem categoria</option>
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                  </div>
               </div>

               <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Nome do Produto</label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-2.5 text-zinc-500" size={16} />
                    <input 
                      required 
                      type="text" 
                      value={formData.name} 
                      onChange={e => setFormData({...formData, name: e.target.value})} 
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 pl-10 text-white focus:ring-1 focus:ring-primary-500 outline-none" 
                      placeholder="Nome do produto..." 
                    />
                  </div>
               </div>
               
               <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Preço (R$)</label>
                  <div className="relative">
                     <DollarSign className="absolute left-3 top-2.5 text-zinc-500" size={16} />
                     <input 
                       type="text" 
                       required
                       value={formatCurrency(formData.price)} 
                       onChange={handlePriceChange} 
                       className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 pl-10 text-white focus:ring-1 focus:ring-primary-500 outline-none font-bold text-lg" 
                     />
                  </div>
               </div>

               <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-1">Descrição</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 text-zinc-500" size={16} />
                    <textarea 
                      rows={4} 
                      value={formData.description} 
                      onChange={e => setFormData({...formData, description: e.target.value})} 
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-2.5 pl-10 text-white focus:ring-1 focus:ring-primary-500 outline-none resize-none" 
                      placeholder="Detalhes técnicos, diferenciais..." 
                    />
                  </div>
               </div>

               <div className="flex items-center gap-2 cursor-pointer p-2.5 bg-zinc-950 border border-zinc-700 rounded-lg w-full">
                  <input 
                    type="checkbox" 
                    id="active"
                    checked={formData.active} 
                    onChange={e => setFormData({...formData, active: e.target.checked})} 
                    className="w-4 h-4 rounded text-primary-600 focus:ring-primary-600 bg-zinc-800 border-zinc-600" 
                  />
                  <label htmlFor="active" className="text-sm text-white font-medium cursor-pointer select-none">Produto Ativo (Disponível)</label>
               </div>

               <div className="pt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-zinc-400 hover:text-white">Cancelar</button>
                  <button type="submit" className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-primary-900/20">
                     <Save size={18} /> Salvar Produto
                  </button>
               </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
