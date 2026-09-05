'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as OpenCC from 'opencc-js';
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
  Loader2,
  Upload,
  CheckCircle2,
  Languages,
  Stamp,
  Menu,
  X,
  CreditCard,
  Tag,
  FileText,
  PieChart,
  Save
} from 'lucide-react';

// --- Supabase 初始化 ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// 初始化 OpenCC 簡體轉香港繁體轉換器 (cn -> hk)
const convertSimpToTrad = OpenCC.Converter({ from: 'cn', to: 'hk' });

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
  discount_hkd?: number;
  actual_cost_hkd?: number;
  items: OrderItem[];
  subtotal_rmb: number;
  grand_total_hkd: number;
  status: 'Draft' | 'Quoted' | 'Confirmed' | 'Shipped' | 'Completed' | 'Cancelled';
  notes: string;
  screenshot_url?: string;
  created_at: string;
}

// 輔助函式：根據訂單明細及折扣精確計算四捨五入後的整數總金額
const computeOrderGrandTotal = (order: Order): number => {
  if (!order.items || order.items.length === 0) return order.grand_total_hkd || 0;

  const totalQty = order.items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  const rate = order.exchange_rate || 1.15;
  const servicePct = order.service_fee_pct || 0;
  const totalShippingRmb = order.shipping_fee_rmb || 0;
  const discountHkd = Number(order.discount_hkd) || 0;

  const discountPerPieceHkd = totalQty > 0 ? discountHkd / totalQty : 0;

  return order.items.reduce((sum, item) => {
    const shippingPerPieceRmb = totalQty > 0 ? totalShippingRmb / totalQty : 0;
    const itemCostWithShippingRmb = Number(item.unit_cost_rmb) + shippingPerPieceRmb;
    const itemCostHkd = itemCostWithShippingRmb * rate;
    const rawUnitPriceHkd = (itemCostHkd * (1 + servicePct / 100)) - discountPerPieceHkd;
    
    const roundedUnitPriceHkd = Math.round(Math.max(0, rawUnitPriceHkd));
    return sum + (roundedUnitPriceHkd * (Number(item.qty) || 0));
  }, 0);
};

export default function GiftCreeperApp() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clients' | 'create_order' | 'orders' | 'profits' | 'print'>('dashboard');
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<Order | null>(null);
  
  // 列印文件類型選擇：'quotation' 或 'invoice'
  const [printDocType, setPrintDocType] = useState<'quotation' | 'invoice'>('quotation');

  // 手機版選單開關 State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 預設圖檔指向 public 資料夾
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string>('/logo.png');
  const [companyChopUrl, setCompanyChopUrl] = useState<string>('/chop.png');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const chopInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (supabase) {
      fetchClients();
      fetchOrders();
    }
    const savedLogo = localStorage.getItem('company_logo_url');
    if (savedLogo) setCompanyLogoUrl(savedLogo);

    const savedChop = localStorage.getItem('company_chop_url');
    if (savedChop) setCompanyChopUrl(savedChop);
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
      const formatted = data.map((item: any) => {
        const orderObj: Order = {
          ...item,
          client_name: item.clients?.school_name || '未指定學校',
          client_info: item.clients || null
        };
        // 即時重算並覆蓋為精確四捨五入整數額
        orderObj.grand_total_hkd = computeOrderGrandTotal(orderObj);
        return orderObj;
      });
      setOrders(formatted);
    }
  };

  const currentPrintClient = useMemo(() => {
    if (!selectedOrderForPrint) return null;
    return clients.find(c => c.id === selectedOrderForPrint.client_id) || (selectedOrderForPrint as any).client_info || null;
  }, [selectedOrderForPrint, clients]);

  const formatDateYYYYMMDD = (dateStr?: string) => {
    if (!dateStr) {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        setCompanyLogoUrl(url);
        try {
          localStorage.setItem('company_logo_url', url);
          alert('公司 Logo 上傳成功！');
        } catch (err) {
          alert('圖片檔案較大，建議直接覆蓋 public/logo.png！');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChopUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        setCompanyChopUrl(url);
        try {
          localStorage.setItem('company_chop_url', url);
          alert('電子公司印章上傳成功！');
        } catch (err) {
          alert('圖片檔案較大，建議直接覆蓋 public/chop.png！');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePrintQuotation = () => {
    if (selectedOrderForPrint) {
      const originalTitle = document.title;
      const prefix = printDocType === 'invoice' ? 'INV-' : 'QT-';
      document.title = `${prefix}${selectedOrderForPrint.order_no}`;
      window.print();
      setTimeout(() => { document.title = originalTitle; }, 1000);
    }
  };

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

  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [exchangeRate, setExchangeRate] = useState<number>(1.15);
  const [serviceFeePct, setServiceFeePct] = useState<number>(30);
  const [shippingFeeRmb, setShippingFeeRmb] = useState<number>(50);
  const [discountHkd, setDiscountHkd] = useState<number>(0);
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
    setDiscountHkd(0);
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
          name: convertSimpToTrad(item.product_name || '未命名商品'),
          spec: convertSimpToTrad(item.spec || ''),
          unit_cost_rmb: Number(item.price) || 0,
          qty: Number(item.quantity) || 100,
          isAiGenerated: true
        }));

        setOrderItems((prevItems) => {
          const isFirstRowEmpty = prevItems.length === 1 && !prevItems[0].name.trim();
          return isFirstRowEmpty ? aiRows : [...prevItems, ...aiRows];
        });

        alert(`✨ AI 成功解析 ${files.length} 張圖！`);
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

  const handleManualTranslateAll = () => {
    const updated = orderItems.map(item => ({
      ...item,
      name: convertSimpToTrad(item.name),
      spec: convertSimpToTrad(item.spec)
    }));
    setOrderItems([...updated]);
    alert('✨ OpenCC 高精準度繁體轉換完成！');
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

  // 全面採用新計算邏輯
  const calculations = useMemo(() => {
    const totalQty = orderItems.reduce((acc, item) => acc + (Number(item.qty) || 0), 0);
    const subtotalRmb = orderItems.reduce((acc, item) => acc + (Number(item.unit_cost_rmb) * Number(item.qty)), 0);
    const subtotalHkd = subtotalRmb * exchangeRate;
    const serviceFeeHkd = subtotalHkd * (serviceFeePct / 100);
    const shippingHkd = shippingFeeRmb * exchangeRate;

    const discountPerPieceHkd = totalQty > 0 ? discountHkd / totalQty : 0;

    const grandTotalHkd = orderItems.reduce((sum, item) => {
      const shippingPerPieceRmb = totalQty > 0 ? shippingFeeRmb / totalQty : 0;
      const itemCostWithShippingRmb = Number(item.unit_cost_rmb) + shippingPerPieceRmb;
      const itemCostHkd = itemCostWithShippingRmb * exchangeRate;
      const rawUnitPriceHkd = (itemCostHkd * (1 + serviceFeePct / 100)) - discountPerPieceHkd;

      const roundedUnitPriceHkd = Math.round(Math.max(0, rawUnitPriceHkd));
      return sum + (roundedUnitPriceHkd * (Number(item.qty) || 0));
    }, 0);

    return { subtotalRmb, subtotalHkd, serviceFeeHkd, shippingHkd, grandTotalHkd };
  }, [orderItems, exchangeRate, serviceFeePct, shippingFeeRmb, discountHkd]);

  const handleSaveOrder = async () => {
    if (!selectedClientId) {
      alert('請先選擇客戶/學校！');
      return;
    }

    const validItems = orderItems
      .filter(item => item.name.trim() !== '')
      .map(item => ({
        ...item,
        name: convertSimpToTrad(item.name),
        spec: convertSimpToTrad(item.spec)
      }));

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
        discount_hkd: discountHkd,
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
        discount_hkd: discountHkd,
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
    setDiscountHkd(order.discount_hkd || 0);
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
    // 即時本地狀態更新
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    if (supabase) {
      await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
      fetchOrders();
    }
  };

  const handleUpdateActualCost = async (orderId: string, cost: number) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, actual_cost_hkd: cost } : o));
    if (supabase) {
      await supabase.from('orders').update({ actual_cost_hkd: cost }).eq('id', orderId);
    }
  };

  // 統計數據：排除 Cancelled 狀態
  const stats = useMemo(() => {
    const validOrders = orders.filter(o => o.status !== 'Cancelled');
    const totalSales = validOrders.reduce((acc, o) => acc + (o.grand_total_hkd || 0), 0);
    const pendingOrders = validOrders.filter(o => o.status === 'Quoted' || o.status === 'Confirmed').length;
    const completedOrders = validOrders.filter(o => o.status === 'Completed').length;
    return { totalSales, pendingOrders, completedOrders, totalClients: clients.length };
  }, [orders, clients]);

  // 財務分析數據
  const profitStats = useMemo(() => {
    const completedList = orders.filter(o => o.status !== 'Cancelled');
    const totalRevenue = completedList.reduce((acc, o) => acc + (o.grand_total_hkd || 0), 0);
    
    // 預設成本算式：若沒有填寫 actual_cost_hkd，預設用 (subtotal_rmb + shipping_fee_rmb) * exchange_rate 計算
    const totalCost = completedList.reduce((acc, o) => {
      const cost = o.actual_cost_hkd !== undefined && o.actual_cost_hkd !== null
        ? Number(o.actual_cost_hkd) 
        : ((Number(o.subtotal_rmb) || 0) + (Number(o.shipping_fee_rmb) || 0)) * (o.exchange_rate || 1.15);
      return acc + cost;
    }, 0);

    const totalProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return { totalRevenue, totalCost, totalProfit, profitMargin, completedList };
  }, [orders]);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden print:h-auto print:overflow-visible">
      {/* 全域列印樣式優化 */}
      <style jsx global>{`
        @media print {
          html, body, #__next, main, div {
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `}</style>
      
      {/* 手機版頂部 Header Bar */}
      <header className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center print:hidden border-b border-slate-800 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
            <DollarSign className="w-5 h-5" />
          </div>
          <span className="font-bold text-base tracking-wide">Gift Creeper</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-1.5 text-slate-300 hover:text-white rounded-lg bg-slate-800 focus:outline-none"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* 側邊導覽列 */}
      <aside className={`
        fixed md:relative inset-y-0 left-0 z-40 w-64 bg-slate-900 text-white flex flex-col justify-between print:hidden transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div>
          <div className="p-6 border-b border-slate-800 hidden md:flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-wide text-white">Gift Creeper</h1>
              <p className="text-xs text-slate-400">訂單管理系統</p>
            </div>
          </div>

          <nav className="p-4 space-y-1 mt-12 md:mt-0">
            <button
              onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <LayoutDashboard className="w-5 h-5" /> 數據總覽
            </button>
            <button
              onClick={() => { resetOrderForm(); setActiveTab('create_order'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'create_order' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <FilePlus className="w-5 h-5" /> {editingOrderId ? '修改訂單中' : '建立新訂單'}
            </button>
            <button
              onClick={() => { setActiveTab('orders'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'orders' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <ListOrdered className="w-5 h-5" /> 訂單列表
            </button>
            <button
              onClick={() => { setActiveTab('profits'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'profits' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <PieChart className="w-5 h-5" /> 財務分析 (Profits)
            </button>
            <button
              onClick={() => { setActiveTab('clients'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'clients' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              <Users className="w-5 h-5" /> 客戶/學校資料
            </button>
          </nav>
        </div>

        {/* 左側底部圖檔設定區 */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          <button 
            onClick={() => logoInputRef.current?.click()} 
            className="w-full text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 p-2.5 rounded-lg flex items-center justify-center gap-2"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-400" /> 上傳公司 Logo
          </button>
          <input type="file" ref={logoInputRef} onChange={handleLogoUpload} accept="image/*" className="hidden" />

          <button 
            onClick={() => chopInputRef.current?.click()} 
            className="w-full text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 p-2.5 rounded-lg flex items-center justify-center gap-2"
          >
            <Stamp className="w-3.5 h-3.5 text-red-400" /> 上傳電子公司印章
          </button>
          <input type="file" ref={chopInputRef} onChange={handleChopUpload} accept="image/*" className="hidden" />

          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/60 p-2.5 rounded-lg mt-1">
            <span className={`w-2 h-2 rounded-full ${supabase ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            {supabase ? 'Supabase 已連線' : '未設定 Supabase 金鑰'}
          </div>
        </div>
      </aside>

      {/* 手機選單遮罩 */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)} 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
        />
      )}

      {/* 主內容區域 */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 print:p-0 print:overflow-visible print:bg-white">
        {/* TAB 1: 數據總覽 */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">儀表板 (Dashboard)</h2>
                <p className="text-sm text-slate-500">歡迎回來，檢視最新的禮品訂單數據。</p>
              </div>
              <button onClick={() => { resetOrderForm(); setActiveTab('create_order'); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 shadow-sm w-full sm:w-auto">
                <Plus className="w-4 h-4" /> 開立新單
              </button>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg shrink-0"><TrendingUp className="w-6 h-6" /></div>
                <div>
                  <p className="text-xs text-slate-500">總營業額 (HKD)</p>
                  <h3 className="text-xl md:text-2xl font-bold text-slate-900">HK$ {stats.totalSales.toLocaleString()}</h3>
                </div>
              </div>
              <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-amber-100 text-amber-600 rounded-lg shrink-0"><Clock className="w-6 h-6" /></div>
                <div>
                  <p className="text-xs text-slate-500">待處理訂單</p>
                  <h3 className="text-xl md:text-2xl font-bold text-slate-900">{stats.pendingOrders} 單</h3>
                </div>
              </div>
              <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg shrink-0"><PackageCheck className="w-6 h-6" /></div>
                <div>
                  <p className="text-xs text-slate-500">已完成訂單</p>
                  <h3 className="text-xl md:text-2xl font-bold text-slate-900">{stats.completedOrders} 單</h3>
                </div>
              </div>
              <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-lg shrink-0"><Building className="w-6 h-6" /></div>
                <div>
                  <p className="text-xs text-slate-500">客戶/學校總數</p>
                  <h3 className="text-xl md:text-2xl font-bold text-slate-900">{stats.totalClients} 間</h3>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6 space-y-4 overflow-x-auto">
              <div className="flex justify-between items-center min-w-[300px]">
                <h3 className="font-bold text-slate-900">近期訂單</h3>
                <button onClick={() => setActiveTab('orders')} className="text-xs text-indigo-600 flex items-center gap-1">查看全部 <ArrowRight className="w-3 h-3" /></button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 min-w-[500px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr><th className="p-3">訂單編號</th><th className="p-3">客戶學校</th><th className="p-3">金額 (HKD)</th><th className="p-3">狀態</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.slice(0, 5).map(order => {
                      const isCancelled = order.status === 'Cancelled';
                      return (
                        <tr key={order.id} className={isCancelled ? 'bg-slate-50/50' : ''}>
                          <td className={`p-3 font-mono font-medium ${isCancelled ? 'line-through text-slate-400' : 'text-slate-900'}`}>{order.order_no}</td>
                          <td className={`p-3 font-medium ${isCancelled ? 'line-through text-slate-400' : ''}`}>{order.client_name}</td>
                          <td className={`p-3 font-semibold ${isCancelled ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                            HK$ {order.grand_total_hkd.toLocaleString()}
                            {!isCancelled && order.grand_total_hkd > 3500 && (
                              <span className="ml-2 px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-bold">
                                需訂金
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${isCancelled ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-700'}`}>
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
                  取消編輯
                </button>
              )}
            </header>

            {/* AI 快捷填單區 */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-dashed border-indigo-200 hover:border-indigo-400 transition-colors cursor-pointer rounded-xl p-4 md:p-5 text-center shadow-sm relative overflow-hidden group"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="image/*" 
                multiple
                className="hidden" 
              />

              <div className="flex flex-wrap items-center justify-center gap-2 text-indigo-900 font-bold text-sm md:text-base mb-1">
                <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
                AI 快捷填單：貼上截圖，或【點擊選取多張圖片】
              </div>

              <p className="text-xs text-indigo-600 flex items-center justify-center gap-1 mt-1">
                <Languages className="w-3.5 h-3.5" />
                支援淘寶購物車多圖解析
              </p>

              {isParsingScreenshot && (
                <div className="mt-3 inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-1.5 rounded-full text-xs font-medium animate-bounce shadow">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Qwen-VL 視覺 AI 解析中...
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2 border-b pb-2"><Building className="w-5 h-5 text-indigo-600" /> 1. 選擇客戶 / 學校</h3>
                  <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} className="w-full border p-2.5 rounded-lg text-sm">
                    <option value="">-- 請選擇客戶 --</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.school_name} ({c.contact_person})</option>)}
                  </select>
                </div>

                <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b pb-2">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <PackageCheck className="w-5 h-5 text-indigo-600" /> 2. 產品明細 (RMB)
                    </h3>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={handleManualTranslateAll} 
                        type="button"
                        className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 shadow-sm transition-colors"
                      >
                        <Languages className="w-3.5 h-3.5 text-emerald-600" /> 一鍵轉繁體
                      </button>

                      <button onClick={addOrderItem} className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1.5 rounded font-medium flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5" /> 增加項目
                      </button>
                    </div>
                  </div>

                  {orderItems.map((item, index) => (
                    <div key={item.id} className={`p-3 rounded-lg border space-y-2 transition-colors ${item.isAiGenerated ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex justify-between text-xs font-semibold">
                        <span className={item.isAiGenerated ? 'text-indigo-600 flex items-center gap-1' : 'text-slate-400'}>
                          {item.isAiGenerated && <Sparkles className="w-3 h-3 inline" />}
                          項目 #{index + 1}
                        </span>
                        {orderItems.length > 1 && (
                          <button onClick={() => removeOrderItem(item.id)} className="text-red-500 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <input
                          type="text"
                          placeholder="輸入品名"
                          value={item.name}
                          onChange={(e) => updateOrderItem(item.id, 'name', e.target.value)}
                          className="sm:col-span-5 border p-2 rounded text-sm bg-white focus:outline-indigo-500"
                        />
                        <input
                          type="text"
                          placeholder="顏色/類別"
                          value={item.spec}
                          onChange={(e) => updateOrderItem(item.id, 'spec', e.target.value)}
                          className="sm:col-span-3 border p-2 rounded text-sm bg-white focus:outline-indigo-500"
                        />
                        <input
                          type="number"
                          placeholder="單價(RMB)"
                          value={item.unit_cost_rmb || ''}
                          onChange={(e) => updateOrderItem(item.id, 'unit_cost_rmb', parseFloat(e.target.value) || 0)}
                          className="sm:col-span-2 border p-2 rounded text-sm bg-white font-mono focus:outline-indigo-500"
                        />
                        <input
                          type="number"
                          placeholder="數量"
                          value={item.qty || ''}
                          onChange={(e) => updateOrderItem(item.id, 'qty', parseInt(e.target.value) || 0)}
                          className="sm:col-span-2 border p-2 rounded text-sm bg-white font-mono focus:outline-indigo-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-white p-4 md:p-6 rounded-xl border space-y-2">
                  <h3 className="font-bold text-sm">訂單備註</h3>
                  <textarea rows={2} placeholder="例如：預計9月開學前交貨..." value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} className="w-full border p-2 rounded text-sm" />
                </div>
              </div>

              <div className="bg-slate-900 text-white p-5 md:p-6 rounded-xl shadow-lg space-y-6 h-fit">
                <h3 className="font-bold text-lg border-b border-slate-800 pb-3 flex items-center gap-2"><DollarSign className="w-5 h-5 text-indigo-400" /> 費用計算</h3>
                <div className="space-y-3 text-sm">
                  <div><label className="text-xs text-slate-400">匯率 (RMB → HKD)</label><input type="number" step="0.01" value={exchangeRate} onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)} className="w-full bg-slate-800 border-slate-700 p-2 rounded text-white" /></div>
                  <div><label className="text-xs text-slate-400">服務費 / 利潤加成 (%)</label><input type="number" value={serviceFeePct} onChange={(e) => setServiceFeePct(parseFloat(e.target.value) || 0)} className="w-full bg-slate-800 border-slate-700 p-2 rounded text-white" /></div>
                  <div><label className="text-xs text-slate-400">國內運費 (RMB)</label><input type="number" value={shippingFeeRmb} onChange={(e) => setShippingFeeRmb(parseFloat(e.target.value) || 0)} className="w-full bg-slate-800 border-slate-700 p-2 rounded text-white" /></div>
                  <div>
                    <label className="text-xs text-amber-400 font-bold flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5" /> 折扣 (HKD) - 不會顯示於報價單上
                    </label>
                    <input 
                      type="number" 
                      value={discountHkd} 
                      onChange={(e) => setDiscountHkd(parseFloat(e.target.value) || 0)} 
                      placeholder="0"
                      className="w-full bg-slate-800 border-slate-700 p-2 rounded text-white focus:outline-indigo-500 font-mono" 
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-2 text-sm">
                  <div className="flex justify-between text-slate-400"><span>貨品小計 (RMB)</span><span className="font-mono">¥ {calculations.subtotalRmb.toFixed(2)}</span></div>
                  <div className="flex justify-between text-slate-400"><span>貨品折合 (HKD)</span><span className="font-mono">HK$ {calculations.subtotalHkd.toFixed(2)}</span></div>
                  {discountHkd > 0 && (
                    <div className="flex justify-between text-amber-400"><span>已扣除折扣 (HKD)</span><span className="font-mono">- HK$ {discountHkd.toLocaleString()}</span></div>
                  )}
                  <div className="flex justify-between items-baseline pt-2 border-t border-slate-700">
                    <span className="font-bold">建議報價單總額</span>
                    <span className="text-xl md:text-2xl font-bold text-emerald-400 font-mono">HK$ {calculations.grandTotalHkd.toLocaleString()}</span>
                  </div>

                  {calculations.grandTotalHkd > 3500 && (
                    <div className="bg-indigo-950/80 border border-indigo-700 p-2.5 rounded-lg text-xs space-y-1 text-indigo-200 mt-2">
                      <div className="flex items-center gap-1.5 font-bold text-indigo-300">
                        <CreditCard className="w-3.5 h-3.5" /> 觸發 50% 訂金條款 (總額 &gt; HK$ 3,500)
                      </div>
                      <div className="flex justify-between"><span>應付訂金 (50%):</span><strong className="font-mono text-emerald-300">HK$ {Math.round(calculations.grandTotalHkd * 0.5).toLocaleString()}</strong></div>
                      <div className="flex justify-between text-slate-400"><span>交貨尾款 (50%):</span><span className="font-mono">HK$ {Math.round(calculations.grandTotalHkd * 0.5).toLocaleString()}</span></div>
                    </div>
                  )}
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
            <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 min-w-[800px]">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b">
                  <tr>
                    <th className="p-4">訂單編號</th>
                    <th className="p-4">客戶學校</th>
                    <th className="p-4">金額 (HKD)</th>
                    <th className="p-4">訂單成本 (HKD)</th>
                    <th className="p-4">訂金狀態</th>
                    <th className="p-4">訂單狀態</th>
                    <th className="p-4 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map(order => {
                    const requiresDeposit = order.grand_total_hkd > 3500;
                    const isConfirmed = ['Confirmed', 'Shipped', 'Completed'].includes(order.status);
                    const isCancelled = order.status === 'Cancelled';
                    const isCompleted = order.status === 'Completed';

                    return (
                      <tr key={order.id} className={`hover:bg-slate-50 ${isCancelled ? 'bg-slate-50/60' : ''}`}>
                        <td className={`p-4 font-mono font-bold ${isCancelled ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                          {order.order_no}
                        </td>
                        <td className={`p-4 font-medium ${isCancelled ? 'line-through text-slate-400' : ''}`}>
                          {order.client_name}
                        </td>
                        <td className={`p-4 font-bold font-mono ${isCancelled ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                          HK$ {order.grand_total_hkd.toLocaleString()}
                        </td>

                        {/* 訂單成本輸入欄（Completed 狀態顯示） */}
                        <td className="p-4">
                          {isCompleted ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-slate-400">HK$</span>
                              <input
                                type="number"
                                placeholder="填寫實際成本"
                                value={order.actual_cost_hkd !== undefined ? order.actual_cost_hkd : ''}
                                onChange={(e) => handleUpdateActualCost(order.id, parseFloat(e.target.value) || 0)}
                                className="w-24 border p-1 rounded text-xs font-mono bg-white focus:outline-indigo-500"
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>

                        <td className="p-4">
                          {isCancelled ? (
                            <span className="text-xs text-slate-400">已取消</span>
                          ) : requiresDeposit ? (
                            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-xs font-bold">
                              <CreditCard className="w-3 h-3" /> 50% Deposit
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">全款</span>
                          )}
                        </td>
                        <td className="p-4">
                          <select 
                            value={order.status} 
                            onChange={(e) => handleUpdateStatus(order.id, e.target.value as any)} 
                            className={`border text-xs rounded p-1 font-medium ${isCancelled ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-100'}`}
                          >
                            <option value="Draft">Draft</option>
                            <option value="Quoted">Quoted</option>
                            <option value="Confirmed">Confirmed</option>
                            <option value="Shipped">Shipped</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <button 
                              onClick={() => { setSelectedOrderForPrint(order); setPrintDocType('quotation'); setActiveTab('print'); }} 
                              className="bg-indigo-900 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1 hover:bg-indigo-800"
                              title="檢視/列印報價單"
                            >
                              <Printer className="w-3.5 h-3.5" /> 報價單
                            </button>

                            {isConfirmed && !isCancelled && (
                              <button 
                                onClick={() => { setSelectedOrderForPrint(order); setPrintDocType('invoice'); setActiveTab('print'); }} 
                                className="bg-emerald-700 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1 hover:bg-emerald-600 shadow-sm"
                                title="檢視/列印 Invoice"
                              >
                                <FileText className="w-3.5 h-3.5" /> Invoice
                              </button>
                            )}

                            <button 
                              onClick={() => handleEditOrder(order)} 
                              className="bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-1 rounded text-xs font-medium flex items-center gap-1 hover:bg-indigo-100"
                              title="修改訂單"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteOrder(order.id, order.order_no)} 
                              className="bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded text-xs font-medium flex items-center hover:bg-red-100"
                              title="刪除訂單"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: 財務 / 盈利分析頁面 */}
        {activeTab === 'profits' && (
          <div className="space-y-6">
            <header className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">財務 / 盈利分析 (Profits)</h2>
                <p className="text-sm text-slate-500">檢視各筆訂單的實質收入、成本與利潤率。</p>
              </div>
            </header>

            {/* KPI Summary 區塊 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-lg shrink-0"><DollarSign className="w-6 h-6" /></div>
                <div>
                  <p className="text-xs text-slate-500">總收入 (Revenue)</p>
                  <h3 className="text-xl font-bold text-slate-900">HK$ {profitStats.totalRevenue.toLocaleString()}</h3>
                </div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-amber-100 text-amber-600 rounded-lg shrink-0"><Tag className="w-6 h-6" /></div>
                <div>
                  <p className="text-xs text-slate-500">總成本 (Total Cost)</p>
                  <h3 className="text-xl font-bold text-slate-900">HK$ {Math.round(profitStats.totalCost).toLocaleString()}</h3>
                </div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg shrink-0"><TrendingUp className="w-6 h-6" /></div>
                <div>
                  <p className="text-xs text-slate-500">總盈利 (Gross Profit)</p>
                  <h3 className="text-xl font-bold text-emerald-600">HK$ {Math.round(profitStats.totalProfit).toLocaleString()}</h3>
                </div>
              </div>
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-purple-100 text-purple-600 rounded-lg shrink-0"><PieChart className="w-6 h-6" /></div>
                <div>
                  <p className="text-xs text-slate-500">平均盈利 % (Margin)</p>
                  <h3 className="text-xl font-bold text-purple-600">{profitStats.profitMargin.toFixed(1)}%</h3>
                </div>
              </div>
            </div>

            {/* 盈利明細表格 */}
            <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 min-w-[700px]">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b">
                  <tr>
                    <th className="p-4">訂單編號</th>
                    <th className="p-4">客戶學校</th>
                    <th className="p-4 text-right">收入 (HKD)</th>
                    <th className="p-4 text-right">成本 (HKD)</th>
                    <th className="p-4 text-right">盈利 (HKD)</th>
                    <th className="p-4 text-right">盈利 %</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {profitStats.completedList.map(order => {
                    const revenue = order.grand_total_hkd || 0;
                    const cost = order.actual_cost_hkd !== undefined && order.actual_cost_hkd !== null
                      ? Number(order.actual_cost_hkd) 
                      : ((Number(order.subtotal_rmb) || 0) + (Number(order.shipping_fee_rmb) || 0)) * (order.exchange_rate || 1.15);
                    
                    const profit = revenue - cost;
                    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

                    return (
                      <tr key={order.id} className="hover:bg-slate-50 font-mono">
                        <td className="p-4 font-bold text-slate-900">{order.order_no}</td>
                        <td className="p-4 font-sans font-medium text-slate-800">{order.client_name}</td>
                        <td className="p-4 text-right text-slate-900 font-bold">HK$ {revenue.toLocaleString()}</td>
                        <td className="p-4 text-right text-slate-600">HK$ {Math.round(cost).toLocaleString()}</td>
                        <td className={`p-4 text-right font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          HK$ {Math.round(profit).toLocaleString()}
                        </td>
                        <td className="p-4 text-right font-bold">
                          <span className={`px-2 py-0.5 rounded text-xs ${margin >= 20 ? 'bg-emerald-100 text-emerald-800' : margin >= 0 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                            {margin.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: 客戶管理 */}
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

              <div className="md:col-span-2 bg-white rounded-xl border shadow-sm p-4 md:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b pb-3">
                  <h3 className="font-bold">學校清單 ({clients.length})</h3>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input type="text" placeholder="搜尋學校..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="w-full sm:w-auto pl-9 pr-4 py-1.5 border rounded-lg text-xs" />
                  </div>
                </div>
                <div className="divide-y">
                  {clients.filter(c => c.school_name.includes(clientSearch)).map(client => (
                    <div key={client.id} className="py-3">
                      <h4 className="font-bold text-slate-900">{client.school_name}</h4>
                      <p className="text-xs text-slate-500 flex flex-wrap gap-3 mt-1">
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

        {/* TAB 6: 升級版專業報價單 / INVOICE */}
        {activeTab === 'print' && selectedOrderForPrint && (() => {
          const totalQuantity = selectedOrderForPrint.items.reduce((sum, item) => sum + item.qty, 0);
          const rate = selectedOrderForPrint.exchange_rate || 1.15;
          const servicePct = selectedOrderForPrint.service_fee_pct || 0;
          const totalShippingRmb = selectedOrderForPrint.shipping_fee_rmb || 0;
          const discountHkdVal = Number(selectedOrderForPrint.discount_hkd) || 0;

          // 四捨五入計算總額
          const computedGrandTotal = computeOrderGrandTotal(selectedOrderForPrint);
          
          // 判定是否需收取 50% 訂金（超過 HK$3,500）
          const requiresDeposit = computedGrandTotal > 3500;
          const depositAmount = Math.round(computedGrandTotal * 0.5);
          const balanceAmount = computedGrandTotal - depositAmount;

          const discountPerPieceHkd = totalQuantity > 0 ? discountHkdVal / totalQuantity : 0;

          // 是否可以切換成 Invoice 模式 (Confirmed, Shipped, Completed)
          const canShowInvoice = ['Confirmed', 'Shipped', 'Completed'].includes(selectedOrderForPrint.status);
          const isInvoice = printDocType === 'invoice' && canShowInvoice;

          // 色調動態設定
          const theme = isInvoice ? {
            primaryBg: 'bg-emerald-900',
            primaryText: 'text-emerald-950',
            primarySubText: 'text-emerald-700',
            badgeBg: 'bg-emerald-800',
            borderTheme: 'border-emerald-800',
            boxBg: 'bg-emerald-50/60',
            boxBorder: 'border-emerald-200',
            grandTotalText: 'text-emerald-900',
            btnBg: 'bg-emerald-800 hover:bg-emerald-700',
            docTitle: 'INVOICE 發票',
            docNoPrefix: 'INV-'
          } : {
            primaryBg: 'bg-indigo-950',
            primaryText: 'text-indigo-950',
            primarySubText: 'text-indigo-700',
            badgeBg: 'bg-indigo-900',
            borderTheme: 'border-indigo-900',
            boxBg: 'bg-indigo-50/50',
            boxBorder: 'border-indigo-100',
            grandTotalText: 'text-indigo-900',
            btnBg: 'bg-indigo-900 hover:bg-indigo-800',
            docTitle: 'QUOTATION 報價單',
            docNoPrefix: 'QT-'
          };

          return (
            <div className="space-y-6 max-w-4xl mx-auto print:m-0 print:p-0 print:max-w-none">
              <div className="flex flex-col sm:flex-row justify-between items-center print:hidden bg-slate-200 p-4 rounded-xl shadow-inner gap-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => setActiveTab('orders')} className="text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1">
                    ← 返回列表
                  </button>

                  {/* 切換 Quotation / Invoice 按鈕選單 */}
                  {canShowInvoice && (
                    <div className="bg-slate-300 p-1 rounded-lg flex gap-1">
                      <button 
                        onClick={() => setPrintDocType('quotation')}
                        className={`px-3 py-1 rounded text-xs font-bold transition-all ${!isInvoice ? 'bg-indigo-900 text-white shadow' : 'text-slate-700 hover:bg-slate-400'}`}
                      >
                        報價單 (Quotation)
                      </button>
                      <button 
                        onClick={() => setPrintDocType('invoice')}
                        className={`px-3 py-1 rounded text-xs font-bold transition-all ${isInvoice ? 'bg-emerald-800 text-white shadow' : 'text-slate-700 hover:bg-slate-400'}`}
                      >
                        發票 (Invoice)
                      </button>
                    </div>
                  )}
                </div>

                <button 
                  onClick={handlePrintQuotation} 
                  className={`${theme.btnBg} text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-md transition-colors`}
                >
                  <Printer className="w-4 h-4" /> 列印 / 下載 {isInvoice ? 'Invoice PDF' : '報價單 PDF'}
                </button>
              </div>

              {/* A4 容器 */}
              <div className="bg-white p-5 md:p-10 rounded-2xl border border-slate-200 shadow-xl print:shadow-none print:border-none print:p-0 print:m-0 font-sans text-slate-800 overflow-x-auto print:overflow-visible">
                <table className="w-full text-left border-collapse min-w-[500px] print:min-w-full">
                  <thead className="print:table-header-group">
                    <tr>
                      <td colSpan={5} className="pb-4">
                        <div className={`flex flex-col sm:flex-row justify-between items-start border-b-2 ${theme.borderTheme} pb-4 gap-4`}>
                          <div className="flex items-center gap-4">
                            {companyLogoUrl ? (
                              <img src={companyLogoUrl} alt="Company Logo" className="h-12 md:h-14 object-contain max-w-[140px] md:max-w-[160px]" />
                            ) : (
                              <div className={`w-10 h-10 md:w-12 md:h-12 ${theme.badgeBg} text-white font-black text-xl rounded-xl flex items-center justify-center shadow`}>
                                GC
                              </div>
                            )}
                            <div>
                              <h1 className={`text-xl md:text-2xl font-black ${theme.primaryText} tracking-wider`}>GIFT CREEPER</h1>
                              <p className={`text-xs font-bold ${theme.primarySubText}`}>博禮貿易公司 | GIFT CREEPER TRADING CO.</p>
                              <p className="text-[11px] text-slate-500 pt-0.5">📞 電話: +852 4624 0018 | ✉️ 電郵: GIFTCREEPER@GMAIL.COM</p>
                            </div>
                          </div>
                          <div className="text-left sm:text-right space-y-1">
                            <div className={`inline-block ${theme.badgeBg} text-white px-3.5 py-1 rounded text-xs font-extrabold tracking-widest uppercase shadow-sm`}>
                              {theme.docTitle}
                            </div>
                            <div className="text-xs text-slate-600 space-y-0.5 font-mono pt-1">
                              <p><span className="text-slate-400">{isInvoice ? '發票號碼:' : '報價單號:'}</span> <strong className={theme.primaryText}>{theme.docNoPrefix}{selectedOrderForPrint.order_no}</strong></p>
                              <p><span className="text-slate-400">發單日期:</span> {formatDateYYYYMMDD(selectedOrderForPrint.created_at)}</p>
                            </div>
                          </div>
                        </div>

                        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${theme.boxBg} p-3.5 rounded-r-xl border-l-4 ${theme.borderTheme} border-t border-b border-r ${theme.boxBorder} text-xs mt-4`}>
                          <div className="space-y-0.5">
                            <p className={`font-bold ${theme.primarySubText} uppercase tracking-wider text-[10px]`}>Customer / Client 客戶資料：</p>
                            <h2 className="text-sm font-bold text-slate-900">{selectedOrderForPrint.client_name}</h2>
                            {currentPrintClient && (
                              <div className="text-slate-600 space-y-0.5 pt-0.5 text-[11px]">
                                {currentPrintClient.contact_person && <p>聯絡人: <strong>{currentPrintClient.contact_person}</strong> {currentPrintClient.phone && `| ${currentPrintClient.phone}`}</p>}
                                {currentPrintClient.address && <p>地址: {currentPrintClient.address}</p>}
                              </div>
                            )}
                          </div>
                          <div className="text-left sm:text-right flex flex-col justify-between">
                            <div>
                              <p className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Status 狀態：</p>
                              <span className="inline-block mt-0.5 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-md text-[11px]">
                                {isInvoice ? '正式發票 (Issued)' : selectedOrderForPrint.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>

                    <tr className={`${theme.primaryBg} text-white uppercase text-[11px] tracking-wider`}>
                      <th className="p-2.5 w-10 text-center">#</th>
                      <th className="p-2.5">產品名稱與規格說明 (Item & Specifications)</th>
                      <th className="p-2.5 text-center w-16">數量</th>
                      <th className="p-2.5 text-right w-28">單價 (HKD)</th>
                      <th className="p-2.5 text-right w-28">小計 (HKD)</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200 bg-white text-xs">
                    {selectedOrderForPrint.items.map((item, idx) => {
                      const shippingPerPieceRmb = totalQuantity > 0 ? totalShippingRmb / totalQuantity : 0;
                      
                      const itemCostWithShippingRmb = item.unit_cost_rmb + shippingPerPieceRmb;
                      const itemCostHkd = itemCostWithShippingRmb * rate;
                      const rawUnitPriceHkd = (itemCostHkd * (1 + servicePct / 100)) - discountPerPieceHkd;

                      const unitPriceHkd = Math.round(Math.max(0, rawUnitPriceHkd));
                      const itemHkdTotal = unitPriceHkd * item.qty;

                      const tradName = convertSimpToTrad(item.name);
                      const tradSpec = convertSimpToTrad(item.spec);

                      return (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                          <td className="p-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="p-2.5">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span>{tradName}</span>
                              {tradSpec && (
                                <span className="font-normal text-slate-500 text-[11px]">
                                  ({tradSpec})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5 text-center font-mono font-medium">{item.qty}</td>
                          <td className="p-2.5 text-right font-mono text-slate-700 font-medium">
                            HK$ {unitPriceHkd.toLocaleString()}
                          </td>
                          <td className={`p-2.5 text-right font-mono font-bold ${theme.primaryText}`}>
                            HK$ {itemHkdTotal.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  <tfoot>
                    <tr>
                      <td colSpan={5} className="pt-6">
                        <div className="space-y-6">
                          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                            <div className="w-full md:w-1/2 md:max-w-[50%] space-y-1.5">
                              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[10px] text-slate-600 space-y-1">
                                <p className={`font-bold ${theme.primarySubText} flex items-center gap-1 text-[10.5px]`}>
                                  <CheckCircle2 className="w-3.5 h-3.5" /> 付款及服務條款 (Terms & Conditions)：
                                </p>
                                <p>• 支票抬頭請寫：<strong>GIFT CREEPER TRADING CO.</strong></p>
                                <p>• 銀行轉帳：<strong>恆生銀行 769-695578-883</strong></p>
                                <p>• FPS 轉數快 ID：<strong>132542846</strong></p>
                                {requiresDeposit && (
                                  <p className={`${isInvoice ? 'text-emerald-900 bg-emerald-100/60' : 'text-indigo-900 bg-indigo-100/60'} font-bold p-1 rounded`}>
                                    • 訂金要求：本單總額超過 HK$3,500，須先付 50% 訂金，餘款於交貨時結清。
                                  </p>
                                )}
                                {selectedOrderForPrint.notes && <p className={`${theme.primarySubText} font-medium`}>• 備註：{selectedOrderForPrint.notes}</p>}
                                
                                <div className="pt-1 border-t border-slate-200 text-[8.5px] text-slate-500 space-y-0.5 leading-tight">
                                  <p>1. 上述貨品乃完全根據買方指定之品牌、型號、規格、品質標準及指定供應商進行採購與供貨。</p>
                                  <p>2. 貨品送達指定地點後，買方須於 3 個工作天內完成外觀及基本功能驗收。如逾期未收到買方之書面異議或修訂要求，即視為該批貨品已完全符合合約要求並完成順利交貨。</p>
                                  <p>3. 如因海關清關抽查/延誤、第三方物流服務商之運輸延誤、或任何不可抗力因素（包括但不限於惡劣天氣、政策變更）導致送貨延期，本公司概不承擔任何違約金、罰款或相關之間接商業損失。</p>
                                  <p>4. 因本報價單或相關貨品所引起之任何索賠、損失或法律責任，本公司所承擔之最高累積賠償金額，在任何情況下均以該批次爭議貨品之實際合約總金額為限。</p>
                                  <p>5. 驗收期滿後，貨品之保養、維修或零件更換，均依據指定供應商之保養條款執行。本公司可協助代為聯絡指定供應商辦理，惟過程中產生之本司行政費、跨境來回運費、關稅或維修費用，須由買方自行承擔。</p>
                                  <p>6. 本報價不含本地運費，將於出貨前與買方確認並另行結算。</p>
                                </div>
                              </div>
                            </div>

                            <div className="w-full md:flex-1 text-right space-y-1.5 text-xs self-start pt-1 md:pl-2">
                              <div className={`${theme.boxBg} p-3 rounded-xl border ${theme.boxBorder} shadow-sm space-y-1`}>
                                <div className="flex justify-between md:justify-end items-baseline gap-2 whitespace-nowrap">
                                  <span className={`font-bold text-xs ${theme.primaryText} shrink-0`}>總金額 (Grand Total):</span>
                                  <span className={`text-xl sm:text-2xl font-black ${theme.grandTotalText} font-mono tracking-tight shrink-0`}>
                                    HK$ {computedGrandTotal.toLocaleString()}
                                  </span>
                                </div>

                                {/* 超過 HK$3,500 自動顯示 50% 訂金明細 */}
                                {requiresDeposit && (
                                  <div className="pt-2 border-t border-slate-200/80 space-y-1 text-[11px] font-mono">
                                    <div className={`flex justify-between md:justify-end gap-3 ${theme.primaryText} font-bold`}>
                                      <span>應付 50% 訂金 (50% Deposit):</span>
                                      <span className="text-emerald-700">HK$ {depositAmount.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between md:justify-end gap-3 text-slate-500">
                                      <span>交貨尾款 (Balance Due):</span>
                                      <span>HK$ {balanceAmount.toLocaleString()}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 簽署區塊 */}
                          <div className="grid grid-cols-2 gap-8 pt-6 mt-8 text-center text-xs text-slate-600">
                            <div className="flex flex-col justify-end space-y-2">
                              <div className="h-16 min-h-[60px]"></div>
                              <div className="border-b border-slate-400 w-3/4 mx-auto"></div>
                              <p className="font-bold text-slate-800 pt-1">
                                客戶確認簽署及蓋單章<br/>
                                <span className="text-slate-400 font-normal text-[10px]">(Customer Accepted & Chopped)</span>
                              </p>
                            </div>
                            
                            <div className="flex flex-col justify-end space-y-2">
                              <div className="h-16 min-h-[60px]"></div>
                              
                              {/* 橫線與印章容器 */}
                              <div className="relative w-3/4 mx-auto border-b border-slate-400">
                                {companyChopUrl ? (
                                  <img 
                                    src={companyChopUrl} 
                                    alt="Company Chop" 
                                    className="absolute -bottom-4 right-2 h-24 md:h-28 object-contain pointer-events-none select-none opacity-90"
                                  />
                                ) : (
                                  <div className="absolute -bottom-4 right-2 w-24 h-24 md:w-28 md:h-28 border-2 border-red-600 rounded-full flex flex-col items-center justify-center text-red-600 transform -rotate-12 opacity-85 pointer-events-none select-none">
                                    <span className="text-[9px] font-bold tracking-tighter uppercase px-1">GIFT CREEPER TRADING</span>
                                    <span className="text-[14px] font-black my-0.5">★ 蓋章 ★</span>
                                    <span className="text-[8px] font-bold">CHOP / SIGN</span>
                                  </div>
                                )}
                              </div>

                              <p className="font-bold text-slate-800 pt-1">
                                GIFT CREEPER TRADING CO. 授權簽署<br/>
                                <span className="text-slate-400 font-normal text-[10px]">(Authorized Signature & Chop)</span>
                              </p>
                            </div>
                          </div>

                          <div className="text-center text-[10px] text-slate-400 pt-4 border-t border-slate-200 space-y-0.5">
                            <p>Thank you for your business! 多謝惠顧，期待再次為您服務。</p>
                            <p className="font-semibold text-slate-500">＊本電子文件連同公司印章將被視作正本處理。＊</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>

              </div>
            </div>
          );
        })()}
      </main>
    </div>
  );
}
