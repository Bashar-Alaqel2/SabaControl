// core/db.js - إعدادات الربط مع Supabase

window.SUPABASE_URL = 'https://omjfsqwtaoyinfteqhqh.supabase.co';
window.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tamZzcXd0YW95aW5mdGVxaHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MDI2ODAsImV4cCI6MjA4NTM3ODY4MH0._2OGGOMW6YUctrCyk-neskR0F7fGadlW79BmPrkyJXM';

// إنشاء العميل وجعله متاحاً للجميع (Global)
window.sb = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);

// 9. تشغيل النظام اللحظي (Real-time) الموحد
const globalSyncChannel = window.sb.channel('global-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'screens' }, () => {
        if (window.ScreensModule) window.ScreensModule.fetchAndRender();
        if (window.DashboardModule) window.DashboardModule.fetchAndRenderAll();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tickers' }, () => {
        if (window.DashboardModule) window.DashboardModule.fetchTickerHistory();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'playlist' }, () => {
        if (window.ContentModule) window.ContentModule.fetchPlaylist();
    })
    .subscribe();

// ✨ نظام البث الفائق (Supreme Broadcast System) ✨
// هذا النظام يرسل الأوامر للشاشات في أقل من 100 ملي ثانية
window.commandChannel = window.sb.channel('signage-commands').subscribe();

window.broadcastCommand = (command, target = 'all', metadata = {}) => {
    console.log(`🚀 Sending Command: ${command} to ${target}`);
    window.commandChannel.send({
        type: 'broadcast',
        event: 'cmd',
        payload: { command, target, metadata, timestamp: Date.now() }
    });
};