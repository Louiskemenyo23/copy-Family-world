
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { MenuItem, Order, Table, Staff, Reservation, OrderStatus, TableStatus, Customer, ItemCategory, SystemSettings } from '../types';
import { INITIAL_MENU, INITIAL_STAFF, INITIAL_TABLES, INITIAL_CUSTOMERS, DRINK_CATEGORIES } from '../constants';
import { supabase } from '../lib/supabase';

interface StoreContextType {
  menu: MenuItem[];
  orders: Order[];
  tables: Table[];
  staff: Staff[];
  customers: Customer[];
  reservations: Reservation[];
  currentUser: Staff | null;
  theme: 'dark' | 'light';
  settings: SystemSettings;
  loading: boolean;
  dbError: string | null;
  
  login: (id: string, passcode: string) => Promise<boolean>;
  logout: () => void;

  addOrder: (order: Order) => void;
  updateOrder: (order: Order) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  deleteOrder: (orderId: string) => Promise<void>; 
  updateTableStatus: (tableId: string, status: TableStatus) => void;
  addMenuItem: (item: MenuItem) => void;
  updateMenuItem: (item: MenuItem) => void;
  deleteMenuItem: (id: string) => void;
  toggleTableStatus: (id: string) => void;
  addReservation: (reservation: Reservation) => void;
  updateReservation: (reservation: Reservation) => void;
  removeReservation: (id: string) => void;
  addTable: (table: Table) => void;
  deleteTable: (id: string) => void;

  addStaff: (staff: Staff) => void;
  updateStaff: (staff: Staff) => void;
  deleteStaff: (id: string) => void;

  addCustomer: (customer: Customer) => void;
  updateCustomer: (customer: Customer) => void;
  deleteCustomer: (id: string) => void;

  resetSystem: () => Promise<void>;
  resetMenu: () => Promise<void>;
  toggleTheme: () => void;
  updateSettings: (newSettings: SystemSettings) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const DEFAULT_SETTINGS: SystemSettings = {
    restaurantName: 'Family World Restaurant',
    address: '123 Main Street, Accra, Ghana',
    phone: '+233 20 000 0000',
    email: 'info@familyworld.com',
    currency: '₵',
    taxRate: 10,
    receiptFooter: 'Thank you for dining with us! See you soon.',
    standbyMinutes: 15
};

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [currentUser, setCurrentUser] = useState<Staff | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
      return (localStorage.getItem('fw_theme') as 'dark' | 'light') || 'dark';
  });
  
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // --- DATA MAPPING HELPERS ---
  const mapMenuFromDB = (item: any): MenuItem => ({
      ...item,
      isAvailable: item.is_available,
      costPrice: item.cost_price,
      unit: item.unit,
      supplier: item.supplier
  });
  const mapMenuToDB = (item: MenuItem) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category,
      image: item.image,
      stock: item.stock,
      is_available: item.isAvailable,
      cost_price: item.costPrice,
      unit: item.unit,
      supplier: item.supplier
  });

  const mapOrderFromDB = (item: any): Order => ({
      ...item,
      tableId: item.table_id,
      customerName: item.customer_name,
      staffId: item.staff_id,
      staffName: item.staff_name,
      timestamp: new Date(item.timestamp)
  });
  const mapOrderToDB = (item: Order) => ({
      id: item.id,
      table_id: item.tableId,
      customer_name: item.customerName,
      items: item.items,
      status: item.status,
      total: item.total,
      timestamp: item.timestamp.toISOString(),
      notes: item.notes,
      staff_id: item.staffId,
      staff_name: item.staffName
  });

  const mapCustomerFromDB = (item: any): Customer => ({
      ...item,
      loyaltyPoints: item.loyalty_points,
      lastVisit: new Date(item.last_visit)
  });
  const mapCustomerToDB = (item: Customer) => ({
      id: item.id,
      name: item.name,
      phone: item.phone,
      email: item.email,
      loyalty_points: item.loyaltyPoints,
      notes: item.notes,
      last_visit: item.lastVisit.toISOString()
  });

  const mapReservationFromDB = (item: any): Reservation => ({
      ...item,
      tableId: item.table_id,
      customerName: item.customer_name
  });
  const mapReservationToDB = (item: Reservation) => ({
      id: item.id,
      table_id: item.tableId,
      customer_name: item.customerName,
      contact: item.contact,
      guests: item.guests,
      time: item.time,
      status: item.status,
      notes: item.notes
  });

  // --- INITIALIZATION ---
  useEffect(() => {
    const initializeApp = async () => {
        setLoading(true);
        setDbError(null);
        console.log("Supabase: Starting init sequence...");
        
        // Timeout protection: If Supabase doesn't respond in 6 seconds, use fallbacks
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Database connection timed out")), 6000)
        );

        try {
            const storedSettings = localStorage.getItem('fw_settings');
            if (storedSettings) {
                setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) });
            }

            // Race the staff fetch against our 6s timeout
            const staffPromise = supabase.from('staff').select('*').limit(50);
            const { data: staffData, error: staffError } = await Promise.race([staffPromise, timeoutPromise]) as any;
            
            if (staffError) {
                console.error("Supabase Staff Fetch Error:", staffError);
                setDbError(`Database unavailable: ${staffError.message}`);
                setStaff(INITIAL_STAFF);
            } else if (!staffData || staffData.length === 0) {
                console.warn("Supabase: No staff data. Seeding...");
                await supabase.from('staff').insert(INITIAL_STAFF);
                setStaff(INITIAL_STAFF);
            } else {
                setStaff(staffData as Staff[]);
            }

            // Restore user session
            const storedUserId = localStorage.getItem('fw_user_id');
            if (storedUserId) {
                const activeStaffList = staffData || INITIAL_STAFF;
                const foundUser = (activeStaffList as Staff[]).find(s => s.id === storedUserId);
                if (foundUser && foundUser.status === 'ACTIVE') {
                    setCurrentUser(foundUser);
                }
            }

            // Load other modules
            const [menuRes, tablesRes, customersRes, ordersRes, resRes] = await Promise.all([
                supabase.from('menu').select('*'),
                supabase.from('tables').select('*'),
                supabase.from('customers').select('*'),
                supabase.from('orders').select('*'),
                supabase.from('reservations').select('*')
            ]);

            if (menuRes.data && menuRes.data.length > 0) setMenu(menuRes.data.map(mapMenuFromDB));
            else { setMenu(INITIAL_MENU); }

            if (tablesRes.data && tablesRes.data.length > 0) setTables(tablesRes.data as Table[]);
            else { setTables(INITIAL_TABLES); }

            if (customersRes.data) setCustomers(customersRes.data.map(mapCustomerFromDB));
            if (ordersRes.data) setOrders(ordersRes.data.map(mapOrderFromDB));
            if (resRes.data) setReservations(resRes.data.map(mapReservationFromDB));

        } catch (error: any) {
            console.error("Critical System Failure during Init:", error);
            setDbError(`System offline: ${error.message || "Network Error"}`);
            // Fallbacks to keep UI working
            setStaff(INITIAL_STAFF);
            setMenu(INITIAL_MENU);
            setTables(INITIAL_TABLES);
        } finally {
            setLoading(false);
            console.log("Supabase: Init process finished.");
        }
    };
    initializeApp();
  }, []);

  const login = async (id: string, passcode: string): Promise<boolean> => {
      const user = staff.find(s => s.id === id && String(s.passcode) === passcode);
      if (user && user.status === 'ACTIVE') {
          setCurrentUser(user);
          localStorage.setItem('fw_user_id', user.id);
          return true;
      }
      return false;
  };

  const logout = () => {
      setCurrentUser(null);
      localStorage.removeItem('fw_user_id');
  };

  useEffect(() => {
      localStorage.setItem('fw_theme', theme);
      if (theme === 'light') {
          document.documentElement.classList.add('light-mode');
          document.documentElement.classList.remove('dark');
      } else {
          document.documentElement.classList.remove('light-mode');
          document.documentElement.classList.add('dark');
      }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const updateSettings = (newSettings: SystemSettings) => {
      setSettings(newSettings);
      localStorage.setItem('fw_settings', JSON.stringify(newSettings));
  };

  const addOrder = async (order: Order) => {
    setOrders((prev) => [order, ...prev]);
    if (order.tableId !== 'TAKEAWAY') {
      updateTableStatus(order.tableId, TableStatus.OCCUPIED);
    }
    await supabase.from('orders').insert(mapOrderToDB(order));
  };

  const updateOrder = async (order: Order) => {
    setOrders((prev) => prev.map(o => o.id === order.id ? order : o));
    await supabase.from('orders').update(mapOrderToDB(order)).eq('id', order.id);
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    setOrders((prev) => prev.map(o => o.id === orderId ? { ...o, status } : o));
    await supabase.from('orders').update({ status }).eq('id', orderId);
  };

  const deleteOrder = async (orderId: string) => {
    setOrders(prev => prev.filter(o => o.id !== orderId));
    await supabase.from('orders').delete().eq('id', orderId);
  };

  const updateTableStatus = async (tableId: string, status: TableStatus) => {
    setTables((prev) => prev.map(t => t.id === tableId ? { ...t, status } : t));
    await supabase.from('tables').update({ status }).eq('id', tableId);
  };

  const toggleTableStatus = (id: string) => {
      const table = tables.find(t => t.id === id);
      if (table) {
          let next = TableStatus.AVAILABLE;
          if (table.status === TableStatus.AVAILABLE) next = TableStatus.OCCUPIED;
          else if (table.status === TableStatus.OCCUPIED) next = TableStatus.DIRTY;
          else if (table.status === TableStatus.DIRTY) next = TableStatus.AVAILABLE;
          updateTableStatus(id, next);
      }
  };

  const addTable = async (table: Table) => {
    setTables(prev => [...prev, table]);
    await supabase.from('tables').insert(table);
  };

  const deleteTable = async (id: string) => {
    setTables(prev => prev.filter(t => t.id !== id));
    await supabase.from('tables').delete().eq('id', id);
  };

  const addMenuItem = async (item: MenuItem) => {
    setMenu(prev => [...prev, item]);
    await supabase.from('menu').insert(mapMenuToDB(item));
  };

  const updateMenuItem = async (item: MenuItem) => {
    setMenu(prev => prev.map(i => i.id === item.id ? item : i));
    await supabase.from('menu').update(mapMenuToDB(item)).eq('id', item.id);
  };

  const deleteMenuItem = async (id: string) => {
    setMenu(prev => prev.filter(i => i.id !== id));
    await supabase.from('menu').delete().eq('id', id);
  };

  const addReservation = async (reservation: Reservation) => {
    setReservations(prev => [...prev, reservation]);
    await supabase.from('reservations').insert(mapReservationToDB(reservation));
  };

  const updateReservation = async (reservation: Reservation) => {
    setReservations(prev => prev.map(r => r.id === reservation.id ? reservation : r));
    await supabase.from('reservations').update(mapReservationToDB(reservation)).eq('id', reservation.id);
  };

  const removeReservation = async (id: string) => {
    setReservations(prev => prev.filter(r => r.id !== id));
    await supabase.from('reservations').delete().eq('id', id);
  };

  const addStaff = async (newStaff: Staff) => {
    setStaff(prev => [...prev, newStaff]);
    await supabase.from('staff').insert(newStaff);
  };

  const updateStaff = async (updatedStaff: Staff) => {
    setStaff(prev => prev.map(s => s.id === updatedStaff.id ? updatedStaff : s));
    await supabase.from('staff').update(updatedStaff).eq('id', updatedStaff.id);
  };

  const deleteStaff = async (id: string) => {
    setStaff(prev => prev.filter(s => s.id !== id));
    await supabase.from('staff').delete().eq('id', id);
  };

  const addCustomer = async (newCustomer: Customer) => {
    setCustomers(prev => [...prev, newCustomer]);
    await supabase.from('customers').insert(mapCustomerToDB(newCustomer));
  };

  const updateCustomer = async (updatedCustomer: Customer) => {
    setCustomers(prev => prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
    await supabase.from('customers').update(mapCustomerToDB(updatedCustomer)).eq('id', updatedCustomer.id);
  };

  const deleteCustomer = async (id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
    await supabase.from('customers').delete().eq('id', id);
  };

  const resetSystem = async () => {
    await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
    await supabase.from('reservations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setOrders([]);
    setReservations([]);
    setCustomers([]);
  };

  const resetMenu = async () => {
    await supabase.from('menu').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('menu').insert(INITIAL_MENU.map(mapMenuToDB));
    setMenu(INITIAL_MENU);
  };

  return (
    <StoreContext.Provider value={{
      menu, orders, tables, staff, customers, reservations, currentUser, theme, loading, settings, dbError,
      login, logout,
      addOrder, updateOrder, updateOrderStatus, deleteOrder, updateTableStatus, addMenuItem, updateMenuItem, deleteMenuItem, toggleTableStatus,
      addReservation, updateReservation, removeReservation, addTable, deleteTable,
      addStaff, updateStaff, deleteStaff,
      addCustomer, updateCustomer, deleteCustomer,
      resetSystem, resetMenu, toggleTheme, updateSettings
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
};
