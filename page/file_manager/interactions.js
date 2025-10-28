// ===== تفاعلات متقدمة لمدير ملفات Potree =====

document.addEventListener('DOMContentLoaded', () => {
    initializeAdvancedInteractions();
    setupMobileOptimizations();
});

function initializeAdvancedInteractions() {
    setupDragAndDrop();
    setupKeyboardShortcuts();
    setupTooltips();
    setupThemeToggle();
    setupAnimations();
}

// تحسينات خاصة بالأجهزة المحمولة
function setupMobileOptimizations() {
    // إضافة كلاس للجسم للتمييز بين الموبايل والديسكتوب
    function updateDeviceClass() {
        const isMobile = window.innerWidth <= 768;
        document.body.classList.toggle('mobile-device', isMobile);
        document.body.classList.toggle('desktop-device', !isMobile);
    }
    
    updateDeviceClass();
    window.addEventListener('resize', updateDeviceClass);
    
    // تحسين التفاعل مع اللمس
    setupTouchInteractions();
    
    // تحسين العرض للأجهزة المحمولة
    optimizeTableForMobile();
    
    // إضافة إيماءات الجهاز المحمول
    setupMobileGestures();
}

// تحسين التفاعل مع اللمس
function setupTouchInteractions() {
    // تحسين أزرار الإجراءات للمس
    document.addEventListener('touchstart', (e) => {
        if (e.target.classList.contains('action-btn')) {
            e.target.style.transform = 'scale(0.95)';
        }
    }, { passive: true });
    
    document.addEventListener('touchend', (e) => {
        if (e.target.classList.contains('action-btn')) {
            e.target.style.transform = '';
        }
    }, { passive: true });
    
    // منع الزوم المزدوج على الأزرار
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            if (e.target.classList.contains('action-btn') || 
                e.target.classList.contains('btn')) {
                e.preventDefault();
            }
        }
        lastTouchEnd = now;
    }, false);
}

// تحسين الجدول للأجهزة المحمولة
function optimizeTableForMobile() {
    const tableContainer = document.querySelector('.table-container');
    if (!tableContainer) return;
    
    // إضافة مؤشر التمرير الأفقي
    const scrollIndicator = document.createElement('div');
    scrollIndicator.className = 'scroll-indicator';
    scrollIndicator.innerHTML = '← مرر لليسار لرؤية المزيد';
    scrollIndicator.style.cssText = `
        position: absolute;
        bottom: -30px;
        right: 10px;
        font-size: 11px;
        color: var(--text-secondary);
        background: var(--surface);
        padding: 4px 8px;
        border-radius: var(--radius-sm);
        box-shadow: var(--shadow-sm);
        z-index: 1;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
    `;
    
    tableContainer.parentElement.style.position = 'relative';
    tableContainer.parentElement.appendChild(scrollIndicator);
    
    // إظهار/إخفاء مؤشر التمرير
    let scrollTimer;
    tableContainer.addEventListener('scroll', () => {
        if (window.innerWidth <= 768) {
            scrollIndicator.style.opacity = '1';
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                scrollIndicator.style.opacity = '0';
            }, 2000);
        }
    });
    
    // إخفاء المؤشر على الشاشات الكبيرة
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            scrollIndicator.style.opacity = '0';
        }
    });
}

// إيماءات الجهاز المحمول
function setupMobileGestures() {
    let touchStartX = 0;
    let touchStartY = 0;
    
    // إيماءة السحب لليسار للحذف (على صفوف الجدول)
    document.addEventListener('touchstart', (e) => {
        if (e.target.closest('tbody tr')) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }
    }, { passive: true });
    
    document.addEventListener('touchmove', (e) => {
        if (!touchStartX || !touchStartY) return;
        
        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;
        const diffX = touchStartX - touchX;
        const diffY = touchStartY - touchY;
        
        // إذا كان السحب أفقياً أكثر من العمودي
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
            const row = e.target.closest('tbody tr');
            if (row && diffX > 0) { // سحب لليسار
                row.style.transform = `translateX(-${Math.min(diffX, 100)}px)`;
                row.style.opacity = Math.max(0.5, 1 - diffX / 200);
            }
        }
    }, { passive: true });
    
    document.addEventListener('touchend', (e) => {
        const row = e.target.closest('tbody tr');
        if (row) {
            row.style.transform = '';
            row.style.opacity = '';
        }
        touchStartX = 0;
        touchStartY = 0;
    }, { passive: true });
}

// ===== سحب وإفلات الملفات =====
function setupDragAndDrop() {
    const fileInputWrapper = document.querySelector('.file-input-wrapper');
    const fileInput = document.getElementById('fileInput');
    
    if (!fileInputWrapper || !fileInput) return;
    
    let dragCounter = 0;
    
    // منع السلوك الافتراضي للمتصفح
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        fileInputWrapper.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    // تسليط الضوء على منطقة الإفلات
    ['dragenter', 'dragover'].forEach(eventName => {
        fileInputWrapper.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        fileInputWrapper.addEventListener(eventName, unhighlight, false);
    });
    
    // التعامل مع الملفات المسحوبة
    fileInputWrapper.addEventListener('drop', handleDrop, false);
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    function highlight(e) {
        dragCounter++;
        fileInputWrapper.classList.add('dragover');
    }
    
    function unhighlight(e) {
        dragCounter--;
        if (dragCounter === 0) {
            fileInputWrapper.classList.remove('dragover');
        }
    }
    
    function handleDrop(e) {
        dragCounter = 0;
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            // تحديث حقل الملفات
            fileInput.files = files;
            
            // تحديث النص المعروض
            const placeholder = fileInputWrapper.querySelector('.placeholder-text');
            if (placeholder) {
                const fileCount = files.length;
                placeholder.textContent = `تم إفلات ${fileCount} ${fileCount === 1 ? 'ملف' : 'ملف'}`;
            }
            
            // تأثير بصري
            fileInputWrapper.style.borderColor = 'var(--success)';
            fileInputWrapper.style.background = 'rgba(76, 175, 80, 0.1)';
            
            showNotification('تم إضافة الملفات بنجاح! 📁', 'success');
        }
    }
}

// ===== اختصارات لوحة المفاتيح =====
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + U = رفع ملف جديد
        if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
            e.preventDefault();
            const fileInput = document.getElementById('fileInput');
            if (fileInput) fileInput.click();
        }
        
        // Ctrl/Cmd + F = البحث
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }
        
        // Escape = إلغاء البحث
        if (e.key === 'Escape') {
            const searchInput = document.getElementById('searchInput');
            if (searchInput && searchInput.value) {
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input'));
            }
        }
        
        // Enter في حقل اسم المشروع = إرسال النموذج
        if (e.key === 'Enter' && e.target.id === 'fileNameInput') {
            e.preventDefault();
            const form = document.getElementById('uploadForm');
            if (form) form.dispatchEvent(new Event('submit'));
        }
    });
}

// ===== تلميحات الأدوات =====
function setupTooltips() {
    const elementsWithTooltips = document.querySelectorAll('[title]');
    
    elementsWithTooltips.forEach(element => {
        let tooltip = null;
        
        element.addEventListener('mouseenter', (e) => {
            const el = e.currentTarget;
            const title = el.getAttribute('title');
            if (!title) return;
            
            // إزالة الـ title لمنع التلميح الافتراضي
            el.removeAttribute('title');
            el.setAttribute('data-original-title', title);
            
            // إنشاء التلميح المخصص
            tooltip = document.createElement('div');
            tooltip.className = 'custom-tooltip';
            tooltip.textContent = title;
            tooltip.style.cssText = `
                position: absolute;
                background: var(--dark-surface);
                color: var(--dark-text);
                padding: var(--spacing-sm) var(--spacing-md);
                border-radius: var(--radius-base);
                font-size: var(--font-size-xs);
                font-weight: var(--font-weight-medium);
                box-shadow: var(--shadow-lg);
                z-index: 1000;
                pointer-events: none;
                white-space: nowrap;
                opacity: 0;
                transition: opacity var(--transition-fast);
            `;
            
            document.body.appendChild(tooltip);
            
            // تحديد موضع التلميح
            const rect = el.getBoundingClientRect();
            const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
            const scrollY = window.pageYOffset || document.documentElement.scrollTop;
            const isRTL = (document.documentElement.getAttribute('dir') || document.body.getAttribute('dir') || '').toLowerCase() === 'rtl';
            const gap = 8; // مسافة فاصلة بين العنصر والتلميح

            let top, left;

            // اجعل تلميح زر الإلغاء بجانب الزر بدلًا من أعلى
            if (el.classList.contains('btn-cancel')) {
                // محاذاة عمودية في منتصف الزر، ووضع التلميح بجانب الزر
                top = rect.top + scrollY + (rect.height / 2) - (tooltip.offsetHeight / 2);
                left = isRTL
                    ? rect.left + scrollX - tooltip.offsetWidth - gap // في RTL ضع التلميح على يسار الزر
                    : rect.left + scrollX + rect.width + gap;         // في LTR ضع التلميح على يمين الزر
            } else {
                // الوضع الافتراضي: أعلى العنصر وفي المنتصف أفقيًا
                top = rect.top + scrollY - tooltip.offsetHeight - gap;
                left = rect.left + scrollX + (rect.width / 2) - (tooltip.offsetWidth / 2);
            }

            // حراسة ضمن إطار العرض أفقيًا
            const maxLeft = scrollX + window.innerWidth - tooltip.offsetWidth - 4;
            const minLeft = scrollX + 4;
            if (left > maxLeft) left = maxLeft;
            if (left < minLeft) left = minLeft;

            // إذا خرج للأعلى، ضع التلميح أسفل العنصر
            if (top < scrollY + 4) {
                top = rect.top + scrollY + rect.height + gap;
            }

            tooltip.style.top = top + 'px';
            tooltip.style.left = left + 'px';
            
            // إظهار التلميح
            setTimeout(() => tooltip.style.opacity = '1', 10);
        });
        
        element.addEventListener('mouseleave', (e) => {
            if (tooltip) {
                tooltip.remove();
                tooltip = null;
            }
            
            // استعادة الـ title الأصلي
            const el = e.currentTarget;
            const originalTitle = el.getAttribute('data-original-title');
            if (originalTitle) {
                el.setAttribute('title', originalTitle);
                el.removeAttribute('data-original-title');
            }
        });
    });
}

// ===== تبديل السمة (فاتح/مظلم) =====
function setupThemeToggle() {
    // إنشاء زر تبديل السمة
    const themeToggle = document.createElement('button');
    themeToggle.className = 'theme-toggle';
    themeToggle.innerHTML = '🌙';
    themeToggle.title = 'تبديل السمة';
    themeToggle.style.cssText = `
        position: fixed;
        bottom: var(--spacing-lg);
        left: var(--spacing-lg);
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: var(--surface);
        border: 1px solid var(--border);
        box-shadow: var(--shadow-lg);
        cursor: pointer;
        font-size: var(--font-size-lg);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all var(--transition-normal);
        z-index: 1000;
    `;
    
    document.body.appendChild(themeToggle);
    
    // التحقق من السمة المحفوظة
    const savedTheme = localStorage.getItem('potree-theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        themeToggle.innerHTML = '☀️';
    }
    
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        
        themeToggle.innerHTML = isDark ? '☀️' : '🌙';
        localStorage.setItem('potree-theme', isDark ? 'dark' : 'light');
        
        // تأثير بصري
        themeToggle.style.transform = 'scale(1.2)';
        setTimeout(() => themeToggle.style.transform = 'scale(1)', 150);
    });
    
    // تأثير الحوم
    themeToggle.addEventListener('mouseenter', () => {
        themeToggle.style.transform = 'translateY(-2px)';
        themeToggle.style.boxShadow = 'var(--shadow-xl)';
    });
    
    themeToggle.addEventListener('mouseleave', () => {
        themeToggle.style.transform = 'translateY(0)';
        themeToggle.style.boxShadow = 'var(--shadow-lg)';
    });
}

// ===== تحريكات متقدمة =====
function setupAnimations() {
    // إضافة كلاس لتحريك العناصر عند الظهور
    const animatedElements = document.querySelectorAll('.upload-section, .projects-section');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    
    animatedElements.forEach(el => observer.observe(el));
    
    // تحريك الأزرار عند النقر
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn') || e.target.classList.contains('action-btn')) {
            const button = e.target;
            
            // إنشاء تأثير التموج
            const ripple = document.createElement('span');
            const rect = button.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                left: ${x}px;
                top: ${y}px;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                transform: scale(0);
                animation: ripple 0.6s linear;
                pointer-events: none;
            `;
            
            button.style.position = 'relative';
            button.style.overflow = 'hidden';
            button.appendChild(ripple);
            
            setTimeout(() => ripple.remove(), 600);
        }
    });
}

// إضافة CSS للتحريكات
const animationStyles = document.createElement('style');
animationStyles.textContent = `
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    
    .dark-theme {
        --bg-primary: var(--dark-bg);
        --bg-secondary: var(--dark-surface);
        --surface: var(--dark-surface);
        --surface-elevated: var(--dark-card);
        --text-primary: var(--dark-text);
        --text-secondary: var(--dark-text-secondary);
        --border: var(--dark-border);
        --border-light: var(--dark-border);
    }
    
    .dark-theme .form-input,
    .dark-theme .search-input {
        background: var(--dark-input);
    }
    
    .dark-theme .navbar {
        background: var(--dark-surface);
        border-bottom-color: var(--dark-border);
    }
    
    .custom-tooltip {
        font-family: var(--font-primary);
    }
`;

document.head.appendChild(animationStyles);

// دالة لإظهار الإشعارات المحسنة مع دعم حالات الرفع
function showNotification(message, type = 'info', duration = 4000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icon = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️',
        upload: '☁️',
        cancel: '🚫'
    }[type] || 'ℹ️';
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
            <span style="font-size: var(--font-size-lg);">${icon}</span>
            <span style="flex: 1;">${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: none; border: none; font-size: var(--font-size-lg); cursor: pointer; color: var(--text-secondary);">
                ×
            </button>
        </div>
    `;
    
    // تخصيص الألوان حسب النوع
    const colors = {
        success: 'var(--success)',
        error: 'var(--error)', 
        warning: 'var(--warning)',
        info: 'var(--info)',
        upload: 'var(--primary)',
        cancel: 'var(--warning)'
    };
    
    notification.style.borderLeftColor = colors[type] || colors.info;
    notification.style.borderLeftWidth = '4px';
    notification.style.borderLeftStyle = 'solid';
    
    // إضافة تأثيرات خاصة للإشعارات المهمة
    if (type === 'error' || type === 'cancel') {
        notification.style.animation = 'shake 0.5s ease-in-out';
        duration = 6000; // وقت أطول للأخطاء
    }
    
    document.body.appendChild(notification);
    
    // إزالة تلقائية مع زيادة المدة للرسائل المهمة
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOutRight 0.3s ease-in forwards';
            setTimeout(() => notification.remove(), 300);
        }
    }, duration);
}

// إضافة تحريكات إضافية
const additionalAnimations = document.createElement('style');
additionalAnimations.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
    
    @keyframes slideOutRight {
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    /* تحسين شكل الإشعارات */
    .notification {
        position: fixed;
        top: var(--spacing-lg);
        right: var(--spacing-lg);
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: var(--spacing-lg);
        box-shadow: var(--shadow-xl);
        z-index: 1000;
        max-width: 400px;
        animation: slideInRight 0.3s ease-out;
        font-family: var(--font-primary);
    }
    
    .notification + .notification {
        top: calc(var(--spacing-lg) + 80px);
    }
    
    .notification + .notification + .notification {
        top: calc(var(--spacing-lg) + 160px);
    }
    
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;

document.head.appendChild(additionalAnimations);

// تصدير الدالة للاستخدام العام
window.showNotification = showNotification;

// إضافة دوال مساعدة للرفع المتقدم
function confirmCancelUpload() {
    return new Promise((resolve) => {
        const projectName = uploadSession.fileName ? uploadSession.fileName.split('.')[0] : 'غير محدد';
        
        const confirmDialog = document.createElement('div');
        confirmDialog.className = 'confirm-dialog';
        confirmDialog.innerHTML = `
            <div class="confirm-dialog-content">
                <div class="confirm-icon">⚠️</div>
                <h3>إلغاء عملية الرفع؟</h3>
                <div class="confirm-details">
                    <p><strong>تحذير:</strong> سيتم فقدان التقدم المحرز في الرفع</p>
                    <p><strong>إجراء:</strong> سيتم حذف المجلد/الملف من pointclouds</p>
                    <div class="confirm-stats">
                        <span>📁 الملف: ${uploadSession.fileName || 'غير محدد'}</span><br>
                        <span>� المشروع: ${projectName}</span><br>
                        <span>�📊 المرفوع: ${formatSize(uploadSession.uploadedBytes || 0)}</span><br>
                        <span>�️ المسار: pointclouds/${projectName}/</span>
                    </div>
                </div>
                <div class="confirm-dialog-actions">
                    <button class="btn btn-danger" id="confirmCancel">
                        🗑️ إلغاء وحذف المجلد
                    </button>
                    <button class="btn btn-primary" id="keepUploading">
                        ⏮️ الاستمرار
                    </button>
                </div>
            </div>
        `;
        
        const style = document.createElement('style');
        style.textContent = `
            .confirm-dialog {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
                animation: fadeIn 0.3s ease-out;
                backdrop-filter: blur(3px);
            }
            
            .confirm-dialog-content {
                background: var(--surface);
                border-radius: var(--radius-lg);
                padding: var(--spacing-xl);
                max-width: 480px;
                width: 90%;
                text-align: center;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                animation: scaleIn 0.3s ease-out;
                border: 2px solid var(--warning);
            }
            
            .confirm-icon {
                font-size: 2.5rem;
                margin-bottom: var(--spacing-md);
            }
            
            .confirm-dialog h3 {
                margin: 0 0 var(--spacing-lg) 0;
                color: var(--text-primary);
                font-size: var(--font-size-xl);
                font-weight: 700;
            }
            
            .confirm-details {
                text-align: right;
                margin: var(--spacing-lg) 0;
                padding: var(--spacing-md);
                background: var(--bg-secondary);
                border-radius: var(--radius-md);
                border-right: 4px solid var(--warning);
            }
            
            .confirm-details p {
                margin: var(--spacing-sm) 0;
                color: var(--text-secondary);
                font-size: var(--font-size-sm);
            }
            
            .confirm-details strong {
                color: var(--text-primary);
            }
            
            .confirm-stats {
                margin-top: var(--spacing-md);
                font-family: 'Courier New', monospace;
                font-size: var(--font-size-xs);
                color: var(--text-secondary);
                line-height: 1.6;
                padding: var(--spacing-sm);
                background: var(--surface);
                border-radius: var(--radius-sm);
                direction: ltr;
                text-align: left;
            }
            
            .confirm-dialog-actions {
                display: flex;
                gap: var(--spacing-md);
                justify-content: center;
                margin-top: var(--spacing-xl);
            }
            
            .confirm-dialog-actions .btn {
                padding: var(--spacing-md) var(--spacing-lg);
                border-radius: var(--radius-md);
                font-weight: 600;
                font-size: var(--font-size-md);
                min-width: 150px;
                transition: transform 0.2s ease;
            }
            
            .confirm-dialog-actions .btn:hover {
                transform: translateY(-2px);
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes scaleIn {
                from { 
                    transform: scale(0.9); 
                    opacity: 0; 
                }
                to { 
                    transform: scale(1); 
                    opacity: 1; 
                }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(confirmDialog);
        
        document.getElementById('confirmCancel').onclick = () => {
            confirmDialog.remove();
            style.remove();
            resolve(true);
        };
        
        document.getElementById('keepUploading').onclick = () => {
            confirmDialog.remove();
            style.remove();
            resolve(false);
        };
        
        // إغلاق عند النقر خارج المحتوى
        confirmDialog.onclick = (e) => {
            if (e.target === confirmDialog) {
                confirmDialog.remove();
                style.remove();
                resolve(false);
            }
        };
    });
}

// دالة لتحديث إحصائيات الرفع في الوقت الفعلي
function updateUploadDisplay(session) {
    const stats = calculateUploadStats(session);
    
    // تحديث شريط التقدم الرئيسي
    const progressBar = document.querySelector('.progress-bar');
    if (progressBar) {
        progressBar.style.width = `${stats.percentage}%`;
        progressBar.style.background = stats.percentage > 90 ? 'var(--success)' : 
                                      stats.percentage > 50 ? 'var(--primary)' : 'var(--info)';
    }
    
    // تحديث شريط سرعة الرفع
    const speedBar = document.querySelector('.speed-bar');
    if (speedBar) {
        const speedPercentage = Math.min(100, (stats.speed / (10 * 1024 * 1024)) * 100); // نسبة من 10MB/s
        speedBar.style.width = `${speedPercentage}%`;
    }
    
    // تحديث النصوص
    const updateElement = (selector, value) => {
        const element = document.querySelector(selector);
        if (element) element.textContent = value;
    };
    
    updateElement('.file-size', formatSize(session.file.size));
    updateElement('.uploaded-size', formatSize(session.loaded));
    updateElement('.upload-speed', `${formatSize(stats.speed)}/ثانية`);
    updateElement('.elapsed-time', formatTime(stats.elapsedTime));
    updateElement('.remaining-time', formatTime(stats.remainingTime));
    updateElement('.progress-percentage', `${stats.percentage.toFixed(1)}%`);
    
    // تحديث العنوان بالنسبة المئوية
    document.title = `رفع الملف: ${stats.percentage.toFixed(0)}%`;
}

// دالة تنسيق الوقت
function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '--:--';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// دالة حساب الإحصائيات المحسنة
function calculateUploadStats(session) {
    const now = Date.now();
    const elapsedTime = (now - session.startTime) / 1000;
    const percentage = session.file.size > 0 ? (session.loaded / session.file.size) * 100 : 0;
    
    // حساب السرعة بناءً على آخر قياسات
    let speed = 0;
    if (session.speedHistory && session.speedHistory.length > 0) {
        // متوسط السرعة من آخر 5 قياسات
        const recentSpeeds = session.speedHistory.slice(-5);
        speed = recentSpeeds.reduce((sum, s) => sum + s, 0) / recentSpeeds.length;
    }
    
    // حساب الوقت المتبقي
    const remainingBytes = session.file.size - session.loaded;
    const remainingTime = speed > 0 ? remainingBytes / speed : Infinity;
    
    return {
        percentage: Math.min(100, Math.max(0, percentage)),
        speed,
        elapsedTime,
        remainingTime,
        remainingBytes
    };
}

// تصدير الدوال للاستخدام العام
window.confirmCancelUpload = confirmCancelUpload;
window.updateUploadDisplay = updateUploadDisplay;
window.formatTime = formatTime;
window.calculateUploadStats = calculateUploadStats;
