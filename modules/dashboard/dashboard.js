// ==========================================
// 📊 modules/dashboard/dashboard.js
// النسخة الاحترافية: نظام المساءلة والشفافية (Tickers)
// ==========================================

function initDashboard() {
    loadComponents();
    if (typeof fetchScreens === 'function') fetchScreens();
    
    // 🟢 الحماية البرمجية: إظهار وجلب بيانات شريط الأخبار للمدير فقط
    if (window.currentUserRole === 'admin') {
        const dashboardTicker = document.getElementById('adminDashboardTicker');
        if (dashboardTicker) dashboardTicker.style.display = 'block';
        
        // 1. تعبئة القائمة المنسدلة بالشاشات
        populateTickerTargetSelect();
        // 2. جلب أحدث خبر تم بثه لعرضه في الحقول
        fetchLastActiveTicker();
    }
}

// 📡 1. جلب أحدث خبر تم بثه (ليعرف المدير الحالة الحالية للنظام)
async function fetchLastActiveTicker() {
    try {
        const { data, error } = await window.sb
            .from('tickers')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (data) {
            if (document.getElementById('newsInput')) document.getElementById('newsInput').value = data.message;
            if (document.getElementById('tickerToggle')) document.getElementById('tickerToggle').checked = data.show_ticker;
            if (document.getElementById('tickerBgColor')) document.getElementById('tickerBgColor').value = data.bg_color;
            if (document.getElementById('tickerTextColor')) document.getElementById('tickerTextColor').value = data.text_color;
            if (document.getElementById('tickerSpeed')) document.getElementById('tickerSpeed').value = data.speed;
        }
    } catch (err) { console.error("خطأ في جلب بيانات الشريط:", err); }
}

// 📡 2. تعبئة القائمة المنسدلة بالشاشات المتوفرة
async function populateTickerTargetSelect() {
    try {
        const { data: screens } = await window.sb.from('screens').select('device_id, screen_name');
        const select = document.getElementById('tickerTargetScreen');
        if (!select || !screens) return;
        
        select.innerHTML = '<option value="all">بث لجميع الشاشات (موحد)</option>';
        screens.forEach(s => {
            const name = s.screen_name || `شاشة (${s.device_id})`;
            select.innerHTML += `<option value="${s.device_id}">${name}</option>`;
        });
    } catch (err) { console.error("خطأ في جلب القائمة:", err); }
}

// 📡 3. جلب بيانات شاشة محددة (إذا أردت رؤية آخر ما بُث لتلك الشاشة تحديداً)
async function loadSpecificScreenTicker() {
    const targetId = document.getElementById('tickerTargetScreen')?.value || 'all';
    
    try {
        const { data } = await window.sb
            .from('tickers')
            .select('*')
            .or(`target_screen_id.eq.${targetId}`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (data) {
            document.getElementById('newsInput').value = data.message;
            document.getElementById('tickerToggle').checked = data.show_ticker;
            document.getElementById('tickerBgColor').value = data.bg_color;
            document.getElementById('tickerTextColor').value = data.text_color;
            document.getElementById('tickerSpeed').value = data.speed;
        } else if (targetId === 'all') {
            fetchLastActiveTicker();
        } else {
            // إذا كانت الشاشة جديدة ولم يُبث لها شيء مخصص
            document.getElementById('newsInput').value = '';
        }
    } catch (err) { console.error(err); }
}

// 📡 4. الحفظ والبث (إضافة سجل جديد Insert لضمان المساءلة)
async function updateAdvancedTickerDashboard() {
    const targetId = document.getElementById('tickerTargetScreen')?.value || 'all';
    const isVisible = document.getElementById('tickerToggle')?.checked || false;
    const text = document.getElementById('newsInput')?.value || '';
    const bgColor = document.getElementById('tickerBgColor')?.value || '#000000';
    const txtColor = document.getElementById('tickerTextColor')?.value || '#ffffff';
    const speed = document.getElementById('tickerSpeed')?.value || '50';

    if (!text) return alert("الرجاء كتابة نص الخبر أولاً!");

    try {
        // 🚀 تنفيذ عملية INSERT وليس UPDATE لضمان الشفافية
        const { error } = await window.sb.from('tickers').insert([{
            message: text,
            bg_color: bgColor,
            text_color: txtColor,
            speed: parseInt(speed),
            show_ticker: isVisible,
            target_screen_id: targetId
            // ملاحظة: created_by و created_at يتم إضافتهما تلقائياً من قاعدة البيانات
        }]);

        if (error) throw error;
        
        alert(`تم بث الخبر بنجاح! تم توثيق العملية باسمك وتاريخ اليوم. 📡✅`);
        
    } catch (err) { 
        alert('حدث خطأ أثناء البث: ' + err.message); 
    }
}

// المكونات الإحصائية
function loadComponents() {
    const statsHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon" style="background: #e3f2fd; color: #1976d2;"><i class="fa-solid fa-tv"></i></div>
                <div class="stat-info"><h4 class="totalScreensVal">0</h4><span>إجمالي الشاشات</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: #e8f5e9; color: #2e7d32;"><i class="fa-solid fa-wifi"></i></div>
                <div class="stat-info"><h4 class="onlineScreensVal">0</h4><span>متصلة الآن (Online)</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: #ffebee; color: #c62828;"><i class="fa-solid fa-triangle-exclamation"></i></div>
                <div class="stat-info"><h4 class="offlineScreensVal">0</h4><span>مفصولة (Offline)</span></div>
            </div>
        </div>
    `;
    document.querySelectorAll('.load-stats-here').forEach(container => container.innerHTML = statsHTML);
}

// بدء التشغيل
initDashboard();