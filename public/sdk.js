const Adzentra = {
    config: {},
    initialize: function(options) {
        this.config = options;
    },
    showPushAd: async function(tgUserId, callback) {
        try {
            const response = await fetch('https://your-vercel-domain.com/api/requestAd', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ publisherId: this.config.publisherId, tgUserId: String(tgUserId) })
            });
            const ad = await response.json();
            if (ad.error || !ad.campaignId) return;

            const adNode = document.createElement('div');
            adNode.style = "position:fixed; bottom:20px; left:5%; width:90%; background:#11141b; color:#fff; padding:16px; border-radius:20px; border:1px solid rgba(255,255,255,0.08); box-shadow:0 10px 30px rgba(0,0,0,0.5); z-index:99999; font-family:sans-serif; display:flex; align-items:center; gap:12px; transition: 0.3s ease;";
            adNode.innerHTML = `
                <div style="flex:1;">
                    <b style="font-size:11px; display:block; color:#0088cc; text-transform:uppercase; letter-spacing:0.5px;">Sponsored Ad</b>
                    <span style="font-size:14px; font-weight:700; display:block; margin-top:2px;">${ad.title}</span>
                    <p style="margin:4px 0 0 0; font-size:12px; color:#94a3b8; line-height:1.3;">${ad.description}</p>
                </div>
                <button id="adzentra-cta-btn" style="background:#0088cc; color:#fff; border:none; padding:10px 16px; border-radius:12px; font-weight:700; font-size:14px; cursor:pointer; min-width:80px; box-shadow:0 4px 12px rgba(0,136,204,0.3);">${ad.cta}</button>
            `;
            document.body.appendChild(adNode);

            document.getElementById('adzentra-cta-btn').onclick = async () => {
                window.open(ad.landingUrl, '_blank');
                
                setTimeout(async () => {
                    const verifyRes = await fetch('https://your-vercel-domain.com/api/verifyReward', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId: ad.sessionId, rewardToken: ad.rewardToken, tgUserId: String(tgUserId) })
                    });
                    const result = await verifyRes.json();
                    adNode.remove();
                    if (result.success && callback) {
                        callback({ status: 'success', message: 'Balance Credit Complete' });
                    }
                }, 5000); // এন্টি-ফ্রড সেফটি বাফার ৫ সেকেন্ড
            };
        } catch (err) {
            console.error("SDK Integration Load Error", err);
        }
    }
};
