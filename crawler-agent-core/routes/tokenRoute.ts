import express from "express";
const router = express.Router();

    const getEpochPlus24Hours = () => {
        const now = Date.now();
        const twentyFourHoursInMs = 24 * 60 * 60 * 1000;
        const futureTimeInMs = now + twentyFourHoursInMs;
        const futureEpochInSeconds = Math.floor(futureTimeInMs / 1000);
        return futureEpochInSeconds;
    }

router.route("/").post(async (req, res) => {
    const {tokenAmount, tokenType, userApiKey, sellerDomainOrUrl} = req.body;
    try {
        const bodyPayload: Record<string, any> = {
            type: tokenType ? tokenType : "kya",
            buyerTag: process.env.BUYER_TAG,
            expiresAt: getEpochPlus24Hours(),
        };

        if (process.env.SELLER_SERVICE_ID) {
            bodyPayload.sellerServiceId = process.env.SELLER_SERVICE_ID;
        } else {
            bodyPayload.sellerDomainOrUrl = sellerDomainOrUrl;
        }

        if (tokenAmount && tokenType !== "kya") {
            bodyPayload.tokenAmount = tokenAmount;
        }
        console.log("bodyPayload", bodyPayload);

        const response = await fetch(`${process.env.SKYFIRE_API_BASE_URL}/api/v1/tokens`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "skyfire-api-key": userApiKey && userApiKey.length > 0 ? userApiKey : process.env.SKYFIRE_API_KEY,
            },
            body: JSON.stringify(bodyPayload),
        });

        if (response.status === 200) {
            const res1: { token: string } = await response.json();
            if (!res1 || !res1.token) {
                console.error("Unable to create kya+pay token");
                res.status(500).json({ error: "Unable to create kya+pay token" });
                return;
            }
            res.status(200).json({"token": `${res1.token}`})
        } else {
            const errorBody = await response.json();
            console.error("Token API error:", response.status, errorBody);
            res.status(response.status).json({ error: errorBody });
        }
    } catch(error: any) {
        console.error("Error in token creation:", error);
        res.status(500).json({ error: error?.message || "Internal server error" });
    }
})

export default router;