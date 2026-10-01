# Pricing Business Rules

**Module:** Pricing Engine

**Version:** 1.0

**Owner:** Pricing Team

---

# Overview

The Pricing Engine is responsible for calculating the final price payable by a customer for a product or order.

It centralizes all pricing logic including:

- Product Price
- Dynamic Pricing
- Sale Price
- Product Discounts
- Coupons
- Wallet
- Loyalty Points
- Shipping Charges
- Taxes
- Platform Fees

The Pricing Service acts as the single source of truth for pricing calculations across all channels (Web, Mobile, APIs).

---

# Business Objectives

- Provide consistent pricing across all channels.
- Prevent pricing discrepancies.
- Support promotional campaigns.
- Support dynamic pricing.
- Enable pricing personalization.
- Ensure tax compliance.
- Maintain pricing history.

---

# Pricing Components

The final payable amount consists of the following components.

```text
MRP

↓

Product Discount

↓

Sale Price

↓

Coupon Discount

↓

Wallet

↓

Gift Card

↓

Reward Points

↓

Shipping Charges

↓

Platform Fee

↓

GST

↓

Final Payable Amount
```

---

# Price Definitions

| Term | Description |
|----------|------------|
| MRP | Manufacturer Retail Price |
| Selling Price | Base selling price |
| Product Discount | Discount on product |
| Coupon Discount | Promotional discount |
| Wallet Discount | Wallet deduction |
| Gift Card | Gift voucher |
| Reward Points | Loyalty deduction |
| Shipping | Delivery charge |
| Platform Fee | Service charge |
| GST | Government Tax |
| Final Price | Amount customer pays |

---

# Pricing Formula

```
Final Price

=

Selling Price

-

Product Discount

-

Coupon Discount

-

Wallet Amount

-

Gift Card

-

Reward Points

+

Shipping Charge

+

Platform Fee

+

GST
```

---

# Pricing Priority

The Pricing Engine must apply pricing in the following order.

```
MRP

↓

Product Price

↓

Flash Sale

↓

Category Discount

↓

Brand Discount

↓

Coupon

↓

Wallet

↓

Gift Card

↓

Reward Points

↓

Shipping

↓

Platform Fee

↓

Tax
```

---

# Pricing Rules

## Rule 1

Selling Price must always be less than or equal to MRP.

```
Selling Price <= MRP
```

---

## Rule 2

Price cannot become negative.

Minimum

```
₹0
```

---

## Rule 3

Only one product price exists at a time.

---

## Rule 4

Product Discount is applied before Coupon Discount.

---

## Rule 5

Coupons are calculated after product discounts.

---

## Rule 6

Shipping charges are calculated after discounts.

---

## Rule 7

GST is calculated on the taxable amount after applicable discounts, in accordance with local tax regulations.

---

## Rule 8

Wallet cannot exceed payable amount.

---

## Rule 9

Reward Points cannot exceed configured limit.

Example

```
Maximum

20%

of Order Value
```

---

## Rule 10

Platform Fee is configurable.

---

# Dynamic Pricing

Dynamic pricing allows the selling price to change based on business conditions.

Factors

- Demand
- Inventory
- Flash Sale
- Festival
- Customer Segment
- Region
- Time of Day

Example

```
Weekend Sale

10%

Discount
```

---

# Customer Segments

Pricing may vary based on customer category.

| Customer | Discount |
|------------|------------|
| New Customer | 5% |
| Silver | 2% |
| Gold | 5% |
| Platinum | 10% |

---

# Shipping Rules

| Order Value | Shipping |
|---------------|-------------|
| < ₹499 | ₹50 |
| ₹499 - ₹999 | ₹20 |
| >= ₹1000 | FREE |

---

# Platform Fee

Example

| Category | Fee |
|------------|-------|
| Grocery | ₹2 |
| Electronics | ₹10 |
| Fashion | ₹5 |

---

# Tax Rules

Example

| Category | GST |
|-------------|-------|
| Electronics | 18% |
| Grocery | 5% |
| Books | 0% |
| Clothing | 12% |

Taxes should be configurable by country, state, and product category.

---

# Pricing Decision Matrix

| Scenario | Product Discount | Coupon | Wallet | Shipping | GST |
|------------|-----------------|---------|---------|-----------|------|
| Normal Purchase | ✅ | ❌ | ❌ | ✅ | ✅ |
| Sale | ✅ | ✅ | ❌ | ✅ | ✅ |
| Premium Customer | ✅ | ✅ | ✅ | FREE | ✅ |
| Gift Card | ✅ | ❌ | Gift Card | ✅ | ✅ |

---

# APIs

## Calculate Price

```
POST /pricing/calculate
```

---

## Get Product Price

```
GET /pricing/products/{productId}
```

---

## Validate Pricing

```
POST /pricing/validate
```

---

## Get Shipping Cost

```
GET /pricing/shipping
```

---

## Get Tax

```
GET /pricing/tax
```

---

# Database

## Product Price

| Column | Description |
|----------|------------|
| price_id | UUID |
| product_id | Product |
| selling_price | Selling Price |
| mrp | MRP |
| currency | Currency |
| effective_from | Start Date |
| effective_to | End Date |

---

## Price History

Store every price change.

Columns

- Previous Price
- New Price
- Changed By
- Changed At
- Reason

---

# Kafka Events

| Topic | Producer | Consumer |
|----------|----------|----------|
| pricing.updated | Pricing | Catalog |
| price.changed | Pricing | Search |
| flashsale.started | Campaign | Pricing |
| flashsale.ended | Campaign | Pricing |

---

# Validation Rules

Reject request when

- Price < 0
- MRP < Selling Price
- Invalid Currency
- Expired Price
- Duplicate Price Entry
- Missing Product

---

# Edge Cases

- Price changes while customer is in checkout
- Coupon expires during payment
- Flash sale ends before payment completion
- Product moved to another category
- Tax changes at midnight
- Shipping charge changes during checkout
- Currency conversion issues
- Multiple pricing rules match the same product

---

# Monitoring Metrics

- Average Selling Price
- Discount Percentage
- Flash Sale Revenue
- Coupon Usage
- Pricing API Latency
- Pricing Errors
- Shipping Revenue
- Tax Collected
- Platform Fee Revenue

---

# Audit Log

Capture

- Price Created
- Price Updated
- Price Deleted
- Flash Sale Started
- Flash Sale Ended
- Manual Price Override

Each audit record contains

- User
- Timestamp
- Product ID
- Previous Price
- New Price
- Reason

---

# Security

- RBAC for pricing updates
- Approval workflow for high-impact price changes
- Immutable price history
- Audit logging
- API authentication
- Rate limiting

---

# SLA

| Operation | SLA |
|------------|------|
| Price Calculation | <100 ms |
| Product Price Lookup | <50 ms |
| Shipping Calculation | <100 ms |
| Tax Calculation | <100 ms |
| Pricing API Availability | 99.99% |

---

# Acceptance Criteria

- Correct price calculated for every order.
- Product discounts applied correctly.
- Coupons applied according to policy.
- Wallet and gift cards deducted correctly.
- Shipping charges calculated accurately.
- Taxes calculated correctly.
- Price history maintained.
- Audit logs generated.
- Pricing events published.
- Same pricing returned across all channels.

---

# Future Enhancements

- AI-based dynamic pricing
- Competitor price matching
- Geo-based pricing
- Personalized pricing
- Surge pricing
- Subscription pricing
- Marketplace seller pricing
- Multi-currency pricing
- B2B pricing tiers
- Machine learning price optimization

---