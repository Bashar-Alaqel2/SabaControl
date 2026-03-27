// ==========================================
// 🖥️ modules/screens/screens.js - إدارة الشاشات (النسخة الآمنة المدمجة)
// ==========================================

function initScreens() {
    loadComponents(); // نحمل الإحصائيات هنا أيضاً
    fetchScreens();
    //  تفعيل التحديث اللحظي (Realtime)
    // نضعه هنا ليعمل مرة واحدة عند تشغيل المودول
    window.sb.channel('screens-realtime-changes')
      .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'screens' }, 
          (payload) => {
            console.log('🔄 تحديث لحظي في الشاشات:', payload);
            fetchScreens(); // إعادة جلب البيانات فور حدوث أي تغيير (إضافة، حذف، تحديث)
          })
      .subscribe();
}

async function fetchScreens() {
    try {
        // 1. إظهار "مؤشر تحميل" بسيط (اختياري لكنه يحسن تجربة المستخدم)
        const tbodyDashboard = document.getElementById('screensList');
        if (tbodyDashboard && tbodyDashboard.innerHTML === '') {
            tbodyDashboard.innerHTML = '<tr><td colspan="4" class="text-center">جاري جلب البيانات...</td></tr>';
        }

        // 2. تنفيذ الطلبات بالتوازي (Parallel) لتقليل وقت الانتظار
        // نستخدم Promise.all لجلب المستخدم والبيانات في آن واحد
        const [userRes, screensRes] = await Promise.all([
            window.sb.auth.getUser(),
            window.sb.from('screens').select('*, profiles(full_name, role)').order('last_ping', { ascending: false })
        ]);

        const user = userRes.data?.user;
        const screens = screensRes.data || [];
        
        if (screensRes.error) throw screensRes.error;

        // 3. استخراج الصلاحية مباشرة من أول سجل أو من بيانات المستخدم
        // بدلاً من عمل طلب إضافي لجدول profiles، نستخدم currentUserRole المخزن عالمياً أو نجلب من الـ Join
        let myUserId = user?.id;
        let myRole = window.currentUserRole || 'editor'; 

        // 4. تمرير البيانات لدالة الرسم فوراً
        renderScreens(screens, myUserId, myRole);
        
        if(typeof updateTargetSelect === 'function') updateTargetSelect(screens);
        
    } catch (err) {
        console.error('Error fetching screens fast:', err);
    }
}

function renderScreens(screens, myUserId, myRole) {
    const tbodyDashboard = document.getElementById('screensList');
    const tbodyDetailed = document.getElementById('detailedScreensList');
    
    if(tbodyDashboard) tbodyDashboard.innerHTML = '';
    if(tbodyDetailed) tbodyDetailed.innerHTML = '';
//
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
                        <div style="font-size: 11px; color: var(--primary); margin-top: 3px;"><i class="fa-solid fa-user-tie"></i> المدخل: ${ownerName}</div>
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

// 🟢 تعديل دوال الحذف والتحديث لالتقاط أخطاء الصلاحيات (RLS)
async function updateScreenStatus(id, status) {
    try {
        const { error } = await window.sb.from('screens').update({ status: status }).eq('device_id', id);
        if (error) throw error;
        fetchScreens();
    } catch(err) { alert("عذراً، لا تملك صلاحية تعديل حالة هذه الشاشة!"); }
}

async function deleteScreen(id) {
    if(confirm('تحذير: هل أنت متأكد من حذف هذه الشاشة من النظام نهائياً؟')) {
        try {
            const { error } = await window.sb.from('screens').delete().eq('device_id', id);
            if (error) throw error;
            fetchScreens();
        } catch(err) { alert("عذراً، لا تملك صلاحية حذف هذه الشاشة!"); }
    }
}

async function renameScreen(deviceId, currentName) {
    const newName = prompt('أدخل اسماً مميزاً لهذه الشاشة:', currentName !== 'null' ? currentName : '');
    if (newName === null) return; 
    try {
        const { error } = await window.sb.from('screens').update({ screen_name: newName }).eq('device_id', deviceId);
        if (error) throw error;
        fetchScreens(); 
    } catch (err) { alert('عذراً، لا تملك صلاحية تغيير اسم هذه الشاشة.'); }
}

// 🟢 إدارة إضافة شاشة جديدة (Modal)
function openAddScreenModal() {
    const modal = document.getElementById('addScreenModal');
    if (modal) modal.style.display = 'flex';
}

function closeAddScreenModal() {
    const modal = document.getElementById('addScreenModal');
    if (modal) modal.style.display = 'none';
}

async function submitNewScreen() {
    const id = document.getElementById('newScreenId').value.trim();
    const name = document.getElementById('newScreenName').value.trim();

    if (!id || !name) return alert('الرجاء إدخال ID الشاشة واسمها!');

    try {
        const { error } = await window.sb.from('screens').upsert([
            { device_id: id, screen_name: name, status: 'linked', last_ping: new Date().toISOString() }
        ]);
        if (error) throw error;

        closeAddScreenModal();
        alert('تم ربط الشاشة بنجاح! ستتحول الشاشة للعمل فوراً. 🚀');
        fetchScreens(); 
    } catch (err) { alert('حدث خطأ أثناء إضافة الشاشة: ' + err.message); }
}

// ==========================================
// 🔄 مراقب التحديثات اللحظية (Realtime Watcher)
// يوضع في أسفل ملف screens.js
// ==========================================

// 1. الاستماع لتغييرات قاعدة البيانات (تفعيل التحديث التلقائي)
window.sb.channel('db-screens-changes')
    .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'screens' 
    }, (payload) => {
        console.log('🔔 تغيير مكتشف في الشاشات:', payload.eventType);
        fetchScreens(); // استدعاء دالتك الذكية لتحديث الجداول والإحصائيات فوراً
    })
    .subscribe();

// 2. تحديث دوري (كل دقيقة) لضمان دقة حالة الـ Online/Offline
// لأن حالة الـ "مفصول" تعتمد على مرور الوقت وليس فقط على تغيير في القاعدة
setInterval(() => {
    console.log('⏱️ تحديث دوري لحالة الاتصال...');
    fetchScreens();
}, 60000); 

// 3. تشغيل الدالة لأول مرة عند تحميل الملف
initScreensModule();

function initScreensModule() {
    fetchScreens();
}

initScreens();