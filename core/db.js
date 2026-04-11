// core/db.js - إعدادات الربط مع Supabase

const SUPABASE_URL = 'https://omjfsqwtaoyinfteqhqh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tamZzcXd0YW95aW5mdGVxaHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MDI2ODAsImV4cCI6MjA4NTM3ODY4MH0._2OGGOMW6YUctrCyk-neskR0F7fGadlW79BmPrkyJXM';

// إنشاء العميل وجعله متاحاً للجميع (Global)
window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// تشغيل النظام اللحظي (Real-time) الموحد
window.sb.channel('global-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'screens' }, () => {
        // تحديث كل من يهتم بالشاشات
        if (window.ScreensModule) window.ScreensModule.fetchAndRender();
        if (window.DashboardModule) window.DashboardModule.fetchAndRenderAll();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tickers' }, () => {
        // تحديث كل من يهتم بـ Tickers
        if (window.DashboardModule) window.DashboardModule.fetchTickerHistory();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'playlist' }, () => {
        if (typeof fetchPlaylist === 'function') fetchPlaylist();
    })
    .subscribe();