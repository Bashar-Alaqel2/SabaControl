
//  modules/screens/screens.js - إدارة الشاشات (النسخة الآمنة المدمجة)


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

    let onlineCount = 0;
    let offlineCount = 0;
    const now = new Date();

    screens.forEach(s => {
        const displayName = s.screen_name ? s.screen_name : `شاشة (${s.device_id})`;
        const isLinked = s.status === 'linked';
        
        const lastPing = new Date(s.last_ping);
        const diffMinutes = Math.abs(now - lastPing) / (1000 * 60);
        const isOnline = diffMinutes <= 2; 

        if (isOnline) onlineCount++; else offlineCount++;

        const statusBadge = isOnline 
            ? `<span class="badge-glass" style="background:rgba(46,204,113,0.1); color:#2ecc71;"><span class="status-glow online" style="margin-left:5px;"></span> متصلة</span>` 
            : `<span class="badge-glass" style="background:rgba(231,76,60,0.1); color:#e74c3c;"><span class="status-glow offline" style="margin-left:5px;"></span> منقطعة</span>`;

        const isPlaying = s.play_status && s.play_status.includes('playing');
        const playBadge = isPlaying
            ? `<span class="badge-glass" style="background:rgba(33,150,243,0.1); color:#2196F3;"><i class="fa-solid fa-play me-1"></i> يبث الآن</span>`
            : `<span class="badge-glass" style="background:rgba(244,67,54,0.1); color:#f44336;"><i class="fa-solid fa-stop me-1"></i> متوقف</span>`;

        // منطق الحماية والأزرار
        const ownerName = s.profiles?.full_name || 'غير معروف';
        const isOwner = (s.created_by === myUserId) || (myRole === 'admin');

        let actionBtn = '';
        let deleteBtn = '';
        let renameBtn = '';
        let protectedBadge = '';

        if (isOwner) {
            actionBtn = isLinked
                ? `<button class="action-circle-btn text-danger shadow-sm" onclick="updateScreenStatus('${s.device_id}', 'pending')" title="تعطيل البث"><i class="fa-solid fa-power-off"></i></button>`
                : `<button class="action-circle-btn text-success shadow-sm" onclick="updateScreenStatus('${s.device_id}', 'linked')" title="تفعيل البث"><i class="fa-solid fa-check"></i></button>`;
            
            renameBtn = `<button class="action-circle-btn text-warning shadow-sm" onclick="renameScreen('${s.device_id}', '${s.screen_name || ''}')" title="تعديل الاسم"><i class="fa-solid fa-pen"></i></button>`;
            deleteBtn = `<button class="action-circle-btn text-danger shadow-sm" onclick="deleteScreen('${s.device_id}')" title="حذف الشاشة"><i class="fa-solid fa-trash"></i></button>`;
        } else {
            protectedBadge = `<span class="badge-glass bg-light"><i class="fa-solid fa-lock me-1"></i> محمية</span>`;
        }

        if(tbodyDashboard) {
            tbodyDashboard.innerHTML += `
                <tr style="transition:0.3s;">
                    <td>
                        <div class="fw-bold text-dark" style="font-size:14px;">${displayName}</div>
                        <div class="owner-pill mt-1" style="font-size: 9px;"><i class="fa-solid fa-user"></i> ${ownerName}</div>
                    </td>
                    <td>${statusBadge}</td>
                    <td>${isLinked ? playBadge : '-'}</td>
                </tr>
            `;
        }

        if(tbodyDetailed) {
            tbodyDetailed.innerHTML += `
                <tr class="detailed-table-row">
                    <td class="ps-3">
                        <div class="fw-bold text-dark" style="font-size: 15px;">${displayName}</div>
                        <span class="screen-id-badge">${s.device_id}</span>
                        <div class="owner-pill mt-2"><i class="fa-solid fa-user-tie"></i> المالك: ${ownerName}</div>
                    </td>
                    <td>
                        <code class="small text-muted">${s.ip_address || '---.---.---.---'}</code><br>
                        ${statusBadge}
                    </td>
                    <td>
                        <div class="d-flex flex-column gap-1">
                            ${isLinked ? `<span class="badge-glass bg-light text-success fw-bold" style="font-size:10px;">مصرحة بالبث ✓</span>` : `<span class="badge-glass bg-light text-warning fw-bold" style="font-size:10px;">بانتظار الموافقة ⏳</span>`}
                            ${isLinked ? playBadge : ''}
                        </div>
                    </td>
                    <td dir="ltr" class="text-end pe-4">
                        <div class="small fw-bold">${lastPing.toLocaleTimeString('ar-YE', {hour:'2-digit', minute:'2-digit'})}</div>
                        <div class="small text-muted" style="font-size: 10px;">${lastPing.toLocaleDateString('ar-YE')}</div>
                    </td>
                    <td>
                        <div class="d-flex gap-2 justify-content-center">
                            ${isOwner ? (actionBtn + renameBtn + deleteBtn) : protectedBadge}
                        </div>
                    </td>
                </tr>
            `;
        }
    });

    document.querySelectorAll('.totalScreensVal').forEach(el => el.innerText = screens.length);
    document.querySelectorAll('.onlineScreensVal').forEach(el => el.innerText = onlineCount);
    document.querySelectorAll('.offlineScreensVal').forEach(el => el.innerText = offlineCount);
}

//  تعديل دوال الحذف والتحديث لالتقاط أخطاء الصلاحيات (RLS)
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

//  إدارة إضافة شاشة جديدة (Modal)
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


//  مراقب التحديثات اللحظية (Realtime Watcher)
// يوضع في أسفل ملف screens.js


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