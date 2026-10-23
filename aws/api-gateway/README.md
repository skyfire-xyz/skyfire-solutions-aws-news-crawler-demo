# API Gateway-Based Architectures (API Gateway + Lambda Authorizer)

## API Gateway Overview

AWS API Gateway provides managed REST, HTTP, and WebSocket APIs with:
- Throttling
- Caching
- Authorization (Lambda or JWT authorizers)
- Request/response transformation
- WAF protection (for REST APIs)

## Authorizers in API Gateway

In AWS API Gateway there are authorizers which act as security features used to control access to API endpoints. They function by verifying the authorization status of a request before it reaches the backend service. Authorizers are associated with routes in API Gateway.

### Authorizer Types
1. ❌ JWT Authorizer
- Supported only for HTTP APIs, not available for REST APIs
- Does NOT support EC algorithms (RSA only)
- Therefore, not suitable for Skyfire, since Skyfire uses ES256-based JWTs.

2. ✔ Lambda Authorizer
- Works for both REST and HTTP APIs
- You define full authentication logic inside your Lambda function
- Can integrate with Skyfire token verification
- Supports setting identity sources (header, query param, etc.)

Note: API Gateway supports one authorizer per route. If you need multiple layers of validation, you must implement them inside your Lambda Authorizer.

![API Gateway Sequence Diagram](/aws/static/images/api-gateway/api-gateway-seq-diag.png)

## Deployment Steps

1. Create a REST API Gateway 

![create rest api gateway step 1](../static/images/api-gateway/create-api-gateway-rest-1.png)

![create rest api gateway step 2](../static/images/api-gateway/create-api-gateway-rest-2.png)

Create resources and methods based on your endpoint requirements

![create resources and methods](../static/images/api-gateway/create-resource-method.png)

2. Create Lambda Authorizer

![create lambda](../static/images/api-gateway/create-lambda.png)

Sample Lambda Authorizer code for API Gateway can be found [here](../api-gateway/lambda-authorizer/)

Configure the following Lambda environment variable in the AWS Lambda console (Configuration → Environment variables):

| Key             | Value                             |
| --------------- | --------------------------------- |
| `SELLER_DOMAIN` | The seller domain this Lambda protects (must match the `sdm` claim in incoming tokens) |

If `SELLER_DOMAIN` is not set, all tokens will be rejected with `"Invalid sdm claim"`.

3. Associate the Lambda Authorizer with the created API Gateway

![associate lambda](../static/images/api-gateway/associate-lambda3.png)

![associated lambda linked in api gateway](../static/images/api-gateway/associate-lambda4.png)