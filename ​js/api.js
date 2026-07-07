// =============================================================
// Adzentra Ads - Firebase Database & Telegram Auth Connection
// =============================================================

// আপনার দেওয়া অরিজিনাল ফায়ারবেস কনফিগারেশন
const firebaseConfig = {
    apiKey: "AIzaSyA8NSBcyIhebm0oZ1Zu7fxoFhA3eC9JT64",
    authDomain: "adzentra-ads.firebaseapp.com",
    projectId: "adzentra-ads",
    storageBucket: "adzentra-ads.firebasestorage.app",
    messagingSenderId: "506267675315",
    appId: "1:506267675315:web:ffc2c63539a095cd411ec6",
    measurementId: "G-X52F25502C"
};

// ফায়ারবেস অ্যাপ অলরেডি ইনিশিয়ালাইজড না থাকলে নতুন করে করা
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// ফায়ারস্টোর ডাটাবেজ ক্লায়েন্ট ইনস্ট্যান্স তৈরি
const db = firebase.firestore();

// আপনার ভার্সেল প্রোডাকশন ডোমেইন (এখানে আপনার আসল ভার্সেল লিংক বসাবেন)
const BACKEND_URL = "https://your-vercel-domain.com";

/**
 * Telegram User Sync Function (Firebase Version)
 * টেলিগ্রাম থেকে ডাটা নিয়ে Firestore ডাটাবেজে ইউজার প্রোফাইল অটো-ক্রিয়েট বা সিঙ্ক করবে।
 */
async function syncTelegramUser() {
    // টেলিগ্রাম ওয়েব অ্যাপ অবজেক্ট চেক
    const tg = window.Telegram.WebApp;
    tg.ready(); // টেলিগ্রামকে জানানো যে অ্যাপ প্রস্তুত

    const userData = tg.initDataUnsafe?.user;

    if (!userData) {
        console.error("টেলিগ্রাম ইউজার ডাটা পাওয়া যায়নি! এটি টেলিগ্রাম অ্যাপের ভেতর ওপেন করুন।");
        return null;
    }

    // টেলিগ্রাম থেকে তথ্য সংগ্রহ
    const { id, first_name, last_name, username, photo_url } = userData;
    const fullName = `${first_name} ${last_name || ''}`.trim();
    const referralCode = `AZ${id}`; // ইউনিক রেফারেল কোড তৈরি

    // ফায়ারস্টোরে 'publishers' কালেকশনের নির্দিষ্ট ডকুমেন্ট রেফারেন্স (ID অনুযায়ী)
    const userRef = db.collection('publishers').doc(String(id));

    try {
        const doc = await userRef.get();
        let clientProfile;

        if (!doc.exists) {
            // যদি ডাটাবেজে আগে থেকে একাউন্ট না থাকে, তবে নতুন তৈরি হবে
            clientProfile = {
                id: String(id),
                username: username || `user_${id}`,
                full_name: fullName,
                profile_pic_url: photo_url || 'https://via.placeholder.com/100',
                referral_code: referralCode,
                balance: 0.0000,
                total_earned: 0.0000,
                impressions: 0,
                clicks: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            // ডাটাবেজে ডাটা রাইট করা
            await userRef.set(clientProfile);
            console.log("নতুন পাবলিশার একাউন্ট সফলভাবে তৈরি হয়েছে! ID:", id);
        } else {
            // একাউন্ট থাকলে ডাটা রিড করা হবে
            clientProfile = doc.data();
            console.log("পুরাতন পাবলিশার লগইন সফল হয়েছে! ID:", id);
        }

        return clientProfile;

    } catch (error) {
        console.error("ফায়ারবেস ডাটাবেজ সিঙ্ক এরর:", error.message);
        return null;
    }
}

// কানেকশন চেক কনসোল লগ
console.log("Adzentra Ads Engine Active & Firebase Database Connected!");
