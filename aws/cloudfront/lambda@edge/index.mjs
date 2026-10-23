import { JwtVerifier } from "aws-jwt-verify";

// Create the verifier outside the Lambda handler (= during cold start),
// so the cache can be reused for subsequent invocations. Then, only during the
// first invocation, will the verifier actually need to fetch the JWKS.
const verifier = JwtVerifier.create({
    issuer: "https://app.skyfire.xyz",
    jwksUri: "https://app.skyfire.xyz/.well-known/jwks.json",
  });

// Lambda@Edge does not support environment variables.
// Set this to the seller domain this function is deployed to protect.
const SELLER_DOMAIN = "<YOUR_SELLER_DOMAIN>";

const requireClaim = (condition, msg) => {
  if (!condition) throw new Error(msg);
};

export const handler = async (event) => {
  const { request } = event.Records[0].cf;

  const kyapayHeader = request.headers["kyapay-token"];
  const skyfireToken = (kyapayHeader && kyapayHeader[0].value) || null;

  if (skyfireToken) {
    try {
      // Signature + issuer + exp are validated by aws-jwt-verify.
      const payload = await verifier.verify(skyfireToken);

      const [headerB64] = skyfireToken.split(".");
      const protectedHeader = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
      const nowSec = Math.floor(Date.now() / 1000);

      requireClaim(["kya+jwt", "kya-pay+jwt"].includes(protectedHeader.typ), `Invalid typ: ${protectedHeader.typ}`);
      requireClaim(payload.env === "production", `Token is not from production environment: ${payload.env}`);
      requireClaim(typeof payload.iat === "number" && payload.iat <= nowSec, `Invalid iat: ${payload.iat}`);
      requireClaim(payload.hid != null, "Missing required claim: hid");
      requireClaim(payload.apd != null, "Missing required claim: apd");
      requireClaim(payload.aid != null, "Missing required claim: aid");
      requireClaim(
        typeof SELLER_DOMAIN === "string" &&
          SELLER_DOMAIN.length > 0 &&
          SELLER_DOMAIN !== "<YOUR_SELLER_DOMAIN>" &&
          typeof payload.sdm === "string" &&
          payload.sdm === SELLER_DOMAIN,
        "Invalid sdm claim",
      );

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