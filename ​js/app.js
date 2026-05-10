/**
 * Adzentra Ads - Professional Application Logic (SPA Version)
 * Handling: Auth, Section Navigation, Referral tracking, Fraud alerts & UI Sync
 */

let currentUser = null;
let statsUpdateInterval = null;

// ১. অ্যাপ শুরু করার মেইন ফাংশন
async function initApp() {
    console.log("Adzentra Ads: System Initializing...");
    
    const tg = window.Telegram.WebApp;
    
    // টেলিগ্রাম ওয়েব অ্যাপ ডিটেক্ট করা
    const isTelegram = tg.initData !== "";
    
    // নোট: আপনার অনুরোধ অনুযায়ী Access Denied স্ক্রিন বাদ দেওয়া হয়েছে। 
    // তাই টেলিগ্রামের বাইরে থেকে ওপেন হলেও ড্যাশবোর্ড দেখানোর চেষ্টা করবে।
    
    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation();

    try {
        // লোডিং স্ক্রিন দেখানো
        showSection('loading');

        // ইউজারের ডাটা সিঙ্ক (api.js থেকে syncTelegramUser কল হবে)
        currentUser = await syncTelegramUser();

        if (currentUser) {
            console.log("Verified User:", currentUser.full_name);
            
            // ডাটা লোড হয়ে গেলে সরাসরি ড্যাশবোর্ড বা ওয়েলকাম স্ক্রিন দেখানো
            // আপনি চাইলে সরাসরি 'dashboard' দিতে পারেন
            showSection('welcome'); 
            
            updateGlobalUI();
            startBackgroundSync(); // রিয়েল-টাইম ব্যালেন্স আপডেট শুরু
            
        } else {
            // ইউজার না পাওয়া গেলে সরাসরি ড্যাশবোর্ড ওপেন করে রাখা যাতে ব্ল্যাঙ্ক না থাকে
            showSection('dashboard');
        }
    } catch (error) {
        console.error("Initialization Failed:", error.message);
        showSection('dashboard');
    }
}

// ২. SPA সেকশন নেভিগেশন (index.html এর IDs এর সাথে মিল রেখে)
function showSection(sectionId) {
    const screens = ['loading-screen', 'welcome-screen', 'dashboard-section'];
    
    // সব স্ক্রিন হাইড করা
    screens.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.style.display = 'none';
    });

    // টার্গেট স্ক্রিন শো করা
    const target = document.getElementById(sectionId + (sectionId === 'dashboard' ? '-section' : '-screen'));
    if (target) {
        target.style.display = 'block';
        if (sectionId === 'dashboard') {
            target.style.display = 'block'; // Dashboard handles its own padding
            const nav = document.getElementById('bottom-nav');
            const miniProfile = document.getElementById('user-mini-profile');
            if (nav) nav.style.display = 'flex';
            if (miniProfile) miniProfile.style.display = 'block';
        }
    }
}

// ৩. গ্লোবাল ইউজার ইন্টারফেস আপডেট
function updateGlobalUI() {
    if (!currentUser) return;

    // ইউজার নেম আপডেট
    document.querySelectorAll('#user-name').forEach(el => el.innerText = currentUser.full_name);

    // ব্যালেন্স আপডেট (৪ দশমিক পর্যন্ত)
    const formattedBalance = `$${parseFloat(currentUser.balance || 0).toFixed(4)}`;
    document.querySelectorAll('#balance-val, #top-balance').forEach(el => {
        el.innerText = formattedBalance;
    });

    // প্রোফাইল পিকচার আপডেট
    document.querySelectorAll('#user-photo').forEach(el => {
        if (currentUser.profile_pic_url) {
            el.src = currentUser.profile_pic_url;
        }
    });

    // রেফারেল লিংক জেনারেট
    const refLinkInput = document.getElementById('ref-link');
    if (refLinkInput) {
        const botUsername = "AdzentraAdsBot"; 
        refLinkInput.value = `https://t.me/${botUsername}?start=${currentUser.referral_code}`;
    }
    
    // লাইফটাইম আর্নিং বা অন্যান্য স্ট্যাটাস আপডেট (যদি HTML এ থাকে)
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

// ৬. স্মার্ট লিংক জেনারেশন ফাংশন (index.html এর বাটন থেকে কল হবে)
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
    copyText.setSelectionRange(0, 99999); // For mobile devices

    navigator.clipboard.writeText(copyText.value).then(() => {
        window.Telegram.WebApp.showAlert("Copied to Clipboard! ✅");
    }).catch(err => {
        // Fallback
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
