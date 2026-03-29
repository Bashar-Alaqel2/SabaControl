
//  modules/content/content.js - إدارة المحتوى والوسائط (النسخة الآمنة المدمجة)


function initContent() {
    fetchPlaylist();
    // نستدعي دالة تحديث قائمة التخصيص لتعبئة الـ Select
    if(typeof fetchScreens === 'function') fetchScreens(); 
}

function updateTargetSelect(screens) {
    const select = document.getElementById('targetScreen');
    if(!select) return;
    select.innerHTML = '<option value="all">عرض على كل الشاشات</option>';
    screens.forEach(s => {
        const displayName = s.screen_name ? s.screen_name : `شاشة (${s.device_id})`;
        select.innerHTML += `<option value="${s.device_id}">${displayName}</option>`;
    });
}

async function uploadContent() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (!file) return alert('الرجاء اختيار ملف!');

    const startsInput = document.getElementById('startsAt').value;
    const expiresInput = document.getElementById('expiresAt').value;
    const target = document.getElementById('targetScreen').value;

    if (!startsInput || !expiresInput) return alert('الرجاء تحديد التاريخ والوقت!');
    if (new Date(startsInput) >= new Date(expiresInput)) return alert('خطأ: وقت الانتهاء يجب أن يكون بعد وقت البدء!');

    // 🔴 [الجديد] 1. فحص التعارض قبل الرفع لتوفير الوقت والبيانات
    const statusLabel = document.getElementById('uploadStatus');
    statusLabel.innerText = 'جاري فحص توفر الشاشات... 🔍';

    const { data: conflicts } = await window.sb
        .from('playlist')
        .select('target_screen_id')
        .lt('starts_at', new Date(expiresInput).toISOString())
        .gt('expires_at', new Date(startsInput).toISOString());

    const busyIds = conflicts.map(c => c.target_screen_id);

    // إذا كان المستخدم اختار شاشة محددة وهي مشغولة
    if (target !== 'all' && busyIds.includes(target)) {
        return alert('عذراً، هذه الشاشة محجوزة بالفعل في هذا التوقيت!');
    }
    
    // إذا اختار "الكل" وجميع الشاشات مشغولة
    if (target === 'all') {
        const { data: allScreens } = await window.sb.from('screens').select('device_id');
        const freeScreens = allScreens.filter(s => !busyIds.includes(s.device_id));
        if (freeScreens.length === 0) {
            return alert('جميع الشاشات محجوزة في هذا التوقيت، لا يمكن النشر!');
        }
        // تخزين الشاشات المتاحة لاستخدامها في دالة Save
        window.currentFreeScreens = freeScreens.map(s => s.device_id);
    }

    // 🟢 2. إذا اجتاز الفحص، نبدأ عملية الرفع (كودك الأصلي كما هو)
    const type = document.getElementById('fileType').value;
    
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    if(progressContainer) progressContainer.style.display = 'block';
    if(progressText) progressText.style.display = 'block';
    if(progressBar) progressBar.style.width = '0%';

    const fileExtension = file.name.split('.').pop() || (type === 'image' ? 'jpg' : 'mp4');
    const fileName = 'media_' + Date.now() + '.' + fileExtension;
    
    if (type === 'video') {
        statusLabel.innerText = 'جاري رفع الفيديو (نظام الحزم الآمن)... ⏳';
        const upload = new tus.Upload(file, {
            endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
            retryDelays: [0, 3000, 5000, 10000, 20000],
            headers: { authorization: `Bearer ${SUPABASE_KEY}`, 'x-upsert': 'true' },
            uploadDataDuringCreation: true,
            removeFingerprintOnSuccess: true,
            metadata: { bucketName: 'media', objectName: fileName, contentType: file.type, cacheControl: '3600' },
            chunkSize: 5 * 1024 * 1024,
            onError: function (error) { statusLabel.innerText = 'فشل الرفع: ' + error.message; },
            onProgress: function (bytesUploaded, bytesTotal) {
                const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(1);
                if(progressBar) progressBar.style.width = percentage + '%';
                if(progressText) progressText.innerText = percentage + '%';
            },
            onSuccess: async function () { await saveToDatabase(fileName, type, startsInput, expiresInput, statusLabel, fileInput); }
        });
        upload.findPreviousUploads().then(function (previousUploads) {
            if (previousUploads.length) upload.resumeFromPreviousUpload(previousUploads[0]);
            upload.start();
        });
    } else {
        statusLabel.innerText = 'جاري رفع الصورة... ⏳';
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = function(event) {
            if (event.lengthComputable) {
                const percentComplete = ((event.loaded / event.total) * 100).toFixed(1);
                if(progressBar) progressBar.style.width = percentComplete + '%';
                if(progressText) progressText.innerText = percentComplete + '%';
            }
        };
        xhr.onload = async function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                await saveToDatabase(fileName, type, startsInput, expiresInput, statusLabel, fileInput);
            } else {
                statusLabel.innerText = 'فشل الرفع المباشر للصورة.';
            }
        };
        xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/media/${fileName}`, true);
        xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_KEY}`);
        xhr.setRequestHeader('x-upsert', 'true');
        xhr.setRequestHeader('Content-Type', file.type || 'image/jpeg');
        xhr.send(file);
    }
}

async function saveToDatabase(fileName, type, startsInput, expiresInput, statusLabel, fileInput) {
  statusLabel.innerText = 'جاري الجدولة الذكية... 💾';
    
    // 2️⃣ جلب بيانات المستخدم مرة واحدة في البداية
    const { data: userData } = await window.sb.auth.getUser();
    const myUserId = userData?.user?.id;

    if (!myUserId) {
        return alert("فشل التحقق من هوية المستخدم، يرجى تسجيل الدخول مجدداً.");
    }

    const { data: { publicUrl } } = sb.storage.from('media').getPublicUrl(fileName);
    const duration = document.getElementById('duration').value;
    const target = document.getElementById('targetScreen').value;

    let rowsToInsert = [];

    // 3️⃣ استخدام myUserId الجاهز داخل المصفوفة
    if (target === 'all' && window.currentFreeScreens) {
        rowsToInsert = window.currentFreeScreens.map(screenId => ({
            url: publicUrl,
            type: type,
            duration: parseInt(duration),
            target_screen_id: screenId,
            starts_at: new Date(startsInput).toISOString(),
            expires_at: new Date(expiresInput).toISOString(),
            created_by: myUserId // القيمة جاهزة الآن
        }));
    } else {
        rowsToInsert.push({
            url: publicUrl,
            type: type,
            duration: parseInt(duration),
            target_screen_id: target,
            starts_at: new Date(startsInput).toISOString(),
            expires_at: new Date(expiresInput).toISOString(),
            created_by: myUserId // القيمة جاهزة الآن
        });
    }

    const { error } = await sb.from('playlist').insert(rowsToInsert);
    
    if (error) {
        statusLabel.innerText = 'خطأ في الجدولة: ' + error.message;
    } else {
        statusLabel.innerText = `تم النشر بنجاح على ${rowsToInsert.length} شاشة! ✅`;
        // تنظيف واعادة تعبئة
        fileInput.value = '';
        fetchPlaylist();
    }
}

// 🟢 الدالة المحدثة: ذكية، تقرأ الصلاحية من القاعدة، وتحمي أزرار الحذف
async function fetchPlaylist() {
    try {
        const { data: { user } } = await window.sb.auth.getUser();
        const myUserId = user?.id;

        let myRole = 'editor';
        if (myUserId) {
            const { data: profile } = await window.sb.from('profiles').select('role').eq('id', myUserId).single();
            if (profile) myRole = profile.role;
        }

        // 1. جلب البيانات (سنحتاج أيضاً لجدول الشاشات لجلب أسمائها)
        const { data: playlistData, error } = await window.sb
            .from('playlist')
            .select('*, profiles(full_name)');
        
        const { data: screensData } = await window.sb.from('screens').select('device_id, screen_name');

        if (error) throw error;

        const gallery = document.getElementById('mediaGallery');
        if (!gallery) return;
        gallery.innerHTML = '';

        if (playlistData && playlistData.length > 0) {
            // 2. 🧠 منطق التجميع (Grouping Logic)
            // نجمع السجلات التي لها نفس الـ URL ونفس وقت البدء
            const groupedMap = {};

            playlistData.forEach(item => {
                const groupKey = `${item.url}_${item.starts_at}`;
                if (!groupedMap[groupKey]) {
                    groupedMap[groupKey] = { ...item, target_screens: [] };
                }
                
                // البحث عن اسم الشاشة بدلاً من الـ ID
                const screenObj = screensData?.find(s => s.device_id === item.target_screen_id);
                const screenName = screenObj?.screen_name || `شاشة (${item.target_screen_id})`;
                groupedMap[groupKey].target_screens.push(screenName);
            });

            const now = new Date();
            
            // 3. عرض الكروت المجمعة
            Object.values(groupedMap).forEach(item => {
                const startDate = new Date(item.starts_at);
                const expDate = item.expires_at ? new Date(item.expires_at) : null;
                
                let statusText = 'نشط 🟢';
                let statusColor = '#2e7d32';
                let opacity = '1';

                if (expDate && now > expDate) {
                    statusText = 'منتهي 🔴'; statusColor = '#e53935'; opacity = '0.6';
                } else if (now < startDate) {
                    statusText = 'مجدول ⏳'; statusColor = '#ffa726';
                }

                const thumb = item.type === 'image' ? `<img src="${item.url}">` : `<video src="${item.url}"></video>`;
                const icon = item.type === 'image' ? '<i class="fa-solid fa-image"></i>' : '<i class="fa-solid fa-film"></i>';
                const publisherName = item.profiles?.full_name || 'مجهول';
                
                // تحويل مصفوفة الشاشات إلى نص مقروء
                const screensList = item.target_screens.join(', ');

                const isOwner = (item.created_by === myUserId) || (myRole === 'admin');
                const deleteButtonHtml = isOwner 
                    ? `<button class="btn btn-danger" onclick="deleteGroup('${item.url}', '${item.starts_at}')" title="حذف من كل الشاشات"><i class="fa-solid fa-trash"></i> حذف الكل</button>` 
                    : `<span class="locked-badge"><i class="fa-solid fa-lock"></i> محمي</span>`;

                gallery.innerHTML += `
                    <div class="media-card" style="opacity: ${opacity};">
                        <div class="media-thumb">
                            <span class="media-type-icon">${icon}</span>
                            ${thumb}
                        </div>
                        <div class="media-info">
                            <strong style="color: var(--primary);"><i class="fa-solid fa-user-pen"></i> الناشر: ${publisherName}</strong>
                            <hr>
                            <div class="schedule-info">
                                <div><strong><i class="fa-regular fa-calendar"></i> يبدأ:</strong> ${startDate.toLocaleString('ar-EG')}</div>
                                <div><strong><i class="fa-regular fa-clock"></i> ينتهي:</strong> ${expDate ? expDate.toLocaleString('ar-EG') : 'مفتوح'}</div>
                            </div>
                            <div class="target-info" style="margin-top:8px; padding:5px; background:#f0f7f0; border-radius:4px; font-size:11px;">
                                <strong><i class="fa-solid fa-display"></i> يعرض على:</strong> <span style="color:#1b5e20;">${screensList}</span>
                            </div>
                            <div style="margin-top: 10px; font-weight: bold; color: ${statusColor}; text-align:center;">${statusText}</div>
                        </div>
                        <div class="media-actions">
                            <button class="btn btn-warning" onclick="previewFromPlaylist('${item.url}', '${item.type}')"><i class="fa-solid fa-play"></i> عرض</button>
                            ${deleteButtonHtml}
                        </div>
                    </div>
                `;
            });
        } else {
            gallery.innerHTML = '<p class="empty-msg">لا توجد وسائط في المكتبة حالياً.</p>';
        }
    } catch (err) {
        console.error("خطأ في جلب المحتوى المجمع:", err);
    }
}

async function deleteGroup(url, starts_at) {
    if (confirm('سيتم حذف هذا الإعلان من جميع الشاشات المرتبط بها، هل أنت متأكد؟')) {
        try {
            const { error } = await window.sb
                .from('playlist')
                .delete()
                .eq('url', url)
                .eq('starts_at', starts_at);
                
            if (error) throw error;
            fetchPlaylist(); // إعادة تحديث القائمة
        } catch (err) {
            alert('عذراً، لا تملك صلاحية حذف هذه المجموعة!');
        }
    }
}

// 🟢 تعديل دالة الحذف لالتقاط رسائل الحماية (RLS) إذا حاول شخص التلاعب
async function deleteItem(id) {
    if (confirm('هل أنت متأكد من حذف هذا المحتوى؟')) {
        try {
            const { error } = await window.sb.from('playlist').delete().eq('id', id);
            if (error) throw error;
            fetchPlaylist();
        } catch (err) {
            alert('عذراً، لا تملك صلاحية حذف هذا الملف!');
        }
    }
}

function previewFromPlaylist(url, type) {
    const placeholder = document.getElementById('previewPlaceholder');
    const imgPreview = document.getElementById('imagePreview');
    const vidPreview = document.getElementById('videoPreview');

    if(placeholder) placeholder.style.display = 'none';
    if(imgPreview) imgPreview.style.display = 'none';
    if(vidPreview) {
        vidPreview.style.display = 'none';
        vidPreview.pause();
    }

    if (type === 'image') {
        if(imgPreview) {
            imgPreview.src = url;
            imgPreview.style.display = 'block';
        }
    } else {
        if(vidPreview) {
            vidPreview.src = url;
            vidPreview.style.display = 'block';
            vidPreview.play();
        }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('fileInput')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const placeholder = document.getElementById('previewPlaceholder');
    const imgPreview = document.getElementById('imagePreview');
    const vidPreview = document.getElementById('videoPreview');

    if(placeholder) placeholder.style.display = 'none';
    if(imgPreview) imgPreview.style.display = 'none';
    
    if(vidPreview) {
        vidPreview.style.display = 'none';
        vidPreview.pause();
    }

    const fileURL = URL.createObjectURL(file);
    if (file.type.startsWith('image/')) {
        if(imgPreview) {
            imgPreview.src = fileURL;
            imgPreview.style.display = 'block';
        }
        if(document.getElementById('fileType')) document.getElementById('fileType').value = 'image';
    } else if (file.type.startsWith('video/')) {
        if(vidPreview) {
            vidPreview.src = fileURL;
            vidPreview.style.display = 'block';
        }
        if(document.getElementById('fileType')) document.getElementById('fileType').value = 'video';
    }
});

initContent();