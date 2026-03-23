// ==========================================
// 📊 modules/dashboard/dashboard.js - لوحة القيادة
// ==========================================

function initDashboard() {
    loadComponents();
    fetchScreens();
    
    // جلب إعدادات الشريط الأخباري لملئ الحقول
    fetchTickerSettingsForDashboard();
}

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
    
    document.querySelectorAll('.load-stats-here').forEach(container => {
        container.innerHTML = statsHTML;
    });
}

async function fetchTickerSettingsForDashboard() {
    try {
        const { data } = await window.sb.from('settings').select('*');
        if (data) {
            const showSetting = data.find(item => item.key === 'show_ticker');
            if (document.getElementById('tickerToggle')) document.getElementById('tickerToggle').checked = showSetting ? (showSetting.value === 'true') : true;

            const newsSetting = data.find(item => item.key === 'news_ticker');
            if (newsSetting && document.getElementById('newsInput')) document.getElementById('newsInput').value = newsSetting.value;

            const tBg = data.find(item => item.key === 'ticker_bg')?.value || '#000000';
            const tColor = data.find(item => item.key === 'ticker_color')?.value || '#ffffff';
            const tSpeed = data.find(item => item.key === 'ticker_speed')?.value || '50';
            
            if(document.getElementById('tickerBgColor')) document.getElementById('tickerBgColor').value = tBg;
            if(document.getElementById('tickerTextColor')) document.getElementById('tickerTextColor').value = tColor;
            if(document.getElementById('tickerSpeed')) document.getElementById('tickerSpeed').value = tSpeed;
        }
    } catch (err) { console.error("خطأ:", err); }
}

async function toggleTickerVisibilityDashboard() {
    const isVisible = document.getElementById('tickerToggle').checked;
    try {
        await window.sb.from('settings').upsert({ key: 'show_ticker', value: isVisible.toString() });
    } catch (err) { console.error(err); }
}

async function updateAdvancedTickerDashboard() {
    const text = document.getElementById('newsInput')?.value || '';
    const bgColor = document.getElementById('tickerBgColor')?.value || '#000000';
    const txtColor = document.getElementById('tickerTextColor')?.value || '#ffffff';
    const speed = document.getElementById('tickerSpeed')?.value || '50';
    try {
        await window.sb.from('settings').upsert([
            { key: 'news_ticker', value: text },
            { key: 'ticker_bg', value: bgColor },
            { key: 'ticker_color', value: txtColor },
            { key: 'ticker_speed', value: speed }
        ]);
        alert('تم بث النص والألوان والسرعة لجميع الشاشات بنجاح! 📡');
    } catch (err) { alert('حدث خطأ: ' + err.message); }
}

// تشغيل عند التحميل
initDashboard();