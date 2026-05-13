/**
 * Adzentra Ads - Professional Application Logic
 * Updated: Sidebar Support, Detailed Profile & Analytics Sync
 */

let currentUser = null;
let statsUpdateInterval = null;

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
                // api.js থেকে ডাটা সিঙ্ক
                currentUser = await syncTelegramUser();
                if (currentUser) {
                    // সরাসরি ড্যাশবোর্ড বা প্রোফাইলে দেখাবে
                    showSection('dashboard'); 
                    updateGlobalUI();
                    startBackgroundSync(); 
                } else {
                    showSection('dashboard');
                }
            } else {
                console.warn("No Telegram Data! Preview Mode.");
                showSection('dashboard');
            }
        } catch (error) {
            console.error("Initialization Failed:", error.message);
            showSection('dashboard');
        }
    }, 800);
}

// ২. Sidebar Toggle ফাংশন (নতুন যুক্ত করা হয়েছে)
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('active');
        overlay.style.display = sidebar.classList.contains('active') ? 'block' : 'none';
    }
}

// ৩. SPA সেকশন নেভিগেশন (সম্পূর্ণ আপডেট করা হয়েছে)
function showSection(sectionId) {
    // সব সম্ভাব্য সেকশন আইডি
    const sections = [
        'loading-screen', 'welcome-screen', 'dashboard-section', 
        'analytics-section', 'withdraw-section', 'profile-section',
        'direct-link-section', 'websites-section'
    ];

    sections.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.style.display = 'none';
    });

    // সঠিক আইডি ফরম্যাট খুঁজে বের করা
    let targetId = sectionId.includes('-section') ? sectionId : sectionId + '-section';
    if (sectionId === 'loading' || sectionId === 'welcome') targetId = sectionId + '-screen';

    const target = document.getElementById(targetId);
    if (target) {
        target.style.display = 'block';
        // সেকশন চেঞ্জ হলে অটোমেটিক সাইডবার বন্ধ হবে
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('active')) toggleSidebar();
    }
}

// ৪. গ্লোবাল ইউজার ইন্টারফেস আপডেট (ইউজারের সব তথ্য ড্যাশবোর্ডে বসাবে)
function updateGlobalUI() {
    if (!currentUser) return;

    // নাম এবং ইউজার আইডি
    const fullName = currentUser.full_name || "Publisher";
    document.querySelectorAll('#user-name, #p-name, #user-name-settings').forEach(el => el.innerText = fullName);
    document.querySelectorAll('#p-id, #tg-id-val').forEach(el => el.innerText = currentUser.id);
    document.querySelectorAll('#p-username').forEach(el => el.innerText = `@${currentUser.username || 'user'}`);

    // ব্যালেন্স আপডেট (৪ দশমিক পর্যন্ত)
    const balance = parseFloat(currentUser.balance || 0).toFixed(4);
    document.querySelectorAll('#balance-val, #top-balance, #p-balance').forEach(el => {
        el.innerText = `$${balance}`;
    });

    // স্ট্যাটিস্টিক্স কার্ড আপডেট
    if(document.getElementById('lifetime-val')) 
        document.getElementById('lifetime-val').innerText = `$${parseFloat(currentUser.total_earned || 0).toFixed(2)}`;
    
    // প্রোফাইল পিকচার সিঙ্ক
    const photoUrl = currentUser.profile_pic_url || window.Telegram.WebApp.initDataUnsafe?.user?.photo_url;
    document.querySelectorAll('#user-photo, #user-avatar, #profile-pic-large').forEach(el => {
        if (photoUrl) el.src = photoUrl;
    });

    // রেফারেল লিংক
    const refLinkInput = document.getElementById('ref-link');
    if (refLinkInput) {
        const botUsername = "AdzentraAdsBot"; // আপনার বটের ইউজারনেম দিন
        refLinkInput.value = `https://t.me/${botUsername}?start=ref_${currentUser.id}`;
    }
}

// ৫. ব্যাকগ্রাউন্ড সিঙ্ক (অটো রিফ্রেশ)
function startBackgroundSync() {
    if (statsUpdateInterval) clearInterval(statsUpdateInterval);
    statsUpdateInterval = setInterval(async () => {
        await refreshUserData();
    }, 30000); 
}

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
            console.log("Data Synced ✅");
        }
    } catch (e) { console.log("Sync failed"); }
}

// ৬. স্মার্ট লিংক জেনারেশন
async function handleLinkCreation() {
    const urlInput = document.getElementById('target-url');
    const url = urlInput.value;
    if (!url) return window.Telegram.WebApp.showAlert("URL দিন!");

    const shortCode = Math.random().toString(36).substring(7);
    try {
        const { error } = await supabase.from('smart_links').insert([{
            publisher_id: currentUser.id,
            original_url: url,
            short_code: shortCode
        }]);

        if (!error) {
            window.Telegram.WebApp.showAlert("Link Created! 🚀\nCode: " + shortCode);
            urlInput.value = "";
            showSection('direct-link'); // লিংক লিস্টে নিয়ে যাবে
        }
    } catch (err) { alert(err.message); }
}

// ৭. কপি ফাংশন
function copyToClipboard(elementId) {
    const copyText = document.getElementById(elementId);
    if (!copyText) return;
    copyText.select();
    navigator.clipboard.writeText(copyText.value).then(() => {
        window.Telegram.WebApp.showAlert("Copied! ✅");
    });
}

// ৮. সিকিউরিটি এলার্ট
async function triggerSecurityAlert(reason) {
    if (reason === "VPN_DETECTED") {
        window.Telegram.WebApp.showAlert("VPN বন্ধ করুন!");
    }
}

window.addEventListener('DOMContentLoaded', initApp);
