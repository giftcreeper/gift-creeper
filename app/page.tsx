'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  LayoutDashboard,
  Users,
  FilePlus,
  ListOrdered,
  Printer,
  Plus,
  Trash2,
  Search,
  Building,
  Phone,
  Mail,
  DollarSign,
  TrendingUp,
  Clock,
  PackageCheck,
  ArrowRight
} from 'lucide-react';

// --- Supabase 初始化 ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

interface Client {
  id: string;
  school_name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
}

interface OrderItem {
  id: string;
  name: string;
  spec: string;
  unit_cost_rmb: number;
  qty: number;
}

interface Order {
  id: string;
  order_no: string;
  client_id: string;
  client_name?: string;
  exchange_rate: number;
  service_fee_pct: number;
  shipping_fee_rmb: number;
  items: OrderItem[];
  subtotal_rmb: number;
  grand_total_hkd: number;
  status: 'Draft' | 'Quoted' | 'Confirmed' | 'Shipped' | 'Completed';
  notes: string;
  created_at: string;
}

export default function GiftCreeperApp() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clients' | 'create_order' | 'orders' | 'print'>('dashboard');
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<Order | null>(null);

  // --- Supabase 資料同步 ---
  useEffect(() => {
    if (supabase) {
      fetchClients();
      fetchOrders();
    }
  }, []);

  const fetchClients = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
    if (!error && data) setClients(data);
  };

  const fetchOrders = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from('orders').select('*, clients(school_name)').order('created_at', { ascending: false });
    if (!error && data) {
      const formatted = data.map((item: any) => ({
        ...item,
        client_name: item.clients?.school_name || '未指定學校'
      }));
      setOrders(formatted);
    }
  };

  // --- 客戶管理表單 ---
  const [newClient, setNewClient] = useState({ school_name: '', contact_person: '', phone: '', email: '', address: '' });
  const [clientSearch, setClientSearch] = useState('');

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.school_name) return;

    if (supabase) {
      const { data, error } = await supabase.from('clients').insert([newClient]).select();
      if (!error && data) {
        setClients([data[0], ...clients]);
      }
    }
    setNewClient({ school_name: '', contact_person: '', phone: '', email: '', address: '' });
    alert('成功新增客戶紀錄！');
  };

  // --- 開單計算 Logic ---
  const [selectedClientId, setSelectedClientId] = useState('');
  const [exchangeRate, setExchangeRate] = useState<number>(1.08);
  const [serviceFeePct, setServiceFeePct] = useState<number>(15);
  const [shippingFeeRmb, setShippingFeeRmb] = useState<number>(50);
  const [orderNotes, setOrderNotes] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([
    { id: '1', name: '', spec: '', unit_cost_rmb: 0, qty: 100 }
  ]);

  const addOrderItem = () => {
    setOrderItems([...orderItems, { id: Date.now().toString(), name: '', spec: '', unit_cost_rmb: 0, qty: 100 }]);
  };

  const removeOrderItem = (id: string) => {
    if (orderItems.length > 1) {
      setOrderItems(orderItems.filter(item => item.id !== id));
    }
  };

  const updateOrderItem = (id: string, field: keyof OrderItem, value: any) => {
    setOrderItems(orderItems.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const calculations = useMemo(() => {
    const subtotalRmb = orderItems.reduce((acc, item) => acc + (Number(item.unit_cost_rmb) * Number(item.qty)), 0);
    const subtotalHkd = subtotalRmb * exchangeRate;
    const serviceFeeHkd = subtotalHkd * (serviceFeePct / 100);
    const shippingHkd = shippingFeeRmb * exchangeRate;
    const grandTotalHkd = Math.round(subtotalHkd + serviceFeeHkd + shippingHkd);

    return { subtotalRmb, subtotalHkd, serviceFeeHkd, shippingHkd, grandTotalHkd };
  }, [orderItems, exchangeRate, serviceFeePct, shippingFeeRmb]);

  const handleCreateOrder = async () => {
    if (!selectedClientId) {
      alert('請先選擇客戶/學校！');
      return;
    }

    const orderNo = `GC-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`;

    const newOrderData = {
      order_no: orderNo,
      client_id: selectedClientId,
      exchange_rate: exchangeRate,
      service_fee_pct: serviceFeePct,
      shipping_fee_rmb: shippingFeeRmb,
      items: orderItems,
      subtotal_rmb: calculations.subtotalRmb,
      grand_total_hkd: calculations.grandTotalHkd,
      status: 'Quoted' as const,
      notes: orderNotes,
      created_at: new Date().toISOString().split('T')[0]
    };

    if (supabase) {
      const { error } = await supabase.from('orders').insert([newOrderData]);
      if (!error) {
        fetchOrders();
      } else {
        alert('建立失敗：' + error.message);
        return;
      }
    }

    alert(`訂單 ${orderNo} 建立成功！`);
    setActiveTab('orders');
  };

  const handleUpdateStatus = async (orderId: string, newStatus: Order['status']) => {
    if (supabase) {
      await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
      fetchOrders();
    }
  };

  const stats = useMemo(() => {
    const totalSales = orders.reduce((acc, o) => acc + o.grand_total_hkd, 0);
    const pendingOrders = orders.filter(o => o.status === 'Quoted' || o.status === 'Confirmed').length;
    const completedOrders = orders.filter(o => o.status === 'Completed').length;
    return { totalSales, pendingOrders, completedOrders, totalClients: clients.length };
  }, [orders, clients]);

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800">
      
      {/* 側邊導覽列 */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col justify-between print:hidden">
        <div>
          <div className="p-6 border-b border-slate-800 flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-wide text-white">Gift Creeper</h1>
              <p className="text-xs text-slate-400">禮品爬蟲 訂單管理系統</p>
            </div>
          </div>

          <nav className="p-4 space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <LayoutDashboard className="w-5 h-5" /> 數據總覽
            </button>

            <button
              onClick={() => setActiveTab('create_order')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'create_order' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <FilePlus className="w-5 h-5" /> 建立新訂單
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'orders' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <ListOrdered className="w-5 h-5" /> 訂單列表
            </button>

            <button
              onClick={() => setActiveTab('clients')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'clients' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <Users className="w-5 h-5" /> 客戶/學校資料
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/60 p-3 rounded-lg">
            <span className={`w-2 h-2 rounded-full ${supabase ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            {supabase ? 'Supabase 已連線' : '未設定 Supabase 金鑰'}
          </div>
        </div>
      </aside>

      {/* 主內容區域 */}
      <main className="flex-1 overflow-y-auto p-8">

        {/* TAB 1: 數據總覽 */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <header className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">儀表板 (Dashboard)</h2>
                <p className="text-sm text-slate-500">歡迎回來，檢視最新的禮品訂單數據。</p>
              </div>
              <button onClick={() => setActiveTab('create_order')} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
                <Plus className="w-4 h-4" /> 開立新單
              </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg"><TrendingUp className="w-6 h-6" /></div>
                <div>
                  <p className="text-xs text-slate-500">總營業額 (HKD)</p>
                  <h3 className="text-2xl font-bold text-slate-900">HK$ {stats.totalSales.toLocaleString()}</h3>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-amber-100 text-amber-600 rounded-lg"><Clock className="w-6 h-6" /></div>
                <div>
                  <p className="text-xs text-slate-500">待處理訂單</p>
                  <h3 className="text-2xl font-bold text-slate-900">{stats.pendingOrders} 單</h3>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg"><PackageCheck className="w-6 h-6" /></div>
                <div>
                  <p className="text-xs text-slate-500">已完成訂單</p>
                  <h3 className="text-2xl font-bold text-slate-900">{stats.completedOrders} 單</h3>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><Building className="w-6 h-6" /></div>
                <div>
                  <p className="text-xs text-slate-500">客戶/學校總數</p>
                  <h3 className="text-2xl font-bold text-slate-900">{stats.totalClients} 間</h3>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-900">近期訂單</h3>
                <button onClick={() => setActiveTab('orders')} className="text-xs text-indigo-600 flex items-center gap-1">查看全部 <ArrowRight className="w-3 h-3" /></button>
              </div>
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr><th className="p-3">訂單編號</th><th className="p-3">客戶學校</th><th className="p-3">金額 (HKD)</th><th className="p-3">狀態</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.slice(0, 5).map(order => (
                    <tr key={order.id}>
                      <td className="p-3 font-mono font-medium text-slate-900">{order.order_no}</td>
                      <td className="p-3 font-medium">{order.client_name}</td>
                      <td className="p-3 font-semibold text-slate-900">HK$ {order.grand_total_hkd.toLocaleString()}</td>
                      <td className="p-3"><span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">{order.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: 建立新訂單 */}
        {activeTab === 'create_order' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <header>
              <h2 className="text-2xl font-bold text-slate-900">建立新訂單</h2>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2 border-b pb-2"><Building className="w-5 h-5 text-indigo-600" /> 1. 選擇客戶 / 學校</h3>
                  <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} className="w-full border p-2.5 rounded-lg text-sm">
                    <option value="">-- 請選擇客戶 --</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.school_name} ({c.contact_person})</option>)}
                  </select>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2"><PackageCheck className="w-5 h-5 text-indigo-600" /> 2. 禮品明細 (RMB)</h3>
                    <button onClick={addOrderItem} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> 增加項目</button>
                  </div>
                  {orderItems.map((item, index) => (
                    <div key={item.id} className="p-3 bg-slate-50 rounded-lg border space-y-2">
                      <div className="flex justify-between text-xs text-slate-400 font-semibold">
                        <span>項目 #{index + 1}</span>
                        {orderItems.length > 1 && <button onClick={() => removeOrderItem(item.id)} className="text-red-500"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                      <div className="grid grid-cols-12 gap-2">
                        <input type="text" placeholder="禮品名稱" value={item.name} onChange={(e) => updateOrderItem(item.id, 'name', e.target.value)} className="col-span-5 border p-2 rounded text-sm bg-white" />
                        <input type="text" placeholder="規格/備註" value={item.spec} onChange={(e) => updateOrderItem(item.id, 'spec', e.target.value)} className="col-span-3 border p-2 rounded text-sm bg-white" />
                        <input type="number" placeholder="單價(RMB)" value={item.unit_cost_rmb || ''} onChange={(e) => updateOrderItem(item.id, 'unit_cost_rmb', parseFloat(e.target.value) || 0)} className="col-span-2 border p-2 rounded text-sm bg-white font-mono" />
                        <input type="number" placeholder="數量" value={item.qty || ''} onChange={(e) => updateOrderItem(item.id, 'qty', parseInt(e.target.value) || 0)} className="col-span-2 border p-2 rounded text-sm bg-white font-mono" />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white p-6 rounded-xl border space-y-2">
                  <h3 className="font-bold text-sm">訂單備註</h3>
                  <textarea rows={2} placeholder="例如：預計9月開學前交貨..." value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} className="w-full border p-2 rounded text-sm" />
                </div>
              </div>

              <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg space-y-6 h-fit">
                <h3 className="font-bold text-lg border-b border-slate-800 pb-3 flex items-center gap-2"><DollarSign className="w-5 h-5 text-indigo-400" /> 費用計算</h3>
                <div className="space-y-3 text-sm">
                  <div><label className="text-xs text-slate-400">匯率 (RMB &rarr; HKD)</label><input type="number" step="0.01" value={exchangeRate} onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)} className="w-full bg-slate-800 border-slate-700 p-2 rounded text-white" /></div>
                  <div><label className="text-xs text-slate-400">服務費 / 利潤加成 (%)</label><input type="number" value={serviceFeePct} onChange={(e) => setServiceFeePct(parseFloat(e.target.value) || 0)} className="w-full bg-slate-800 border-slate-700 p-2 rounded text-white" /></div>
                  <div><label className="text-xs text-slate-400">國內運費 (RMB)</label><input type="number" value={shippingFeeRmb} onChange={(e) => setShippingFeeRmb(parseFloat(e.target.value) || 0)} className="w-full bg-slate-800 border-slate-700 p-2 rounded text-white" /></div>
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-2 text-sm">
                  <div className="flex justify-between text-slate-400"><span>貨品小計 (RMB)</span><span className="font-mono">¥ {calculations.subtotalRmb.toFixed(2)}</span></div>
                  <div className="flex justify-between text-slate-400"><span>貨品折合 (HKD)</span><span className="font-mono">HK$ {calculations.subtotalHkd.toFixed(2)}</span></div>
                  <div className="flex justify-between items-baseline pt-2 border-t border-slate-700">
                    <span className="font-bold">建議報價總額</span>
                    <span className="text-2xl font-bold text-emerald-400 font-mono">HK$ {calculations.grandTotalHkd.toLocaleString()}</span>
                  </div>
                </div>

                <button onClick={handleCreateOrder} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-lg font-bold">儲存並建立報價單</button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: 訂單列表 */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-900">訂單紀錄</h2>
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b">
                  <tr><th className="p-4">訂單編號</th><th className="p-4">客戶學校</th><th className="p-4">金額 (HKD)</th><th className="p-4">狀態</th><th className="p-4 text-center">操作</th></tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50">
                      <td className="p-4 font-mono font-bold text-slate-900">{order.order_no}</td>
                      <td className="p-4 font-medium">{order.client_name}</td>
                      <td className="p-4 font-bold font-mono">HK$ {order.grand_total_hkd.toLocaleString()}</td>
                      <td className="p-4">
                        <select value={order.status} onChange={(e) => handleUpdateStatus(order.id, e.target.value as any)} className="bg-slate-100 border text-xs rounded p-1 font-medium">
                          <option value="Draft">Draft</option>
                          <option value="Quoted">Quoted</option>
                          <option value="Confirmed">Confirmed</option>
                          <option value="Shipped">Shipped</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </td>
                      <td className="p-4 text-center">
                        <button onClick={() => { setSelectedOrderForPrint(order); setActiveTab('print'); }} className="bg-slate-900 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1 mx-auto">
                          <Printer className="w-3.5 h-3.5" /> 檢視/列印
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: 客戶管理 */}
        {activeTab === 'clients' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-900">客戶/學校管理</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
                <h3 className="font-bold border-b pb-2 flex items-center gap-2"><Plus className="w-4 h-4 text-indigo-600" /> 新增客戶/學校</h3>
                <form onSubmit={handleAddClient} className="space-y-3">
                  <div><label className="text-xs font-medium">學校名稱 *</label><input type="text" required value={newClient.school_name} onChange={(e) => setNewClient({ ...newClient, school_name: e.target.value })} className="w-full border p-2 rounded text-sm mt-1" /></div>
                  <div><label className="text-xs font-medium">聯絡人</label><input type="text" value={newClient.contact_person} onChange={(e) => setNewClient({ ...newClient, contact_person: e.target.value })} className="w-full border p-2 rounded text-sm mt-1" /></div>
                  <div><label className="text-xs font-medium">電話</label><input type="text" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} className="w-full border p-2 rounded text-sm mt-1" /></div>
                  <div><label className="text-xs font-medium">電郵</label><input type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} className="w-full border p-2 rounded text-sm mt-1" /></div>
                  <div><label className="text-xs font-medium">地址</label><textarea rows={2} value={newClient.address} onChange={(e) => setNewClient({ ...newClient, address: e.target.value })} className="w-full border p-2 rounded text-sm mt-1" /></div>
                  <button type="submit" className="w-full bg-indigo-600 text-white font-medium py-2 rounded-lg text-sm">儲存客戶</button>
                </form>
              </div>

              <div className="md:col-span-2 bg-white rounded-xl border shadow-sm p-6 space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="font-bold">學校清單 ({clients.length})</h3>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input type="text" placeholder="搜尋學校..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="pl-9 pr-4 py-1.5 border rounded-lg text-xs" />
                  </div>
                </div>
                <div className="divide-y">
                  {clients.filter(c => c.school_name.includes(clientSearch)).map(client => (
                    <div key={client.id} className="py-3">
                      <h4 className="font-bold text-slate-900">{client.school_name}</h4>
                      <p className="text-xs text-slate-500 flex gap-3 mt-1">
                        <span><Users className="w-3 h-3 inline mr-1" />{client.contact_person || '未設置'}</span>
                        <span><Phone className="w-3 h-3 inline mr-1" />{client.phone || '未設置'}</span>
                        <span><Mail className="w-3 h-3 inline mr-1" />{client.email || '未設置'}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: 列印報價單 */}
        {activeTab === 'print' && selectedOrderForPrint && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center print:hidden">
              <button onClick={() => setActiveTab('orders')} className="text-xs text-slate-500">← 返回訂單列表</button>
              <button onClick={() => window.print()} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-md">
                <Printer className="w-4 h-4" /> 列印 / 下載 PDF
              </button>
            </div>

            <div className="bg-white p-10 rounded-xl border border-slate-300 shadow-md print:shadow-none print:border-none print:p-0 space-y-8">
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
                <div>
                  <h1 className="text-3xl font-extrabold text-slate-900 tracking-wider">GIFT CREEPER</h1>
                  <p className="text-xs text-slate-500 mt-1">禮品爬蟲禮品服務公司 | Gift Creeper Limited</p>
                </div>
                <div className="text-right">
                  <h2 className="text-2xl font-bold text-indigo-600">QUOTATION 報價單</h2>
                  <p className="text-xs font-mono mt-1">單號: {selectedOrderForPrint.order_no}</p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-400 font-bold mb-1">TO:</p>
                <h3 className="font-bold text-slate-900 text-lg">{selectedOrderForPrint.client_name}</h3>
              </div>

              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-800 bg-slate-100">
                    <th className="p-3">#</th>
                    <th className="p-3">項目與規格</th>
                    <th className="p-3 text-right">數量</th>
                    <th className="p-3 text-right">小計 (HKD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {selectedOrderForPrint.items.map((item, idx) => {
                    const itemHkdTotal = (item.unit_cost_rmb * item.qty) * selectedOrderForPrint.exchange_rate * (1 + selectedOrderForPrint.service_fee_pct / 100);
                    return (
                      <tr key={idx}>
                        <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-3"><p className="font-bold">{item.name}</p><p className="text-xs text-slate-500">{item.spec}</p></td>
                        <td className="p-3 text-right font-mono">{item.qty}</td>
                        <td className="p-3 text-right font-mono font-semibold">HK$ {itemHkdTotal.toFixed(0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="flex justify-end pt-4 border-t-2 border-slate-800">
                <div className="w-64 text-right">
                  <div className="flex justify-between text-base font-bold text-slate-900">
                    <span>總金額 (Grand Total):</span>
                    <span className="text-indigo-600 font-mono">HK$ {selectedOrderForPrint.grand_total_hkd.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}