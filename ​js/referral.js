/**
 * Adzentra Ads - Professional Referral Engine
 * Updated for: Firebase Firestore Architecture & Telegram Bot Referral Tracking
 */

// ১. রেফারেল লিংক কপি করার অপ্টিমাইজড ফাংশন
function copyReferralLink() {
    if (!currentUser) return window.Telegram.WebApp.showAlert("User not loaded!");

    // টেলিগ্রাম বটের মাধ্যমে রেফারেল ট্র্যাক করার জন্য অফিসিয়াল লিংক ফরম্যাট
    const botUsername = "AdzentraAdsBot"; // আপনার আসল বটের ইউজারনেম এখানে দিবেন
    const refLink = `https://t.me/${botUsername}?start=ref_${currentUser.id}`;

    // মোবাইলের জন্য সুরক্ষিত কপি মেকানিজম
    const tempInput = document.createElement('input');
    tempInput.value = refLink;
    document.body.appendChild(tempInput);
    tempInput.select();
    tempInput.setSelectionRange(0, 99999);

    navigator.clipboard.writeText(refLink).then(() => {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        window.Telegram.WebApp.showAlert("Referral link copied! 🚀 Share it with your friends.");
    }).catch(() => {
        window.Telegram.WebApp.showAlert("Copy failed. Please try manually.");
    });

    document.body.removeChild(tempInput);
}

// ২. ডাটাবেজ থেকে রিয়েল-টাইম রেফারেল ডাটা এবং ৫% কমিশন লোড করা
async function loadReferralStats() {
    if (!currentUser) return;

    try {
        // ফায়ারস্টোর থেকে আপনার আইডি ব্যবহার করে রেফার করা ইউজারদের কাউন্ট করা
        const snapshot = await db.collection('publishers')
            .where('referred_by', '==', String(currentUser.id))
            .get();

        // মোট কতজন রেফারেল জয়েন করেছে তার সংখ্যা
        const totalReferralsCount = snapshot.size;

        // UI-তে মোট রেফারেল সংখ্যা আপডেট করা
        const totalRefEl = document.getElementById('total-referrals');
        if (totalRefEl) totalRefEl.innerText = totalReferralsCount;

        // ইউজারের ডকুমেন্ট থেকে অরিজিনাল রেফারেল ইনকাম (কমিশন) রিড করা
        // নোট: যখন কোনো রেফারেড ইউজার অ্যাড দেখবে, ব্যাকএন্ড এপিআই তার আয়ের ৫% এই 'referral_earnings' ফিল্ডে যোগ করে দেবে
        const commission = parseFloat(currentUser.referral_earnings || 0);
        
        const refIncomeEl = document.getElementById('ref-income');
        if (refIncomeEl) refIncomeEl.innerText = `$${commission.toFixed(4)}`;

    } catch (err) {
        console.error("Referral Sync Error:", err.message);
    }
}

// ৩. পেজ বা সেকশন লোড হলে ডাটা রেন্ডার করার লজিক
document.addEventListener('DOMContentLoaded', () => {
    // ২ সেকেন্ড পর রান হবে যেন মেইন ইউজার সেশনটি অলরেডি রেডি থাকে
    setTimeout(() => {
        loadReferralStats();
    }, 2000);
});
