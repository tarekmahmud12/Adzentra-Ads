/**
 * Adzentra Ads - Professional Application Logic
 * Updated: Firebase Realtime Firestore Sync, Anti-Interval Engine
 */

let currentUser = null;
let unsubscribeUser = null; // রিয়েল-টাইম লিসেনার বন্ধ/চালু করার জন্য ট্র্যাকিং ভেরিয়েবল

// ১. অ্যাপ শুরু করার মেইন ফাংশন
async function initApp() {
    console.log("Adzentra Ads: System Initializing...");
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    showSection('loading');

    setTimeout(async () => {
        try {
            const tgUser = tg.initDataUnsafe?.user;
            if (tgUser) {
                // js/api.js থেকে ফায়ারবেস ডাটা সিঙ্ক করা
                currentUser = await syncTelegramUser();
                if (currentUser) {
                    showSection('dashboard'); 
                    // রিয়েল-টাইম ডাটা সিঙ্কিং লিসেনার চালু করা
                    startRealtimeSync(currentUser.id);
                } else {
                    showSection('dashboard');
                }
            } else {
                console.warn("No Telegram Data! Running Preview Mode.");
                showSection('dashboard');
            }
        } catch (error) {
            console.error("Initialization Failed:", error.message);
            showSection('dashboard');
        }
    }, 800);
}

// ২. Sidebar Toggle ফাংশন
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('active');
        overlay.style.display = sidebar.classList.contains('active') ? 'block' : 'none';
    }
}

// ৩. SPA সেকশন নেভিগেশন
function showSection(sectionId) {
    const sections = [
        'loading-screen', 'welcome-screen', 'dashboard-section', 
        'analytics-section', 'withdraw-section', 'profile-section',
        'direct-link-section', 'websites-section'
    ];

    sections.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.style.display = 'none';
    });

    let targetId = sectionId.includes('-section') ? sectionId : sectionId + '-section';
    if (sectionId === 'loading' || sectionId === 'welcome') targetId = sectionId + '-screen';

    const target = document.getElementById(targetId);
    if (target) {
        target.style.display = 'block';
        // সেকশন চেঞ্জ হলে স্বয়ংক্রিয়ভাবে সাইডবার বন্ধ হবে
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('active')) toggleSidebar();
    }

    // যদি অ্যানালিটিক্স সেকশন ওপেন হয়, তবে ফায়ারস্টোর থেকে লগ লোড হবে
    if (sectionId === 'analytics' && typeof loadFullAnalytics === 'function') {
        loadFullAnalytics();
    }
}

// ৪. গ্লোবাল ইউজার ইন্টারফেস আপডেট (রিয়েল-টাইম ডাটা স্ক্রিনে পুশ করার লজিক)
function updateGlobalUI() {
    if (!currentUser) return;

    // নাম, ইউজার আইডি এবং ইউজারনেম আপডেট
    const fullName = currentUser.full_name || "Publisher";
    document.querySelectorAll('#user-name, #p-name, #user-name-settings').forEach(el => el.innerText = fullName);
    document.querySelectorAll('#p-id, #tg-id-val').forEach(el => el.innerText = currentUser.id);
    document.querySelectorAll('#p-username').forEach(el => el.innerText = `@${currentUser.username || 'user'}`);

    // ব্যালেন্স আপডেট (৪ দশমিক পর্যন্ত নিখুঁত প্রদর্শন)
    const balance = parseFloat(currentUser.balance || 0).toFixed(4);
    document.querySelectorAll('#balance-val, #top-balance, #p-balance').forEach(el => {
        el.innerText = `$${balance}`;
    });

    // টোটাল আর্নিং ও স্ট্যাটিস্টিক্স কার্ড আপডেট
    if (document.getElementById('lifetime-val')) {
        document.getElementById('lifetime-val').innerText = `$${parseFloat(currentUser.total_earned || 0).toFixed(4)}`;
    }
    if (document.getElementById('dash-imp')) {
        document.getElementById('dash-imp').innerText = currentUser.impressions || 0;
    }
    if (document.getElementById('dash-clicks')) {
        document.getElementById('dash-clicks').innerText = currentUser.clicks || 0;
    }
    
    // প্রোফাইল পিকচার সিঙ্ক
    const photoUrl = currentUser.profile_pic_url || window.Telegram.WebApp.initDataUnsafe?.user?.photo_url;
    document.querySelectorAll('#user-photo, #user-avatar, #profile-pic-large').forEach(el => {
        if (photoUrl) el.src = photoUrl;
    });

    // রেফারেল লিংক জেনারেশন
    const refLinkInput = document.getElementById('ref-link');
    if (refLinkInput) {
        const botUsername = "AdzentraAdsBot"; // আপনার অফিসিয়াল বটের ইউজারনেম
        refLinkInput.value = `https://t.me/${botUsername}?start=ref_${currentUser.id}`;
    }
}

// ৫. ফায়ারবেস রিয়েল-টাইম ডাটা সিঙ্কিং (পুরোনো ইন্টারভাল মেকানিজম রিপ্লেসড)
function startRealtimeSync(userId) {
    if (unsubscribeUser) unsubscribeUser();

    // অন-স্প্ল্যাপশট লিসেনার ডাটাবেজের যেকোনো পরিবর্তন লাইভ ট্র্যাক করবে
    unsubscribeUser = db.collection('publishers').doc(String(userId))
        .onSnapshot((doc) => {
            if (doc.exists) {
                currentUser = doc.data();
                updateGlobalUI();
                console.log("Database Synced in Real-time ⚡");
            }
        }, (error) => {
            console.error("Realtime sync failed:", error.message);
        });
}

// ৬. স্মার্ট লিংক জেনারেশন (ফায়ারস্টোর ভার্সন)
async function handleLinkCreation() {
    const urlInput = document.getElementById('target-url');
    const url = urlInput.value;
    if (!url) return window.Telegram.WebApp.showAlert("URL দিন!");

    // ইউআরএল ভ্যালিডেশন চেক
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return window.Telegram.WebApp.showAlert("সঠিক URL দিন (https://...)");
    }

    const shortCode = Math.random().toString(36).substring(7);
    try {
        await db.collection('smart_links').add({
            publisher_id: currentUser.id,
            original_url: url,
            short_code: shortCode,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        window.Telegram.WebApp.showAlert(`Smart Link Created! 🚀\nURL: ${BACKEND_URL}/go/${shortCode}`);
        urlInput.value = "";
        showSection('direct-link'); // সরাসরি একটিভ লিংক সেকশনে রিডাইরেক্ট করবে
    } catch (err) { 
        window.Telegram.WebApp.showAlert("Error creating link: " + err.message); 
    }
}

// ৭. কপি ফাংশন
function copyToClipboard(elementId) {
    const copyText = document.getElementById(elementId);
    if (!copyText) return;
    
    // মোবাইলের জন্য অপ্টিমাইজড কপি সিঙ্ক
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    
    navigator.clipboard.writeText(copyText.value).then(() => {
        window.Telegram.WebApp.showAlert("Copied to clipboard! ✅");
    }).catch(() => {
        window.Telegram.WebApp.showAlert("Copy failed. Please try manually.");
    });
}

// ৮. ডেমো পুশ অ্যাড টেস্ট রানার (পাবলিশারদের টেস্ট করার জন্য)
function triggerTestAd() {
    if (!currentUser) return window.Telegram.WebApp.showAlert("টেলিগ্রাম প্রিভিউ মোড! বটের ভেতরে ওপেন করুন।");
    if (typeof Adzentra !== 'undefined') {
        Adzentra.initialize({ publisherId: currentUser.id });
        Adzentra.showPushAd(currentUser.id, (res) => {
            window.Telegram.WebApp.showAlert("Result: " + res.message);
        });
    } else {
        window.Telegram.WebApp.showAlert("SDK Not Loaded properly.");
    }
}

// ৯. সিকিউরিটি এলার্ট (অ্যান্টি ফ্রড)
async function triggerSecurityAlert(reason) {
    if (reason === "VPN_DETECTED") {
        window.Telegram.WebApp.showAlert("নিরাপত্তা জনিত কারণে VPN বন্ধ করে অ্যাপটি পুনরায় ওপেন করুন!");
    }
}

window.addEventListener('DOMContentLoaded', initApp);
