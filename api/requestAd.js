const admin = require('firebase-admin');
const crypto = require('crypto');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
    });
}
const db = admin.firestore();

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { publisherId, tgUserId } = req.body;
    if (!publisherId || !tgUserId) return res.status(400).json({ error: 'Missing information' });

    try {
        const campaignRef = db.collection('campaigns').where('status', '==', 'active').limit(1);
        const snapshot = await campaignRef.get();

        let campaign = {
            title: "Premium Adzentra Partner Campaign",
            description: "Click to visit our partner platform and unlock your bonus coins instantly.",
            cta: "Visit Now",
            landingUrl: "https://adzentra-ads.firebaseapp.com"
        };
        let campaignId = "house_ad_01";

        if (!snapshot.empty) {
            campaign = snapshot.docs[0].data();
            campaignId = snapshot.docs[0].id;
        }

        const sessionId = crypto.randomBytes(16).toString('hex');
        const rewardToken = crypto.randomBytes(32).toString('hex');

        await db.collection('ad_sessions').doc(sessionId).set({
            tgUserId: String(tgUserId),
            publisherId: String(publisherId),
            campaignId,
            rewardToken,
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return res.status(200).json({
            campaignId,
            title: campaign.title,
            description: campaign.description,
            cta: campaign.cta,
            landingUrl: campaign.landingUrl,
            sessionId,
            rewardToken
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
