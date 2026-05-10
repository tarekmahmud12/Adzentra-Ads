// backend/server.js
const { isFraudulent } = require('./utils/fraud');
const { trackClick, getLinkData } = require('./models/db'); // আপনার ডাটাবেজ লজিক

app.get('/r/:code', async (req, res) => {
    try {
        const { code } = req.params;
        
        // ১. ডাটাবেজ থেকে লিংকের তথ্য আনা
        const linkData = await getLinkData(code);
        if (!linkData) {
            return res.status(404).send("Link not found or disabled");
        }

        // ২. ফ্রড এবং কান্ট্রি ডিটেকশন (Cloudflare ব্যবহার করলে cf-ipcountry পাবেন)
        const fraud = await isFraudulent(req);
        const country = req.headers['cf-ipcountry'] || 'Unknown';
        const userAgent = req.headers['user-agent'];

        // ৩. অ্যাড রোটেটর এবং ফলব্যাক লজিক
        let targetAdUrl = "";

        if (fraud) {
            // ফ্রড ট্রাফিক হলে খুব কম দামি বা সেফ অ্যাড লিংকে পাঠাবে
            targetAdUrl = "https://link.gigapub.tech/l/5o1y7bjp9"; 
            console.log(`Fraud detected from ${country}. Redirecting to fallback.`);
        } else {
            // রিয়েল ট্রাফিক হলে আপনার প্রিমিয়াম অ্যাড নেটওয়ার্কগুলো
            const adNetworks = [
                "https://www.profitablecpmratenetwork.com/yh7pvdve?key=58d4a9b60d7d99d8d92682690909edc3", // Adsterra
                "https://omg10.com/4/9627131", // Monetag
                "https://quge5.com/88/tag.min.js?zone=236881" // RichAds
            ];
            
            // স্মার্ট রোটেশন (এখানে আপনি কান্ট্রি বেজড কন্ডিশনও দিতে পারেন)
            targetAdUrl = adNetworks[Math.floor(Math.random() * adNetworks.length)];
        }

        // ৪. ক্লিক ট্র্যাক করা (পাবলিশারের আর্নিং এর জন্য)
        // ডাটাবেজে ইউজার আইডি, কান্ট্রি এবং ফ্রড স্ট্যাটাস সেভ হবে
        await trackClick({
            code: code,
            publisher_id: linkData.publisher_id,
            country: country,
            is_fraud: fraud,
            ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            user_agent: userAgent
        });

        // ৫. ফাইনাল রিডাইরেক্ট
        // আপনি চাইলে মাঝখানে একটি 'Bridge Page' বা 'Timer Page' দেখাতে পারেন আর্নিং বাড়ানোর জন্য
        res.redirect(targetAdUrl);

    } catch (error) {
        console.error("Server Error:", error);
        res.redirect("https://adzentra.pro"); // কোনো ভুল হলে মেইন সাইটে পাঠিয়ে দিবে
    }
});
