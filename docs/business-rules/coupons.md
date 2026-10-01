# Coupon & Promotion Business Rules

**Module:** Promotion / Coupon Engine

**Version:** 1.0

**Owner:** Marketing Team

---

# Overview

The Coupon Service is responsible for validating, calculating, and applying promotional discounts during checkout.

Unlike the Pricing Service, the Coupon Service **does not own product pricing**.

It only determines:

- Is a coupon valid?
- Is the customer eligible?
- What discount should be applied?
- Can multiple coupons be combined?
- Which campaign has higher priority?

The Coupon Service integrates with:

- Pricing Service
- Cart Service
- Checkout Service
- Order Service
- Customer Service
- Analytics Service

---

# Business Objectives

- Increase conversions
- Increase Average Order Value (AOV)
- Attract new customers
- Retain existing customers
- Support marketing campaigns
- Prevent coupon abuse
- Enable configurable promotion rules

---

# Promotion Types

## Percentage Discount

Example

```
10% OFF
```

---

## Flat Discount

Example

```
₹500 OFF
```

---

## Buy X Get Y

Example

```
Buy 2 Shirts

Get 1 Shirt Free
```

---

## Free Shipping

Example

```
FREE DELIVERY
```

---

## Cashback

Example

```
₹200 Cashback
```

---

## Loyalty Coupon

Example

```
Gold Members

10% OFF
```

---

## Festival Campaign

Example

```
Diwali Sale

20% OFF
```

---

## Bank Offer

Example

```
HDFC Cards

10% Instant Discount
```

---

## Category Promotion

Example

```
Electronics

15% OFF
```

---

## Brand Promotion

Example

```
Nike

20% OFF
```

---

# Coupon Structure

Every coupon consists of

```
Coupon Code

Campaign

Discount Type

Discount Value

Validity

Usage Limit

Eligibility Rules

Priority

Status
```

---

# Coupon Lifecycle

```text
Created

↓

Scheduled

↓

Active

↓

Applied

↓

Redeemed

↓

Expired

↓

Archived
```

Alternative states

```text
Paused

Cancelled

Disabled
```

---

# Business Rules

## Rule 1

Coupon code must be unique.

Example

```
WELCOME100
```

---

## Rule 2

Coupons cannot be applied after expiration.

---

## Rule 3

Coupons must be active.

---

## Rule 4

Coupon usage must not exceed configured limit.

---

## Rule 5

Customer usage limit must be enforced.

Example

```
Maximum

1 Redemption

Per Customer
```

---

## Rule 6

Coupon minimum order amount must be satisfied.

Example

```
Minimum Order

₹999
```

---

## Rule 7

Coupon discount cannot exceed configured maximum.

Example

```
20%

Maximum ₹1000
```

---

## Rule 8

Coupon cannot make order value negative.

---

## Rule 9

Coupon validation occurs before payment.

---

## Rule 10

Coupon redemption occurs only after successful payment.

---

# Coupon Priority

When multiple promotions exist

Priority Order

```
Flash Sale

↓

Product Promotion

↓

Category Promotion

↓

Brand Promotion

↓

Coupon

↓

Wallet

↓

Reward Points
```

---

# Coupon Eligibility

Coupons can be restricted by

- Customer
- Customer Group
- Membership Tier
- Country
- State
- City
- Product
- Category
- Brand
- Seller
- Payment Method
- Bank
- First Order
- New Customer

---

# Coupon Types

| Coupon | Description |
|----------|------------|
| Public | Everyone |
| Private | Selected Users |
| Referral | Invited Users |
| Loyalty | Membership |
| Employee | Internal Users |
| Influencer | Marketing Campaign |
| Partner | Bank/Brand Offers |

---

# Buy X Get Y Rules

Example

```
Buy

2

T-Shirts

↓

Get

1

Free
```

Rules

- Lowest-priced item is free
- Free item must belong to eligible category
- Promotion cannot be combined with another Buy X Get Y campaign

---

# Free Shipping Rules

Example

```
Order > ₹499

↓

Free Shipping
```

Priority

Free Shipping overrides normal shipping calculation.

---

# Cashback Rules

Cashback is credited

```
After Order Delivery
```

Not immediately after payment.

---

# Stackable Coupons

Support configurable stacking.

Example

Allowed

```
Bank Offer

+

Free Shipping
```

Not Allowed

```
Coupon A

+

Coupon B
```

Configuration

| Promotion | Stackable |
|------------|-----------|
| Coupon | No |
| Bank Offer | Yes |
| Cashback | Yes |
| Shipping | Yes |

---

# Coupon Formula

```
Order Total

-

Product Discount

-

Coupon Discount

+

Shipping

+

Tax

=

Final Amount
```

---

# Validation Rules

Coupon validation checks

- Coupon Exists
- Coupon Active
- Not Expired
- Usage Limit
- Customer Eligibility
- Product Eligibility
- Category Eligibility
- Minimum Cart Value
- Maximum Discount
- Stackable Rules

---

# APIs

## Validate Coupon

```
POST /coupons/validate
```

---

## Apply Coupon

```
POST /coupons/apply
```

---

## Remove Coupon

```
DELETE /coupons
```

---

## Get Coupon Details

```
GET /coupons/{code}
```

---

## List Active Coupons

```
GET /coupons
```

---

# Database

## Coupon

| Column | Description |
|----------|------------|
| coupon_id | UUID |
| code | Coupon Code |
| campaign_id | Campaign |
| discount_type | Percentage / Flat |
| discount_value | Value |
| max_discount | Maximum |
| min_order | Minimum Order |
| start_date | Start |
| end_date | End |
| active | Boolean |

---

## Coupon Redemption

| Column | Description |
|----------|------------|
| redemption_id | UUID |
| coupon_id | Coupon |
| customer_id | Customer |
| order_id | Order |
| discount_amount | Applied Discount |
| redeemed_at | Timestamp |

---

# Kafka Events

| Topic | Producer | Consumer |
|----------|----------|----------|
| coupon.created | Promotion | Analytics |
| coupon.updated | Promotion | Cache |
| coupon.applied | Promotion | Order |
| coupon.redeemed | Promotion | Analytics |
| coupon.expired | Promotion | Notification |

---

# Exception Handling

## Coupon Expired During Checkout

Reject coupon.

Prompt customer to refresh cart.

---

## Coupon Usage Limit Reached

Reject coupon.

Display

```
Coupon no longer available
```

---

## Coupon Already Used

Reject request.

---

## Invalid Coupon

Return

```
INVALID_COUPON
```

---

## Duplicate Coupon Request

Return cached validation result.

---

# Fraud Prevention

Detect

- Multiple accounts using same coupon
- Bot-generated coupon attempts
- Excessive coupon validation
- Referral abuse
- Fake account creation
- Coupon sharing
- Automated redemption

Actions

- Block redemption
- Require OTP verification
- Flag account for review

---

# Monitoring Metrics

- Coupon Usage
- Redemption Rate
- Conversion Rate
- Campaign Revenue
- Average Discount
- Failed Validations
- Fraud Attempts
- Coupon Expiry Count
- Campaign ROI

---

# Audit Log

Track

- Coupon Created
- Coupon Updated
- Coupon Activated
- Coupon Paused
- Coupon Redeemed
- Coupon Expired
- Manual Override

Each record contains

- User
- Timestamp
- Coupon Code
- Campaign
- Previous Status
- New Status
- IP Address

---

# Edge Cases

- Coupon expires during payment
- Cart modified after coupon applied
- Product removed from campaign
- Customer logs in after applying coupon
- Multiple browser sessions
- Concurrent coupon redemption
- Partial order cancellation
- Partial refund after coupon usage
- Coupon restored after payment failure

---

# SLA

| Operation | SLA |
|------------|-----|
| Coupon Validation | <100 ms |
| Apply Coupon | <200 ms |
| Redemption | <500 ms |
| Campaign Update | <5 sec |
| API Availability | 99.99% |

---

# Acceptance Criteria

- Coupon validated successfully.
- Eligibility rules enforced.
- Discount calculated correctly.
- Usage limits respected.
- Stackable rules applied.
- Fraud checks executed.
- Coupon redeemed only after payment.
- Kafka events published.
- Audit logs generated.
- Campaign reports updated.

---

# Future Enhancements

- AI-generated personalized coupons
- Dynamic campaign optimization
- Location-based promotions
- Gamified coupon rewards
- QR code coupons
- Affiliate campaign engine
- Multi-brand promotions
- Time-slot-based offers
- Predictive coupon targeting
- Machine Learning campaign optimization

---