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

    // استهداف زر التبديل (Toggle)
const tickerToggle = document.getElementById('tickerToggle');

if (tickerToggle) {
    tickerToggle.addEventListener('change', async (e) => {
        const isVisible = e.target.checked;
        const targetId = document.getElementById('tickerTargetScreen')?.value || 'all';
        const message = document.getElementById('newsInput')?.value || "تحديث حالة الشريط";

        // إشعار المستخدم بالتحميل البسيط
        console.log("🔄 جاري تغيير حالة ظهور الشريط إلى:", isVisible);

        try {
            // نقوم بإضافة سجل جديد (Insert) لتوثيق أن المدير غير الحالة الآن
            const { error } = await window.sb.from('tickers').insert([{
                message: message,
                show_ticker: isVisible,
                target_screen_id: targetId,
                // نأخذ بقية التنسيقات من الحقول الحالية
                bg_color: document.getElementById('tickerBgColor')?.value || '#000000',
                text_color: document.getElementById('tickerTextColor')?.value || '#ffffff',
                speed: parseInt(document.getElementById('tickerSpeed')?.value || '50')
            }]);

            if (error) throw error;
            
            // ملاحظة: الـ Realtime سيتكفل بتحديث الشاشات فوراً
            console.log("✅ تم تحديث الحالة بنجاح");
        } catch (err) {
            console.error("خطأ في تحديث الحالة:", err.message);
            // إعادة الزر لوضعه السابق في حال الفشل
            e.target.checked = !isVisible; 
        }
    });
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
 * 5. النسخة المحسنة: الحفظ والبث مع حماية من التعليق والتكرار
 */
async function updateAdvancedTickerDashboard() {
    const btn = document.querySelector('button[onclick="updateAdvancedTickerDashboard()"]');
    const newsInput = document.getElementById('newsInput');
    const tickerToggle = document.getElementById('tickerToggle');
    const targetId = document.getElementById('tickerTargetScreen')?.value || 'all';

    // 🛑 الشرط الأول: التأكد من وجود نص
    const text = newsInput?.value.trim() || '';
    if (!text) return alert("الرجاء كتابة نص الخبر أولاً!");

    // 🛑 الشرط الثاني (طلبك): لا يمكن الرفع إذا كان الزر غير مفعل
    const isVisible = tickerToggle?.checked || false;
    if (!isVisible) {
        return alert("⚠️ لا يمكن بث الخبر والشريط مغلق! يرجى تفعيل 'إظهار شريط الأخبار' أولاً.");
    }

    try {
        // 🔄 بدء التحميل وتعطيل الزر
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري المعالجة...';
        }

        const bgColor = document.getElementById('tickerBgColor')?.value || '#000000';
        const txtColor = document.getElementById('tickerTextColor')?.value || '#ffffff';
        const speed = document.getElementById('tickerSpeed')?.value || '50';

        // 🚀 إرسال البيانات
        const { error } = await window.sb.from('tickers').insert([{
            message: text,
            bg_color: bgColor,
            text_color: txtColor,
            speed: parseInt(speed),
            show_ticker: isVisible,
            target_screen_id: targetId
        }]);

        if (error) throw error;

        // ✅ نجاح العملية
        alert(`تم بث الخبر بنجاح وتوثيقه في السجل! 📡`);
        
        // تفريغ الحقل بعد النجاح (اختياري)
        newsInput.value = '';

    } catch (err) { 
        console.error("بث الأخبار فشل:", err);
        alert('حدث خطأ تقني: ' + err.message); 
    } finally {
        // 🔓 إعادة الزر للعمل دائماً (حتى لو فشل الإنترنت) لإنهاء الدوران
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'تحديث وبث الأخبار';
        }
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
                const screenDisplayName = log.target_screen_id === 'all' ? 'الكل' : (log.screens?.screen_name || log.target_screen_id);
                
                tbody.innerHTML += `
                    <tr id="row-${log.id}">
                        <td><span id="text-${log.id}" style="font-size: 13px;">${log.message}</span></td>
                        <td class="small text-muted">${sender}</td>
                        <td class="small">${time}</td>
                        <td><span class="badge bg-light text-dark border">${screenDisplayName}</span></td>
                        <td>
                            <div class="btn-group">
                                <button class="btn btn-sm btn-outline-primary" onclick="editTickerInline('${log.id}')">
                                    <img src="images/edit_square.png" alt="SabaPost Logo">
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="deleteTickerRecord('${log.id}')">
                                    <img src="images/delete_2.png" alt="SabaPost Logo">
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
                <div class="stat-icon" style="background: #e3f2fd; color: #1976d2;"><img src="images/Total_screens.png" alt="SabaPost Logo"></div>
                <div class="stat-info"><h4 class="totalScreensVal">0</h4><span>إجمالي الشاشات</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: #e8f5e9; color: #2e7d32;"><img src="images/cat_connect.png" alt="SabaPost Logo"></div>
                <div class="stat-info"><h4 class="onlineScreensVal">0</h4><span>متصلة الآن (Online)</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: #ffebee; color: #c62828;"><img src="images/Separated_screens.png" alt="SabaPost Logo"></div>
                <div class="stat-info"><h4 class="offlineScreensVal">0</h4><span>مفصولة (Offline)</span></div>
            </div>
        </div>
    `;
    document.querySelectorAll('.load-stats-here').forEach(container => container.innerHTML = statsHTML);
}


/**
 * 9. جلب الشاشات وتحديث الإحصائيات العلوية (Stats)
 */
async function fetchScreens() {
    try {
        // 1. إظهار مؤشر تحميل في الجدول الصغير
        const tbodyDashboard = document.getElementById('screensList');
        if (tbodyDashboard && tbodyDashboard.innerHTML === '') {
            tbodyDashboard.innerHTML = '<tr><td colspan="4" class="text-center p-3">جاري المزامنة...</td></tr>';
        }

        // 2. جلب البيانات بالتوازي لسرعة فائقة
        const [userRes, screensRes] = await Promise.all([
            window.sb.auth.getUser(),
            window.sb.from('screens').select('*, profiles(full_name, role)').order('last_ping', { ascending: false })
        ]);

        const user = userRes.data?.user;
        const screens = screensRes.data || [];
        
        if (screensRes.error) throw screensRes.error;

        // 3. تحديد الهوية والصلاحية (تستخدم للتحكم في العرض)
        let myUserId = user?.id;
        let myRole = window.currentUserRole || 'editor'; 

        // 4. إرسال البيانات لدالة الرسم
        renderDashboardScreensTable(screens, myUserId, myRole);
        
    } catch (err) {
        console.error('Error fetching dashboard screens:', err);
    }
}

/**
 * دالة مساعدة لرسم جدول الشاشات في لوحة القيادة
 */
function renderDashboardScreensTable(screens, myUserId, myRole) {
        const tbodyDashboard = document.getElementById('screensList');
    const tbodyDetailed = document.getElementById('detailedScreensList');
    
    if(tbodyDashboard) tbodyDashboard.innerHTML = '';
    if(tbodyDetailed) tbodyDetailed.innerHTML = '';

    let onlineCount = 0;
    let offlineCount = 0;
    const now = new Date();

    screens.forEach(s => {
        const displayName = s.screen_name ? s.screen_name : `شاشة (${s.device_id})`;
        const isLinked = s.status === 'linked';
        const statusClass = isLinked ? 'status-linked' : 'status-pending';
        const statusText = isLinked ? 'متصل ومفعل ✅' : 'بانتظار الموافقة ⏳';

        const isPlaying = s.play_status && s.play_status.includes('playing');
        const playBadge = isPlaying
            ? `<span style="background: #2196F3; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; margin-top: 5px; display: inline-block;">📺 يعرض الآن</span>`
            : `<span style="background: #f44336; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8em; margin-top: 5px; display: inline-block;">⚠️ شاشة فارغة</span>`;

        const lastPing = new Date(s.last_ping);
        const diffMinutes = Math.abs(now - lastPing) / (1000 * 60);
        const isOnline = diffMinutes <= 1; 

        if (isOnline) onlineCount++; else offlineCount++;

        const connectionBadge = isOnline 
            ? `<span style="color: #2e7d32; font-weight:bold; font-size: 0.85em;"><i class="fa-solid fa-wifi"></i> متصل </span>` 
            : `<span style="color: #c62828; font-weight:bold; font-size: 0.85em;"><i class="fa-solid fa-plug-circle-xmark"></i> مفصول</span>`;

        // ==========================================
        // 🛡️ منطق الحماية (إخفاء/إظهار الأزرار)
        // ==========================================
        const ownerName = s.profiles?.full_name || 'غير معروف';
        const isOwner = (s.created_by === myUserId) || (myRole === 'admin');

        let actionBtn = '';
        let deleteBtn = '';
        let renameBtn = '';
        let protectedBadge = '';

        // إذا كان المالك أو مدير، نجهز الأزرار كالمعتاد
        // إذا كان المالك أو مدير، نجهز الأزرار كالمعتاد
        if (isOwner) {
            actionBtn = isLinked
                ? `<button style="background: #f91616;" class="btn-delete" onclick="updateScreenStatus('${s.device_id}', 'pending')"><img src="images/mode_off_on_2b.png" alt="SabaPost Logo"></button>`
                : `<button style="background: #54dc5b;" class="btn-approve" onclick="updateScreenStatus('${s.device_id}', 'linked')" ><img src="images/mode_off_on_2b.png" alt="SabaPost Logo"></button>`;
            
            deleteBtn = `<button class="btn-delete" style="background:#ed0707; margin-right:5px;" onclick="deleteScreen('${s.device_id}')"><img src="images/delete_22.png" alt="SabaPost Logo"></button>`;
            renameBtn = `<button class="btn btn-warning" style="padding: 5px 10px; font-size:12px; margin-right:5px;" onclick="renameScreen('${s.device_id}', '${s.screen_name || ''}')"><img src="images/edit_22.png" alt="SabaPost Logo"></button>`;
        } else {
            // إذا لم يكن يملك الصلاحية، نجهز علامة القفل فقط
            protectedBadge = `<span style="font-size: 11px; color: #888; background: #eee; padding: 6px 10px; border-radius: 4px;"><i class="fa-solid fa-lock"></i> محمية</span>`;
        }
        // ==========================================

        if(tbodyDashboard) {
            tbodyDashboard.innerHTML += `
                <tr>
                    <td>
                        <div style="color: var(--primary); font-weight: bold; font-size: 14px;">${displayName}</div>
                        <div style="font-size: 10px; color: gray; margin-top:2px;"><i class="fa-solid fa-user"></i> ${ownerName}</div>
                    </td>
                    <td>${connectionBadge}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${isLinked ? playBadge : '-'}</td>
                </tr>
            `;
        }

        if(tbodyDetailed) {
            tbodyDetailed.innerHTML += `
                <tr>
                    <td>
                        <strong style="font-size: 15px;">${displayName}</strong><br>
                        <small style="color: #888;">ID: ${s.device_id}</small>
                        <div style="font-size: 11px; color: var(--primary); margin-top: 3px;"><i class="fa-solid fa-user-tie"></i> المالك: ${ownerName}</div>
                    </td>
                    <td>${s.ip_address || '-'} <br> ${connectionBadge}</td>
                    <td>
                        <span class="status-badge ${statusClass}">${statusText}</span><br>
                        ${isLinked ? playBadge : ''}
                    </td>
                    <td dir="ltr" style="text-align: right;">${lastPing.toLocaleTimeString('ar-EG')}</td>
                    <td>${isOwner ? (actionBtn + ' ' + renameBtn + ' ' + deleteBtn) : protectedBadge}</td>
                </tr>
            `;
        }
    });

    document.querySelectorAll('.totalScreensVal').forEach(el => el.innerText = screens.length);
    document.querySelectorAll('.onlineScreensVal').forEach(el => el.innerText = onlineCount);
    document.querySelectorAll('.offlineScreensVal').forEach(el => el.innerText = offlineCount);
}



// ==========================================
// 🔄 التحديث اللحظي الموحد (Unified Realtime Sync)
// ==========================================

// 1. مراقبة جدول الشاشات (تحديث الجداول والإحصائيات)
window.sb.channel('dashboard-screens-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'screens' }, () => {
        console.log('🔄 تحديث تلقائي للبيانات والإحصائيات...');
        fetchScreens(); 
    })
    .subscribe();

// 2. مراقبة جدول الأخبار (للمدراء فقط) - تم دمج التكرار هنا
if (window.currentUserRole === 'admin') {
    window.sb.channel('dashboard-tickers-sync')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tickers' }, () => {
            console.log('📢 تم رصد خبر جديد، تحديث سجل الأخبار...');
            fetchTickerHistory();
        })
        .subscribe();
}

// 3. نبض النظام (Heartbeat): تحديث حالة الاتصال كل دقيقة
setInterval(() => {
    console.log('⏱️ تحديث زمني دوري (Heartbeat)...');
    fetchScreens();
}, 60000);

// استدعاء التشغيل الأولي
initDashboard();