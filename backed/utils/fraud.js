// backend/utils/fraud.js
const axios = require('axios');

async function isFraudulent(req, db, publisher_id) {
    // ১. আইপি এড্রেস বের করা (Cloudflare বা Normal Proxy হ্যান্ডেল সহ)
    const ip = req.headers['cf-connecting-ip'] || 
               req.headers['x-forwarded-for']?.split(',')[0] || 
               req.socket.remoteAddress;

    const ua = req.get('User-Agent') || '';

    // ২. বট ডিটেকশন (User-Agent Check)
    // অনেক সময় বট নিজেকে গোপন রাখে, তাই এই লিস্টটি বড় করা হয়েছে
    const botPattern = /bot|spider|crawler|lighthouse|inspect|headless|selenium|puppeteer|python|curl|wget/i;
    if (botPattern.test(ua)) {
        console.log(`[FRAUD] Bot detected: ${ua}`);
        return true;
    }

    // ৩. ডুপ্লিকেট ক্লিক চেক (একই আইপি থেকে ৩০ মিনিটের মধ্যে ক্লিক)
    // এখানে publisher_id যোগ করা হয়েছে যাতে ভুল করে অন্য কারো ক্লিক ফ্রড না হয়
    try {
        const recentClick = await db.query(
            "SELECT id FROM clicks WHERE ip=$1 AND publisher_id=$2 AND created_at > NOW() - INTERVAL '30 minutes'", 
            [ip, publisher_id]
        );
        if (recentClick.rowCount > 0) {
            console.log(`[FRAUD] Duplicate click from IP: ${ip}`);
            return true;
        }
    } catch (err) {
        console.error("DB Error in fraud check:", err);
    }

    // ৪. ভিপিএন ও প্রক্সি ডিটেকশন (Advanced Check using IP-API)
    try {
        // IP-API এর মাধ্যমে আইপি চেক (এটি ফ্রি টায়ারে প্রতি মিনিটে ৪৫টি রিকোয়েস্ট দেয়)
        // আপনি চাইলে পরে ipqualityscore.com এর মতো প্রিমিয়াম সার্ভিস যোগ করতে পারেন
        const response = await axios.get(`http://ip-api.com/json/${ip}?fields=status,mobile,proxy,hosting`);
        
        if (response.data && response.data.status === 'success') {
            const { proxy, hosting } = response.data;
            
            // যদি আইপিটি প্রক্সি, ভিপিএন বা কোনো ডাটা সেন্টার (hosting) থেকে হয়
            if (proxy === true || hosting === true) {
                console.log(`[FRAUD] VPN/Proxy/Hosting IP: ${ip}`);
                return true;
            }
        }
    } catch (apiError) {
        // যদি এপিআই ফেইল করে তবে নরমাল চেক
        if (req.headers['x-forwarded-for'] && req.headers['x-forwarded-for'].includes(',')) return true;
    }

    return false;
}

module.exports = { isFraudulent };
