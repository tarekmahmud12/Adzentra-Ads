// Adzentra Ads - Database & Telegram Auth Connection
const SUPABASE_URL = 'https://fskrypkkobralfweymtu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_1UOx33B5q7K5oFNiCkL21Q_2NO2rCFR';

// Supabase ক্লায়েন্ট তৈরি
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Telegram User Sync Function
 * টেলিগ্রাম থেকে ডাটা নিয়ে ডাটাবেজে ইউজার প্রোফাইল অটো-ক্রিয়েট করবে।
 */
async function syncTelegramUser() {
    // টেলিগ্রাম ওয়েব অ্যাপ অবজেক্ট চেক
    const tg = window.Telegram.WebApp;
    tg.ready(); // টেলিগ্রামকে জানানো যে অ্যাপ তৈরি

    const userData = tg.initDataUnsafe?.user;

    if (!userData) {
        console.error("টেলিগ্রাম ইউজার ডাটা পাওয়া যায়নি! এটি টেলিগ্রাম অ্যাপের ভেতর ওপেন করুন।");
        return null;
    }

    // টেলিগ্রাম থেকে তথ্য সংগ্রহ
    const { id, first_name, last_name, username, photo_url } = userData;
    const fullName = `${first_name} ${last_name || ''}`.trim();
    const referralCode = `AZ${id}`; // ইউনিক রেফারেল কোড তৈরি

    // ডাটাবেজে ইউজার চেক করা এবং আপডেট/ক্রিয়েট করা (Upsert)
    // নোট: আপনার 'profiles' টেবিলে full_name এবং profile_pic কলাম থাকতে হবে
    const { data, error } = await supabase
        .from('profiles')
        .upsert({
            id: id, // ইউজারের টেলিগ্রাম আইডি
            username: username || `user_${id}`,
            full_name: fullName,
            profile_pic: photo_url || '',
            referral_code: referralCode
        }, { onConflict: 'id' })
        .select()
        .single();

    if (error) {
        console.error("ডাটাবেজ সিঙ্ক এরর:", error.message);
        return null;
    }

    console.log("ইউজার ডাটা সফলভাবে সিঙ্ক হয়েছে:", data);
    return data;
}

// অ্যাপ লোড হওয়ার সাথে সাথে ডাটাবেজ কানেকশন চেক
console.log("Adzentra Ads Engine Active & Connected!");
