const admin = require('firebase-admin');
const crypto = require('crypto');

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

    // sdk.js থেকে আসা ভেরিয়েবল (telegramId অথবা tgUserId ব্যাকওয়ার্ড কম্প্যাটিবিলিটি সহ)
    const { publisherId, tgUserId, telegramId } = req.body;
    const finalTgUserId = tgUserId || telegramId;

    if (!publisherId || !finalTgUserId) {
        return res.status(400).json({ error: 'Missing information' });
    }

    try {
        // ফায়ারস্টোর থেকে একটি একটিভ ক্যাম্পেইন খোঁজ করা
        const campaignRef = db.collection('campaigns').where('status', '==', 'active').limit(1);
        const snapshot = await campaignRef.get();

        // ডিফল্ট হাউস অ্যাড বা ফলব্যাক ক্যাম্পেইন ডাটা (আইকনসহ)
        let campaign = {
            title: "Premium Adzentra Partner Campaign",
            description: "Click to visit our partner platform and unlock your bonus coins instantly.",
            cta: "Visit Now",
            landingUrl: "https://adzentra-ads.firebaseapp.com",
            icon: "https://via.placeholder.com/150/4318ff/ffffff?text=Adzentra"
        };
        let campaignId = "house_ad_01";

        if (!snapshot.empty) {
            campaign = snapshot.docs[0].data();
            campaignId = snapshot.docs[0].id;
        }

        // সিকিউর ক্রিপ্টোগ্রাফিক টোকেন ও সেশন জেনারেশন
        const sessionId = crypto.randomBytes(16).toString('hex');
        const sessionToken = `sess_${sessionId}`;
        const impressionToken = `imp_${crypto.randomBytes(16).toString('hex')}`;
        const clickToken = `clk_${crypto.randomBytes(16).toString('hex')}`;

        // ফায়ারবেস স্টোরেজে সেশন রেকর্ড পুশ করা (অ্যান্টি-ফ্রড ও ট্র্যাকিং ভেরিফিকেশনের জন্য)
        await db.collection('ad_sessions').doc(sessionToken).set({
            tgUserId: String(finalTgUserId),
            publisherId: String(publisherId),
            campaignId,
            impressionToken,
            clickToken,
            status: 'pending',
            isImpressionLogged: false,
            isClickLogged: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // কাস্টম পুশ-স্টাইল SDK ব্যানারের রিকোয়ারমেন্ট অনুযায়ী রেসপন্স পাঠানো
        return res.status(200).json({
            campaignId,
            title: campaign.title,
            description: campaign.description,
            cta: campaign.cta || "Open",
            landingUrl: campaign.landingUrl,
            icon: campaign.icon || "https://via.placeholder.com/150/4318ff/ffffff?text=Ads",
            sessionToken,
            impressionToken,
            clickToken
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
