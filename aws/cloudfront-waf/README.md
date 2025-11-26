# CloudFront-Based Architectures (CloudFront + AWS WAF + Lambda@Edge)

## CloudFront Overview
Amazon CloudFront is AWS’s global content delivery network (CDN). It accelerates delivery of web assets (static and dynamic content, APIs, media) by caching content at globally distributed edge locations. Requests are served from the nearest edge location, reducing latency and improving performance.
CloudFront integrates seamlessly with multiple AWS services and can be extended using edge compute (Lambda@Edge).

## CloudFront + Lambda@Edge

You can attach Lambda@Edge functions to CloudFront to run custom logic at the edge before requests reach your origin. Lambda@Edge enables token validation, request transformation, bot checks, security filtering, and more - all close to your users.
CloudFront Events Supported by Lambda@Edge
Lambda@Edge functions can be invoked during four event phases:
- Viewer Request: Triggered when CloudFront receives a request from a viewer before checking the cache.
- Origin Request: Triggered when CloudFront forwards a request to the origin (executes only on cache misses).
- Origin Response: Triggered after CloudFront receives a response from the origin, but before caching it.
- Viewer Response: Triggered before CloudFront returns the response to the viewer (cache hit or miss).

A CloudFront distribution can attach one Lambda function per event type.

[Sample Lambda@Edge Function](https://github.com/skyfire-xyz/skyfire-solutions-aws-news-crawler-demo/blob/SKYK-930-aws-integration/platforms/aws/cloudfront-waf/lambda%40edge/index.mjs) for Skyfire Token Verification

Note: This sample uses a Viewer Request event, so the token validation happens before cache evaluation.

If your environment requires advanced security (bot mitigation, IP filtering, rate limiting, geo-restrictions), you can layer AWS WAF on top of your CloudFront + Lambda@Edge architecture.

## ​​AWS WAF Overview
AWS WAF is a web application firewall that lets you inspect the inbound HTTP and HTTPS traffic that are forwarded to your protected web application resources using:
- IP rules
- String/regex matching
- Rate-limit rules
- Managed rule groups
- Bot Control (Bot Manager)
- CAPTCHA / Challenge actions

For each rule one can choose to:
- Allow
- Block
- Count
- Run CAPTCHA
- Run Challenge
AWS WAF lets you control access to your content. Based on conditions that you specify, such as the IP addresses that requests originate from or the values of query strings, your protected resource responds to requests either with the requested content, with an HTTP 403 status code (Forbidden), or with a custom response.

Note: When using AWS WAF, WAF evaluates the request before your Viewer Request Lambda@Edge executes.

#### Bot Classification Requirement

The client needs to classify bots into 3 categories:

1. Allowed Bots (no Skyfire token required)
Examples:
- Googlebot
- Bingbot
These should bypass Skyfire logic if verified as good bots.

2. Bots with Skyfire Token
- Acceptable: These must present a valid Skyfire token. If a token is missing or invalid, then block.
- Non-acceptable: Even if a Skyfire token is present, these should not override other WAF security rules.

Examples:
- AI scrapers
- Automated crawlers

3. Unidentified bots (which don’t present Skyfire token)

##### Important Requirement

```
Bot classification should not prevent the Skyfire token verification rule from running.
Bot logic + Skyfire token logic must both be considered before allowing access.
```

This typically requires:
- Correct priority ordering of WAF rules
- Using WAF labels or rule groups
- Ensuring Skyfire-related logic happens after bot evaluation
- Ensuring Lambda@Edge logic still fires for acceptable bot types

#### Deployment Steps
1. Create a CloudFront Distribution -

Configure your origin, cache policy, and any required behaviors based on your application architecture.

![cloudfront distribution creation step 1](../static/images/cloudfront-waf/create-distribution-1.png)
![cloudfront distribution creation step 2](../static/images/cloudfront-waf/create-distribution-2.png)
![cloudfront distribution creation step 3](../static/images/cloudfront-waf/create-distribution-3.png)
![cloudfront distribution creation step 4](../static/images/cloudfront-waf/create-distribution-4.png)

2. Create a Lambda@Edge Function - 

Lambda@Edge functions must be created in the N. Virginia (us-east-1) region. 
CloudFront's control plane is hosted exclusively in this region, and all edge function replication begins from here. More details [here](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-edge-how-it-works-tutorial.html).

![lambda function creation](../static/images/cloudfront-waf/create-lambda.png)
![associate lambda function with cloudfront](../static/images/cloudfront-waf/associate-lambda.png)

3. Configure Web ACL security on CloudFront Distribution
Let's establish WAF rules in order to accomplish the above discussed requirement - 

![web-acl-configuration](../static/images/cloudfront-waf/web-acl-configuration.png)

1. Allowed bots - 

**`AWSManagedRulesBotControlRuleSet`** categorises bot requests into various categories and adds corresponding category labels (which can be used to target particular category of bots in the following rules). 

[!Labels for bot categories](../static/images/cloudfront-waf/cloudfront-waf-bot-category-labels.png)

We have the capability to choose one of allow, block, count, challenge for each of these category bots.

In this sample, we have directly allowed **`CategorySeo`** & **`CategorySearchEngine`** from this rule
[!WAF Rules for allowing SearchEngine and SEO bot categories](../static/images/cloudfront-waf/cloudfront-waf-allowed-bots.png)

2. Bots with Skyfire Token - 

    We can configure this rule using labels from `AWSManagedRulesBotControlRuleSet`. All monitored and permissible bot categories from previous rule for allowing access to certain bot categories with valid Skyfire KYA Token - [!Configured list](../static/images/cloudfront-waf/cloudfront-waf-bots-require-skyfire-token.png)

    In this sample, we've configured `awswaf:managed:aws:bot-control:bot:category:ai` and `awswaf:managed:aws:bot-control:bot:category:scraping_framework` to be allowed only when there is a valid Skyfire KYA token by adding a `SkyfireTokenRequired` label to all bot requests that match this rule condition.

    ```
    // JSON view

    {
    "Action": {
        "Count": {}
    },
    "Name": "BotsRequireSkyfireToken",
    "Priority": 7,
    "RuleLabels": [
        {
            "Name": "SkyfireTokenRequired"
        }
    ],
    "Statement": {
        "OrStatement": {
            "Statements": [
                {
                    "LabelMatchStatement": {
                        "Key": "awswaf:managed:aws:bot-control:bot:category:ai",
                        "Scope": "LABEL"
                    }
                },
                {
                    "LabelMatchStatement": {
                        "Key": "awswaf:managed:aws:bot-control:bot:category:scraping_framework",
                        "Scope": "LABEL"
                    }
                }
            ]
        }
    },
    "VisibilityConfig": {
        "CloudWatchMetricsEnabled": true,
        "MetricName": "BotsRequireSkyfireToken",
        "SampledRequestsEnabled": true
    }
}
    ```

In the last `SkyfireDecisioning` rule, we block the request, if a particular bot request has an associated `SkyfireTokenRequired` label but doesn't have a `skyfire-pay-id` JWT in the request header. 
[!cloudfront-waf-skyfire-decisioning-1](../static/images/cloudfront-waf/cloudfront-waf-skyfire-decisioning-1.png)

A custom response can be set when WAF blocks requests to origin server
[!cloudfront-waf-skyfire-decisioning-2](../static/images/cloudfront-waf/cloudfront-waf-skyfire-decisioning-2.png)

```
JSON view

{
    "Action": {
        "Block": {
            "CustomResponse": {
                "CustomResponseBodyKey": "missing-KYA-token-error",
                "ResponseCode": 401
            }
        }
    },
    "Name": "SkyfireDecisioning",
    "Priority": 8,
    "Statement": {
        "AndStatement": {
            "Statements": [
                {
                    "LabelMatchStatement": {
                        "Key": "SkyfireTokenRequired",
                        "Scope": "LABEL"
                    }
                },
                {
                    "NotStatement": {
                        "Statement": {
                            "RegexMatchStatement": {
                                "FieldToMatch": {
                                    "SingleHeader": {
                                        "Name": "skyfire-pay-id"
                                    }
                                },
                                "RegexString": "^[A-Za-z0-9-_]+\\.[A-Za-z0-9-_]+\\.[A-Za-z0-9-_]*$",
                                "TextTransformations": [
                                    {
                                        "Priority": 0,
                                        "Type": "NONE"
                                    }
                                ]
                            }
                        }
                    }
                }
            ]
        }
    },
    "VisibilityConfig": {
        "CloudWatchMetricsEnabled": true,
        "MetricName": "SkyfireDecisioning",
        "SampledRequestsEnabled": true
    }
}
```

Note: WAF rules can be reordered to meet business logic requirements.
Note: Depending on the use-case, these rules are entirely configurable and extendable (including list for **`BotsRequireSkyfireToken`**) - any bot categories can be set up for allow or blocking directly by WAF bot manager itself, and any other for monitoring to apply custom rule later in the priority order. 
