/**
 * Adzentra Ads - Main Application Logic
 * Handling Auth Session, Navigation, and Global Stats
 */

// গ্লোবাল ভেরিয়েবল ইউজারের ডাটা স্টোর করার জন্য
let currentUser = null;

// ১. অ্যাপ শুরু করার ফাংশন
async function initApp() {
    console.log("Adzentra App Initializing...");
    
    // টেলিগ্রাম ওয়েব অ্যাপ সেটআপ
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand(); // ফুল স্ক্রিন মোড
    }

    try {
        // ইউজারের ডাটা সিঙ্ক করা (api.js থেকে syncTelegramUser কল হবে)
        currentUser = await syncTelegramUser();

        if (currentUser) {
            console.log("Login Successful:", currentUser.full_name);
            updateGlobalUI();
            
            // যদি ইনডেক্স পেজে থাকে তবে অটো ড্যাশবোর্ডে পাঠানো (ঐচ্ছিক)
            if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
                // setTimeout(() => { window.location.href = 'dashboard.html'; }, 2000);
            }
        } else {
            console.warn("User session not found.");
        }
    } catch (error) {
        console.error("App Init Error:", error.message);
    }
}

// ২. গ্লোবাল ইউজার ইন্টারফেস আপডেট (নাম, ছবি, ব্যালেন্স)
function updateGlobalUI() {
    if (!currentUser) return;

    // সব পেজে যেখানে ইউজারের নাম দেখানোর আইডি 'user-name' আছে
    const nameElements = document.querySelectorAll('#user-name');
    nameElements.forEach(el => el.innerText = currentUser.full_name);

    // সব পেজে যেখানে ইউজারের ব্যালেন্স দেখানোর আইডি 'user-balance' আছে
    const balanceElements = document.querySelectorAll('#user-balance');
    balanceElements.forEach(el => el.innerText = `$${parseFloat(currentUser.balance).toFixed(4)}`);

    // প্রোফাইল পিকচার আপডেট
    const picElements = document.querySelectorAll('#user-pic');
    picElements.forEach(el => {
        if (currentUser.profile_pic_url) {
            el.src = currentUser.profile_pic_url;
            el.style.display = 'block';
        }
    });
}

// ৩. ইউজার ডাটা রিফ্রেশ করার ফাংশন (ড্যাশবোর্ডের জন্য)
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
    }
}

// ৪. ইউটিলিটি ফাংশন: কপি করা (স্মার্ট লিংকের জন্য)
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        if (window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.showAlert("Link Copied to Clipboard!");
        } else {
            alert("Copied!");
        }
    }).catch(err => {
        console.error('Copy failed', err);
    });
}

// ৫. এরর হ্যান্ডলিং এবং ফ্রড প্রোটেকশন অ্যালার্ট (বেসিক)
function triggerSecurityAlert(reason) {
    console.error("Security Alert:", reason);
    // এখানে আপনি চাইলে ইউজারকে ব্যান করার লজিক বা পেজ থেকে বের করে দেওয়ার কোড রাখতে পারেন
}

// পেজ লোড হলে অ্যাপ রান করা
window.addEventListener('DOMContentLoaded', initApp);
