/**
 * modules/content/content.js - إدارة المحتوى (النسخة الاحترافية المستعادة)
 */

window.ContentModule = {
    init() {
        this.fetchPlaylist();
        this.syncScreens();

        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        // إخفاء مؤشرات التحميل عند البدء
        const progressContainer = document.getElementById('progressContainer');
        if (progressContainer) progressContainer.style.display = 'none';
    },

    async syncScreens() {
        const screens = await window.api.fetchScreens();
        this.updateTargetSelect(screens);
    },

    updateTargetSelect(screens) {
        const select = document.getElementById('targetScreen');
        if (!select) return;
        select.innerHTML = '<option value="all">عرض على كل الشاشات</option>';
        screens.forEach(s => {
            const displayName = s.screen_name || `شاشة (${s.device_id})`;
            select.innerHTML += `<option value="${s.device_id}">${displayName}</option>`;
        });
    },

    async upload() {
        const fileInput = document.getElementById('fileInput');
        const file = fileInput.files[0];
        if (!file) return alert('الرجاء اختيار ملف!');

        const startsInput = document.getElementById('startsAt').value;
        const expiresInput = document.getElementById('expiresAt').value;
        const target = document.getElementById('targetScreen').value;

        if (!startsInput || !expiresInput) return alert('الرجاء تحديد التاريخ والوقت!');
        if (new Date(startsInput) >= new Date(expiresInput)) return alert('خطأ: وقت الانتهاء يجب أن يكون بعد وقت البدء!');

        const statusLabel = document.getElementById('uploadStatus');
        if (statusLabel) statusLabel.innerText = 'جاري فحص توفر الشاشات... 🔍';

        try {
            // 🛑 1. فحص التعارض قبل الرفع
            const { data: conflicts } = await window.sb
                .from('playlist')
                .select('target_screen_id')
                .lt('starts_at', new Date(expiresInput).toISOString())
                .gt('expires_at', new Date(startsInput).toISOString());

            const busyIds = conflicts?.map(c => c.target_screen_id) || [];

            if (target !== 'all' && busyIds.includes(target)) {
                return alert('عذراً، هذه الشاشة محجوزة بالفعل في هذا التوقيت!');
            }

            if (target === 'all') {
                const allScreens = await window.api.fetchScreens();
                const freeScreens = allScreens.filter(s => !busyIds.includes(s.device_id));
                if (freeScreens.length === 0) {
                    return alert('جميع الشاشات محجوزة في هذا التوقيت، لا يمكن النشر!');
                }
                window.currentFreeScreens = freeScreens.map(s => s.device_id);
            }

            // 🟢 2. بدء عملية الرفع
            const type = document.getElementById('fileType').value;
            const progressContainer = document.getElementById('progressContainer');
            const progressBar = document.getElementById('progressBar');
            const progressText = document.getElementById('progressText');

            if (progressContainer) progressContainer.style.display = 'block';
            if (progressText) progressText.style.display = 'block';
            if (progressBar) progressBar.style.width = '0%';

            const fileName = `media_${Date.now()}.${file.name.split('.').pop()}`;

            if (type === 'video' && typeof tus !== 'undefined') {
                // استخدام tus للفيديوهات الكبيرة
                const upload = new tus.Upload(file, {
                    endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
                    retryDelays: [0, 3000, 5000, 10000, 20000],
                    headers: { authorization: `Bearer ${SUPABASE_KEY}`, 'x-upsert': 'true' },
                    uploadDataDuringCreation: true,
                    removeFingerprintOnSuccess: true,
                    metadata: { bucketName: 'media', objectName: fileName, contentType: file.type },
                    chunkSize: 5 * 1024 * 1024,
                    onError: (error) => { statusLabel.innerText = 'فشل الرفع: ' + error.message; },
                    onProgress: (bytesUploaded, bytesTotal) => {
                        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(1);
                        if (progressBar) progressBar.style.width = percentage + '%';
                        if (progressText) progressText.innerText = percentage + '%';
                    },
                    onSuccess: () => this.saveToDatabase(fileName, type, startsInput, expiresInput)
                });
                upload.start();
            } else {
                // رفع مباشر للصور أو في حال غياب tus
                statusLabel.innerText = 'جاري رفع الملف... ⏳';
                const { error: uploadError } = await window.sb.storage.from('media').upload(fileName, file);
                if (uploadError) throw uploadError;
                await this.saveToDatabase(fileName, type, startsInput, expiresInput);
            }

        } catch (err) {
            alert("فشل الرفع: " + err.message);
        }
    },

    async saveToDatabase(fileName, type, startsInput, expiresInput) {
        const statusLabel = document.getElementById('uploadStatus');
        if (statusLabel) statusLabel.innerText = 'جاري الجدولة... 💾';

        try {
            const { data: { publicUrl } } = window.sb.storage.from('media').getPublicUrl(fileName);
            const duration = document.getElementById('duration').value;
            const target = document.getElementById('targetScreen').value;
            const { data: userData } = await window.sb.auth.getUser();

            let rowsToInsert = [];
            if (target === 'all' && window.currentFreeScreens) {
                rowsToInsert = window.currentFreeScreens.map(screenId => ({
                    url: publicUrl,
                    type: type,
                    duration: parseInt(duration),
                    target_screen_id: screenId,
                    starts_at: new Date(startsInput).toISOString(),
                    expires_at: new Date(expiresInput).toISOString(),
                    created_by: userData.user.id
                }));
            } else {
                rowsToInsert.push({
                    url: publicUrl,
                    type: type,
                    duration: parseInt(duration),
                    target_screen_id: target,
                    starts_at: new Date(startsInput).toISOString(),
                    expires_at: new Date(expiresInput).toISOString(),
                    created_by: userData.user.id
                });
            }

            const { error } = await window.sb.from('playlist').insert(rowsToInsert);
            if (error) throw error;

            if (statusLabel) statusLabel.innerText = `تم النشر بنجاح على ${rowsToInsert.length} شاشة! ✅`;
            this.fetchPlaylist();
        } catch (err) {
            if (statusLabel) statusLabel.innerText = 'خطأ في الجدولة: ' + err.message;
        }
    },

    async fetchPlaylist() {
        try {
            const playlistData = await window.sb.from('playlist').select('*, profiles(full_name)');
            const screensData = await window.api.fetchScreens();

            const gallery = document.getElementById('mediaGallery');
            if (!gallery) return;
            gallery.innerHTML = '';

            const data = playlistData.data || [];

            if (data.length > 0) {
                data.forEach(item => {
                    const screenObj = screensData?.find(s => s.device_id === item.target_screen_id);
                    const screenName = screenObj?.screen_name || (item.target_screen_id === 'all' ? 'الكل' : item.target_screen_id);

                    gallery.innerHTML += `
                        <div class="media-card">
                            <div class="media-thumb">
                                ${item.type === 'image' ? `<img src="${item.url}">` : `<video src="${item.url}"></video>`}
                            </div>
                            <div class="media-info">
                                <strong><i class="fa-solid fa-display"></i> ${screenName}</strong>
                                <div class="small text-muted">${new Date(item.starts_at).toLocaleString('ar-YE')}</div>
                            </div>
                            <div class="media-actions">
                                <button class="btn btn-warning btn-sm" onclick="ContentModule.preview('${item.url}', '${item.type}')">عرض</button>
                                <button class="btn btn-danger btn-sm" onclick="ContentModule.delete('${item.id}')">حذف</button>
                            </div>
                        </div>
                    `;
                });
            } else {
                gallery.innerHTML = '<p class="empty-msg">المكتبة فارغة حالياً.</p>';
            }
        } catch (err) { console.error(err); }
    },

    async delete(id) {
        if (!confirm('هل أنت متأكد من الحذف؟')) return;
        await window.sb.from('playlist').delete().eq('id', id);
        this.fetchPlaylist();
    },

    preview(url, type) {
        const img = document.getElementById('imagePreview');
        const vid = document.getElementById('videoPreview');
        const placeholder = document.getElementById('previewPlaceholder');

        if (placeholder) placeholder.style.display = 'none';

        if (type === 'image') {
            if (img) { img.src = url; img.style.display = 'block'; }
            if (vid) { vid.style.display = 'none'; vid.pause(); }
        } else {
            if (vid) { vid.src = url; vid.style.display = 'block'; vid.play(); }
            if (img) img.style.display = 'none';
        }
    },

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        const fileURL = URL.createObjectURL(file);
        this.preview(fileURL, file.type.startsWith('image/') ? 'image' : 'video');
    }
};

// تشغيل الوحدة
ContentModule.init();