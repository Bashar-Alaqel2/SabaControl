// ==========================================
// 🚀 modules/content/content.js - إدارة المحتوى والوسائط (النسخة الآمنة المدمجة)
// ==========================================

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

    if (!startsInput || !expiresInput) return alert('الرجاء تحديد تاريخ ووقت البدء والانتهاء!');
    if (new Date(startsInput) >= new Date(expiresInput)) return alert('خطأ: وقت الانتهاء يجب أن يكون بعد وقت البدء!');

    const statusLabel = document.getElementById('uploadStatus');
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
    statusLabel.innerText = 'جاري الجدولة... 💾';
    const { data: { publicUrl } } = sb.storage.from('media').getPublicUrl(fileName);
    const duration = document.getElementById('duration').value;
    const target = document.getElementById('targetScreen').value;

    await sb.from('playlist').insert({
        url: publicUrl, type: type, duration: parseInt(duration),
        target_screen_id: target,
        starts_at: new Date(startsInput).toISOString(),
        expires_at: new Date(expiresInput).toISOString() 
    });

    statusLabel.innerText = 'تم الرفع والجدولة بنجاح! ✅';
    fileInput.value = '';
    if(document.getElementById('fileNameDisplay')) document.getElementById('fileNameDisplay').innerHTML = 'اسحب الملف هنا أو <span>اضغط للاستعراض</span>';
    
    setTimeout(() => {
        if(document.getElementById('progressContainer')) document.getElementById('progressContainer').style.display = 'none';
        if(document.getElementById('progressText')) document.getElementById('progressText').style.display = 'none';
    }, 3000);
    
    fetchPlaylist();
}

// 🟢 الدالة المحدثة: ذكية، تقرأ الصلاحية من القاعدة، وتحمي أزرار الحذف
async function fetchPlaylist() {
    try {
        // 1. جلب بيانات المستخدم الحالي
        const { data: { user } } = await window.sb.auth.getUser();
        const myUserId = user?.id;

        // 2. التأكد من الصلاحية (مدير أو محرر) من قاعدة البيانات لتجنب أي تأخير
        let myRole = 'editor';
        if (myUserId) {
            const { data: profile } = await window.sb.from('profiles').select('role').eq('id', myUserId).single();
            if (profile) myRole = profile.role;
        }

        // 3. جلب المحتوى مع اسم الناشر (يعتمد على عمود created_by الذي أنشأناه في SQL)
        const { data, error } = await window.sb
            .from('playlist')
            .select('*, profiles(full_name)')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error("خطأ قاعدة البيانات:", error.message);
            throw error;
        }
        
        const gallery = document.getElementById('mediaGallery');
        if (!gallery) return;
        gallery.innerHTML = '';
        
        if(data && data.length > 0) {
            const now = new Date();
            data.forEach(item => {
                const startDate = item.starts_at ? new Date(item.starts_at) : new Date(0);
                const expDate = item.expires_at ? new Date(item.expires_at) : null;
                
                let statusText = 'غير معروف';
                let statusColor = 'gray';
                let opacity = '1';

                if (expDate && now > expDate) {
                    statusText = 'منتهي 🔴'; statusColor = '#e53935'; opacity = '0.6';
                } else if (now < startDate) {
                    statusText = 'مجدول ⏳'; statusColor = '#ffa726';
                } else {
                    statusText = 'نشط 🟢'; statusColor = '#2e7d32';
                }
                
                const thumb = item.type === 'image' ? `<img src="${item.url}">` : `<video src="${item.url}"></video>`;
                const icon = item.type === 'image' ? '<i class="fa-solid fa-image"></i>' : '<i class="fa-solid fa-film"></i>';
                
                // ==========================================
                // 🛡️ منطق الحماية: إظهار اسم الناشر وحماية زر الحذف
                // ==========================================
                const publisherName = item.profiles?.full_name || 'مجهول';
                const isOwner = (item.created_by === myUserId) || (myRole === 'admin');
                
                // زر الحذف يظهر للمالك والمدير فقط، وغيرهم يرى (محمي)
                const deleteButtonHtml = isOwner 
                    ? `<button class="btn btn-danger" style="padding: 5px 10px; font-size:12px;" onclick="deleteItem('${item.id}')" title="حذف الملف"><i class="fa-solid fa-trash"></i></button>` 
                    : `<span style="font-size: 11px; color: #888; background: #eee; padding: 4px 8px; border-radius: 4px;"><i class="fa-solid fa-lock"></i> محمية</span>`;

                gallery.innerHTML += `
                    <div class="media-card" style="opacity: ${opacity};">
                        <div class="media-thumb">
                            <span class="media-type-icon">${icon}</span>
                            ${thumb}
                        </div>
                        <div class="media-info">
                            <strong style="font-size:11px; color: var(--primary);"><i class="fa-solid fa-user-pen"></i> الناشر: ${publisherName}</strong><br>
                            <hr style="border: 0; border-top: 1px solid #eee; margin: 5px 0;">
                            <strong style="font-size:12px;">يبدأ:</strong> <span style="font-size:11px;">${startDate.toLocaleString('ar-EG')}</span><br>
                            <strong style="font-size:12px;">ينتهي:</strong> <span style="font-size:11px;">${expDate ? expDate.toLocaleString('ar-EG') : 'غير محدد'}</span><br>
                            <div style="margin-top: 8px; font-weight: bold; color: ${statusColor};">${statusText}</div>
                        </div>
                        <div class="media-actions">
                            <button class="btn btn-warning" style="padding: 5px 10px; font-size:12px;" onclick="previewFromPlaylist('${item.url}', '${item.type}')"><i class="fa-solid fa-play"></i> عرض</button>
                            ${deleteButtonHtml}
                        </div>
                    </div>
                `;
            });
        } else {
            gallery.innerHTML = '<p style="text-align: center; width: 100%; color: #888; margin-top: 20px;">لا توجد وسائط في المكتبة حالياً.</p>';
        }
    } catch (err) {
        console.error("خطأ في جلب المحتوى:", err);
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