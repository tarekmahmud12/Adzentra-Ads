/**
 * Adzentra Ads - Professional Application Logic (SPA Version)
 * Handling: Auth, Section Navigation, Referral tracking, Fraud alerts & UI Sync
 */

let currentUser = null;
let statsUpdateInterval = null;

// ১. অ্যাপ শুরু করার মেইন ফাংশন (Updated for Auto-Sync)
async function initApp() {
    console.log("Adzentra Ads: System Initializing...");
    
    const tg = window.Telegram.WebApp;
    
    // টেলিগ্রাম এনভায়রনমেন্ট রেডি করা
    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation();

    // লোডিং স্ক্রিন দেখানো
    showSection('loading');

    // টেলিগ্রাম থেকে ডাটা নিতে অনেক সময় কয়েক মিলিসেকেন্ড দেরি হয়, তাই সামান্য ডিলে দেওয়া হয়েছে
    setTimeout(async () => {
        try {
            // টেলিগ্রাম ইউজার ডাটা চেক করা
            const tgUser = tg.initDataUnsafe?.user;
            
            if (tgUser) {
                console.log("Telegram User Detected:", tgUser.first_name);
                
                // ইউজারের ডাটা সিঙ্ক (api.js থেকে syncTelegramUser কল হবে)
                // এটি অটোমেটিক ইউজারের TG ID দিয়ে আপনার ডাটাবেজে চেক/রেজিস্ট্রেশন করবে
                currentUser = await syncTelegramUser();

                if (currentUser) {
                    console.log("Verified User:", currentUser.full_name);
                    
                    // ভেরিফাইড হলে সরাসরি ওয়েলকাম বা ড্যাশবোর্ড
                    showSection('welcome'); 
                    updateGlobalUI();
                    startBackgroundSync(); 
                } else {
                    // যদি ডাটাবেজে ইউজার না থাকে তবে সরাসরি ড্যাশবোর্ড দেখাবে (ব্ল্যাঙ্ক যেন না থাকে)
                    showSection('dashboard');
                }
            } else {
                // টেলিগ্রামের বাইরে থেকে ওপেন করলে সরাসরি ড্যাশবোর্ড বা ব্যাকআপ লজিক
                console.warn("No Telegram Data! Running in preview mode.");
                showSection('dashboard');
            }
        } catch (error) {
            console.error("Initialization Failed:", error.message);
            showSection('dashboard');
        }
    }, 500); // 0.5 সেকেন্ড ওয়েট করা যাতে TG SDK ডাটা রেডি করতে পারে
}

// ২. SPA সেকশন নেভিগেশন (সম্পূর্ণ আগের ফাংশন ঠিক রাখা হয়েছে)
function showSection(sectionId) {
    const screens = ['loading-screen', 'welcome-screen', 'dashboard-section'];
    
    screens.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.style.display = 'none';
    });

    const target = document.getElementById(sectionId + (sectionId === 'dashboard' ? '-section' : '-screen'));
    if (target) {
        target.style.display = 'block';
        if (sectionId === 'dashboard') {
            const nav = document.getElementById('bottom-nav');
            const miniProfile = document.getElementById('user-mini-profile');
            if (nav) nav.style.display = 'flex';
            if (miniProfile) miniProfile.style.display = 'block';
        }
    }
}

// ৩. গ্লোবাল ইউজার ইন্টারফেস আপডেট (অটোমেটিক ডাটা রেন্ডারিং)
function updateGlobalUI() {
    if (!currentUser) return;

    // ইউজার নেম আপডেট
    document.querySelectorAll('#user-name').forEach(el => el.innerText = currentUser.full_name);

    // ব্যালেন্স আপডেট
    const formattedBalance = `$${parseFloat(currentUser.balance || 0).toFixed(4)}`;
    document.querySelectorAll('#balance-val, #top-balance').forEach(el => {
        el.innerText = formattedBalance;
    });

    // প্রোফাইল পিকচার (টেলিগ্রাম থেকে বা ডাটাবেজ থেকে)
    document.querySelectorAll('#user-photo').forEach(el => {
        if (currentUser.profile_pic_url) {
            el.src = currentUser.profile_pic_url;
        } else if (window.Telegram.WebApp.initDataUnsafe?.user?.photo_url) {
            // যদি ডাটাবেজে না থাকে তবে সরাসরি টেলিগ্রামের URL ব্যবহার করা
            el.src = window.Telegram.WebApp.initDataUnsafe.user.photo_url;
        }
    });

    // রেফারেল লিংক জেনারেট
    const refLinkInput = document.getElementById('ref-link');
    if (refLinkInput) {
        const botUsername = "AdzentraAdsBot"; 
        refLinkInput.value = `https://t.me/${botUsername}?start=${currentUser.referral_code || currentUser.id}`;
    }
    
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

// ৫. ইউজার ডাটা রিফ্রেশ ফাংশন
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
            console.log("Stats Auto-Synced ✅");
        }
    } catch (e) {
        console.log("Sync failed silently...");
    }
}

// ৬. স্মার্ট লিংক জেনারেশন ফাংশন (আগের মতোই রাখা হয়েছে)
async function handleLinkCreation() {
    const urlInput = document.getElementById('target-url');
    const resultArea = document.getElementById('result-area');
    const finalLinkInput = document.getElementById('final-link');
    
    const url = urlInput.value;
    if (!url) return window.Telegram.WebApp.showAlert("Please enter a valid URL!");

    const shortCode = Math.random().toString(36).substring(7);
    
    try {
        const { error } = await supabase.from('smart_links').insert([{
            publisher_id: currentUser.id,
            original_url: url,
            short_code: shortCode
        }]);

        if (!error) {
            resultArea.style.display = 'block';
            finalLinkInput.value = `https://adzentra.click/${shortCode}`;
            window.Telegram.WebApp.showAlert("Smart Link Generated! 🚀");
            urlInput.value = ""; // ফিল্ড খালি করা
        } else {
            throw error;
        }
    } catch (err) {
        window.Telegram.WebApp.showAlert("Error: " + err.message);
    }
}

// ৭. ক্লিপবোর্ডে কপি করার ফাংশন
function copyToClipboard(elementId) {
    const copyText = document.getElementById(elementId);
    if (!copyText) return;

    copyText.select();
    copyText.setSelectionRange(0, 99999);

    navigator.clipboard.writeText(copyText.value).then(() => {
        window.Telegram.WebApp.showAlert("Copied to Clipboard! ✅");
    }).catch(err => {
        alert("Copied!");
    });
}

// ৮. সিকিউরিটি এবং ফ্রড ডিটেকশন
async function triggerSecurityAlert(reason) {
    console.warn("🚨 Security Alert:", reason);
    if (reason === "VPN_DETECTED") {
        window.Telegram.WebApp.showAlert("VPN is not allowed! Please turn off VPN.");
    }
}

// পেজ লোড হলে অ্যাপ ইনিশিয়ালাইজ করা
window.addEventListener('DOMContentLoaded', initApp);
