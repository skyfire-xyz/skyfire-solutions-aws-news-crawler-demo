import { JwtVerifier } from "aws-jwt-verify";

// Create the verifier outside the Lambda handler (= during cold start),
// so the cache can be reused for subsequent invocations. Then, only during the
// first invocation, will the verifier actually need to fetch the JWKS.
const verifier = JwtVerifier.create({
    issuer: "https://app.skyfire.xyz", 
    audience: "<YOUR_SELLER_AGENT_ID>",
    jwksUri: "https://app.skyfire.xyz/.well-known/jwks.json",
  });

export const handler = async (event) => {
  const { request } = event.Records[0].cf;

  const kyapayHeader = request.headers["kyapay-token"];
  const legacyHeader = request.headers["skyfire-pay-id"];
  const skyfireToken =
    (kyapayHeader && kyapayHeader[0].value) ||
    (legacyHeader && legacyHeader[0].value) ||
    null;

  if (skyfireToken) {
    try {
      // Signature + issuer + exp are validated by aws-jwt-verify.
      const payload = await verifier.verify(skyfireToken);

      // typ (JWT header) must be kya+jwt or kya-pay+jwt.
      const [headerB64] = skyfireToken.split(".");
      const protectedHeader = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
      if (!["kya+jwt", "kya-pay+jwt"].includes(protectedHeader.typ)) {
        throw new Error(`Invalid typ: ${protectedHeader.typ}`);
      }

      // env must be production.
      if (payload.env !== "production") {
        throw new Error(`Token is not from production environment: ${payload.env}`);
      }

      // iat must be present and not in the future.
      const nowSec = Math.floor(Date.now() / 1000);
      if (typeof payload.iat !== "number" || payload.iat > nowSec) {
        throw new Error(`Invalid iat: ${payload.iat}`);
      }

      // hid, apd, aid claims required for kya and kya-pay tokens.
      if (payload.hid === undefined || payload.hid === null) {
        throw new Error("Missing required claim: hid");
      }
      if (payload.apd === undefined || payload.apd === null) {
        throw new Error("Missing required claim: apd");
      }
      if (payload.aid === undefined || payload.aid === null) {
        throw new Error("Missing required claim: aid");
      }

      console.log("Token is valid!");
      return request; // allow request to proceed
    } catch (err) {
      console.log("Token not valid!", err);
    }
  }
  return    {
    status: "403",
    headers: {
      'content-type': [{
          key: 'Content-Type',
          value: 'application/json'
       }],
  },
    body: JSON.stringify({"message": "Invalid/Missing `kyapay-token`. Please use a valid kya token - https://docs.skyfire.xyz/reference/create-token."}),
  };
};