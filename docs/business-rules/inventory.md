# Inventory Business Rules

**Module:** Inventory Management

**Version:** 1.0

**Owner:** Supply Chain & Inventory Team

---

# Overview

The Inventory Service is the single source of truth for product stock across all warehouses, fulfillment centers, dark stores, and retail locations.

The service is responsible for:

- Maintaining stock levels
- Reserving inventory
- Releasing reservations
- Deducting stock after fulfillment
- Handling damaged inventory
- Managing returned inventory
- Preventing overselling
- Supporting multi-warehouse inventory

The Inventory Service integrates with:

- Product Catalog Service
- Cart Service
- Checkout Service
- Order Service
- Warehouse Service
- Shipping Service
- Return Service
- Analytics Service

---

# Business Objectives

- Prevent overselling
- Maintain inventory accuracy
- Support real-time inventory visibility
- Optimize stock allocation
- Enable multi-warehouse fulfillment
- Minimize stock loss
- Improve inventory turnover

---

# Inventory Types

| Inventory Type | Description |
|----------------|-------------|
| On Hand | Physical stock available |
| Available | Sellable stock |
| Reserved | Reserved for active orders |
| In Transit | Moving between warehouses |
| Damaged | Unsellable stock |
| Returned | Returned awaiting inspection |
| Quarantine | Held for investigation |
| Lost | Missing inventory |
| Blocked | Reserved for business reasons |

---

# Inventory Formula

```
Available Inventory

=

On Hand Inventory

-

Reserved Inventory

-

Blocked Inventory

-

Damaged Inventory
```

---

# Inventory Lifecycle

```text
Stock Received

↓

Available

↓

Reserved

↓

Picked

↓

Packed

↓

Shipped

↓

Delivered
```

Alternative flows

```text
Reservation Released

Returned

Damaged

Lost

Transferred

Adjusted
```

---

# Stock States

| State | Description |
|---------|------------|
| AVAILABLE | Sellable |
| RESERVED | Allocated to order |
| PICKED | Picked by warehouse |
| PACKED | Packed |
| SHIPPED | Dispatched |
| RETURNED | Returned |
| DAMAGED | Unsellable |
| LOST | Missing |
| BLOCKED | Business hold |

---

# Business Rules

## Rule 1

Inventory cannot become negative.

```
Available >= 0
```

---

## Rule 2

Every reservation must reference an Order ID.

---

## Rule 3

Only AVAILABLE inventory can be reserved.

---

## Rule 4

Inventory is deducted only after shipment confirmation.

---

## Rule 5

Cancelled orders release reserved inventory immediately.

---

## Rule 6

Failed payments release inventory automatically.

---

## Rule 7

Returned inventory must pass inspection before becoming AVAILABLE.

---

## Rule 8

Damaged inventory cannot be sold.

---

## Rule 9

Inventory transfers must maintain quantity consistency.

```
Source - X

=

Destination + X
```

---

## Rule 10

Manual stock adjustments require approval and audit logging.

---

# Inventory Reservation Rules

Reservation occurs when

- Checkout initiated
- Order confirmed
- Payment authorized (configurable)

Reservation expires after configurable timeout.

Example

```
15 Minutes
```

Expired reservations are released automatically.

---

# Reservation Priority

```text
Express Orders

↓

Prepaid Orders

↓

Standard Orders

↓

Cash on Delivery
```

---

# Multi-Warehouse Allocation Rules

Allocation priority

```text
Nearest Warehouse

↓

Warehouse with Inventory

↓

Lowest Shipping Cost

↓

Highest Inventory

↓

Split Shipment (if enabled)
```

Factors considered

- Stock availability
- Delivery SLA
- Shipping cost
- Warehouse capacity
- Seller preference

---

# Stock Movement Types

| Movement | Description |
|----------|-------------|
| Purchase Receipt | Supplier stock received |
| Reservation | Stock reserved |
| Release | Reservation removed |
| Shipment | Stock deducted |
| Return | Stock received back |
| Damage | Marked damaged |
| Transfer | Warehouse transfer |
| Adjustment | Manual correction |
| Cycle Count | Inventory verification |

---

# Inventory Validation Rules

Before reservation

Validate

- Product Exists
- SKU Active
- Warehouse Active
- Available Quantity
- Product Sellable
- Inventory Not Locked

Reject if

- Quantity unavailable
- Warehouse offline
- SKU discontinued
- Product recalled

---

# Low Stock Rules

Default thresholds

| Available Quantity | Status |
|--------------------|--------|
| >100 | Healthy |
| 21–100 | Medium |
| 6–20 | Low Stock |
| ≤5 | Critical |
| 0 | Out of Stock |

Thresholds should be configurable per SKU.

---

# Safety Stock

Safety stock is reserved inventory that cannot be sold.

Formula

```
Available Inventory

=

Physical Stock

-

Safety Stock
```

Example

```
Physical

100

Safety

10

Available

90
```

---

# Inventory Adjustment Rules

Allowed reasons

- Physical Count
- Damage
- Theft
- Expired Product
- Supplier Correction
- Warehouse Error
- System Correction

Every adjustment requires

- Reason
- User
- Approval (if configured)
- Audit Record

---

# Inventory Transfer Rules

Warehouse A

↓

Transfer Request

↓

Shipment

↓

Transit

↓

Warehouse B

↓

Available

Rules

- Destination warehouse must exist.
- Source inventory must be sufficient.
- Inventory remains IN_TRANSIT until receipt.
- Failed transfers trigger reconciliation.

---

# APIs

## Get Inventory

```
GET /inventory/{sku}
```

---

## Reserve Inventory

```
POST /inventory/reservations
```

---

## Release Reservation

```
DELETE /inventory/reservations/{reservationId}
```

---

## Adjust Inventory

```
POST /inventory/adjustments
```

---

## Transfer Inventory

```
POST /inventory/transfers
```

---

## Inventory History

```
GET /inventory/{sku}/history
```

---

# Database

## Inventory

| Column | Description |
|----------|------------|
| inventory_id | UUID |
| sku | Product SKU |
| warehouse_id | Warehouse |
| on_hand | Physical Stock |
| available | Sellable Stock |
| reserved | Reserved Stock |
| damaged | Damaged Stock |
| updated_at | Timestamp |

---

## Reservation

| Column | Description |
|----------|------------|
| reservation_id | UUID |
| order_id | Order |
| sku | Product SKU |
| quantity | Reserved Quantity |
| expires_at | Expiration Time |

---

## Inventory Movement

| Column | Description |
|----------|------------|
| movement_id | UUID |
| movement_type | Reservation, Shipment, Return, etc. |
| sku | Product SKU |
| quantity | Quantity |
| warehouse_id | Warehouse |
| reference_id | Order/Transfer ID |
| created_at | Timestamp |

---

# Kafka Events

| Topic | Producer | Consumer |
|---------|----------|----------|
| inventory.reserved | Inventory | Order |
| inventory.released | Inventory | Cart |
| inventory.updated | Inventory | Catalog |
| inventory.low_stock | Inventory | Notification |
| inventory.out_of_stock | Inventory | Catalog |
| inventory.adjusted | Inventory | Analytics |
| inventory.transferred | Inventory | Warehouse |
| inventory.returned | Return | Inventory |

---

# Exception Handling

## Reservation Timeout

Automatically release stock.

---

## Oversell Attempt

Reject reservation.

Return

```
OUT_OF_STOCK
```

---

## Warehouse Offline

Allocate from alternate warehouse.

---

## Duplicate Reservation

Ignore duplicate request using idempotency key.

---

## Transfer Failure

Rollback transfer.

Raise reconciliation task.

---

# Monitoring Metrics

- Available Inventory
- Reserved Inventory
- Inventory Accuracy
- Stock Turnover
- Reservation Success Rate
- Reservation Timeout Rate
- Inventory Adjustments
- Warehouse Utilization
- Low Stock Count
- Out of Stock Count

---

# Security

- RBAC for stock adjustments
- Approval workflow for manual corrections
- Immutable inventory movement history
- API authentication
- Audit logging
- Idempotent inventory operations

---

# Audit Log

Track

- Inventory Created
- Reservation Created
- Reservation Released
- Inventory Adjusted
- Inventory Transferred
- Inventory Received
- Inventory Shipped
- Inventory Returned
- Manual Override

Each record contains

- User
- Timestamp
- Warehouse ID
- SKU
- Previous Quantity
- New Quantity
- Movement Type
- Reason

---

# Edge Cases

- Simultaneous reservations for last item
- Payment succeeds after reservation timeout
- Duplicate shipment notification
- Partial shipment
- Partial cancellation
- Multi-warehouse fulfillment
- Warehouse closed during allocation
- Inventory mismatch after physical count
- Returned item fails inspection
- Supplier recalls product after reservation

---

# SLA

| Operation | SLA |
|------------|-----|
| Inventory Lookup | <50 ms |
| Reservation | <100 ms |
| Release Reservation | <100 ms |
| Inventory Update | <200 ms |
| Stock Transfer | <5 sec |
| Inventory Event Publication | <1 sec |

---

# Acceptance Criteria

- Inventory never becomes negative.
- Reservations created atomically.
- Expired reservations released automatically.
- Stock deducted only after shipment.
- Returns processed correctly.
- Multi-warehouse allocation works as configured.
- Inventory events published.
- Inventory history maintained.
- Audit logs generated.
- Reconciliation discrepancies are traceable.

---

# Future Enhancements

- AI demand forecasting
- Automatic replenishment
- Vendor Managed Inventory (VMI)
- Predictive stock allocation
- IoT/RFID-enabled inventory tracking
- Digital twin warehouses
- Real-time shelf visibility
- ML-based safety stock optimization
- Cross-region inventory optimization
- Autonomous warehouse integration

---