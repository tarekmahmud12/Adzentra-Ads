/**
 * Adzentra Ads - Professional Telegram Mini App SDK Panel
 * File Path: public/sdk.js
 * Features: RichAds Bridge, Push-style UI Banner, Anti-Fraud Protection
 */

class AdzentraAdsSDK {
    constructor() {
        this.pubId = null;
        this.appId = "5127"; // আপনার ডিফল্ট রিচঅ্যাডস অ্যাপ আইডি
        this.apiUrl = "/api"; // ভেরসেল এনভায়রনমেন্ট অনুযায়ী রিয়াল পাথ
        this.tg = window.Telegram?.WebApp || null;
    }

    // পাবলিশার অ্যাপ ইনিশিয়ালাইজেশন
    initialize(config) {
        if (!config.publisherId) {
            console.error("Adzentra Error: publisherId is required!");
            return;
        }
        this.pubId = config.publisherId;
        console.log(`Adzentra SDK Loaded Successfully for Pub: ${this.pubId}`);

        // RichAds এর অবজেক্ট ব্যাকগ্রাউন্ডে রেডি করে রাখা
        this.injectRichAdsCore();
    }

    // ব্যাকগ্রাউন্ডে RichAds কোর স্ক্রিপ্ট এবং কন্ট্রোলার রেডি করা
    injectRichAdsCore() {
        if (typeof window.TelegramAdsController === "undefined") {
            const script = document.createElement("script");
            script.src = "https://richinfo.co/richpartners/telegram/js/tg-ob.js";
            script.onload = () => {
                try {
                    window.TelegramAdsController = new TelegramAdsController();
                    window.TelegramAdsController.initialize({
                        pubId: "987925", // RichAds Publisher ID
                        appId: this.config?.appId || "5127"
                    });
                } catch (e) {
                    console.log("RichAds Init Wait...");
                }
            };
            document.head.appendChild(script);
        }
    }

    // মেইন ট্রিগার মেথড যা পাবলিশারের বাটন ক্লিকে কল হবে
    async triggerNativeNotification() {
        if (!this.tg) {
            console.error("Adzentra: External Telegram WebApp environment not found.");
            return;
        }

        const tgUser = this.tg.initDataUnsafe?.user || { id: "000000", username: "anonymous" };

        try {
            // আপনার নিজস্ব সার্ভার থেকে ক্যাম্পেইন এবং সেশন টোকেন জেনারেট রিকোয়েস্ট
            const res = await fetch(`${this.apiUrl}/requestAd`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    publisherId: this.pubId,
                    telegramId: tgUser.id,
                    username: tgUser.username
                })
            });

            const adData = await res.json();

            if (adData && adData.campaignId) {
                this.renderPushStyleBanner(adData);
            } else {
                // কোনো কাস্টম ক্যাম্পেইন লাইভ না থাকলে সরাসরি RichAds এর নেটিভ নোটিফিকেশন লোড হবে
                if (window.TelegramAdsController) window.TelegramAdsController.triggerNativeNotification();
            }
        } catch (error) {
            console.error("Adzentra Fallback to RichAds Native Engine:", error);
            if (window.TelegramAdsController) window.TelegramAdsController.triggerNativeNotification();
        }
    }

    // স্ক্রিনের নিচে কাস্টম পুশ-স্টাইল ব্যানার ডিজাইন এবং রেন্ডারিং
    renderPushStyleBanner(ad) {
        const existingAd = document.getElementById("adzentra-native-push");
        if (existingAd) existingAd.remove();

        const container = document.createElement("div");
        container.id = "adzentra-native-push";
        container.style = `
            position: fixed; bottom: 15px; left: 5%; width: 90%; max-width: 380px;
            background: #ffffff; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.12);
            padding: 14px; z-index: 2147483647; display: flex; flex-direction: column;
            gap: 10px; border: 1px solid #e0e5f2; font-family: 'Inter', sans-serif;
            animation: adzentraSlideUp 0.3s ease-out;
        `;

        container.innerHTML = `
            <style>
                @keyframes adzentraSlideUp { from { transform: translateY(100px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .az-progress-container { width: 100%; height: 4px; background: #f0f2f5; border-radius: 2px; overflow: hidden; }
                .az-bar { width: 100%; height: 100%; background: #4318ff; transition: linear; }
            </style>
            <div style="display: flex; gap: 12px; align-items: center; position: relative;">
                <img src="${ad.icon || 'https://via.placeholder.com/50'}" style="width: 44px; height: 44px; border-radius: 10px; object-fit: cover; border: 1px solid #eee;">
                <div style="flex: 1; padding-right: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                        <span style="font-size: 10px; font-weight: 700; color: #a3adc2; text-transform: uppercase; letter-spacing: 0.5px;">Sponsored</span>
                        <span id="az-timer" style="font-size: 11px; font-weight: 700; color: #ee5d50; background: #fff5f5; padding: 1px 6px; border-radius: 4px;">10s</span>
                    </div>
                    <h4 style="font-size: 13px; font-weight: 700; color: #1b2559; margin: 0; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${ad.title}</h4>
                    <p style="font-size: 11px; color: #707eae; line-height: 1.3; margin-top: 1px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${ad.description}</p>
                </div>
                <i class="fa-solid fa-xmark" id="az-close-btn" style="position: absolute; right: 0; top: 0; cursor: pointer; color: #a3adc2; font-size: 16px;"></i>
            </div>
            <div class="az-progress-container"><div class="az-bar" id="az-bar-fill"></div></div>
            <button id="az-action-btn" style="background: #4318ff; color: #ffffff; border: none; padding: 10px; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 12px; display: flex; justify-content: center; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(67,24,255,0.15);">
                ${ad.cta || 'Learn More'} <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 10px;"></i>
            </button>
        `;

        document.body.appendChild(container);

        // ১. ইম্প্রেশন কাউন্ট ট্র্যাকিং কল
        this.logSecureEvent("impression", ad.impressionToken);

        // ২. টাইমার ও প্রগ্রেস বার কন্ট্রোল
        let remainingTime = 10;
        const barFill = document.getElementById("az-bar-fill");
        barFill.style.transitionDuration = `${remainingTime}s`;
        setTimeout(() => barFill.style.width = "0%", 50);

        const countdownThread = setInterval(() => {
            remainingTime--;
            const timerLabel = document.getElementById("az-timer");
            if (timerLabel) timerLabel.innerText = `${remainingTime}s`;

            if (remainingTime <= 0) {
                clearInterval(countdownThread);
                if (timerLabel) {
                    timerLabel.innerText = "Claimable";
                    timerLabel.style.color = "#05cd99";
                    timerLabel.style.background = "#e6fff5";
                }
            }
        }, 1000);

        // ৩. ইউজার যদি কেটে দেয় (X বাটনে চাপ দেয়) - অ্যান্টি ফ্রড প্রোটেকশন পলিসি
        document.getElementById("az-close-btn").onclick = () => {
            clearInterval(countdownThread);
            container.remove();
            // অটোমেটিক কোনো লিঙ্কে রিডাইরেক্ট না করে মিনি অ্যাপের নরমাল ফ্লোতেই ধরে রাখা হবে
            this.tg.showAlert("বিজ্ঞাপনে ক্লিক না করার কারণে রিওয়ার্ড প্রসেস বাতিল করা হয়েছে।");
        };

        // ৪. ইউজার যখন বিজ্ঞাপনে বা অ্যাকশন বাটনে ক্লিক করবে
        document.getElementById("az-action-btn").onclick = () => {
            clearInterval(countdownThread);
            
            // ক্লিক ট্র্যাকিং কল
            this.logSecureEvent("click", ad.clickToken);

            // বিজ্ঞপ্তির অরিজিনাল ল্যান্ডিং ইউআরএল ওপেন করা
            this.tg.openLink(ad.landingUrl);
            container.remove();

            // ব্যাকগ্রাউন্ডে রিওয়ার্ড ভেরিফিকেশন সেশন রান করা
            this.verifyRewardSession(ad.sessionToken);
        };
    }

    // ইভেন্ট লগার এপিআই কানেকশন
    async logSecureEvent(endpoint, token) {
        try {
            await fetch(`${this.apiUrl}/${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: token, ts: Date.now() })
            });
        } catch (e) {
            console.log("Tracking log deferred.");
        }
    }

    // ব্যাকএন্ড ভেরিফিকেশন এপিআই প্রসেসিং
    async verifyRewardSession(sessionToken) {
        this.tg.showPopup({
            title: "Securing Reward Session",
            message: "অনুগ্রহ করে ৫ সেকেন্ড অপেক্ষা করুন, আপনার ক্লিটি ড্যাশবোর্ডে ভেরিফাই করা হচ্ছে...",
            buttons: [{ type: "close" }]
        });

        setTimeout(async () => {
            try {
                const check = await fetch(`${this.apiUrl}/verifyReward`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        sessionToken: sessionToken,
                        telegramId: this.tg.initDataUnsafe?.user?.id
                    })
                });

                const status = await check.json();

                if (status.success) {
                    this.tg.showAlert(`ধন্যবাদ! সফলভাবে ভেরিফিকেশন সম্পন্ন হয়েছে এবং অ্যাকাউন্টে ${status.rewardAmount} কয়েন যোগ করা হয়েছে।`);
                } else {
                    this.tg.showAlert("রিওয়ার্ড ভেরিফিকেশন ব্যর্থ! ডুপ্লিকেট বা ইনভ্যালিড সেশন ডিটেক্ট হয়েছে।");
                }
            } catch (err) {
                console.error("Verification latency issue:", err);
            }
        }, 5000);
    }
}

window.Adzentra = new AdzentraAdsSDK();
