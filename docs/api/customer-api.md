# Customer API

Base path: `/api/customer`

Customer and address identifiers are UUIDs. The service uses PostgreSQL and runs its Prisma migrations on container startup. Email addresses are normalized to lowercase; mobile numbers are unique when supplied.

## Customers

| Method | Path | Behavior |
| --- | --- | --- |
| `POST` | `/customers` | Create a profile linked to an `identityId`. |
| `GET` | `/customers` | Search profiles using `q`, `status`, `page`, and `pageSize` (maximum 100). |
| `GET` | `/customers/{customerId}` | Get a profile with addresses and preferences. |
| `PUT` | `/customers/{customerId}` | Update profile fields. |
| `DELETE` | `/customers/{customerId}` | Soft-delete the profile and set status to `DELETED`. |
| `PATCH` | `/customers/{customerId}/status` | Set status to `ACTIVE`, `BLOCKED`, or `SUSPENDED`. |
| `GET` | `/customers/profile` | Get the profile matching the `x-identity-id` request header. |
| `PUT` | `/customers/profile` | Update the profile matching the `x-identity-id` request header. |

`POST /customers` requires `identityId`, `email`, `firstName`, and `lastName`. Duplicate identity, email, or mobile values return `409 Conflict`. Deleted profiles are excluded from reads and search.

## Addresses

| Method | Path | Behavior |
| --- | --- | --- |
| `POST` | `/customers/{customerId}/addresses` | Add an address. |
| `GET` | `/customers/{customerId}/addresses` | List addresses with defaults first. |
| `PUT` | `/customers/{customerId}/addresses/{addressId}` | Update an address. |
| `DELETE` | `/customers/{customerId}/addresses/{addressId}` | Delete a non-default address. |

Setting an address as the default shipping or billing address clears that default from other addresses in the same transaction. A default address cannot be deleted until another address is selected.

## Preferences

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/customers/{customerId}/preferences` | Read communication and locale preferences. |
| `PUT` | `/customers/{customerId}/preferences` | Create or update preferences. |

## Audit and events

Mutations write an audit record and a customer event outbox row in the same database transaction. Event types include `customer.created`, `customer.updated`, `customer.deleted`, `customer.suspended`, `customer.reactivated`, `customer.address.created`, `customer.address.updated`, `customer.address.deleted`, and `customer.preferences.updated`.

No Kafka relay is configured in this repository yet. A relay must publish pending `customer_events` rows and set `published_at` before events reach downstream services. The profile endpoints require a trusted caller to authenticate the request and set `x-identity-id`; the current Nginx gateway does not validate JWTs.
