const admin = require('firebase-admin');

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

    const { sessionId, rewardToken, tgUserId } = req.body;

    try {
        const sessionRef = db.collection('ad_sessions').doc(sessionId);
        const sessionDoc = await sessionRef.get();

        if (!sessionDoc.exists) return res.status(400).json({ error: 'Invalid Session' });

        const sessionData = sessionDoc.data();

        if (sessionData.status !== 'pending') return res.status(400).json({ error: 'Claimed already' });
        if (sessionData.rewardToken !== rewardToken) return res.status(400).json({ error: 'Token hacked' });
        if (sessionData.tgUserId !== String(tgUserId)) return res.status(400).json({ error: 'User mismatched' });

        // ভেরিফিকেশন সফল - ব্যালেন্স যোগ
        await sessionRef.update({ status: 'completed', completedAt: admin.firestore.FieldValue.serverTimestamp() });

        const pubRef = db.collection('publishers').doc(sessionData.publisherId);
        await db.runTransaction(async (transaction) => {
            const pubDoc = await transaction.get(pubRef);
            if (pubDoc.exists) {
                const currentBal = parseFloat(pubDoc.data().balance || 0);
                const currentEarned = parseFloat(pubDoc.data().total_earned || 0);
                const currentImp = parseInt(pubDoc.data().impressions || 0);
                const currentClicks = parseInt(pubDoc.data().clicks || 0);

                transaction.update(pubRef, {
                    balance: currentBal + 0.0100, // প্রতি ক্লিকের রেভিনিউ $0.01
                    total_earned: currentEarned + 0.0100,
                    impressions: currentImp + 1,
                    clicks: currentClicks + 1
                });
            }
        });

        // অ্যানালিটিক্স হিস্ট্রির জন্য রেভিনিউ লগ সেভ
        await db.collection('rewards').add({
            publisherId: sessionData.publisherId,
            tgUserId: String(tgUserId),
            amount: 0.0100,
            completedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return res.status(200).json({ success: true, message: 'Balance credited' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
