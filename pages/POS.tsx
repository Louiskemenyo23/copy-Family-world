
import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { ItemCategory, MenuItem, Order, OrderStatus } from '../types';
import { DRINK_CATEGORIES } from '../constants';
import { Search, ShoppingCart, Trash2, CreditCard, User, Tag, CheckCircle, MessageSquare, X, AlertCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useSearchParams, useNavigate } from 'react-router-dom';

const POS: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editOrderId = searchParams.get('edit');
  
  const { menu, addOrder, updateOrder, orders, tables, currentUser, settings } = useStore();
  
  const [cart, setCart] = useState<{ item: MenuItem; quantity: number; notes?: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | 'ALL' | 'DRINK'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTable, setSelectedTable] = useState<string>('TAKEAWAY');
  const [customerName, setCustomerName] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Load existing order if editing
  useEffect(() => {
      if (editOrderId) {
          const orderToEdit = orders.find(o => o.id === editOrderId);
          if (orderToEdit) {
              setIsUpdating(true);
              setCustomerName(orderToEdit.customerName || '');
              setSelectedTable(orderToEdit.tableId);
              
              // Map order items back to menu items
              const loadedCart = orderToEdit.items.map(orderItem => {
                  const menuItem = menu.find(m => m.id === orderItem.itemId);
                  // Create a temporary menu item if not found (fallback)
                  const item = menuItem || {
                      id: orderItem.itemId,
                      name: orderItem.name,
                      price: orderItem.price,
                      category: orderItem.category,
                      image: '',
                      description: '',
                      stock: 0,
                      isAvailable: true
                  } as MenuItem;
                  
                  return {
                      item,
                      quantity: orderItem.quantity,
                      notes: orderItem.notes
                  };
              });
              setCart(loadedCart);
          }
      }
  }, [editOrderId, orders, menu]);

  // Note Modal State
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [noteInput, setNoteInput] = useState('');

  const filteredMenu = useMemo(() => {
    return menu.filter(item => {
      if (item.category === ItemCategory.COOKING_ESSENTIAL) return false;
      let matchesCategory = selectedCategory === 'ALL' || (selectedCategory === 'DRINK' ? DRINK_CATEGORIES.includes(item.category) : item.category === selectedCategory);
      return matchesCategory && item.name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [menu, selectedCategory, searchQuery]);

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existingIndex = prev.findIndex(i => i.item.id === item.id && !i.notes);
      if (existingIndex >= 0) {
        const newCart = [...prev];
        newCart[existingIndex].quantity += 1;
        return newCart;
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const removeFromCart = (index: number) => setCart(prev => prev.filter((_, i) => i !== index));
  const updateQuantity = (index: number, delta: number) => {
    setCart(prev => prev.map((line, i) => i === index ? { ...line, quantity: Math.max(1, line.quantity + delta) } : line));
  };

  const openNoteModal = (index: number) => {
    setEditingNoteIndex(index);
    setNoteInput(cart[index].notes || '');
  };

  const saveNote = () => {
    if (editingNoteIndex !== null) {
      setCart(prev => prev.map((line, i) => i === editingNoteIndex ? { ...line, notes: noteInput } : line));
      setEditingNoteIndex(null);
      setNoteInput('');
    }
  };

  const subtotal = cart.reduce((sum, i) => sum + (i.item.price * i.quantity), 0);
  const taxAmount = subtotal * (settings.taxRate / 100);
  const finalTotal = subtotal + taxAmount;

  const handleProcessOrder = async () => {
    if (cart.length === 0) return;

    const isAllDrinks = cart.every(i => DRINK_CATEGORIES.includes(i.item.category));
    const initialStatus = isAllDrinks ? OrderStatus.SERVED : OrderStatus.PENDING;

    const orderData: Order = {
      id: isUpdating ? editOrderId! : uuidv4(),
      tableId: selectedTable,
      items: cart.map(i => ({
        itemId: i.item.id,
        name: i.item.name,
        price: i.item.price,
        quantity: i.quantity,
        category: i.item.category,
        notes: i.notes
      })),
      status: isUpdating ? (orders.find(o => o.id === editOrderId)?.status || initialStatus) : initialStatus,
      timestamp: isUpdating ? (orders.find(o => o.id === editOrderId)?.timestamp || new Date()) : new Date(),
      total: finalTotal,
      customerName: customerName || 'Guest',
      staffId: currentUser?.id,
      staffName: currentUser?.name
    };

    if (isUpdating) {
        await updateOrder(orderData);
    } else {
        await addOrder(orderData);
    }

    setCart([]);
    setCustomerName('');
    setIsUpdating(false);
    setOrderSuccess(true);
    
    setTimeout(() => {
        setOrderSuccess(false);
        if (isUpdating) navigate('/orders');
    }, 2000);
  };

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden bg-slate-950 relative">
      {orderSuccess && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-slate-900 border border-emerald-500/50 p-8 rounded-2xl shadow-2xl flex flex-col items-center animate-in zoom-in-95">
                  <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/30">
                      <CheckCircle size={48} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-1">{isUpdating ? 'Order Updated!' : 'Order Placed!'}</h2>
                  <p className="text-emerald-400 font-medium">Successfully processed changes</p>
              </div>
          </div>
      )}

      {editingNoteIndex !== null && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl shadow-2xl w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-4">Add Note to Item</h3>
            <textarea
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:border-indigo-500 h-24 resize-none mb-4"
              placeholder="e.g. No onions..."
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setEditingNoteIndex(null)} className="flex-1 py-2 bg-slate-800 text-white rounded-lg font-medium">Cancel</button>
              <button onClick={saveNote} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-medium">Save Note</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col h-full p-4 overflow-hidden">
        {isUpdating && (
            <div className="bg-indigo-600/20 border border-indigo-500/50 p-3 rounded-xl mb-4 flex justify-between items-center animate-in slide-in-from-top-2">
                <div className="flex items-center gap-3 text-indigo-400 font-bold">
                    <AlertCircle size={20} />
                    <span>Editing Mode: Order #{editOrderId?.slice(0, 6)}</span>
                </div>
                <button 
                    onClick={() => { navigate('/pos'); setIsUpdating(false); setCart([]); setCustomerName(''); }} 
                    className="text-xs font-bold uppercase tracking-widest bg-slate-900 px-3 py-1 rounded-lg hover:bg-slate-800 text-white border border-slate-700"
                >
                    Cancel Editing
                </button>
            </div>
        )}

        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-md mb-4 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
            {['ALL', ItemCategory.FOOD, 'DRINK', ItemCategory.DESSERT].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat as any)}
                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
                  selectedCategory === cat ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {cat === 'DRINK' ? 'Drinks Only' : cat.charAt(0) + cat.slice(1).toLowerCase().replace('_', ' ')}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search menu..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border-none rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 pb-20 lg:pb-0">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredMenu.map(item => (
              <div key={item.id} onClick={() => addToCart(item)} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-indigo-500/50 transition-all cursor-pointer group flex flex-col">
                <div className="h-40 overflow-hidden relative">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute bottom-0 right-0 bg-slate-900/80 px-2 py-1 m-2 rounded text-xs font-bold text-white backdrop-blur-md">
                    {settings.currency}{item.price.toFixed(2)}
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-slate-200 truncate">{item.name}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-96 bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl z-20">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShoppingCart size={20} className="text-indigo-400" /> 
            {isUpdating ? 'Edit Order Items' : 'Current Order'}
          </h2>
        </div>

        <div className="p-4 space-y-3 bg-slate-800/50">
            <div className="flex gap-2">
                 <div className="flex-1 bg-slate-800 rounded-lg flex items-center px-3 border border-slate-700">
                    <User size={16} className="text-slate-400 mr-2" />
                    <input 
                        type="text" 
                        placeholder="Customer Name"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="bg-transparent border-none w-full text-sm text-white focus:outline-none py-2"
                    />
                 </div>
                 <select value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)} className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg p-2">
                    <option value="TAKEAWAY">Takeaway</option>
                    {tables.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                 </select>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center text-slate-500 mt-10"><Tag size={32} className="mx-auto mb-2 opacity-20" /> Cart is empty</div>
          ) : (
            cart.map((line, idx) => (
              <div key={idx} className="bg-slate-800/50 p-3 rounded-lg border border-slate-800/50">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-lg bg-slate-700 flex-shrink-0 mr-3 overflow-hidden">
                            {line.item.image && <img src={line.item.image} className="w-full h-full object-cover" />}
                        </div>
                        <div className="min-w-0"><div className="font-medium text-sm text-white truncate">{line.item.name}</div><div className="text-xs text-slate-400">{settings.currency}{line.item.price.toFixed(2)}</div></div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                        <div className="flex items-center gap-1 bg-slate-900 rounded-lg px-1"><button onClick={() => updateQuantity(idx, -1)} className="w-6 h-6">-</button><span className="text-sm font-semibold w-4 text-center">{line.quantity}</span><button onClick={() => updateQuantity(idx, 1)} className="w-6 h-6">+</button></div>
                        <button onClick={() => removeFromCart(idx)} className="text-rose-400"><Trash2 size={16} /></button>
                    </div>
                </div>
                <button onClick={() => openNoteModal(idx)} className={`text-xs flex items-center gap-1 px-2 py-1 rounded ${line.notes ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-700 text-slate-400'}`}>
                    <MessageSquare size={12} /> {line.notes ? line.notes : 'Add Note'}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-slate-900 border-t border-slate-800 space-y-4">
          <div className="flex justify-between text-white text-xl font-bold pt-2 border-t border-slate-800">
            <span>Total</span><span>{settings.currency}{finalTotal.toFixed(2)}</span>
          </div>
          <button onClick={handleProcessOrder} disabled={cart.length === 0} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg">
            <CreditCard size={20} /> {isUpdating ? 'Update Order' : 'Process Payment'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default POS;
