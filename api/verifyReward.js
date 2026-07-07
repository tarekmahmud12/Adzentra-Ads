const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
    });
}
const db = admin.firestore();

export default async function handler(req, res) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // sdk.js থেকে পাঠানো বডি ডেটা রিসিভ (sessionToken এবং telegramId)
    const { sessionToken, telegramId } = req.body;

    if (!sessionToken || !telegramId) {
        return res.status(400).json({ success: false, error: 'Missing session or user information' });
    }

    try {
        // ডক আইডি হিসেবে সরাসরি sessionToken দিয়ে রেফারেন্স নেওয়া
        const sessionRef = db.collection('ad_sessions').doc(sessionToken);
        const sessionDoc = await sessionRef.get();

        if (!sessionDoc.exists) {
            return res.status(400).json({ success: false, error: 'Invalid Session' });
        }

        const sessionData = sessionDoc.data();

        // অ্যান্টি-ফ্রড ও সিকিউরিটি ভেরিফিকেশন চেক
        if (sessionData.status !== 'pending') {
            return res.status(400).json({ success: false, error: 'Claimed already' });
        }
        if (sessionData.tgUserId !== String(telegramId)) {
            return res.status(400).json({ success: false, error: 'User mismatched' });
        }

        // ভেরিফিকেশন সফল - সেশন আপডেট (ডাবল ক্লাইম প্রটেকশন)
        await sessionRef.update({ 
            status: 'completed', 
            isClickLogged: true,
            isImpressionLogged: true,
            completedAt: admin.firestore.FieldValue.serverTimestamp() 
        });

        // পাবলিশারের মেইন অ্যাকাউন্ট ব্যালেন্স আপডেট (Atomic Transaction)
        const pubRef = db.collection('publishers').doc(sessionData.publisherId);
        
        await db.runTransaction(async (transaction) => {
            const pubDoc = await transaction.get(pubRef);
            if (pubDoc.exists) {
                const currentBal = parseFloat(pubDoc.data().balance || 0);
                const currentEarned = parseFloat(pubDoc.data().total_earned || 0);
                const currentImp = parseInt(pubDoc.data().impressions || 0);
                const currentClicks = parseInt(pubDoc.data().clicks || 0);

                transaction.update(pubRef, {
                    balance: parseFloat((currentBal + 0.0100).toFixed(4)), // প্রতি ক্লিকের রেভিনিউ $0.01 (JS Floating point ফিক্স সহ)
                    total_earned: parseFloat((currentEarned + 0.0100).toFixed(4)),
                    impressions: currentImp + 1,
                    clicks: currentClicks + 1
                });
            }
        });

        // ফিউচার অ্যানালিটিক্স ও হিস্ট্রির জন্য রেভিনিউ লগ সেভ
        await db.collection('rewards').add({
            publisherId: sessionData.publisherId,
            tgUserId: String(telegramId),
            amount: 0.0100,
            completedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // sdk.js এর রিকোয়ারমেন্ট অনুযায়ী রেসপন্স পাঠানো
        return res.status(200).json({ 
            success: true, 
            rewardAmount: 250, // পাবলিশারের মিনি অ্যাপ ইউজারকে দেখানোর জন্য ডেমো কয়েন কাউন্ট
            message: 'Balance credited successfully' 
        });

    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
