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
  if (request.headers["skyfire-pay-id"] && request.headers["skyfire-pay-id"][0].value) {
    const skyfireToken = request.headers["skyfire-pay-id"][0].value || null; 
    try {
      const payload = await verifier.verify(skyfireToken); 
      console.log("Token is valid!");
    } catch {
      console.log("Token not valid!");
      return {
        status: "403",
        headers: {
          'content-type': [{
              key: 'Content-Type',
              value: 'application/json'
           }],
      },
        body: JSON.stringify({"message": "Invalid token `skyfire-pay-id`. Please use valid kya token - https://docs.skyfire.xyz/reference/create-token."}),
      };
    }
  }
  return request; // allow request to proceed
};