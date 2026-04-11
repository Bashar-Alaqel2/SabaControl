/**
 * core/api.js - الطبقة المركزية للتعامل مع البيانات لجلبها وتحديثها
 * تهدف هذه الطبقة لتوحيد الدوال المشتركة ومنع تكرار الكود
 */

window.api = {
    // 1. جلب الشاشات (تستخدم في اللوحة الرئيسية وإدارة الشاشات)
    async fetchScreens() {
        try {
            const { data, error } = await window.sb
                .from('screens')
                .select('*')
                .order('screen_name', { ascending: true });
            
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error("API Error (fetchScreens):", err.message);
            return [];
        }
    },

    // 2. جلب إعدادات النظام
    async fetchSettings() {
        try {
            const { data, error } = await window.sb
                .from('settings')
                .select('key, value');
            
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error("API Error (fetchSettings):", err.message);
            return [];
        }
    },

    // 3. جلب الجلسات النشطة (تستخدم في الإعدادات والحماية)
    async fetchSessions() {
        try {
            const { data, error } = await window.sb
                .from('user_sessions')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error("API Error (fetchSessions):", err.message);
            return [];
        }
    },

    // 4. جلب سجل شريط الأخبار
    async fetchTickerHistory(limit = 20) {
        try {
            const { data, error } = await window.sb
                .from('tickers')
                .select('*, screens(screen_name), profiles(full_name)')
                .order('created_at', { ascending: false })
                .limit(limit);
            
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error("API Error (fetchTickerHistory):", err.message);
            return [];
        }
    },

    // 5. جلب آخر خبر نشط
    async fetchLastActiveTicker(targetScreenId = 'all') {
        try {
            const query = window.sb
                .from('tickers')
                .select('*')
                .eq('show_ticker', true)
                .order('created_at', { ascending: false });
            
            if (targetScreenId !== 'all') {
                query.eq('target_screen_id', targetScreenId);
            }

            const { data, error } = await query.limit(1).maybeSingle();
            if (error) throw error;
            return data;
        } catch (err) {
            console.error("API Error (fetchLastActiveTicker):", err.message);
            return null;
        }
    }
};
