// ==========================================
// 📊 modules/dashboard/dashboard.js
// النسخة الاحترافية: نظام المساءلة والشفافية (Tickers)
// ==========================================

/**
 * 1. تهيئة لوحة القيادة
 */
function initDashboard() {
    loadComponents();
    if (typeof fetchScreens === 'function') fetchScreens();
    
    // 🟢 الحماية البرمجية: إظهار وجلب بيانات شريط الأخبار للمدير فقط
    if (window.currentUserRole === 'admin') {
        const dashboardTicker = document.getElementById('adminDashboardTicker');
        if (dashboardTicker) dashboardTicker.style.display = 'block';
        
        // جلب البيانات الأساسية
        populateTickerTargetSelect();
        fetchLastActiveTicker();
        fetchTickerHistory();
    }
}

/**
 * 2. جلب أحدث خبر تم بثه (لعرض الحالة الحالية في حقول الإدخال)
 */
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

/**
 * 3. تعبئة القائمة المنسدلة بالشاشات المتوفرة
 */
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

/**
 * 4. جلب بيانات شاشة محددة عند تغيير الاختيار
 */
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
            document.getElementById('newsInput').value = '';
        }
    } catch (err) { console.error(err); }
}

/**
 * 5. الحفظ والبث (إضافة سجل جديد Insert لضمان المساءلة)
 */
async function updateAdvancedTickerDashboard() {
    const targetId = document.getElementById('tickerTargetScreen')?.value || 'all';
    const isVisible = document.getElementById('tickerToggle')?.checked || false;
    const text = document.getElementById('newsInput')?.value || '';
    const bgColor = document.getElementById('tickerBgColor')?.value || '#000000';
    const txtColor = document.getElementById('tickerTextColor')?.value || '#ffffff';
    const speed = document.getElementById('tickerSpeed')?.value || '50';

    if (!text) return alert("الرجاء كتابة نص الخبر أولاً!");

    try {
        // 🚀 تنفيذ عملية INSERT لضمان الشفافية التاريخية
        const { error } = await window.sb.from('tickers').insert([{
            message: text,
            bg_color: bgColor,
            text_color: txtColor,
            speed: parseInt(speed),
            show_ticker: isVisible,
            target_screen_id: targetId
        }]);

        if (error) throw error;

        // تحديث جدول السجل فوراً بعد البث
        fetchTickerHistory(); 
        alert(`تم بث الخبر بنجاح! تم توثيق العملية باسمك وتاريخ اليوم. 📡✅`);
        
    } catch (err) { 
        alert('حدث خطأ أثناء البث: ' + err.message); 
    }
}

/**
 * 6. جلب سجل الأخبار (Audit Log)
 */
async function fetchTickerHistory() {
    try {
        const { data, error } = await window.sb
            .from('tickers')
            .select(`id, message, created_at, target_screen_id, profiles(full_name)`)
            .order('created_at', { ascending: false })
            .limit(10);

        const tbody = document.getElementById('tickerHistoryBody');
        const historyCard = document.getElementById('tickerHistoryCard'); // المعرف الخاص بالكرت

        if (error) throw error;

        // 🟢 إظهار الكرت فور بدء جلب البيانات أو نجاحها
        if (historyCard) historyCard.style.display = 'block';

        if (data && data.length > 0) {
            tbody.innerHTML = '';
            data.forEach(log => {
                const time = new Date(log.created_at).toLocaleTimeString('ar-YE', {hour: '2-digit', minute:'2-digit'});
                const sender = log.profiles?.full_name || 'مدير النظام';
                
                tbody.innerHTML += `
                    <tr id="row-${log.id}">
                        <td><span id="text-${log.id}" style="font-size: 13px;">${log.message}</span></td>
                        <td class="small text-muted">${sender}</td>
                        <td class="small">${time}</td>
                        <td><span class="badge bg-light text-dark border">${log.target_screen_id}</span></td>
                        <td>
                            <div class="btn-group">
                                <button class="btn btn-sm btn-outline-primary" onclick="editTickerInline('${log.id}')">
                                    <i class="fa-solid fa-pen"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="deleteTickerRecord('${log.id}')">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center p-3 text-muted">لا توجد سجلات حالياً</td></tr>';
        }
    } catch (err) { 
        console.error("History Error:", err); 
    }
}

/**
 * 7. حذف سجل من القاعدة والواجهة
 */
async function deleteTickerRecord(id) {
    if (!confirm("هل أنت متأكد من حذف هذا الخبر نهائياً؟")) return;

    try {
        const { error } = await window.sb.from('tickers').delete().eq('id', id);
        if (error) throw error;
        
        // تأثير بصري للحذف
        const row = document.getElementById(`row-${id}`);
        if (row) {
            row.style.transition = '0.5s';
            row.style.backgroundColor = '#ffebee';
            setTimeout(() => row.remove(), 500);
        }
        alert("تم الحذف بنجاح!");
    } catch (err) { alert("خطأ في الحذف: " + err.message); }
}

/**
 * 8. التعديل المباشر (Inline Editing)
 */
async function editTickerInline(id) {
    const textElement = document.getElementById(`text-${id}`);
    const oldMessage = textElement ? textElement.innerText : "";
    
    const newMessage = prompt("تعديل نص الخبر وبثه مجدداً:", oldMessage);
    if (!newMessage || newMessage === oldMessage) return;

    try {
        const { error } = await window.sb
            .from('tickers')
            .update({ 
                message: newMessage,
                created_at: new Date().toISOString() // تحديث الوقت ليظهر كأحدث خبر في الشاشات
            })
            .eq('id', id);

        if (error) throw error;

        // تحديث الواجهة
        if (textElement) {
            textElement.innerText = newMessage;
            textElement.style.color = '#2e7d32'; 
            textElement.style.fontWeight = 'bold';
        }
        
        alert("تم تحديث الخبر وبثه للشاشات! ✅");
    } catch (err) { alert("خطأ في التعديل: " + err.message); }
}

/**
 * مكونات الإحصائيات (UI Only)
 */
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

// تشغيل النظام
initDashboard();