/**
 * Adzentra Ads - Professional Application Logic
 * Handling: Auth, Direct Redirect, Referral tracking, Fraud alerts & UI Sync
 */

let currentUser = null;
let statsUpdateInterval = null;

// ১. অ্যাপ শুরু করার মেইন ফাংশন
async function initApp() {
    console.log("Adzentra Ads: System Initializing...");
    
    // টেলিগ্রাম ওয়েব অ্যাপ ডিটেক্ট ও রেডি করা
    const isTelegram = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData !== "";
    
    if (isTelegram) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        tg.enableClosingConfirmation(); // অ্যাপ ভুল করে বন্ধ হওয়া রোধ করতে

        try {
            // ইউজারের ডাটা সিঙ্ক (api.js থেকে syncTelegramUser কল হবে)
            currentUser = await syncTelegramUser();

            if (currentUser) {
                console.log("Verified User:", currentUser.full_name);
                
                // --- অটো রিডাইরেক্ট লজিক ---
                // যদি ইউজার ইনডেক্স পেজে থাকে তবে সরাসরি ড্যাশবোর্ডে নিয়ে যাবে
                const isIndexPath = window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/');
                if (isIndexPath) {
                    window.location.href = 'dashboard.html';
                    return;
                }

                // ড্যাশবোর্ডে থাকলে ডাটা রেন্ডার করা
                updateGlobalUI();
                startBackgroundSync(); // রিয়েল-টাইম ব্যালেন্স আপডেট শুরু
                
            } else {
                handleAccessDenied();
            }
        } catch (error) {
            console.error("Initialization Failed:", error.message);
            handleAccessDenied();
        }
    } else {
        // টেলিগ্রামের বাইরে থেকে ওপেন করলে এরর স্ক্রিন
        handleAccessDenied();
    }
}

// ২. এক্সেস ডিনাইড বা এরর হ্যান্ডেলিং
function handleAccessDenied() {
    const loading = document.getElementById('loading-screen');
    const errorScreen = document.getElementById('error-screen');
    const welcome = document.getElementById('welcome-screen');

    if (loading) loading.style.display = 'none';
    if (welcome) welcome.style.display = 'none';
    if (errorScreen) errorScreen.style.display = 'flex';
    
    console.warn("Security Alert: Unauthorized device or browser.");
}

// ৩. গ্লোবাল ইউজার ইন্টারফেস আপডেট (নাম, ছবি, ব্যালেন্স, রেফার কোড)
function updateGlobalUI() {
    if (!currentUser) return;

    // ইউজার নেম আপডেট
    document.querySelectorAll('#user-name').forEach(el => el.innerText = currentUser.full_name);

    // ব্যালেন্স আপডেট (৪ দশমিক পর্যন্ত একুরেট আর্নিং)
    document.querySelectorAll('#user-balance, #top-balance').forEach(el => {
        el.innerText = `$${parseFloat(currentUser.balance || 0).toFixed(4)}`;
    });

    // প্রোফাইল পিকচার আপডেট
    document.querySelectorAll('#user-photo, #user-pic').forEach(el => {
        if (currentUser.profile_pic_url) {
            el.src = currentUser.profile_pic_url;
            el.style.display = 'block';
        }
    });

    // যদি ড্যাশবোর্ডে রেফারেল সেকশন থাকে তবে কোড বসানো
    const refCodeElement = document.getElementById('referral-link');
    if (refCodeElement) {
        const botUsername = "AdzentraAdsBot"; // আপনার বটের ইউজারনেম এখানে দিন
        refCodeElement.value = `https://t.me/${botUsername}?start=${currentUser.referral_code}`;
    }
}

// ৪. ব্যাকগ্রাউন্ড সিঙ্ক (প্রতি ৩০ সেকেন্ডে ডাটা রিফ্রেশ করবে)
function startBackgroundSync() {
    if (statsUpdateInterval) clearInterval(statsUpdateInterval);
    
    statsUpdateInterval = setInterval(async () => {
        await refreshUserData();
    }, 30000); // 30 Seconds
}

// ৫. ইউজার ডাটা রিফ্রেশ ফাংশন
async function refreshUserData() {
    if (!currentUser) return;
    
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
}

// ৬. ক্লিপবোর্ডে কপি করার স্মার্ট ফাংশন
function copyToClipboard(elementIdOrText) {
    let text = "";
    const element = document.getElementById(elementIdOrText);
    
    if (element) {
        text = element.value || element.innerText;
    } else {
        text = elementIdOrText;
    }

    navigator.clipboard.writeText(text).then(() => {
        if (window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.showAlert("Copied to Clipboard! ✅");
        } else {
            alert("Copied!");
        }
    }).catch(err => console.error('Copy failed', err));
}

// ৭. সিকিউরিটি এবং ফ্রড ডিটেকশন লগিং
async function triggerSecurityAlert(reason, details = {}) {
    console.warn("🚨 Security Alert:", reason);
    
    if (currentUser) {
        // ডাটাবেজে ফ্রড লগ সেভ করা (ঐচ্ছিক - যদি ফ্রড টেবিল থাকে)
        /*
        await supabase.from('fraud_logs').insert([{
            publisher_id: currentUser.id,
            reason: reason,
            details: details,
            ip: "Tracked" 
        }]);
        */
        
        // সিরিয়াস ফ্রড হলে অ্যাপ ক্লোজ করে দেওয়া
        if (reason === "VPN_DETECTED" || reason === "MULTIPLE_ACCOUNT") {
            window.Telegram.WebApp.showAlert("Security Violation Detected! Access Suspended.");
            window.Telegram.WebApp.close();
        }
    }
}

// ৮. পেজ চেঞ্জ করার সময় ক্লিনআপ
window.addEventListener('beforeunload', () => {
    if (statsUpdateInterval) clearInterval(statsUpdateInterval);
});

// পেজ লোড হলে অ্যাপ ইনিশিয়ালাইজ করা
window.addEventListener('DOMContentLoaded', initApp);
