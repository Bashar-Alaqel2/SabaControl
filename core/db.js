// ⚙️ core/db.js - إعدادات الربط مع Supabase
// ==========================================
const SUPABASE_URL = 'https://omjfsqwtaoyinfteqhqh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tamZzcXd0YW95aW5mdGVxaHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MDI2ODAsImV4cCI6MjA4NTM3ODY4MH0._2OGGOMW6YUctrCyk-neskR0F7fGadlW79BmPrkyJXM';

// إنشاء العميل وجعله متاحاً للجميع (Global)
window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// تشغيل النظام اللحظي (Real-time) الأساسي
window.sb.channel('admin-dashboard')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'screens' }, () => {
        if(typeof fetchScreens === 'function') fetchScreens();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'playlist' }, () => {
        if(typeof fetchPlaylist === 'function') fetchPlaylist();
    })
    .subscribe();