
import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Order, OrderStatus } from '../types';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Filter, Calendar, Eye, X, Receipt, 
  CheckCircle, XCircle, Clock, ChefHat, User, ShoppingBag, Printer, Trash2, Edit, AlertTriangle, Ban
} from 'lucide-react';

const Orders: React.FC = () => {
  const navigate = useNavigate();
  const { orders, currentUser, updateOrderStatus, deleteOrder, staff, settings } = useStore();
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [dateFilter, setDateFilter] = useState<string>(''); // YYYY-MM-DD
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  // Manage Order Modal
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  // PERMISSIONS
  const userRole = currentUser?.role?.trim().toUpperCase() || '';
  const isManager = ['MANAGER', 'ADMIN'].includes(userRole);
  const isAdmin = userRole === 'ADMIN';

  // Derived State: Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Role Check: If not manager/admin, ONLY show orders created by this user
      if (!isManager && order.staffId !== currentUser?.id) {
          return false;
      }

      const matchesSearch = 
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (order.customerName && order.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (order.tableId.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;
      const orderDate = new Date(order.timestamp).toISOString().split('T')[0];
      const matchesDate = !dateFilter || orderDate === dateFilter;

      return matchesSearch && matchesStatus && matchesDate;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [orders, searchTerm, statusFilter, dateFilter, isManager, currentUser]);

  const totalRevenue = filteredOrders
    .filter(o => o.status !== OrderStatus.CANCELLED)
    .reduce((sum, o) => sum + o.total, 0);
    
  const completedCount = filteredOrders.filter(o => o.status === OrderStatus.PAID).length;
  const cancelledCount = filteredOrders.filter(o => o.status === OrderStatus.CANCELLED).length;

  const getServerName = (order: Order) => {
      if (order.staffName) return order.staffName;
      if (order.staffId) {
          const foundStaff = staff.find(s => s.id === order.staffId);
          return foundStaff ? foundStaff.name : 'Unknown';
      }
      return 'Unknown';
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PAID:
        return <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded text-xs font-bold border border-emerald-500/20"><CheckCircle size={12} /> PAID</span>;
      case OrderStatus.CANCELLED:
        return <span className="flex items-center gap-1 bg-rose-500/10 text-rose-400 px-2 py-1 rounded text-xs font-bold border border-rose-500/20"><XCircle size={12} /> CANCELLED</span>;
      case OrderStatus.PENDING:
        return <span className="flex items-center gap-1 bg-orange-500/10 text-orange-400 px-2 py-1 rounded text-xs font-bold border border-orange-500/20"><Clock size={12} /> PENDING</span>;
      case OrderStatus.PREPARING:
        return <span className="flex items-center gap-1 bg-blue-500/10 text-blue-400 px-2 py-1 rounded text-xs font-bold border border-blue-500/20"><ChefHat size={12} /> PREPARING</span>;
      case OrderStatus.READY:
      case OrderStatus.SERVED:
        return <span className="flex items-center gap-1 bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded text-xs font-bold border border-cyan-500/20"><ShoppingBag size={12} /> {status}</span>;
      default:
        return <span className="bg-slate-800 text-slate-400 px-2 py-1 rounded text-xs font-bold">{status}</span>;
    }
  };

  const handleUpdateStatus = (status: OrderStatus) => {
      if (editingOrder) {
          updateOrderStatus(editingOrder.id, status);
          setEditingOrder(null);
      }
  };

  const handleCancelOrder = () => {
      if (editingOrder) {
          updateOrderStatus(editingOrder.id, OrderStatus.CANCELLED);
          setEditingOrder(null);
          setConfirmCancelId(null);
      }
  };

  const handleDeleteOrder = async () => {
      if (editingOrder) {
          try {
              await deleteOrder(editingOrder.id);
              setEditingOrder(null);
              setConfirmDeleteId(null);
          } catch (error) {
              console.error(error);
          }
      }
  };

  const getReceiptDetails = (order: Order) => {
      const taxRate = settings.taxRate / 100;
      const subtotal = order.total / (1 + taxRate);
      const taxAmount = order.total - subtotal;
      return { subtotal, taxAmount };
  };

  const handleEditInPOS = (order: Order) => {
      navigate(`/pos?edit=${order.id}`);
  };

  return (
    <div className="p-8 h-full flex flex-col bg-slate-950 print:p-0 print:bg-white print:h-auto print:block">
      <div className="print:hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
            <h1 className="text-3xl font-bold text-white">Order History</h1>
            <p className="text-slate-400 mt-1">
                {isManager ? 'Track and manage all past transactions' : 'View your personal sales history'}
            </p>
            </div>
            <div className="flex gap-4">
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col min-w-[120px]">
                    <span className="text-xs text-slate-500 font-bold uppercase">
                        {isManager ? 'Total Revenue' : 'My Sales'}
                    </span>
                    <span className="text-xl font-bold text-emerald-400">{settings.currency}{totalRevenue.toLocaleString()}</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col min-w-[100px]">
                    <span className="text-xs text-slate-500 font-bold uppercase">Orders</span>
                    <span className="text-xl font-bold text-white">{filteredOrders.length}</span>
                </div>
            </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-lg mb-6 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Search Order ID, Customer, or Table..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-800 border-none rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 placeholder-slate-500"
                />
            </div>
            
            <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
                <div className="relative">
                    <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="appearance-none bg-slate-800 text-white pl-9 pr-8 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer text-sm font-semibold"
                    >
                        <option value="ALL">All Status</option>
                        <option value={OrderStatus.PAID}>Paid</option>
                        <option value={OrderStatus.PENDING}>Pending</option>
                        <option value={OrderStatus.CANCELLED}>Cancelled</option>
                    </select>
                    <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                <div className="relative">
                    <input 
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="bg-slate-800 text-white pl-9 pr-4 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer text-sm font-semibold h-full"
                    />
                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
            </div>
        </div>
      </div>

      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col print:hidden">
         <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-800/50 text-slate-400 text-xs uppercase font-bold sticky top-0 backdrop-blur-md z-10">
                    <tr>
                        <th className="p-4 border-b border-slate-800">Order ID</th>
                        <th className="p-4 border-b border-slate-800">Date & Time</th>
                        <th className="p-4 border-b border-slate-800">Server</th>
                        <th className="p-4 border-b border-slate-800">Customer / Table</th>
                        <th className="p-4 border-b border-slate-800">Items</th>
                        <th className="p-4 border-b border-slate-800 text-right">Total</th>
                        <th className="p-4 border-b border-slate-800 text-center">Status</th>
                        <th className="p-4 border-b border-slate-800 text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm">
                    {filteredOrders.length === 0 ? (
                        <tr>
                            <td colSpan={8} className="p-12 text-center text-slate-500">
                                <Receipt size={48} className="mx-auto mb-3 opacity-20" />
                                No orders found.
                            </td>
                        </tr>
                    ) : (
                        filteredOrders.map(order => {
                            const canModify = order.status !== OrderStatus.PAID && order.status !== OrderStatus.CANCELLED;
                            return (
                                <tr key={order.id} className="hover:bg-slate-800/30 transition-colors group">
                                    <td className="p-4 font-mono text-indigo-400 font-bold">
                                        #{order.id.slice(0, 6)}
                                    </td>
                                    <td className="p-4 text-slate-300">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-white">{new Date(order.timestamp).toLocaleDateString()}</span>
                                            <span className="text-xs text-slate-500">{new Date(order.timestamp).toLocaleTimeString()}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-slate-300">
                                        <span className="flex items-center gap-1 text-xs font-semibold bg-slate-800 px-2 py-1 rounded w-fit">
                                            <User size={12} className="text-indigo-400"/>
                                            {getServerName(order)}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2 text-white font-medium">
                                                {order.customerName || 'Guest'}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {order.tableId === 'TAKEAWAY' ? 'Takeaway' : `Table ${order.tableId.replace('t-', '')}`}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-slate-400">
                                        {order.items.length === 1 
                                            ? order.items[0].name 
                                            : `${order.items[0].name} +${order.items.length - 1} others`
                                        }
                                    </td>
                                    <td className="p-4 text-right font-mono font-bold text-white">
                                        {settings.currency}{order.total.toFixed(2)}
                                    </td>
                                    <td className="p-4 flex justify-center">
                                        {getStatusBadge(order.status)}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={() => setSelectedOrder(order)}
                                                className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-lg transition-colors"
                                                title="View Receipt"
                                            >
                                                <Eye size={18} />
                                            </button>
                                            
                                            {canModify && (
                                                <button 
                                                    onClick={() => setEditingOrder(order)}
                                                    className="text-slate-400 hover:text-indigo-400 p-2 hover:bg-slate-800 rounded-lg transition-colors"
                                                    title="Manage Order"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )
                        })
                    )}
                </tbody>
            </table>
         </div>
      </div>

      {/* MANAGE ORDER MODAL */}
      {editingOrder && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
                      <h2 className="text-xl font-bold text-white">Manage Order</h2>
                      <button onClick={() => { setEditingOrder(null); setConfirmCancelId(null); setConfirmDeleteId(null); }} className="text-slate-400 hover:text-white"><X size={24} /></button>
                  </div>

                  <div className="p-6 space-y-6">
                      <div className="flex flex-col gap-3">
                          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quick Actions</h3>
                          <button 
                              onClick={() => handleEditInPOS(editingOrder)}
                              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
                          >
                              <Edit size={18} /> Edit Items / Quantities
                          </button>
                          
                          <div className="grid grid-cols-2 gap-2 mt-2">
                              {[OrderStatus.PAID, OrderStatus.SERVED, OrderStatus.PREPARING, OrderStatus.READY].map(status => (
                                  <button
                                      key={status}
                                      onClick={() => handleUpdateStatus(status)}
                                      className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                                          editingOrder.status === status 
                                          ? 'bg-emerald-600 border-emerald-500 text-white' 
                                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                                      }`}
                                  >
                                      Mark as {status}
                                  </button>
                              ))}
                          </div>
                      </div>

                      <div className="pt-4 border-t border-slate-800">
                          <label className="block text-sm text-slate-400 mb-3 flex items-center gap-2 text-rose-400 font-bold uppercase tracking-wider">
                              <AlertTriangle size={14} /> Danger Zone
                          </label>
                          
                          <div className="space-y-3">
                              {confirmCancelId === editingOrder.id ? (
                                  <div className="flex gap-2 animate-in slide-in-from-bottom-2">
                                      <button onClick={() => setConfirmCancelId(null)} className="flex-1 py-3 bg-slate-800 text-white rounded-lg font-bold">Back</button>
                                      <button onClick={handleCancelOrder} className="flex-1 py-3 bg-rose-600 text-white rounded-lg font-bold">Confirm Cancel</button>
                                  </div>
                              ) : (
                                  <button 
                                      onClick={() => setConfirmCancelId(editingOrder.id)}
                                      className="w-full py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 rounded-xl font-bold flex items-center justify-center gap-2"
                                  >
                                      <Ban size={18} /> Cancel Order
                                  </button>
                              )}

                              {isAdmin && (
                                  <>
                                      {confirmDeleteId === editingOrder.id ? (
                                          <div className="flex gap-2 animate-in slide-in-from-bottom-2">
                                              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-3 bg-slate-800 text-white rounded-lg font-bold">Back</button>
                                              <button onClick={handleDeleteOrder} className="flex-1 py-3 bg-rose-700 text-white rounded-lg font-bold">Confirm Delete</button>
                                          </div>
                                      ) : (
                                          <button 
                                              onClick={() => setConfirmDeleteId(editingOrder.id)}
                                              className="w-full py-3 bg-slate-900 hover:bg-rose-900/40 text-rose-600 border border-slate-800 rounded-xl font-bold flex items-center justify-center gap-2"
                                          >
                                              <Trash2 size={18} /> Permanently Delete
                                          </button>
                                      )}
                                  </>
                              )}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* RECEIPT VIEW MODAL (Existing functionality) */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white text-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden print:shadow-none">
                <div className="bg-slate-100 border-b p-6 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Receipt className="text-slate-500" /> Order Receipt
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Order #{selectedOrder.id.slice(0, 8)}</p>
                    </div>
                    <button onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-slate-700">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                    <div className="flex justify-between items-center text-sm border-b border-dashed pb-4">
                        <div>
                            <span className="block font-bold">Customer</span>
                            <span className="text-slate-600">{selectedOrder.customerName || 'Guest'}</span>
                        </div>
                        <div className="text-right">
                            <span className="block font-bold">Date</span>
                            <span className="text-slate-600">{new Date(selectedOrder.timestamp).toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {selectedOrder.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-start text-sm border-b border-slate-100 pb-2 last:border-0">
                                <div>
                                    <span className="text-slate-800 font-medium block">{item.name}</span>
                                    <div className="text-xs text-slate-500 mt-0.5">
                                        {item.quantity} x <span className="font-mono">{settings.currency}{item.price.toFixed(2)}</span>
                                    </div>
                                </div>
                                <span className="font-bold text-slate-900">{settings.currency}{(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="border-t border-dashed pt-4 space-y-2">
                         {(() => {
                             const { subtotal, taxAmount } = getReceiptDetails(selectedOrder);
                             return (
                                 <>
                                    <div className="flex justify-between text-sm text-slate-600">
                                        <span>Subtotal</span>
                                        <span>{settings.currency}{subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-slate-600">
                                        <span>Tax ({settings.taxRate}%)</span>
                                        <span>{settings.currency}{taxAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-xl font-bold border-t pt-2 mt-2">
                                        <span>Total</span>
                                        <span>{settings.currency}{selectedOrder.total.toFixed(2)}</span>
                                    </div>
                                 </>
                             )
                         })()}
                    </div>
                </div>
                <div className="p-4 bg-slate-50 border-t text-center">
                     <button onClick={() => window.print()} className="text-indigo-600 font-semibold text-sm hover:underline flex items-center justify-center gap-2 mx-auto">
                        <Printer size={16} /> Print Receipt
                     </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
