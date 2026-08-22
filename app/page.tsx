'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  LayoutDashboard,
  Users,
  FilePlus,
  ListOrdered,
  Printer,
  Plus,
  Trash2,
  Edit,
  Search,
  Building,
  Phone,
  Mail,
  DollarSign,
  TrendingUp,
  Clock,
  PackageCheck,
  ArrowRight,
  Sparkles,
  Image as ImageIcon,
  Loader2,
  Upload,
  CheckCircle2
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
  isAiGenerated?: boolean;
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
  screenshot_url?: string;
  created_at: string;
}

export default function GiftCreeperApp() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clients' | 'create_order' | 'orders' | 'print'>('dashboard');
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<Order | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const { data, error } = await supabase.from('orders').select('*, clients(school_name, contact_person, phone, email, address)').order('created_at', { ascending: false });
    if (!error && data) {
      const formatted = data.map((item: any) => ({
        ...item,
        client_name: item.clients?.school_name || '未指定學校',
        client_info: item.clients || null
      }));
      setOrders(formatted);
    }
  };

  const currentPrintClient = useMemo(() => {
    if (!selectedOrderForPrint) return null;
    return clients.find(c => c.id === selectedOrderForPrint.client_id) || (selectedOrderForPrint as any).client_info || null;
  }, [selectedOrderForPrint, clients]);

  // 格式化日期為 YYYY-MM-DD
  const formatDateYYYYMMDD = (dateStr?: string) => {
    if (!dateStr) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

  // --- 開單與編輯狀態 Logic ---
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [exchangeRate, setExchangeRate] = useState<number>(1.15);
  const [serviceFeePct, setServiceFeePct] = useState<number>(30);
  const [shippingFeeRmb, setShippingFeeRmb] = useState<number>(50);
  const [orderNotes, setOrderNotes] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([
    { id: '1', name: '', spec: '', unit_cost_rmb: 0, qty: 100 }
  ]);

  const [isParsingScreenshot, setIsParsingScreenshot] = useState(false);
  const [uploadedScreenshotUrl, setUploadedScreenshotUrl] = useState<string | null>(null);

  const resetOrderForm = () => {
    setEditingOrderId(null);
    setSelectedClientId('');
    setExchangeRate(1.15);
    setServiceFeePct(30);
    setShippingFeeRmb(50);
    setOrderNotes('');
    setUploadedScreenshotUrl(null);
    setOrderItems([{ id: '1', name: '', spec: '', unit_cost_rmb: 0, qty: 100 }]);
  };

  useEffect(() => {
    if (activeTab !== 'create_order') return;

    const handlePaste = async (e: ClipboardEvent) => {
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      const imageFiles: File[] = [];
      for (const item of clipboardItems) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        await handleProcessScreenshots(imageFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeTab, orderItems]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleProcessScreenshots(Array.from(files));
      e.target.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        await handleProcessScreenshots(imageFiles);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleProcessScreenshots = async (files: File[]) => {
    setIsParsingScreenshot(true);
    try {
      const base64List = await Promise.all(files.map(f => convertFileToBase64(f)));

      if (supabase && files[0]) {
        try {
          const fileName = `screenshot-${Date.now()}.png`;
          const { data: storageData } = await supabase.storage.from('order-screenshots').upload(fileName, files[0]);
          if (storageData) {
            const { data: { publicUrl } } = supabase.storage.from('order-screenshots').getPublicUrl(fileName);
            setUploadedScreenshotUrl(publicUrl);
          }
        } catch (storageErr) {
          console.warn('Storage error:', storageErr);
        }
      }

      const res = await fetch('/api/parse-cart-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagesBase64: base64List }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`伺服器回應錯誤 (${res.status}): ${errorText.slice(0, 100)}`);
      }

      const data = await res.json();

      if (data.success && data.items && data.items.length > 0) {
        const aiRows: OrderItem[] = data.items.map((item: any, idx: number) => ({
          id: `ai-${Date.now()}-${idx}`,
          name: item.product_name || '未命名商品',
          spec: item.spec || '',
          unit_cost_rmb: Number(item.price) || 0,
          qty: Number(item.quantity) || 100,
          isAiGenerated: true
        }));

        setOrderItems((prevItems) => {
          const isFirstRowEmpty = prevItems.length === 1 && !prevItems[0].name.trim();
          return isFirstRowEmpty ? aiRows : [...prevItems, ...aiRows];
        });

        alert(`✨ AI 成功解析 ${files.length} 張圖，一共提取了 ${aiRows.length} 項商品！`);
      } else {
        alert('⚠️ 無法識別購物車截圖，請確認圖片是否清晰。');
      }
    } catch (err: any) {
      console.error(err);
      alert(`❌ 截圖辨識過程發生錯誤：${err.message || '未知錯誤'}`);
    } finally {
      setIsParsingScreenshot(false);
    }
  };

  const addOrderItem = () => {
    setOrderItems([...orderItems, { id: Date.now().toString(), name: '', spec: '', unit_cost_rmb: 0, qty: 100 }]);
  };

  const removeOrderItem = (id: string) => {
    if (orderItems.length > 1) {
      setOrderItems(orderItems.filter(item => item.id !== id));
    }
  };

  const updateOrderItem = (id: string, field: keyof OrderItem, value: any) => {
    setOrderItems(prevItems => {
      const updated = prevItems.map(item => item.id === id ? { ...item, [field]: value } : item);
      const isLastItem = prevItems[prevItems.length - 1].id === id;

      if (isLastItem && field === 'name' && value.toString().trim() !== '') {
        return [
          ...updated,
          { id: Date.now().toString(), name: '', spec: '', unit_cost_rmb: 0, qty: 100 }
        ];
      }
      return updated;
    });
  };

  const calculations = useMemo(() => {
    const subtotalRmb = orderItems.reduce((acc, item) => acc + (Number(item.unit_cost_rmb) * Number(item.qty)), 0);
    const subtotalHkd = subtotalRmb * exchangeRate;
    const serviceFeeHkd = subtotalHkd * (serviceFeePct / 100);
    const shippingHkd = shippingFeeRmb * exchangeRate;
    const grandTotalHkd = Math.round(subtotalHkd + serviceFeeHkd + shippingHkd);
    return { subtotalRmb, subtotalHkd, serviceFeeHkd, shippingHkd, grandTotalHkd };
  }, [orderItems, exchangeRate, serviceFeePct, shippingFeeRmb]);

  const handleSaveOrder = async () => {
    if (!selectedClientId) {
      alert('請先選擇客戶/學校！');
      return;
    }

    const validItems = orderItems.filter(item => item.name.trim() !== '');
    if (validItems.length === 0) {
      alert('請至少填寫一個產品項目的品名！');
      return;
    }

    if (editingOrderId) {
      const updateData = {
        client_id: selectedClientId,
        exchange_rate: exchangeRate,
        service_fee_pct: serviceFeePct,
        shipping_fee_rmb: shippingFeeRmb,
        items: validItems,
        subtotal_rmb: calculations.subtotalRmb,
        grand_total_hkd: calculations.grandTotalHkd,
        notes: orderNotes,
        screenshot_url: uploadedScreenshotUrl || null,
      };

      if (supabase) {
        const { error } = await supabase.from('orders').update(updateData).eq('id', editingOrderId);
        if (!error) {
          fetchOrders();
          alert('訂單修改成功！');
          resetOrderForm();
          setActiveTab('orders');
        } else {
          alert('修改失敗：' + error.message);
        }
      }
    } else {
      const orderNo = `GC-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`;

      const newOrderData = {
        order_no: orderNo,
        client_id: selectedClientId,
        exchange_rate: exchangeRate,
        service_fee_pct: serviceFeePct,
        shipping_fee_rmb: shippingFeeRmb,
        items: validItems,
        subtotal_rmb: calculations.subtotalRmb,
        grand_total_hkd: calculations.grandTotalHkd,
        status: 'Quoted' as const,
        notes: orderNotes,
        screenshot_url: uploadedScreenshotUrl || null,
        created_at: new Date().toISOString().split('T')[0]
      };

      if (supabase) {
        const { error } = await supabase.from('orders').insert([newOrderData]);
        if (!error) {
          fetchOrders();
          alert(`訂單 ${orderNo} 建立成功！`);
          resetOrderForm();
          setActiveTab('orders');
        } else {
          alert('建立失敗：' + error.message);
        }
      }
    }
  };

  const handleEditOrder = (order: Order) => {
    setEditingOrderId(order.id);
    setSelectedClientId(order.client_id);
    setExchangeRate(order.exchange_rate);
    setServiceFeePct(order.service_fee_pct);
    setShippingFeeRmb(order.shipping_fee_rmb);
    setOrderNotes(order.notes || '');
    setUploadedScreenshotUrl(order.screenshot_url || null);
    setOrderItems(order.items && order.items.length > 0 ? order.items : [{ id: '1', name: '', spec: '', unit_cost_rmb: 0, qty: 100 }]);
    setActiveTab('create_order');
  };

  const handleDeleteOrder = async (orderId: string, orderNo: string) => {
    if (window.confirm(`確定要刪除訂單 ${orderNo} 嗎？此操作無法撤銷。`)) {
      if (supabase) {
        const { error } = await supabase.from('orders').delete().eq('id', orderId);
        if (!error) {
          setOrders(orders.filter(o => o.id !== orderId));
          alert('訂單已順利刪除！');
        } else {
          alert('刪除失敗：' + error.message);
        }
      }
    }
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

  const printPages = useMemo(() => {
    if (!selectedOrderForPrint || !selectedOrderForPrint.items) return [];
    const items = selectedOrderForPrint.items;
    const pages = [];
    const pageSize = 20;
    for (let i = 0; i < items.length; i += pageSize) {
      pages.push(items.slice(i, i + pageSize));
    }
    return pages.length > 0 ? pages : [[]];
  }, [selectedOrderForPrint]);

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
              <p className="text-xs text-slate-400">訂單管理系統</p>
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
              onClick={() => { resetOrderForm(); setActiveTab('create_order'); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'create_order' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <FilePlus className="w-5 h-5" /> {editingOrderId ? '修改訂單中' : '建立新訂單'}
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
      <main className="flex-1 overflow-y-auto p-8 print:p-0 print:overflow-visible print:bg-white">
        {/* TAB 1: 數據總覽 */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <header className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">儀表板 (Dashboard)</h2>
                <p className="text-sm text-slate-500">歡迎回來，檢視最新的禮品訂單數據。</p>
              </div>
              <button onClick={() => { resetOrderForm(); setActiveTab('create_order'); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
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

        {/* TAB 2: 建立/修改訂單 */}
        {activeTab === 'create_order' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <header className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-900">
                {editingOrderId ? '修改訂單資料' : '建立新訂單'}
              </h2>
              {editingOrderId && (
                <button onClick={resetOrderForm} className="text-xs bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded font-medium text-slate-700">
                  取消編輯 (切換為新建)
                </button>
              )}
            </header>

            {/* AI 快捷填單區 */}
            <div 
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-dashed border-indigo-200 hover:border-indigo-400 transition-colors cursor-pointer rounded-xl p-5 text-center shadow-sm relative overflow-hidden group"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="image/*" 
                multiple
                className="hidden" 
              />

              <div className="flex items-center justify-center gap-2 text-indigo-900 font-bold text-base mb-1">
                <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
                AI 快捷填單：按 <kbd className="px-2 py-0.5 bg-white border border-indigo-300 rounded shadow-sm text-xs font-mono">Ctrl + V</kbd> 貼上截圖，或【拖曳 / 點擊選取多張圖片】
              </div>

              <p className="text-xs text-indigo-600 flex items-center justify-center gap-1 mt-1">
                <Upload className="w-3.5 h-3.5" />
                支援一次上傳多張淘寶購物車截圖，AI 將自動合併所有商品並填入表格
              </p>

              {isParsingScreenshot && (
                <div className="mt-3 inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-1.5 rounded-full text-xs font-medium animate-bounce shadow">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Qwen-VL 視覺 AI 解析多圖中...
                </div>
              )}

              {uploadedScreenshotUrl && (
                <div className="mt-2 text-xs text-slate-500 flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                  已上傳截圖備份：<a href={uploadedScreenshotUrl} target="_blank" rel="noreferrer" className="text-indigo-600 underline">檢視原圖</a>
                </div>
              )}
            </div>

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
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <PackageCheck className="w-5 h-5 text-indigo-600" /> 2. 產品明細 (RMB)
                    </h3>
                    <button onClick={addOrderItem} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded font-medium flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> 增加項目
                    </button>
                  </div>

                  <div className="grid grid-cols-12 gap-2 text-xs font-bold text-slate-500 px-3 pt-1">
                    <span className="col-span-5">品名</span>
                    <span className="col-span-3">顏色/類別</span>
                    <span className="col-span-2">單價 (RMB)</span>
                    <span className="col-span-2">數量</span>
                  </div>

                  {orderItems.map((item, index) => (
                    <div key={item.id} className={`p-3 rounded-lg border space-y-2 transition-colors ${item.isAiGenerated ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex justify-between text-xs font-semibold">
                        <span className={item.isAiGenerated ? 'text-indigo-600 flex items-center gap-1' : 'text-slate-400'}>
                          {item.isAiGenerated && <Sparkles className="w-3 h-3 inline" />}
                          項目 #{index + 1} {item.isAiGenerated && '(AI 自動填入)'}
                        </span>
                        {orderItems.length > 1 && (
                          <button onClick={() => removeOrderItem(item.id)} className="text-red-500 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-12 gap-2">
                        <input
                          type="text"
                          placeholder="輸入品名"
                          value={item.name}
                          onChange={(e) => updateOrderItem(item.id, 'name', e.target.value)}
                          className="col-span-5 border p-2 rounded text-sm bg-white focus:outline-indigo-500"
                        />
                        <input
                          type="text"
                          placeholder="顏色/類別"
                          value={item.spec}
                          onChange={(e) => updateOrderItem(item.id, 'spec', e.target.value)}
                          className="col-span-3 border p-2 rounded text-sm bg-white focus:outline-indigo-500"
                        />
                        <input
                          type="number"
                          placeholder="單價(RMB)"
                          value={item.unit_cost_rmb || ''}
                          onChange={(e) => updateOrderItem(item.id, 'unit_cost_rmb', parseFloat(e.target.value) || 0)}
                          className="col-span-2 border p-2 rounded text-sm bg-white font-mono focus:outline-indigo-500"
                        />
                        <input
                          type="number"
                          placeholder="數量"
                          value={item.qty || ''}
                          onChange={(e) => updateOrderItem(item.id, 'qty', parseInt(e.target.value) || 0)}
                          className="col-span-2 border p-2 rounded text-sm bg-white font-mono focus:outline-indigo-500"
                        />
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
                  <div><label className="text-xs text-slate-400">匯率 (RMB → HKD)</label><input type="number" step="0.01" value={exchangeRate} onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)} className="w-full bg-slate-800 border-slate-700 p-2 rounded text-white" /></div>
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

                <button onClick={handleSaveOrder} className="w-full bg-indigo-600 hover:bg-indigo-500 py-3 rounded-lg font-bold">
                  {editingOrderId ? '更新訂單內容' : '儲存並建立報價單'}
                </button>
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
                  <tr>
                    <th className="p-4">訂單編號</th>
                    <th className="p-4">客戶學校</th>
                    <th className="p-4">金額 (HKD)</th>
                    <th className="p-4">狀態</th>
                    <th className="p-4 text-center">操作</th>
                  </tr>
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
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => { setSelectedOrderForPrint(order); setActiveTab('print'); }} 
                            className="bg-slate-900 text-white px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1 hover:bg-slate-800"
                            title="檢視/列印"
                          >
                            <Printer className="w-3.5 h-3.5" /> 列印
                          </button>
                          <button 
                            onClick={() => handleEditOrder(order)} 
                            className="bg-indigo-50 text-indigo-600 border border-indigo-200 px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1 hover:bg-indigo-100"
                            title="修改訂單"
                          >
                            <Edit className="w-3.5 h-3.5" /> 編輯
                          </button>
                          <button 
                            onClick={() => handleDeleteOrder(order.id, order.order_no)} 
                            className="bg-red-50 text-red-600 border border-red-200 px-2 py-1.5 rounded text-xs font-medium flex items-center hover:bg-red-100"
                            title="刪除訂單"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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

        {/* TAB 5: 升級版專業報價單 (更新 Header 聯絡資訊與 YYYY-MM-DD 日期格式) */}
        {activeTab === 'print' && selectedOrderForPrint && (
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* 頂部操作按鈕 */}
            <div className="flex justify-between items-center print:hidden bg-slate-200 p-4 rounded-xl shadow-inner">
              <button onClick={() => setActiveTab('orders')} className="text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1">
                ← 返回訂單列表
              </button>
              <button 
                onClick={() => window.print()} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 shadow-md transition-all transform hover:scale-105"
              >
                <Printer className="w-4 h-4" /> 列印 / 下載專業 PDF
              </button>
            </div>

            {/* 多頁渲染 container */}
            <div className="space-y-8 print:space-y-0">
              {printPages.map((pageItems, pageIdx) => {
                const isLastPage = pageIdx === printPages.length - 1;

                return (
                  <div 
                    key={pageIdx} 
                    className="bg-white p-10 rounded-2xl border border-slate-200 shadow-xl print:shadow-none print:border-none print:p-0 print:m-0 space-y-6 font-sans text-slate-800 relative print:break-after-page"
                    style={{ pageBreakAfter: isLastPage ? 'auto' : 'always' }}
                  >
                    {/* Header 抬頭：已取消地址與網站，更新電話與 Email */}
                    <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5">
                      <div className="space-y-1">
                        <h1 className="text-2xl font-extrabold text-slate-900 tracking-wider">GIFT CREEPER</h1>
                        <p className="text-sm font-bold text-indigo-600">博禮貿易公司 | GIFT CREEPER TRADING CO.</p>
                        <div className="text-xs text-slate-500 space-y-0.5 pt-1">
                          <p>📞 電話: +852 4624 0018 | ✉️ 電郵: GIFTCREEPER@GMAIL.COM</p>
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        <div className="inline-block bg-slate-900 text-white px-3 py-1 rounded text-xs font-bold tracking-widest uppercase">
                          Quotation 報價單 {printPages.length > 1 && `(${pageIdx + 1}/${printPages.length})`}
                        </div>
                        <div className="text-xs text-slate-600 space-y-0.5 font-mono">
                          <p><span className="text-slate-400">報價單號:</span> <strong className="text-slate-900">{selectedOrderForPrint.order_no}</strong></p>
                          <p><span className="text-slate-400">發單日期:</span> {formatDateYYYYMMDD(selectedOrderForPrint.created_at)}</p>
                          <p><span className="text-slate-400">有效期至:</span> 30 天內有效</p>
                        </div>
                      </div>
                    </div>

                    {/* Client Info 客戶資料欄 */}
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                      <div className="space-y-0.5">
                        <p className="font-bold text-indigo-600 uppercase tracking-wider">Customer / Client 寶號客戶：</p>
                        <h2 className="text-base font-bold text-slate-900">{selectedOrderForPrint.client_name}</h2>
                        {currentPrintClient && (
                          <div className="text-slate-600 space-y-0.5 pt-0.5">
                            {currentPrintClient.contact_person && <p>聯絡人: <strong>{currentPrintClient.contact_person}</strong> {currentPrintClient.phone && `| ${currentPrintClient.phone}`}</p>}
                            {currentPrintClient.address && <p>地址: {currentPrintClient.address}</p>}
                          </div>
                        )}
                      </div>
                      <div className="text-right flex flex-col justify-between">
                        <div>
                          <p className="font-bold text-slate-400 uppercase tracking-wider">Status 狀態：</p>
                          <span className="inline-block mt-0.5 px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded">
                            {selectedOrderForPrint.status === 'Quoted' ? '待確認報價 (Quoted)' : selectedOrderForPrint.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 明細表格 Table */}
                    <div className="overflow-hidden rounded-lg border border-slate-300">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-white uppercase tracking-wider">
                            <th className="p-2.5 w-10 text-center">#</th>
                            <th className="p-2.5">產品名稱與規格說明 (Item & Specifications)</th>
                            <th className="p-2.5 text-center w-16">數量</th>
                            <th className="p-2.5 text-right w-24">單價 (RMB)</th>
                            <th className="p-2.5 text-right w-28">小計 (HKD)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {pageItems.map((item, idx) => {
                            const globalIndex = pageIdx * 20 + idx + 1;
                            const itemHkdTotal = Math.round(
                              (item.unit_cost_rmb * item.qty) * selectedOrderForPrint.exchange_rate * (1 + selectedOrderForPrint.service_fee_pct / 100)
                            );

                            return (
                              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                <td className="p-2.5 text-center text-slate-400 font-mono">{globalIndex}</td>
                                <td className="p-2.5">
                                  <p className="font-bold text-slate-900">{item.name}</p>
                                  {item.spec && <p className="text-[11px] text-slate-500">{item.spec}</p>}
                                </td>
                                <td className="p-2.5 text-center font-mono font-medium">{item.qty}</td>
                                <td className="p-2.5 text-right font-mono text-slate-600">¥ {item.unit_cost_rmb.toFixed(2)}</td>
                                <td className="p-2.5 text-right font-mono font-bold text-slate-900">HK$ {itemHkdTotal.toLocaleString()}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* 頁尾付款條款與簽署欄 */}
                    {isLastPage ? (
                      <div className="space-y-6 pt-1">
                        <div className="grid grid-cols-12 gap-4 items-end">
                          <div className="col-span-7 space-y-1">
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-0.5">
                              <p className="font-bold text-slate-900 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 付款條款 (Terms & Conditions)：
                              </p>
                              <p>• 支票抬頭請寫：<strong>GIFT CREEPER TRADING CO.</strong></p>
                              <p>• 銀行轉帳：<strong>恆生銀行 769-695578-883</strong></p>
                              {selectedOrderForPrint.notes && <p className="text-indigo-600 font-medium">• 備註：{selectedOrderForPrint.notes}</p>}
                            </div>
                          </div>

                          <div className="col-span-5 text-right space-y-1">
                            <div className="flex justify-between text-xs text-slate-500">
                              <span>貨品折合 (Subtotal):</span>
                              <span className="font-mono">HK$ {Math.round(selectedOrderForPrint.subtotal_rmb * selectedOrderForPrint.exchange_rate).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t-2 border-slate-900">
                              <span className="font-bold text-xs text-slate-900 whitespace-nowrap">總金額 (Grand Total):</span>
                              <span className="text-lg font-extrabold text-indigo-600 font-mono whitespace-nowrap ml-2">HK$ {selectedOrderForPrint.grand_total_hkd.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* 簽署區 */}
                        <div className="grid grid-cols-2 gap-8 pt-6 text-center text-xs text-slate-600">
                          <div className="space-y-6">
                            <div className="border-b border-slate-400 h-10 w-3/4 mx-auto"></div>
                            <p className="font-bold text-slate-800">客戶確認簽署及蓋單章<br/><span className="text-slate-400 font-normal text-[10px]">(Customer Accepted & Chopped)</span></p>
                          </div>
                          <div className="space-y-6">
                            <div className="border-b border-slate-400 h-10 w-3/4 mx-auto"></div>
                            <p className="font-bold text-slate-800">GIFT CREEPER TRADING CO. 授權簽署<br/><span className="text-slate-400 font-normal text-[10px]">(Authorized Signature & Chop)</span></p>
                          </div>
                        </div>

                        <div className="text-center text-[10px] text-slate-400 pt-2 border-t border-slate-200">
                          Thank you for your business! 多謝惠顧，期待再次為您服務。
                        </div>
                      </div>
                    ) : (
                      <div className="text-right text-xs text-slate-400 font-mono pt-2">
                        -- 接下頁 (Continued on next page) --
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}