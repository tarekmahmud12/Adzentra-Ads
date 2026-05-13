/**
 * Adzentra Ads - Main Application Hub
 * Responsibility: Auth, Section Navigation, & Global UI Sync
 */

let currentUser = null;
let statsUpdateInterval = null;

// ১. অ্যাপ শুরু করার মেইন ফাংশন
async function initApp() {
    console.log("Adzentra Ads: System Initializing...");
    
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation();

    // লোডিং স্ক্রিন দেখানো
    showSection('loading');

    setTimeout(async () => {
        try {
            const tgUser = tg.initDataUnsafe?.user;
            
            if (tgUser) {
                console.log("Telegram User Detected:", tgUser.first_name);
                
                // এটি api.js থেকে ডাটা সিঙ্ক করবে
                currentUser = await syncTelegramUser();

                if (currentUser) {
                    console.log("Verified User:", currentUser.full_name);
                    showSection('welcome'); 
                    updateGlobalUI();
                    startBackgroundSync(); 
                } else {
                    showSection('dashboard');
                }
            } else {
                console.warn("No Telegram Data! Running in preview mode.");
                showSection('dashboard');
            }
        } catch (error) {
            console.error("Initialization Failed:", error.message);
            showSection('dashboard');
        }
    }, 500);
}

// ২. SPA সেকশন নেভিগেশন (Updated to handle Sidebar & Bottom Nav)
function showSection(sectionId) {
    // সকল মেইন সেকশন হাইড করা
    const sections = document.querySelectorAll('.content-section, #loading-screen, #welcome-screen');
    sections.forEach(sec => sec.style.display = 'none');

    // টার্গেট সেকশন দেখানো
    const target = document.getElementById(sectionId + (sectionId === 'dashboard' ? '-section' : '-screen')) 
                || document.getElementById(sectionId + '-section');
    
    if (target) {
        target.style.display = 'block';
        
        // ড্যাশবোর্ড বা অন্যান্য ইন্টারনাল পেজে নেভিগেশন এলিমেন্ট দেখানো
        if (['dashboard', 'analytics', 'withdraw', 'profile', 'direct-link', 'websites'].includes(sectionId)) {
            const nav = document.getElementById('bottom-nav');
            const header = document.querySelector('header');
            if (nav) nav.style.display = 'flex';
            if (header) header.style.display = 'flex';
        }
    }

    // Sidebar বন্ধ করা (যদি খোলা থাকে)
    if (typeof toggleSidebar === "function") {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('active')) {
            toggleSidebar();
        }
    }
}

// ৩. গ্লোবাল ইউজার ইন্টারফেস আপডেট
function updateGlobalUI() {
    if (!currentUser) return;

    // ইউজার নেম ও আইডি আপডেট
    document.querySelectorAll('#user-name, #p-name').forEach(el => el.innerText = currentUser.full_name);
    document.querySelectorAll('#p-id').forEach(el => el.innerText = currentUser.id);

    // ব্যালেন্স আপডেট
    const formattedBalance = `$${parseFloat(currentUser.balance || 0).toFixed(2)}`;
    document.querySelectorAll('#balance-val, #top-balance, #p-balance').forEach(el => {
        el.innerText = formattedBalance;
    });

    // প্রোফাইল পিকচার আপডেট
    const photoUrl = currentUser.profile_pic_url || window.Telegram.WebApp.initDataUnsafe?.user?.photo_url;
    document.querySelectorAll('#user-photo, #user-avatar, #profile-pic-large').forEach(el => {
        if (photoUrl) el.src = photoUrl;
    });

    // লাইফটাইম আর্নিং
    const lifetimeEl = document.getElementById('lifetime-val');
    if(lifetimeEl) lifetimeEl.innerText = `$${parseFloat(currentUser.total_earned || 0).toFixed(2)}`;
}

// ৪. ব্যাকগ্রাউন্ড সিঙ্ক (প্রতি ৩০ সেকেন্ডে ডাটা রিফ্রেশ)
function startBackgroundSync() {
    if (statsUpdateInterval) clearInterval(statsUpdateInterval);
    statsUpdateInterval = setInterval(async () => {
        await refreshUserData();
    }, 30000); 
}

// ৫. ইউজার ডাটা রিফ্রেশ (Profiles টেবিল থেকে)
async function refreshUserData() {
    if (!currentUser) return;
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (!error && data) {
            currentUser = data;
            updateGlobalUI();
        }
    } catch (e) {
        console.log("Sync failed silently...");
    }
}

// ৬. ক্লিপবোর্ড কপি ফাংশন
function copyToClipboard(elementId) {
    const copyText = document.getElementById(elementId);
    if (!copyText) return;

    copyText.select();
    navigator.clipboard.writeText(copyText.value).then(() => {
        window.Telegram.WebApp.showScanQrPopup ? null : window.Telegram.WebApp.showAlert("Copied! ✅");
    });
}

// পেজ লোড হলে অ্যাপ রান করা
window.addEventListener('DOMContentLoaded', initApp);
