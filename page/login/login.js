/**
 * نظام تسجيل الدخول لـ Potree Manager
 * يدعم التحقق من بيانات الاعتماد الافتراضية مع واجهة مستخدم متطورة
 */

// بيانات تسجيل الدخول الافتراضية
const DEFAULT_CREDENTIALS = {
    username: 'admin',
    password: 'a123'
};

// عناصر DOM
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('togglePassword');
const rememberMeCheckbox = document.getElementById('rememberMe');
const loginButton = document.getElementById('loginButton');
const alertMessage = document.getElementById('alertMessage');

// عناصر زر تسجيل الدخول
const buttonText = loginButton.querySelector('.button-text');
const buttonLoader = loginButton.querySelector('.button-loader');

// متغيرات الحالة
let isLoading = false;

/**
 * تهيئة النظام عند تحميل الصفحة
 */
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    loadSavedCredentials();
    addInputAnimations();
    createParticleEffect();
});

/**
 * تهيئة مستمعي الأحداث
 */
function initializeEventListeners() {
    // معالج نموذج تسجيل الدخول
    loginForm.addEventListener('submit', handleLogin);
    
    // زر إظهار/إخفاء كلمة المرور
    togglePasswordBtn.addEventListener('click', togglePasswordVisibility);
    
    // إضافة تأثيرات التفاعل للحقول
    [usernameInput, passwordInput].forEach(input => {
        input.addEventListener('focus', handleInputFocus);
        input.addEventListener('blur', handleInputBlur);
        input.addEventListener('input', handleInputChange);
    });
    
    // معالج اختصارات لوحة المفاتيح
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // تأثير الهز للبطاقة عند النقر في المساحة الفارغة
    document.addEventListener('click', handleOutsideClick);
}

/**
 * معالج تسجيل الدخول الرئيسي
 */
async function handleLogin(event) {
    event.preventDefault();
    
    if (isLoading) return;
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    // التحقق من صحة البيانات
    if (!validateInputs(username, password)) {
        return;
    }
    
    // بدء عملية تسجيل الدخول
    setLoadingState(true);
    hideAlert();
    
    try {
        // محاكاة تأخير الشبكة
        await simulateNetworkDelay();
        
        // التحقق من بيانات الاعتماد
        if (authenticateUser(username, password)) {
            // حفظ بيانات التذكر إذا تم اختيارها
            if (rememberMeCheckbox.checked) {
                saveCredentials(username);
            }
            
            // التوجه مباشرة إلى مدير الملفات
            window.location.href = '../file_manager/file_manager.html';
        } else {
            // عرض رسالة الخطأ
            showAlert('اسم المستخدم أو كلمة المرور غير صحيحة', 'error');
            shakeCard();
        }
    } catch (error) {
        console.error('خطأ في تسجيل الدخول:', error);
        showAlert('حدث خطأ في الاتصال، يرجى المحاولة مرة أخرى', 'error');
    } finally {
        setLoadingState(false);
    }
}

/**
 * التحقق من صحة المدخلات
 */
function validateInputs(username, password) {
    if (!username) {
        showAlert('يرجى إدخال اسم المستخدم', 'warning');
        usernameInput.focus();
        return false;
    }
    
    if (!password) {
        showAlert('يرجى إدخال كلمة المرور', 'warning');
        passwordInput.focus();
        return false;
    }
    
    if (username.length < 2) {
        showAlert('اسم المستخدم يجب أن يكون أكثر من حرفين', 'warning');
        usernameInput.focus();
        return false;
    }
    
    return true;
}

/**
 * التحقق من بيانات المستخدم
 */
function authenticateUser(username, password) {
    return username.toLowerCase() === DEFAULT_CREDENTIALS.username.toLowerCase() && 
           password === DEFAULT_CREDENTIALS.password;
}

/**
 * تعيين حالة التحميل
 */
function setLoadingState(loading) {
    isLoading = loading;
    loginButton.disabled = loading;
    
    if (loading) {
        buttonText.style.opacity = '0';
        buttonLoader.style.display = 'block';
        loginButton.style.cursor = 'not-allowed';
    } else {
        buttonText.style.opacity = '1';
        buttonLoader.style.display = 'none';
        loginButton.style.cursor = 'pointer';
    }
}

/**
 * عرض رسالة التنبيه
 */
function showAlert(message, type = 'error') {
    const alertMessage = document.getElementById('alertMessage');
    const alertText = alertMessage.querySelector('.alert-text');
    const alertIcon = alertMessage.querySelector('.alert-icon');
    
    alertText.textContent = message;
    
    // تغيير الأيقونة حسب النوع
    switch(type) {
        case 'error':
            alertIcon.textContent = '⚠️';
            alertMessage.style.background = 'rgba(244, 67, 54, 0.1)';
            alertMessage.style.color = '#F44336';
            alertMessage.style.borderColor = 'rgba(244, 67, 54, 0.2)';
            break;
        case 'warning':
            alertIcon.textContent = '⚠️';
            alertMessage.style.background = 'rgba(255, 152, 0, 0.1)';
            alertMessage.style.color = '#FF9800';
            alertMessage.style.borderColor = 'rgba(255, 152, 0, 0.2)';
            break;
        case 'success':
            alertIcon.textContent = '✅';
            alertMessage.style.background = 'rgba(76, 175, 80, 0.1)';
            alertMessage.style.color = '#4CAF50';
            alertMessage.style.borderColor = 'rgba(76, 175, 80, 0.2)';
            break;
    }
    
    alertMessage.style.display = 'flex';
    alertMessage.style.animation = 'none';
    setTimeout(() => {
        alertMessage.style.animation = 'shake 0.5s ease-in-out';
    }, 10);
}

/**
 * إخفاء رسالة التنبيه
 */
function hideAlert() {
    alertMessage.style.display = 'none';
}

/**
 * تبديل رؤية كلمة المرور
 */
function togglePasswordVisibility() {
    const eyeIcon = togglePasswordBtn.querySelector('.eye-icon');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.textContent = '🙈';
        togglePasswordBtn.title = 'إخفاء كلمة المرور';
    } else {
        passwordInput.type = 'password';
        eyeIcon.textContent = '👁️';
        togglePasswordBtn.title = 'إظهار كلمة المرور';
    }
    
    // تأثير بصري لطيف
    togglePasswordBtn.style.transform = 'scale(0.9)';
    setTimeout(() => {
        togglePasswordBtn.style.transform = 'scale(1)';
    }, 150);
}

/**
 * معالج تركيز الحقل
 */
function handleInputFocus(event) {
    const wrapper = event.target.closest('.input-wrapper');
    wrapper.style.transform = 'translateY(-2px)';
    wrapper.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
}

/**
 * معالج فقدان تركيز الحقل
 */
function handleInputBlur(event) {
    const wrapper = event.target.closest('.input-wrapper');
    wrapper.style.transform = 'translateY(0)';
    wrapper.style.boxShadow = 'none';
}

/**
 * معالج تغيير المحتوى
 */
function handleInputChange(event) {
    const input = event.target;
    const icon = input.parentElement.querySelector('.input-icon');
    
    if (input.value.length > 0) {
        icon.style.color = '#1E88E5';
        icon.style.transform = 'scale(1.1)';
    } else {
        icon.style.color = '#757575';
        icon.style.transform = 'scale(1)';
    }
}

/**
 * معالج اختصارات لوحة المفاتيح
 */
function handleKeyboardShortcuts(event) {
    // Enter للتسجيل
    if (event.key === 'Enter' && !isLoading) {
        event.preventDefault();
        loginForm.dispatchEvent(new Event('submit'));
    }
    
    // Escape لإخفاء التنبيهات
    if (event.key === 'Escape') {
        hideAlert();
    }
}

/**
 * معالج النقر خارج البطاقة
 */
function handleOutsideClick(event) {
    const loginCard = document.querySelector('.login-card');
    if (!loginCard.contains(event.target) && !isLoading) {
        // تأثير نبضة لطيف
        loginCard.style.animation = 'pulse 0.3s ease-in-out';
        setTimeout(() => {
            loginCard.style.animation = '';
        }, 300);
    }
}

/**
 * هز البطاقة عند الخطأ
 */
function shakeCard() {
    const loginCard = document.querySelector('.login-card');
    loginCard.style.animation = 'shake 0.5s ease-in-out';
    setTimeout(() => {
        loginCard.style.animation = '';
    }, 500);
}

/**
 * محاكاة تأخير الشبكة
 */
function simulateNetworkDelay() {
    return new Promise(resolve => {
        const delay = Math.random() * 1000 + 500; // 500-1500ms
        setTimeout(resolve, delay);
    });
}

/**
 * حفظ بيانات الاعتماد
 */
function saveCredentials(username) {
    try {
        localStorage.setItem('potree_remember_username', username);
        localStorage.setItem('potree_remember_timestamp', Date.now().toString());
    } catch (error) {
        console.warn('لا يمكن حفظ بيانات التذكر:', error);
    }
}

/**
 * تحميل بيانات الاعتماد المحفوظة
 */
function loadSavedCredentials() {
    try {
        const savedUsername = localStorage.getItem('potree_remember_username');
        const timestamp = localStorage.getItem('potree_remember_timestamp');
        
        // التحقق من انتهاء صلاحية التذكر (30 يوم)
        if (savedUsername && timestamp) {
            const daysSinceRemember = (Date.now() - parseInt(timestamp)) / (1000 * 60 * 60 * 24);
            
            if (daysSinceRemember < 30) {
                usernameInput.value = savedUsername;
                rememberMeCheckbox.checked = true;
                
                // تركيز على حقل كلمة المرور
                passwordInput.focus();
            } else {
                // إزالة البيانات المنتهية الصلاحية
                localStorage.removeItem('potree_remember_username');
                localStorage.removeItem('potree_remember_timestamp');
            }
        }
    } catch (error) {
        console.warn('لا يمكن تحميل بيانات التذكر:', error);
    }
}

/**
 * إضافة تحريكات الإدخال
 */
function addInputAnimations() {
    const inputs = [usernameInput, passwordInput];
    
    inputs.forEach((input, index) => {
        // تأخير التحريك للحقول
        input.style.opacity = '0';
        input.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            input.style.transition = 'all 0.6s ease-out';
            input.style.opacity = '1';
            input.style.transform = 'translateY(0)';
        }, 200 + (index * 100));
    });
}

/**
 * إنشاء تأثير الجسيمات
 */
function createParticleEffect() {
    const particleContainer = document.createElement('div');
    particleContainer.className = 'particle-container';
    particleContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 0;
    `;
    
    document.body.appendChild(particleContainer);
    
    // إنشاء جسيمات متحركة
    for (let i = 0; i < 20; i++) {
        createParticle(particleContainer);
    }
}

/**
 * إنشاء جسيم واحد
 */
function createParticle(container) {
    const particle = document.createElement('div');
    particle.style.cssText = `
        position: absolute;
        width: 4px;
        height: 4px;
        background: rgba(255, 255, 255, 0.6);
        border-radius: 50%;
        animation: floatParticle ${15 + Math.random() * 10}s linear infinite;
    `;
    
    // موضع عشوائي
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDelay = Math.random() * 15 + 's';
    
    container.appendChild(particle);
    
    // إزالة وإعادة إنشاء الجسيم
    setTimeout(() => {
        if (particle.parentElement) {
            particle.remove();
            createParticle(container);
        }
    }, (15 + Math.random() * 10) * 1000);
}

// إضافة CSS للجسيمات
const particleStyle = document.createElement('style');
particleStyle.textContent = `
    @keyframes floatParticle {
        0% {
            transform: translateY(100vh) translateX(0px) rotate(0deg);
            opacity: 0;
        }
        10% {
            opacity: 1;
        }
        90% {
            opacity: 1;
        }
        100% {
            transform: translateY(-10px) translateX(${Math.random() * 200 - 100}px) rotate(360deg);
            opacity: 0;
        }
    }
    
    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.02); }
    }
`;
document.head.appendChild(particleStyle);

/**
 * معالج الأخطاء العامة
 */
window.addEventListener('error', function(event) {
    console.error('خطأ في التطبيق:', event.error);
    showAlert('حدث خطأ غير متوقع، يرجى إعادة تحميل الصفحة', 'error');
});

/**
 * معالج التحميل والحفظ التلقائي للحالة
 */
window.addEventListener('beforeunload', function() {
    // حفظ الحالة الحالية إذا لزم الأمر
    if (rememberMeCheckbox.checked && usernameInput.value.trim()) {
        saveCredentials(usernameInput.value.trim());
    }
});

// تهيئة النظام
console.log('🚀 نظام تسجيل الدخول Potree Manager جاهز');
console.log('📋 بيانات التجربة: admin / a123');