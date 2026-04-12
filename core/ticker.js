/**
 * core/ticker.js - وحدة إدارة البث الحي (شريط الأخبار) الموحدة
 * Component-based module to prevent HTML/JS duplication
 */

window.TickerModule = {
    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // توليد الواجهة الموحدة
        container.innerHTML = `
            <div class="premium-glass-card h-100" style="border-top: 4px solid #f59e0b;">
                <div class="flex-between mb-4">
                    <h3 class="mb-0" style="font-size: 1.3rem; font-weight: 900; color: #fff;">
                        <i class="fa-solid fa-satellite-dish text-warning me-2"></i> بث الأخبار العاجلة
                    </h3>
                    <label class="toggle-switch">
                        <input type="checkbox" id="sharedTickerToggle_${containerId}">
                        <span class="slider"></span>
                    </label>
                </div>
                
                <div class="card-body p-0">
                    <div class="form-group mb-4">
                        <label class="small fw-bold text-muted mb-2">🎯 استهداف البث ومعرف الشاشة:</label>
                        <div class="d-flex gap-2">
                            <select id="sharedTickerTargetScreen_${containerId}" onchange="TickerModule.loadSpecificScreenTicker('${containerId}')" class="premium-input flex-fill">
                                <option value="all">البث للجميع (Global Sync)</option>
                            </select>
                            <button class="action-btn identify" style="width: 48px; border-radius: 12px;" onclick="TickerModule.identifySelectedScreen('${containerId}')" title="إظهار كود التعريف للشاشة المحددة">
                                <i class="fa-solid fa-id-badge"></i>
                            </button>
                        </div>
                    </div>

                    <div class="form-group mb-4">
                        <textarea id="sharedNewsInput_${containerId}" rows="3" class="premium-input w-100" placeholder="اكتب رسالة البث هنا..." style="font-size: 15px; resize: none;"></textarea>
                    </div>

                    <div class="settings-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px;">
                        <div class="form-group text-center">
                            <label class="small d-block mb-2 fw-bold text-muted">الخلفية</label>
                            <input type="color" id="sharedTickerBgColor_${containerId}" value="#000000" class="premium-input w-100 p-1" style="height: 50px; cursor: pointer;">
                        </div>
                        <div class="form-group text-center">
                            <label class="small d-block mb-2 fw-bold text-muted">لون الخط</label>
                            <input type="color" id="sharedTickerTextColor_${containerId}" value="#ffffff" class="premium-input w-100 p-1" style="height: 50px; cursor: pointer;">
                        </div>
                        <div class="form-group" style="grid-column: span 2;">
                            <label class="small fw-bold text-muted mb-2">سرعة الحركة</label>
                            <input type="range" id="sharedTickerSpeed_${containerId}" value="50" min="10" max="200" class="form-range" style="accent-color: var(--primary);">
                        </div>
                    </div>

                    <button class="neon-btn w-100 py-3" style="background: #f59e0b; font-weight: 900; font-size: 16px; border: none;" onclick="TickerModule.saveAdvancedTicker('${containerId}')">
                        <i class="fa-solid fa-satellite-dish me-2"></i> إرسال البث الفوري
                    </button>
                </div>
            </div>
        `;

        this.populateTickerTargetSelect(containerId).then(() => {
            this.loadSpecificScreenTicker(containerId);
        });
    },

    async populateTickerTargetSelect(containerId) {
        const screens = await window.api.fetchScreens();
        const select = document.getElementById(`sharedTickerTargetScreen_${containerId}`);
        if (!select || !screens) return;

        select.innerHTML = '<option value="all">البث للجميع (Global Sync)</option>';
        screens.forEach(s => {
            const name = s.screen_name || `شاشة (${s.device_id})`;
            select.innerHTML += `<option value="${s.device_id}">${name}</option>`;
        });
    },

    async loadSpecificScreenTicker(containerId) {
        const targetId = document.getElementById(`sharedTickerTargetScreen_${containerId}`)?.value || 'all';
        const data = await window.api.fetchLastActiveTicker(targetId);
        
        if (data) {
            document.getElementById(`sharedNewsInput_${containerId}`).value = data.message;
            document.getElementById(`sharedTickerToggle_${containerId}`).checked = data.show_ticker;
            document.getElementById(`sharedTickerBgColor_${containerId}`).value = data.bg_color;
            document.getElementById(`sharedTickerTextColor_${containerId}`).value = data.text_color;
            document.getElementById(`sharedTickerSpeed_${containerId}`).value = data.speed;
        } else {
            document.getElementById(`sharedNewsInput_${containerId}`).value = '';
        }
    },

    async identifySelectedScreen(containerId) {
        const targetId = document.getElementById(`sharedTickerTargetScreen_${containerId}`)?.value;
        if (!targetId || targetId === 'all') return alert('يرجى تحديد شاشة معينة أولاً من القائمة لإرسال أمر التعرف.');
        try {
            window.broadcastCommand('SHOW_ID', targetId);
            alert(`تم إرسال إشارة للتعرف على الشاشة مستهدفة: ${targetId} 📡`);
        } catch (err) { console.error(err); }
    },

    async saveAdvancedTicker(containerId) {
        const text = document.getElementById(`sharedNewsInput_${containerId}`)?.value || '';
        const bgColor = document.getElementById(`sharedTickerBgColor_${containerId}`)?.value || '#000000';
        const txtColor = document.getElementById(`sharedTickerTextColor_${containerId}`)?.value || '#ffffff';
        const speed = document.getElementById(`sharedTickerSpeed_${containerId}`)?.value || '50';
        const targetId = document.getElementById(`sharedTickerTargetScreen_${containerId}`)?.value || 'all';
        const isVisible = document.getElementById(`sharedTickerToggle_${containerId}`)?.checked || false;

        const btn = document.querySelector(`#${containerId} .neon-btn`);

        if (!text) return alert("الرجاء كتابة نص الخبر أولاً!");

        try {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري المعالجة...';
            }

            const { error } = await window.sb.from('tickers').insert([{
                message: text,
                bg_color: bgColor,
                text_color: txtColor,
                speed: parseInt(speed),
                show_ticker: isVisible,
                target_screen_id: targetId
            }]);

            if (error) throw error;

            window.broadcastCommand('SYNC_TICKER', targetId);
            alert('تم بث وتحديث رسالة الأخبار بنجاح 📡');
            
            // Clear input after successful broadcast
            document.getElementById(`sharedNewsInput_${containerId}`).value = '';
            
            // Refresh dashboard ticker history if open
            if (window.DashboardModule && document.getElementById('tickerHistoryBody')) {
                 window.DashboardModule.fetchTickerHistory();
            }

        } catch (err) { 
            alert('خطأ في البث: ' + err.message); 
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-satellite-dish me-2"></i> إرسال البث الفوري';
            }
        }
    }
};
