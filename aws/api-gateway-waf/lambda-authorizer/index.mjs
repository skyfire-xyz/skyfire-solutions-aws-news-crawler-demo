import { JwtVerifier } from "aws-jwt-verify";

// Create the verifier outside the Lambda handler (= during cold start),
// so the cache can be reused for subsequent invocations. Then, only during the
// first invocation, will the verifier actually need to fetch the JWKS.
const verifier = JwtVerifier.create({
  issuer: "https://app.skyfire.xyz",
  audience: "<YOUR_SELLER_AGENT_ID>",
  jwksUri: "https://app.skyfire.xyz/.well-known/jwks.json",
});

const requireClaim = (condition, msg) => {
  if (!condition) throw new Error(msg);
};


export const handler = async (event) => {
  const headers = event.headers || {};
  const methodArn = event.methodArn; // IMPORTANT: REST API uses methodArn

  const skyfireToken = headers["kyapay-token"] || null;

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
        typeof process.env.SELLER_DOMAIN === "string" &&
          process.env.SELLER_DOMAIN.length > 0 &&
          typeof payload.sdm === "string" &&
          payload.sdm === process.env.SELLER_DOMAIN,
        "Invalid sdm claim",
      );

      console.log("Token is valid!");
    } catch (err) {
      console.log("Exception", err);
      console.log("Token not valid!");

      return {
        principalId: "abcdef",
        policyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Action: "execute-api:Invoke",
              Effect: "Deny",
              Resource: methodArn
            }
          ]
        },
        context: {
          error: "Invalid `kyapay-token`. Please use a valid kya token - https://docs.skyfire.xyz/reference/create-token."
        }
      };
    }
  }

  return {
    principalId: "abcdef",
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: "Allow",
          Resource: methodArn
        }
      ]
    },
    context: {
      stringKey: "value",
      numberKey: 1,
      booleanKey: true
    }
  };
};