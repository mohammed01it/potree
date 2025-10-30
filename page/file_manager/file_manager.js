let files = [];
let idCounter = 1;
let searchQuery = '';

// ===== إعداد قاعدة المسارات (يدعم الاستضافة تحت مجلد فرعي) =====
// يمكن تعريف window.APP_BASE قبل تحميل هذا الملف في الـ HTML:
// <script>window.APP_BASE = '/potree/';</script>
// إذا تُرك فارغاً يعتمد الجذر '/'
// يمكن أيضاً تحديد أصل مختلف (دومين/منفذ) عبر window.API_ORIGIN مثل:
// <script>window.API_ORIGIN = 'http://localhost:3000'; window.APP_BASE='/';</script>
const RAW_APP_BASE = (typeof window !== 'undefined' && window.APP_BASE) ? window.APP_BASE : '/';
const API_BASE = RAW_APP_BASE.replace(/\\+/g, '/').replace(/\/+/g, '/').replace(/\/\/+/g, '/').replace(/\/?$/, '/');
const API_ORIGIN = (typeof window !== 'undefined' && window.API_ORIGIN) ? window.API_ORIGIN.replace(/\/?$/, '') : '';
function buildApiUrl(path){
    if(!path) return (API_ORIGIN || '') + API_BASE;
    const cleaned = path.replace(/^\//, '');
    return (API_ORIGIN + API_BASE + cleaned).replace(/(?<!:)\/+/g, '/');
}

// متغيرات مراقبة الرفع
let uploadSession = {
    isActive: false,
    startTime: null,
    // زمن التشغيل الفعلي (مجموع فترات النشاط)
    activeTimeMs: 0,
    // بداية آخر فترة نشاط
    lastActiveStart: null,
    totalBytes: 0,
    uploadedBytes: 0,
    currentFileIndex: 0,
    currentFileBytes: 0,
    currentFileTotalBytes: 0,
    speeds: [],
    lastUpdateTime: null,
    lastUploadedBytes: 0,
    maxSpeed: 0,
    avgSpeed: 0,
    cancelled: false,
    abortController: null,
    retryCount: 0,
    connectionStatus: 'متصل'
};

// توحيد قيمة mtime إلى ميلي ثانية
function normalizeMtime(v) {
    try {
        if (v == null) return Date.now();
        if (typeof v === 'number') {
            // إذا كانت بالثواني حوّلها لميلي ثانية
            return v < 1e12 ? Math.round(v * 1000) : Math.round(v);
        }
        if (typeof v === 'string') {
            // جرّب التحويل المباشر، ثم كرقم
            const parsed = Date.parse(v);
            if (!Number.isNaN(parsed)) return parsed;
            const n = Number(v);
            if (!Number.isNaN(n)) return n < 1e12 ? Math.round(n * 1000) : Math.round(n);
        }
    } catch (_) {}
    return Date.now();
}

// عند تحميل الصفحة: جلب قائمة المشاريع الموجودة مسبقاً ضمن pointclouds
window.addEventListener('DOMContentLoaded', async () => {
    showLoading(true);
    try {
    const res = await fetch(buildApiUrl('/api/projects'));
        if (!res.ok) throw new Error('http ' + res.status);
        const data = await res.json();
        let items = Array.isArray(data.items) ? data.items : [];
        // فرز محلي احتياطي من الأحدث إلى الأقدم
        try { items = items.sort((a, b) => (b.mtime || 0) - (a.mtime || 0)); } catch (_) {}
        files = items.map((it, idx) => {
            const mtimeMs = normalizeMtime(it.mtime);
            return {
                id: idx + 1,
                name: it.name,
                size: formatSize(it.sizeBytes || 0),
                sizeBytes: it.sizeBytes || 0,
                // نخزن الميلي ثانية فقط وننسّق وقت العرض
                mtime: mtimeMs,
                // تبقى موجودة للملائمة لكن لن يُعاد تحليلها
                date: new Date(mtimeMs).toLocaleString('ar-EG'),
                url: `/pointclouds/${encodeURIComponent(it.name)}/`
            };
        });
        idCounter = files.length + 1;
        renderTable();
        updateProjectCount();
    } catch (err) {
        console.error('failed to load projects:', err);
        showNotification('حدث خطأ أثناء تحميل المشاريع', 'error');
    } finally {
        showLoading(false);
    }
});

// إظهار/إخفاء شاشة التحميل
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

// تحديث عداد المشاريع
function updateProjectCount() {
    const countElement = document.getElementById('projectCount');
    if (countElement) {
    const count = files.length;
    const totalBytes = files.reduce((sum, f) => sum + (f.sizeBytes || 0), 0);
    const totalStr = formatSize(totalBytes);
    countElement.textContent = `${count} مشروع • ${totalStr}`;
    }
}

// إضافة مستمع لتغيير حجم النافذة لإعادة رسم الجدول
window.addEventListener('resize', () => {
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(() => {
        renderMobileOptimized();
        renderTable();
    }, 150);
});

// تشغيل التحسين عند تحميل الصفحة
window.addEventListener('DOMContentLoaded', () => {
    renderMobileOptimized();
});

// إظهار الإشعارات
function showNotification(message, type = 'info') {
    // يمكن تطوير هذه الدالة لاحقاً لإظهار إشعارات أكثر تقدماً
    if (type === 'error') {
        alert('❌ ' + message);
    } else if (type === 'success') {
        alert('✅ ' + message);
    } else {
        alert('ℹ️ ' + message);
    }
}

// ===== وظائف مراقبة الرفع =====

// بدء جلسة رفع جديدة
function initializeUploadSession(totalBytes, filesList) {
    uploadSession = {
        isActive: true,
    startTime: Date.now(),
    activeTimeMs: 0,
    lastActiveStart: Date.now(),
        totalBytes: totalBytes,
        uploadedBytes: 0,
        currentFileIndex: 0,
        currentFileBytes: 0,
        currentFileTotalBytes: 0,
        speeds: [],
        lastUpdateTime: Date.now(),
        lastUploadedBytes: 0,
        maxSpeed: 0,
        avgSpeed: 0,
        cancelled: false,
        abortController: new AbortController(),
        retryCount: 0,
        connectionStatus: 'متصل',
        filesList: filesList,
        totalFiles: filesList.length
    };
    
    // ربط زر الإلغاء
    const cancelBtn = document.getElementById('cancelUpload');
    if (cancelBtn) {
        cancelBtn.onclick = cancelUpload;
    }
    
    // بدء تحديث الإحصائيات
    startStatsUpdater();
}

// إلغاء الرفع مع حذف مجلد المشروع الكامل من pointclouds
async function cancelUpload() {
    if (!uploadSession.isActive) return;
    
    // استخدام نافذة تأكيد محسنة
    const shouldCancel = await confirmCancelUpload();
    if (!shouldCancel) return;
    
    try {
        // اجمع فترة النشاط الحالية قبل تغيير الحالة
        if (uploadSession.lastActiveStart) {
            uploadSession.activeTimeMs += Date.now() - uploadSession.lastActiveStart;
            uploadSession.lastActiveStart = null;
        }
        uploadSession.cancelled = true;
        uploadSession.isActive = false;
        
        const projectName = uploadSession.fileName ? uploadSession.fileName.split('.')[0] : 'غير محدد';
        showNotification(`جاري إلغاء الرفع وحذف مجلد "${projectName}" من pointclouds...`, 'cancel');
        
        // إلغاء الطلبات الجارية
        if (uploadSession.abortController) {
            uploadSession.abortController.abort();
        }
        
        // حذف مجلد المشروع الكامل من pointclouds
        if (uploadSession.fileName) {
            console.log(`🗑️ بدء حذف مجلد المشروع: ${projectName} من pointclouds`);
            const deleteResult = await deleteIncompleteFile(uploadSession.fileName);
            
            if (deleteResult.success) {
                showNotification(`✅ تم إلغاء الرفع وحذف مجلد "${projectName}" من pointclouds بنجاح`, 'success');
                console.log(`✅ حذف مجلد المشروع مكتمل:`, {
                    projectName: deleteResult.projectName,
                    path: deleteResult.path,
                    message: deleteResult.message
                });
            } else {
                showNotification(`⚠️ تم إلغاء الرفع لكن لم يتم حذف مجلد "${projectName}". يرجى حذفه يدوياً من pointclouds`, 'warning', 12000);
                console.warn(`⚠️ فشل حذف مجلد المشروع:`, {
                    projectName: deleteResult.projectName,
                    path: deleteResult.path,
                    message: deleteResult.message
                });
            }
        } else {
            showNotification('تم إلغاء الرفع بنجاح', 'success');
        }
        
        // تحديث واجهة المستخدم
        updateProgressContainer('cancelled');
        
        // إخفاء شريط التقدم بعد تأخير
        setTimeout(() => {
            hideProgress();
            cleanupSession();
        }, 3000);
        
        console.log('📋 ملخص إلغاء الرفع:', {
            fileName: uploadSession.fileName,
            projectName: projectName,
            uploadedSize: formatSize(uploadSession.uploadedBytes || 0),
            cancelledAt: new Date().toISOString(),
            targetPath: `pointclouds/${projectName}/`
        });
        
    } catch (error) {
        console.error('❌ خطأ عام أثناء إلغاء الرفع:', error);
        showNotification('تم إلغاء الرفع لكن حدث خطأ أثناء تنظيف الملفات. تحقق من pointclouds يدوياً.', 'error', 10000);
        
        updateProgressContainer('cancelled');
        setTimeout(() => {
            hideProgress();
            cleanupSession();
        }, 3000);
    }
}

// حذف مشروع من pointclouds باستخدام نفس API كالجدول
async function deleteIncompleteFile(fileName) {
    if (!fileName) {
        return { success: false, message: 'اسم الملف غير محدد' };
    }
    const projectName = fileName.split('.')[0];
    console.log(`🗑️ حذف مشروع من pointclouds عبر API: ${projectName}`);
    try {
        // نفس endpoint المستخدم في زر الحذف داخل الجدول
        const res = await fetch(`/api/projects/${encodeURIComponent(projectName)}`, { method: 'DELETE' });
        if (res.ok) {
            return {
                success: true,
                projectName,
                path: `pointclouds/${projectName}/`,
                message: 'تم حذف المشروع بنجاح'
            };
        }
        // Fallback: بعض الخوادم قد تستخدم POST /delete
        if (res.status === 404 || res.status === 405) {
            const fb = await fetch(`/api/projects/${encodeURIComponent(projectName)}/delete`, { method: 'POST' });
            if (fb.ok) {
                return {
                    success: true,
                    projectName,
                    path: `pointclouds/${projectName}/`,
                    message: 'تم حذف المشروع بنجاح (POST)'
                };
            }
        }
        const msg = await res.text();
        return { success: false, projectName, path: `pointclouds/${projectName}/`, message: msg || `HTTP ${res.status}` };
    } catch (err) {
        return { success: false, projectName, path: '', message: err.message };
    }
}

// [حُذفت دالة deleteProjectFolder لأنها لم تعد مستخدمة بعد توحيد الحذف عبر API]

// تحديث إحصائيات الرفع المحسن
function updateUploadStats(bytesUploaded, currentFileName = null) {
    if (!uploadSession.isActive || uploadSession.cancelled) return;
    
    const now = Date.now();
    const timeDiff = now - uploadSession.lastUpdateTime;
    
    if (timeDiff > 0) {
        // حساب السرعة الحالية
        const bytesDiff = bytesUploaded - uploadSession.lastUploadedBytes;
        const currentSpeed = (bytesDiff / timeDiff) * 1000; // bytes per second
        
        // تحديث مصفوفة السرعات (احتفظ بآخر 10 قياسات)
        uploadSession.speeds.push(currentSpeed);
        if (uploadSession.speeds.length > 10) {
            uploadSession.speeds.shift();
        }
        
        // حساب المتوسط والحد الأقصى
        uploadSession.avgSpeed = uploadSession.speeds.reduce((a, b) => a + b, 0) / uploadSession.speeds.length;
        uploadSession.maxSpeed = Math.max(uploadSession.maxSpeed, currentSpeed);
        
        uploadSession.lastUpdateTime = now;
        uploadSession.lastUploadedBytes = bytesUploaded;
    }
    
    uploadSession.uploadedBytes = bytesUploaded;
    
    // تحديث اسم الملف الحالي
    if (currentFileName) {
        updateCurrentFile(currentFileName);
    }
    
    // تحديث حالة الاتصال بناء على السرعة
    updateConnectionStatus();
    
    // تحديث العرض المحسن
    updateEnhancedProgressDisplay();
}

// تحديث العرض المحسن مع الرموز والأوقات
function updateEnhancedProgressDisplay() {
    const totalBytes = uploadSession.totalBytes;
    const uploadedBytes = uploadSession.uploadedBytes;
    const percentage = totalBytes > 0 ? (uploadedBytes / totalBytes) * 100 : 0;
    
    // تحديث شريط التقدم: اجعل الحاوية ثابتة وزد عرض التعبئة فقط
    const progressFill = document.getElementById('uploadProgress');
    if (progressFill) {
        progressFill.style.width = `${Math.min(100, percentage)}%`;
    }
    
    // تحديث النسبة المئوية المستقرة
    updatePercentageDisplay(percentage);
    
    // تحديث السرعة المستقرة
    updateSpeedDisplay(uploadSession.avgSpeed || 0);
    
    // تمت إزالة قسم الأوقات حسب الطلب
    
    // تحديث الأحجام
    const fileSizeElement = document.querySelector('.file-size');
    const uploadedSizeElement = document.querySelector('.uploaded-size');
    
    if (fileSizeElement) fileSizeElement.textContent = formatSize(totalBytes);
    if (uploadedSizeElement) uploadedSizeElement.textContent = formatSize(uploadedBytes);
    
    // تحديث عنوان الصفحة
    document.title = `رفع الملف: ${Math.round(percentage)}%`;
}

// تحديث حالة الاتصال
function updateConnectionStatus() {
    const currentSpeed = uploadSession.speeds[uploadSession.speeds.length - 1] || 0;
    let status = 'متصل';
    let statusClass = 'status-connected';
    
    if (currentSpeed < 1024) { // أقل من 1 KB/s
        status = 'بطيء';
        statusClass = 'status-slow';
    } else if (currentSpeed === 0) {
        status = 'منقطع';
        statusClass = 'status-disconnected';
    }
    
    uploadSession.connectionStatus = status;
    
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.textContent = status;
        statusElement.className = `stat-value ${statusClass}`;
    }
}

// تحديث الملف الحالي
function updateCurrentFile(fileName, fileIndex = null, fileBytes = 0, fileTotalBytes = 0) {
    if (fileIndex !== null) {
        uploadSession.currentFileIndex = fileIndex;
    }
    uploadSession.currentFileBytes = fileBytes;
    uploadSession.currentFileTotalBytes = fileTotalBytes;
    
    // تمت إزالة عرض اسم الملف الحالي
}

// تحديث عرض التقدم
function updateProgressDisplay() {
    if (!uploadSession.isActive) return;
    
    const now = Date.now();
    // زمن أدق: مجموع الفترات النشطة + المدة منذ آخر بداية نشاط
    const elapsedTime = (uploadSession.activeTimeMs || 0) + (uploadSession.lastActiveStart ? (now - uploadSession.lastActiveStart) : 0);
    const progress = (uploadSession.uploadedBytes / uploadSession.totalBytes) * 100;
    
    // تحديث النسبة المئوية
    const progressText = document.getElementById('progressText');
    if (progressText) {
        progressText.textContent = Math.round(progress) + '%';
    }
    
    // تحديث شريط التقدم الإجمالي
    const uploadProgress = document.getElementById('uploadProgress');
    if (uploadProgress) {
        uploadProgress.style.width = progress + '%';
    }
    
    // تحديث شريط تقدم الملف الحالي
    // تم إلغاء شريط تقدم الملف الحالي بناءً على طلب المستخدم
    
    // تحديث أحجام الملفات
    updateSizeDisplays();
    
    // تحديث الإحصائيات
    updateDetailedStats(elapsedTime);
    
    // تحديث معلومات الملفات
    updateFilesProgress();
}

// تحديث عرض الأحجام
function updateSizeDisplays() {
    const uploadedSizeEl = document.getElementById('uploadedSize');
    const totalSizeEl = document.getElementById('totalSize');
    // تمت إزالة عناصر تفاصيل الحجم للملف الحالي من الواجهة
    
    if (uploadedSizeEl) uploadedSizeEl.textContent = formatSize(uploadSession.uploadedBytes);
    if (totalSizeEl) totalSizeEl.textContent = formatSize(uploadSession.totalBytes);
    // لا يوجد تحديثات إضافية للملف الحالي
}

// تحديث الإحصائيات المفصلة
function updateDetailedStats(elapsedTime) {
    // السرعة المتوسطة
    const avgSpeedEl = document.getElementById('avgSpeed');
    if (avgSpeedEl) {
        avgSpeedEl.textContent = formatSpeed(uploadSession.avgSpeed);
    }
    
    // أعلى سرعة
    const maxSpeedEl = document.getElementById('maxSpeed');
    if (maxSpeedEl) {
        maxSpeedEl.textContent = formatSpeed(uploadSession.maxSpeed);
    }
    
    // الوقت المنقضي
    // تم الاستغناء عن عناصر timeElapsed/timeRemaining القديمة
    
    // السرعة الحالية
    const uploadSpeedEl = document.getElementById('uploadSpeed');
    if (uploadSpeedEl) {
        const currentSpeed = uploadSession.speeds[uploadSession.speeds.length - 1] || 0;
        uploadSpeedEl.textContent = formatSpeed(currentSpeed);
    }
    
    // إجمالي البيانات المرسلة
    const totalDataSentEl = document.getElementById('totalDataSent');
    if (totalDataSentEl) {
        totalDataSentEl.textContent = formatSize(uploadSession.uploadedBytes);
    }
}

// تحديث تقدم الملفات
function updateFilesProgress() {
    const filesProgressEl = document.getElementById('filesProgress');
    if (filesProgressEl) {
        filesProgressEl.textContent = `${uploadSession.currentFileIndex + 1}/${uploadSession.totalFiles} ملف`;
    }
}

// بدء محدث الإحصائيات
function startStatsUpdater() {
    const updateInterval = setInterval(() => {
        if (!uploadSession.isActive || uploadSession.cancelled) {
            clearInterval(updateInterval);
            return;
        }
        updateProgressDisplay();
    }, 500); // تحديث كل نصف ثانية
}

// تنسيق السرعة
function formatSpeed(bytesPerSecond) {
    if (bytesPerSecond < 1024) {
        return Math.round(bytesPerSecond) + ' B/s';
    } else if (bytesPerSecond < 1024 * 1024) {
        return (bytesPerSecond / 1024).toFixed(1) + ' KB/s';
    } else {
        return (bytesPerSecond / (1024 * 1024)).toFixed(2) + ' MB/s';
    }
}

// تنسيق الوقت بالشكل المطلوب مع الرموز
function formatTime(milliseconds) {
    if (isNaN(milliseconds) || milliseconds < 0) {
        return '--:--';
    }
    const totalSeconds = Math.floor(milliseconds / 1000);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

// تحديد تسمية وحدة الوقت (ساعة/دقيقة) حسب القيمة
function getTimeUnitLabel(milliseconds) {
    if (isNaN(milliseconds) || milliseconds < 0) return '';
    const hours = Math.floor(milliseconds / 3600000);
    return hours > 0 ? 'ساعة' : 'دقيقة';
}

// دالة تحديث عرض السرعة المستقرة
function updateSpeedDisplay(bytesPerSecond) {
    const speedElement = document.querySelector('.upload-speed .stat-value');
    if (!speedElement) return;
    
    if (bytesPerSecond === 0) {
        speedElement.innerHTML = `<span style="color: #666; font-family: monospace;">0 B/s</span>`;
        return;
    }
    
    const speed = formatSize(bytesPerSecond);
    let color = '#2196F3'; // لون ثابت أزرق
    
    speedElement.innerHTML = `<span style="color: ${color}; font-family: 'Courier New', monospace; font-weight: 600;">${speed}/ث</span>`;
}

// دالة تحديث عرض النسبة المئوية المستقرة
function updatePercentageDisplay(percentage) {
    const percentElement = document.querySelector('.progress-percentage .stat-value');
    if (!percentElement) return;
    
    const roundedPercent = Math.round(percentage * 10) / 10; // دقة عشرية واحدة
    const color = '#9C27B0'; // لون ثابت بنفسجي
    
    percentElement.innerHTML = `<span style="color: ${color}; font-family: 'Courier New', monospace; font-size: 1.2em; font-weight: 700;">${roundedPercent}%</span>`;
}

// تحديث حاوي التقدم بناء على الحالة
function updateProgressContainer(status) {
    const container = document.getElementById('progressContainer');
    if (!container) return;
    
    // إزالة جميع كلاسات الحالة
    container.classList.remove('error', 'success', 'cancelled');
    
    // إضافة كلاس الحالة المناسب
    if (status && status !== 'active') {
        container.classList.add(status);
    }
}

document.getElementById('uploadForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const fileInput = document.getElementById('fileInput');
    const fileNameInput = document.getElementById('fileNameInput');
    const filesList = Array.from(fileInput?.files || []);
    const customName = (fileNameInput?.value || '').trim();
    const progressContainer = document.getElementById('progressContainer');

    if (!filesList.length) {
        showNotification("يرجى اختيار ملفات أو مجلد للرفع.", 'error');
        return;
    }
    if (!customName) {
        showNotification("يرجى إدخال اسم الملف أو المشروع.", 'error');
        return;
    }

    const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
    // حساب إجمالي الأجزاء لجميع الملفات + الحجم الإجمالي لعرضه كسطر واحد
    let totalChunks = 0;
    let totalBytes = 0;
    for (const f of filesList) {
        totalChunks += Math.max(1, Math.ceil(f.size / CHUNK_SIZE));
        totalBytes += f.size;
    }
    let uploadedChunks = 0;
    let totalUploadedBytes = 0;

    // تهيئة جلسة الرفع
    initializeUploadSession(totalBytes, filesList);
    // حفظ اسم المشروع للاستخدام عند الإلغاء والحذف
    uploadSession.fileName = customName;

    if (progressContainer) {
        progressContainer.style.display = 'block';
        progressContainer.classList.add('fade-in');
        updateProgressContainer('active');
    }

    // دالة مساعدة لرفع جزء عبر XHR مع مراقبة التقدم
    function sendPart(formData, fileName, fileIndex, isFileComplete = false) {
        return new Promise((resolve, reject) => {
            if (uploadSession.cancelled) {
                reject(new Error('Upload cancelled'));
                return;
            }

            const xhr = new XMLHttpRequest();
            xhr.open('POST', buildApiUrl('/upload-chunk'), true);
            
            // مراقبة تقدم الرفع
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && !uploadSession.cancelled) {
                    const chunkProgress = e.loaded;
                    const currentFileBytes = uploadSession.currentFileBytes + chunkProgress;
                    
                    // تحديث الإحصائيات
                    updateUploadStats(totalUploadedBytes + chunkProgress, fileName);
                    updateCurrentFile(fileName, fileIndex, currentFileBytes, uploadSession.currentFileTotalBytes);
                }
            });
            
            xhr.onload = () => {
                if (uploadSession.cancelled) {
                    reject(new Error('Upload cancelled'));
                    return;
                }
                
                if (xhr.status >= 200 && xhr.status < 300) {
                    uploadSession.retryCount = 0; // إعادة تعيين عداد المحاولات عند النجاح
                    resolve(xhr.responseText);
                } else {
                    reject(new Error('HTTP ' + xhr.status));
                }
            };
            
            xhr.onerror = () => {
                uploadSession.connectionStatus = 'منقطع';
                reject(new Error('Network error'));
            };
            
            xhr.ontimeout = () => {
                uploadSession.connectionStatus = 'بطيء';
                reject(new Error('Upload timeout'));
            };
            
            // تعيين مهلة زمنية للطلب
            xhr.timeout = 60000; // 60 ثانية
            
            // ربط الطلب بـ AbortController
            uploadSession.abortController.signal.addEventListener('abort', () => {
                xhr.abort();
            });
            
            xhr.send(formData);
        });
    }

    // دالة إعادة المحاولة
    async function retryUpload(uploadFunction, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (uploadSession.cancelled) throw new Error('Upload cancelled');
                return await uploadFunction();
            } catch (error) {
                uploadSession.retryCount = attempt;
                
                if (attempt === maxRetries) {
                    throw error;
                }
                
                // انتظار قبل إعادة المحاولة (تزايد تدريجي)
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                await new Promise(resolve => setTimeout(resolve, delay));
                
                showNotification(`إعادة المحاولة ${attempt}/${maxRetries}...`, 'warning');
            }
        }
    }

    (async () => {
        try {
            for (let fileIndex = 0; fileIndex < filesList.length; fileIndex++) {
                if (uploadSession.cancelled) break;
                
                const file = filesList[fileIndex];
                uploadSession.currentFileIndex = fileIndex;
                uploadSession.currentFileTotalBytes = file.size;
                uploadSession.currentFileBytes = 0;
                
                // تحديد المسار النسبي داخل المجلد المختار
                let relativePath = file.webkitRelativePath || file.name;
                const firstSlash = relativePath.indexOf('/');
                if (firstSlash !== -1) {
                    relativePath = relativePath.substring(firstSlash + 1);
                }

                updateCurrentFile(relativePath, fileIndex, 0, file.size);

                if (file.size <= CHUNK_SIZE) {
                    // رفع ملف كامل كجزء واحد
                    await retryUpload(async () => {
                        const fd = new FormData();
                        fd.append('file', file);
                        fd.append('fileName', relativePath);
                        fd.append('customName', customName);
                        return await sendPart(fd, relativePath, fileIndex, true);
                    });
                    
                    uploadedChunks += 1;
                    totalUploadedBytes += file.size;
                    uploadSession.currentFileBytes = file.size;
                } else {
                    // رفع مجزأ
                    const chunks = Math.ceil(file.size / CHUNK_SIZE);
                    for (let i = 0; i < chunks; i++) {
                        if (uploadSession.cancelled) break;
                        
                        const start = i * CHUNK_SIZE;
                        const end = Math.min(start + CHUNK_SIZE, file.size);
                        const chunkSize = end - start;
                        
                        await retryUpload(async () => {
                            const blob = file.slice(start, end);
                            const fd = new FormData();
                            fd.append('chunk', blob, file.name);
                            fd.append('fileName', relativePath);
                            fd.append('chunkIndex', String(i));
                            fd.append('totalChunks', String(chunks));
                            fd.append('customName', customName);
                            return await sendPart(fd, relativePath, fileIndex, i === chunks - 1);
                        });
                        
                        uploadedChunks += 1;
                        totalUploadedBytes += chunkSize;
                        uploadSession.currentFileBytes = Math.min(uploadSession.currentFileBytes + chunkSize, file.size);
                        
                        // تحديث التقدم النهائي لهذا الجزء
                        updateUploadStats(totalUploadedBytes, relativePath);
                    }
                }
            }

            if (!uploadSession.cancelled) {
                // إضافة صف واحد يمثل المشروع باسم المستخدم المدخل وحجم إجمالي كل الملفات
                const now = new Date();
                files.unshift({
                    id: idCounter++,
                    name: customName,
                    size: formatSize(totalBytes),
                    sizeBytes: totalBytes,
                    date: now.toLocaleString('ar-EG'),
                    mtime: now.getTime(),
                    url: `/pointclouds/${encodeURIComponent(customName)}/`
                });
                renderTable();
                updateProjectCount();

                // تحديث حالة النجاح
                updateProgressContainer('success');
                const progressTitle = document.querySelector('.progress-title');
                if (progressTitle) {
                    progressTitle.innerHTML = '<span class="progress-emoji">✅</span>تم رفع المشروع بنجاح!';
                }
                
                showNotification('تم رفع جميع الملفات بنجاح! 🎉', 'success');
            }
        } catch (err) {
            console.error('Upload error:', err);
            
            if (!uploadSession.cancelled) {
                updateProgressContainer('error');
                const progressTitle = document.querySelector('.progress-title');
                if (progressTitle) {
                    progressTitle.innerHTML = '<span class="progress-emoji">❌</span>فشل في رفع المشروع';
                }
                showNotification('حدث خطأ أثناء الرفع: ' + err.message, 'error');
            }
        } finally {
            // أضف أي فترة نشطة متبقية ثم أوقف العداد
            if (uploadSession.lastActiveStart) {
                uploadSession.activeTimeMs += Date.now() - uploadSession.lastActiveStart;
                uploadSession.lastActiveStart = null;
            }
            uploadSession.isActive = false;
            
            // إخفاء شريط التقدم بعد تأخير
            setTimeout(() => {
                hideProgress();
                resetForm();
            }, uploadSession.cancelled ? 1000 : 5000);
        }
    })();
});

// تحديث شريط التقدم (دالة محسنة)
function updateProgress(uploaded, total) {
    const percent = Math.round((uploaded / total) * 100);
    updateUploadStats(uploaded * (uploadSession.totalBytes / total));
}

// إخفاء شريط التقدم
function hideProgress() {
    const progressContainer = document.getElementById('progressContainer');
    if (progressContainer) {
        setTimeout(() => {
            progressContainer.style.display = 'none';
            progressContainer.classList.remove('fade-in');
        }, 1000);
    }
}

// إعادة تعيين النموذج
function resetForm() {
    const fileInput = document.getElementById('fileInput');
    const fileNameInput = document.getElementById('fileNameInput');
    const uploadProgress = document.getElementById('uploadProgress');
    const progressText = document.getElementById('progressText');
    
    if (fileInput) fileInput.value = '';
    if (fileNameInput) fileNameInput.value = '';
    if (uploadProgress) uploadProgress.style.width = '0%';
    if (progressText) progressText.textContent = '';
}

// دالة تنظيف شاملة للجلسة
function cleanupSession() {
    console.log('🧹 بدء تنظيف الجلسة');
    
    // إيقاف الطلبات النشطة
    if (uploadSession.abortController) {
        uploadSession.abortController.abort();
    }
    
    // مسح بيانات الجلسة
    Object.assign(uploadSession, {
        isActive: false,
        cancelled: false,
        fileName: null,
        fileSize: 0,
        uploadedBytes: 0,
        startTime: null,
        abortController: null
    });
    
    // مسح المؤقتات
    if (window.progressTimer) {
        clearInterval(window.progressTimer);
        window.progressTimer = null;
    }
    
    console.log('✅ تم تنظيف الجلسة بنجاح');
}

function renderTable() {
    const tbody = document.querySelector('#filesTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    // فرز من الأحدث إلى الأقدم بناءً على mtime
    const sorted = [...files].sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
    const q = (searchQuery || '').trim().toLowerCase();
    const filtered = q ? sorted.filter(f => (f.name || '').toLowerCase().includes(q)) : sorted;
    
    if (filtered.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td colspan="5" class="empty-state">
                <div style="padding: 2rem; color: var(--text-secondary);">
                    ${q ? '🔍 لم يتم العثور على مشاريع تطابق البحث' : '📂 لا توجد مشاريع بعد'}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
        return;
    }
    
    // التحقق من حجم الشاشة
    const isMobile = window.innerWidth <= 768;

    filtered.forEach(f => {
        const tr = document.createElement('tr');
        tr.classList.add('fade-in');

        const fullDate = formatDateFull(f.mtime);
        const dateDisplay = isMobile ? formatDateCompact(f.mtime) : fullDate;
        const sizeDisplay = isMobile ? formatSizeCompact(f.size) : f.size;

        // Build a single, consistent row template. Use id-based handlers (viewFile/deleteFile/copyLink)
        tr.innerHTML = `
            <td data-label="المعرف"><strong>${f.id}</strong></td>
            <td data-label="اسم المشروع" class="project-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</td>
            <td data-label="الحجم"><span class="size-badge" title="${f.size}">${sizeDisplay}</span></td>
            <td data-label="تاريخ الإنشاء"><span class="date-text" title="${fullDate}">⏰ ${dateDisplay}</span></td>
            <td data-label="الإجراءات" class="col-actions">
                <div class="action-buttons">
                    <button onclick="viewFile(${f.id})" class="btn btn-view" title="عرض المشروع">
                        <span class="btn-icon">👁️</span><span class="btn-text">عرض</span>
                    </button>
                    <button onclick="copyLink(${f.id})" class="btn btn-copy" title="نسخ رابط المشروع">
                        <span class="btn-icon">📋</span><span class="btn-text">نسخ</span>
                    </button>
                    <button onclick="deleteFile(${f.id})" class="btn btn-delete" title="حذف المشروع">
                        <span class="btn-icon">🗑️</span><span class="btn-text">حذف</span>
                    </button>
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });
}

// دالة لتنسيق الحجم المضغوط للموبايل
function formatSizeCompact(sizeStr) {
    // إذا كان النص طويلاً، قم بتقصيره
    if (sizeStr.length > 8) {
        const match = sizeStr.match(/^(\d+\.?\d*)\s*(\w+)$/);
        if (match) {
            const number = parseFloat(match[1]);
            const unit = match[2];
            if (number >= 1000) {
                return (number / 1000).toFixed(1) + unit.charAt(0);
            }
            return number.toFixed(1) + unit.charAt(0);
        }
    }
    return sizeStr;
}

// عرض التاريخ الكامل حسب اللغة
function formatDateFull(ms) {
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '--';
    return d.toLocaleString('ar-EG');
}

// دالة لتنسيق التاريخ المضغوط للموبايل بالاعتماد على mtime (ميلي ثانية)
function formatDateCompact(input) {
    let ms = typeof input === 'number' ? input : Date.parse(input);
    if (Number.isNaN(ms)) return '—';
    const date = new Date(ms);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return 'اليوم';
    } else if (diffDays === 1) {
        return 'أمس';
    } else if (diffDays < 7) {
        return `${diffDays}د`;
    } else {
        return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    }
}

// إضافة دالة للتحقق من ضرورة استخدام عرض مضغوط جداً
function isExtraSmallScreen() {
    return window.innerWidth <= 480;
}

// تحسين عرض الجدول للشاشات الصغيرة جداً
function renderMobileOptimized() {
    const tbody = document.querySelector('#filesTable tbody');
    const thead = document.querySelector('#filesTable thead');
    
    if (isExtraSmallScreen()) {
        // تعديل رؤوس الأعمدة للشاشات الصغيرة - نعرض جميع الأعمدة في الكاردات
        thead.innerHTML = `
            <tr>
                <th class="col-id">المعرف</th>
                <th class="col-name">المشروع</th>
                <th class="col-size">الحجم</th>
                <th class="col-date">التاريخ</th>
                <th class="col-actions">الإجراءات</th>
            </tr>
        `;
        
        // إزالة أي ستايل قديم
        const oldStyle = document.getElementById('mobile-table-style');
        if (oldStyle) oldStyle.remove();
    } else {
        // استعادة الرؤوس الأصلية
        thead.innerHTML = `
            <tr>
                <th class="col-id">المعرف</th>
                <th class="col-name">اسم المشروع</th>
                <th class="col-size">الحجم</th>
                <th class="col-date">تاريخ الإنشاء</th>
                <th class="col-actions">الإجراءات</th>
            </tr>
        `;
        
        // إزالة الستايل المخصص للموبايل
        const mobileStyle = document.getElementById('mobile-table-style');
        if (mobileStyle) mobileStyle.remove();
    }
}

// دالة مساعدة لتجنب XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// البحث الفوري
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('searchInput');
    if (!input) return;
    
    input.addEventListener('input', (e) => {
        searchQuery = e.target.value || '';
        renderTable();
        updateProjectCount();
    });
    
    // إضافة مؤثرات للنموذج
    const fileInput = document.getElementById('fileInput');
    const fileInputWrapper = fileInput?.parentElement;
    
    if (fileInput && fileInputWrapper) {
        fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            const placeholder = fileInputWrapper.querySelector('.placeholder-text');
            
            if (files && files.length > 0) {
                const fileCount = files.length;
                placeholder.textContent = `تم اختيار ${fileCount} ${fileCount === 1 ? 'ملف' : 'ملف'}`;
                fileInputWrapper.style.borderColor = 'var(--success)';
                fileInputWrapper.style.background = 'rgba(76, 175, 80, 0.1)';
            } else {
                placeholder.textContent = 'اضغط لتحديد مجلد المشروع';
                fileInputWrapper.style.borderColor = 'var(--border)';
                fileInputWrapper.style.background = 'var(--bg-secondary)';
            }
        });
    }
});

function viewFile(id) {
    const folder = files.find(f => f.id === id);
    if (folder && folder.name) {
        // فتح صفحة Index.html مع اسم المشروع كـ query parameter لعرض النقاط السحابية
    // المسار إلى examples من داخل page/file_manager هو ../..
    const url = `../../examples/Index.html?r=${encodeURIComponent(folder.name)}`;
        window.open(url, '_blank');
        showNotification(`تم فتح مشروع "${folder.name}" في نافذة جديدة`, 'info');
    }
}

function deleteFile(id) {
    const item = files.find(f => f.id === id);
    if (!item) return;
    
    // تأكيد محسن للحذف
    const confirmMessage = `⚠️ تأكيد الحذف\n\nهل تريد حذف المشروع "${item.name}" وجميع ملفاته؟\n\nهذا الإجراء لا يمكن التراجع عنه.`;
    if (!confirm(confirmMessage)) return;
    
    // إظهار حالة التحميل
    const deleteBtn = document.querySelector(`button[onclick="deleteFile(${id})"]`);
    const originalText = deleteBtn?.innerHTML;
    if (deleteBtn) {
        deleteBtn.innerHTML = '⏳ جاري الحذف...';
        deleteBtn.disabled = true;
    }
    
    fetch(buildApiUrl(`/api/projects/${encodeURIComponent(item.name)}`), { method: 'DELETE' })
        .then(async (res) => {
            if (res.ok) return res; // قد يكون 204 بدون جسم
            // إن لم يدعم السيرفر DELETE أو عاد 404/405، جرّب POST fallback
            if (res.status === 404 || res.status === 405) {
                return fetch(buildApiUrl(`/api/projects/${encodeURIComponent(item.name)}/delete`), { method: 'POST' });
            }
            const txt = await res.text();
            throw new Error(txt || ('HTTP ' + res.status));
        })
        .then(async (res) => {
            if (!res.ok) {
                const txt = await res.text();
                throw new Error(txt || 'delete failed');
            }
            files = files.filter(f => f.id !== id);
            renderTable();
            updateProjectCount();
            showNotification(`تم حذف المشروع "${item.name}" بنجاح ✅`, 'success');
        })
        .catch(err => {
            console.error('delete error:', err);
            showNotification(`تعذر حذف المشروع: ${err.message}`, 'error');
        })
        .finally(() => {
            if (deleteBtn) {
                deleteBtn.innerHTML = originalText;
                deleteBtn.disabled = false;
            }
        });
}

function copyLink(id) {
    const file = files.find(f => f.id === id);
    if (file) {
        // نسخ رابط المشاهدة مباشرة إلى صفحة العارض
    // استخدم مسار نسبي يعمل عند فتح الملف من page/file_manager
    const url = `${window.location.origin}/examples/Index.html?r=${encodeURIComponent(file.name)}`;
        
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(url)
                .then(() => showNotification(`تم نسخ رابط المشروع "${file.name}" 📋`, 'success'))
                .catch(() => fallbackCopyTextToClipboard(url, file.name));
        } else {
            fallbackCopyTextToClipboard(url, file.name);
        }
    }
}

// نسخ نص كحل بديل للمتصفحات القديمة
function fallbackCopyTextToClipboard(text, fileName) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showNotification(`تم نسخ رابط المشروع "${fileName}" 📋`, 'success');
        } else {
            showNotification('تعذر نسخ الرابط', 'error');
        }
    } catch (err) {
        console.error('Fallback: Could not copy text', err);
        showNotification('تعذر نسخ الرابط', 'error');
    }
    
    document.body.removeChild(textArea);
}

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    if (bytes < 1024 * 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    return (bytes / (1024 * 1024 * 1024 * 1024)).toFixed(2) + ' TB';
}

// إخفاء شريط التقدم مع تنظيف البيانات
function hideProgress() {
    const progressContainer = document.getElementById('progressContainer');
    if (progressContainer) {
        progressContainer.style.display = 'none';
        progressContainer.classList.remove('fade-in', 'error', 'success', 'cancelled');
    }
    
    // إعادة تعيين جلسة الرفع
    uploadSession = {
        isActive: false,
        startTime: null,
        totalBytes: 0,
        uploadedBytes: 0,
        currentFileIndex: 0,
        currentFileBytes: 0,
        currentFileTotalBytes: 0,
        speeds: [],
        lastUpdateTime: null,
        lastUploadedBytes: 0,
        maxSpeed: 0,
        avgSpeed: 0,
        cancelled: false,
        abortController: null,
        retryCount: 0,
        connectionStatus: 'متصل'
    };
}

// إعادة تعيين النموذج مع تنظيف شامل
function resetForm() {
    const fileInput = document.getElementById('fileInput');
    const fileNameInput = document.getElementById('fileNameInput');
    const fileInputWrapper = document.querySelector('.file-input-wrapper');
    
    if (fileInput) fileInput.value = '';
    if (fileNameInput) fileNameInput.value = '';
    
    // إعادة تعيين شكل منطقة الرفع
    if (fileInputWrapper) {
        const placeholder = fileInputWrapper.querySelector('.placeholder-text');
        if (placeholder) {
            placeholder.textContent = 'اضغط لتحديد مجلد المشروع';
        }
        fileInputWrapper.style.borderColor = 'var(--border)';
        fileInputWrapper.style.background = 'var(--bg-secondary)';
    }
    
    // إعادة تعيين جميع عناصر التقدم
    const elementsToReset = [
        'uploadProgress', 'currentFileProgress', 'progressText',
        'currentFileName', 'uploadedSize', 'totalSize', 
        'currentFileSize', 'currentFileTotalSize', 'filesProgress',
        'uploadSpeed', 'timeElapsed', 'timeRemaining', 'avgSpeed',
        'maxSpeed', 'connectionStatus', 'totalDataSent'
    ];
    
    elementsToReset.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            if (id.includes('Progress')) {
                element.style.width = '0%';
            } else if (id === 'progressText') {
                element.textContent = '0%';
            } else if (id === 'currentFileName') {
                element.textContent = '📄 --';
            } else if (id === 'connectionStatus') {
                element.textContent = 'متصل';
                element.className = 'stat-value status-connected';
            } else if (id.includes('Size') || id === 'totalDataSent') {
                element.textContent = '0 B';
            } else if (id.includes('Speed')) {
                element.textContent = '0 KB/s';
            } else if (id.includes('time')) {
                element.textContent = id === 'timeElapsed' ? '00:00 دقيقة' : '--:-- دقيقة';
            } else if (id === 'filesProgress') {
                element.textContent = '0/0 ملف';
            }
        }
    });
}

// إتاحة الدوال للنطاق العام لاستدعائها من HTML
window.viewFile = viewFile;
window.deleteFile = deleteFile;
window.copyLink = copyLink;
