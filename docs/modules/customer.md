# Customer Module

**Module:** Customer Service  
**Version:** 1.0  
**Owner:** Customer Experience Team

---

# Business Objective

The Customer Service is responsible for managing the complete customer lifecycle, including profile management, addresses, preferences, communication settings, account status, and customer metadata.

It acts as the single source of truth for customer information across the platform and enables personalized shopping experiences while ensuring secure and compliant management of customer data.

The service integrates with:

- Authentication Service
- Order Service
- Cart Service
- Wishlist Service
- Review Service
- Notification Service
- Loyalty Service
- Analytics Service
- Recommendation Service

---

# Features

- Customer Registration
- Customer Profile Management
- Address Management
- Contact Information Management
- Communication Preferences
- Account Status Management
- Customer Preferences
- Wishlist Association
- Loyalty Membership
- Profile Picture Management
- Account Verification
- Account Deactivation
- Customer Search
- Customer Activity Tracking
- GDPR/Data Privacy Support

---

# Functional Requirements

1. Allow customers to create and maintain their profiles.
2. Support multiple shipping and billing addresses.
3. Allow customers to update contact information.
4. Store customer preferences such as language and currency.
5. Support account verification using email and mobile.
6. Maintain customer account status (Active, Blocked, Suspended, Deleted).
7. Track customer registration date and last login.
8. Allow profile picture upload.
9. Support customer search by administrators.
10. Allow customers to manage communication preferences.
11. Integrate customer information with loyalty and rewards.
12. Publish customer events for downstream services.

---

# Business Rules

- Every customer must have a unique Customer ID.
- Email addresses must be unique.
- Mobile numbers must be unique.
- A customer account must be linked to an Authentication account.
- A customer may have multiple addresses.
- Only one address can be marked as the default shipping address.
- Only one address can be marked as the default billing address.
- Soft delete should be used instead of permanently deleting customer data unless regulatory policies require otherwise.
- Customer profile changes must be audit logged.
- Blocked or suspended customers cannot place new orders.
- Customer communication preferences must be respected.
- Personally Identifiable Information (PII) must be stored securely and encrypted where required.

---

# APIs

## Customer

- `POST /customers`
- `GET /customers/{customerId}`
- `PUT /customers/{customerId}`
- `DELETE /customers/{customerId}`

## Profile

- `GET /customers/profile`
- `PUT /customers/profile`

## Address

- `POST /customers/{customerId}/addresses`
- `GET /customers/{customerId}/addresses`
- `PUT /customers/{customerId}/addresses/{addressId}`
- `DELETE /customers/{customerId}/addresses/{addressId}`

## Preferences

- `GET /customers/{customerId}/preferences`
- `PUT /customers/{customerId}/preferences`

---

# Events

## Publishes

- `customer.created`
- `customer.updated`
- `customer.deleted`
- `customer.verified`
- `customer.suspended`
- `customer.reactivated`
- `customer.address.created`
- `customer.address.updated`
- `customer.preferences.updated`

## Consumes

- `user.registered`
- `user.email_verified`
- `user.mobile_verified`
- `order.completed`
- `loyalty.points.updated`
- `account.disabled`

---

# Edge Cases

- Duplicate email registration
- Duplicate mobile number
- Invalid address format
- Missing mandatory profile fields
- Attempt to delete default address
- Customer updates profile during active checkout
- Concurrent profile updates
- Customer account merged with another account
- Soft-deleted customer attempting login
- Communication preference conflicts
- Profile update during service outage
- Invalid country or postal code

---

# Acceptance Criteria

- [ ] Customers can create and manage profiles.
- [ ] Multiple addresses are supported.
- [ ] Only one default shipping address exists.
- [ ] Only one default billing address exists.
- [ ] Customer profile updates are persisted successfully.
- [ ] Customer preferences are configurable.
- [ ] Customer events are published successfully.
- [ ] Audit logs are generated for profile changes.
- [ ] Customer account status is enforced correctly.
- [ ] Customer data is securely stored and protected.
- [ ] APIs return appropriate HTTP status codes.
- [ ] Business objectives are fully satisfied.