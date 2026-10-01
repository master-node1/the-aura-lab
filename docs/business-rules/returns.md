# Returns Business Rules

**Module:** Return Management (RMA)

**Version:** 1.0

**Owner:** Customer Experience & Reverse Logistics Team

---

# Overview

The Return Management Service governs the business policies for accepting, validating, processing, and closing product return requests.

The service determines **whether a product is eligible for return**. It does **not** process refunds directly (handled by the Refund Service).

The Return Service integrates with:

- Order Service
- Inventory Service
- Warehouse Service
- Shipping Service
- Refund Service
- Customer Service
- Notification Service
- Analytics Service

---

# Business Objectives

- Provide a simple customer return experience
- Prevent fraudulent returns
- Minimize reverse logistics costs
- Ensure inventory accuracy
- Automate return decisions where possible
- Improve customer satisfaction
- Maintain complete audit history

---

# Return Types

| Return Type | Description |
|-------------|-------------|
| Standard Return | Customer no longer wants the product |
| Damaged Product | Product damaged during delivery |
| Wrong Product | Incorrect item delivered |
| Defective Product | Manufacturing defect |
| Missing Parts | Accessories/components missing |
| Exchange | Different size/color/model requested |
| Replacement | Same product replacement |

---

# Return Eligibility

A product is eligible only if all applicable conditions are satisfied.

Validate

- Order Delivered
- Return Window Active
- Product Returnable
- Customer Eligible
- Return Limit Not Exceeded
- Product Not Previously Returned
- Fraud Score Acceptable

---

# Return Lifecycle

```text
Delivered

↓

Return Requested

↓

Eligibility Validation

↓

Approved

↓

Pickup Scheduled

↓

Picked Up

↓

Inspection

↓

Accepted

↓

Closed
```

Alternative States

```text
Rejected

Cancelled

Expired

Replacement

Exchange
```

---

# Return Window Rules

| Category | Return Window |
|----------|---------------|
| Electronics | 7 Days |
| Fashion | 30 Days |
| Grocery | Not Returnable |
| Books | 10 Days |
| Furniture | 15 Days |

Return window starts from

```
Delivery Date
```

---

# Non-Returnable Products

Examples

- Gift Cards
- Digital Products
- Downloadable Software
- Perishable Food
- Medicines (where regulations prohibit)
- Customized Products
- Personal Care Products (opened)
- Innerwear (opened)
- Hazardous Goods

These should be configurable by category and region.

---

# Business Rules

## Rule 1

Only delivered orders can be returned.

---

## Rule 2

Returned quantity cannot exceed delivered quantity.

---

## Rule 3

Only products within the return window are eligible.

---

## Rule 4

Products marked as non-returnable must be rejected.

---

## Rule 5

A return request cannot be created after a refund has been completed for the same item.

---

## Rule 6

Exchange and refund cannot be processed simultaneously for the same return item.

---

## Rule 7

Inspection result determines return outcome.

---

## Rule 8

Inventory is updated only after successful inspection.

---

## Rule 9

Manual approval is required for high-value returns (configurable threshold).

---

## Rule 10

All return decisions must be auditable.

---

# Return Reasons

| Code | Reason |
|------|--------|
| DAMAGED | Damaged Product |
| DEFECTIVE | Manufacturing Defect |
| WRONG_ITEM | Wrong Product Delivered |
| MISSING_PARTS | Missing Accessories |
| SIZE_ISSUE | Incorrect Size |
| QUALITY_ISSUE | Poor Quality |
| CHANGED_MIND | Customer Changed Mind |
| OTHER | Other |

---

# Inspection Rules

Inspection validates

- SKU matches order
- Quantity matches
- Serial/IMEI matches (if applicable)
- Product condition
- Accessories included
- Packaging status
- Tamper seals (where applicable)

---

# Inspection Outcomes

| Result | Action |
|----------|--------|
| PASS | Accept Return |
| MINOR_DAMAGE | Partial Refund (configurable) |
| MAJOR_DAMAGE | Reject Return |
| WRONG_PRODUCT | Reject Return |
| MISSING_ACCESSORIES | Partial Refund / Reject |
| FRAUD | Reject & Escalate |

---

# Exchange Rules

Supported when

- Product is exchangeable
- Replacement inventory available
- Exchange window active

Exchange options

- Size
- Color
- Variant

Exchange is not allowed after refund initiation.

---

# Pickup Rules

Pickup scheduling depends on

- Customer location
- Courier availability
- Product category
- Serviceability

Maximum pickup attempts

```
3
```

---

# Return Limits

Example configuration

| Customer Tier | Maximum Returns / Month |
|---------------|-------------------------|
| New | 3 |
| Silver | 5 |
| Gold | 8 |
| Platinum | Unlimited (configurable) |

---

# Fraud Prevention

Detect

- Excessive returns
- High-value repeated returns
- Different product returned
- Serial number mismatch
- Empty box return
- Fake customer accounts
- Return abuse across multiple accounts

Possible actions

- Manual review
- OTP verification
- Block returns
- Suspend account
- Escalate to Risk Team

---

# Reverse Logistics Rules

Warehouse assignment based on

- Customer location
- Product category
- Warehouse capacity
- Inspection capability

Returned inventory states

```text
Returned

↓

Inspection

↓

Available

OR

Damaged

OR

Quarantine
```

---

# APIs

## Create Return

```
POST /returns
```

---

## Get Return

```
GET /returns/{returnId}
```

---

## Cancel Return

```
POST /returns/{returnId}/cancel
```

---

## Schedule Pickup

```
POST /returns/{returnId}/pickup
```

---

## Complete Inspection

```
POST /returns/{returnId}/inspection
```

---

# Database

## Return

| Column | Description |
|----------|------------|
| return_id | UUID |
| order_id | Order Reference |
| customer_id | Customer |
| status | Return Status |
| reason | Return Reason |
| created_at | Timestamp |

---

## Return Item

| Column | Description |
|----------|------------|
| return_item_id | UUID |
| return_id | Parent Return |
| sku | Product SKU |
| quantity | Quantity |
| inspection_result | PASS/FAIL |
| warehouse_id | Processing Warehouse |

---

# Kafka Events

| Topic | Producer | Consumer |
|---------|----------|----------|
| return.requested | Return | Analytics |
| return.approved | Return | Shipping |
| return.picked_up | Shipping | Warehouse |
| return.inspected | Warehouse | Inventory |
| return.accepted | Return | Refund |
| return.rejected | Return | Notification |

---

# Exception Handling

## Return Window Expired

Reject request.

---

## Pickup Failed

Retry according to configured pickup policy.

---

## Customer Unavailable

Reschedule pickup.

---

## Inspection Failed

Reject return and notify customer.

---

## Warehouse Capacity Full

Route to alternate warehouse.

---

# Monitoring Metrics

- Return Request Rate
- Return Approval Rate
- Return Rejection Rate
- Average Pickup Time
- Inspection Time
- Return Cycle Time
- Return Fraud Rate
- Reverse Logistics Cost
- Exchange Rate

---

# Security

- Customer authentication
- Role-based approval
- Audit logging
- Fraud scoring integration
- Immutable return history
- API authentication

---

# Audit Log

Track

- Return Requested
- Return Approved
- Pickup Scheduled
- Pickup Completed
- Inspection Completed
- Return Accepted
- Return Rejected
- Manual Override

Each record includes

- User/System
- Timestamp
- Return ID
- Order ID
- Previous Status
- New Status
- Remarks

---

# Edge Cases

- Partial return from multi-item order
- Multiple return requests for same order
- Product damaged during return transit
- Return created just before window expiry
- Duplicate return requests
- Exchange inventory unavailable
- Wrong product collected by courier
- Customer refuses pickup
- Product recalled after delivery

---

# SLA

| Operation | SLA |
|------------|-----|
| Return Validation | <200 ms |
| Auto Approval | <1 min |
| Pickup Scheduling | <4 hrs |
| Inspection Completion | <24 hrs |
| Return Status Update | Real-time |
| API Availability | 99.99% |

---

# Acceptance Criteria

- Eligible returns are approved.
- Non-returnable items are rejected.
- Inspection rules are enforced.
- Fraud checks are executed.
- Pickup is scheduled successfully.
- Inventory updates occur after inspection.
- Kafka events are published.
- Audit logs are maintained.
- Return lifecycle is fully traceable.

---

# Future Enhancements

- AI-powered return fraud detection
- Computer Vision-based inspection
- QR-code paperless returns
- Self-service return kiosks
- Instant exchange approval
- Predictive return analytics
- Smart reverse logistics optimization
- Sustainability metrics for returned products

---