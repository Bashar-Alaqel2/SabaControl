/**
 * modules/content/content.js - إدارة المحتوى (Namespaced Version)
 */

window.ContentModule = {
    init() {
        this.fetchPlaylist();
        this.syncScreens();
        
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }
    },

    async syncScreens() {
        const screens = await window.api.fetchScreens();
        this.updateTargetSelect(screens);
    },

    updateTargetSelect(screens) {
        const select = document.getElementById('targetScreen');
        if(!select) return;
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

        const startsAt = document.getElementById('startsAt').value;
        const expiresAt = document.getElementById('expiresAt').value;
        const target = document.getElementById('targetScreen').value;

        if (!startsAt || !expiresAt) return alert('الرجاء تحديد التاريخ والوقت!');
        
        const statusLabel = document.getElementById('uploadStatus');
        if (statusLabel) statusLabel.innerText = 'جاري المعالجة... ⏳';

        try {
            const type = document.getElementById('fileType').value;
            const fileName = `media_${Date.now()}.${file.name.split('.').pop()}`;
            
            // رفع الملف (تبسيطاً للنسخة الحالية)
            const { data, error: uploadError } = await window.sb.storage.from('media').upload(fileName, file);
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = window.sb.storage.from('media').getPublicUrl(fileName);
            
            const { data: userData } = await window.sb.auth.getUser();
            
            await window.sb.from('playlist').insert([{
                url: publicUrl,
                type: type,
                duration: parseInt(document.getElementById('duration').value || '10'),
                target_screen_id: target,
                starts_at: new Date(startsAt).toISOString(),
                expires_at: new Date(expiresAt).toISOString(),
                created_by: userData.user.id
            }]);

            alert("تم النشر بنجاح! ✅");
            this.fetchPlaylist();
        } catch (err) {
            alert("فشل الرفع: " + err.message);
        }
    },

    async fetchPlaylist() {
        try {
            const { data: playlistData, error } = await window.sb.from('playlist').select('*, profiles(full_name)');
            const screensData = await window.api.fetchScreens();
            
            const gallery = document.getElementById('mediaGallery');
            if (!gallery) return;
            gallery.innerHTML = '';

            if (playlistData && playlistData.length > 0) {
                playlistData.forEach(item => {
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
                gallery.innerHTML = '<p class="empty-msg">المكتبة فارغة</p>';
            }
        } catch (err) { console.error(err); }
    },

    async delete(id) {
        if (!confirm('حذف من الجدولة؟')) return;
        await window.sb.from('playlist').delete().eq('id', id);
        this.fetchPlaylist();
    },

    preview(url, type) {
        const img = document.getElementById('imagePreview');
        const vid = document.getElementById('videoPreview');
        if (type === 'image') {
            if (img) { img.src = url; img.style.display = 'block'; }
            if (vid) vid.style.display = 'none';
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