---
title: Hotel API
description: Endpoints, filters, pagination and rating behavior of the hotel management API.
---

The hotel management API exposes the administrative CRUD of the hotels and the ratings of the signed-in accounts (ADR-013). Every route requires a valid access token, and the session behind the token must still be open.

## Endpoints

| Method | Route | Policy | Success | Failures |
|---|---|---|---|---|
| `GET` | `/api/hotels` | `hotels.read` | `200` with a page of hotels | `400` invalid query, `401` missing or invalid token |
| `GET` | `/api/hotels/{id}` | `hotels.read` | `200` with the hotel | `404` unknown hotel, `401` missing or invalid token |
| `POST` | `/api/hotels` | `hotels.create` | `201` with the created hotel | `400` invalid input, `403` the role cannot write, `401` missing or invalid token |
| `PUT` | `/api/hotels/{id}` | `hotels.update` | `200` with the updated hotel | `400` invalid input, `404` unknown hotel, `403` the role cannot write, `401` missing or invalid token |
| `DELETE` | `/api/hotels/{id}` | `hotels.delete` | `204` | `404` unknown hotel, `403` the role cannot write, `401` missing or invalid token |
| `POST` | `/api/hotels/{id}/ratings` | `hotels.rate` | `200` with the rating summary | `400` score outside 1 to 5, `404` unknown hotel, `401` missing or invalid token |
| `PUT` | `/api/hotels/{id}/image` | `hotels.update` | `200` with the image metadata | `400`, `413`, `415`, `422` rejected image, `404` unknown hotel, `403`, `401` |
| `GET` | `/api/hotels/{id}/image` | `hotels.read` | `200` with the image bytes | `404` unknown hotel or no image, `401` |
| `DELETE` | `/api/hotels/{id}/image` | `hotels.update` | `204` | `404` unknown hotel or no image, `403`, `401` |

The three image routes are described in [Hotel images](hotel-images.md).
A rejected write never changes the stored data: a `401` or a `403` answer leaves the hotel exactly as it was.

## Listing

| Parameter | Type | Default | Behavior |
|---|---|---|---|
| `name` | string | None | Case-insensitive contains over the hotel name. The wildcard characters of the input are matched literally. |
| `minRating` | decimal | None | Keeps the hotels whose average rating is at least the value. Hotels without votes never match. |
| `page` | integer | `1` | One-based page number. |
| `pageSize` | integer | `20` | Between 1 and 100. |

A `pageSize` outside the accepted range, a `page` below one, or a `minRating` outside the inclusive 1 to 5 is answered with `400`.

The response carries the items, the page, the page size, the total number of matching hotels and the total number of pages. The order is the creation timestamp and then the identifier, so the pages are deterministic.

```json
{
  "items": [
    {
      "id": "0198f2c1-4f7a-7c1e-9a0b-1d2e3f4a5b6c",
      "name": "Grand Plaza",
      "description": "Seafront hotel",
      "address": {
        "street": "1 Main Street",
        "city": "Lisbon",
        "region": "Lisboa",
        "country": "Portugal",
        "postalCode": "1000-001"
      },
      "contact": {
        "phone": "+351123456789",
        "email": "info@grandplaza.test",
        "website": "https://grandplaza.test"
      },
      "isActive": true,
      "createdAtUtc": "2026-10-23T12:00:00Z",
      "updatedAtUtc": "2026-10-23T12:00:00Z",
      "rating": { "sum": 9.0, "count": 2, "average": 4.5 },
      "image": { "contentType": "image/webp", "width": 1280, "height": 720, "sizeBytes": 211873 }
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalItems": 1,
  "totalPages": 1
}
```

A hotel without an image reports `"image": null`. The `image` property is the only addition to the hotel response; the create and update bodies stay the same.

## Writing a hotel

The create and update bodies carry the descriptive values. The name is the only mandatory one.

```json
{
  "name": "Grand Plaza",
  "description": "Seafront hotel",
  "street": "1 Main Street",
  "city": "Lisbon",
  "region": "Lisboa",
  "country": "Portugal",
  "postalCode": "1000-001",
  "phone": "+351123456789",
  "email": "info@grandplaza.test",
  "website": "https://grandplaza.test"
}
```

An invalid value is answered with `400` and the failing field, the same way the authentication endpoints answer an invalid registration. The domain rules own the limits: the name is required, the optional texts are trimmed and bounded, the email must be well formed, and the phone and the website must keep their format.

The hotel keeps its creation timestamp when it is updated, and the update timestamp moves to the moment of the update. Updating the details never changes the image of the hotel.

## Rating

The body carries the score and nothing else. The account that rates is the subject of the validated token, never a value of the request.

```json
{ "score": 4.5 }
```

The score is a decimal between 1 and 5, both included. A score outside that range is answered with `400` and no vote is stored.

One account has one rating per hotel. Rating again replaces the previous value: the average moves and the count does not grow. The answer carries the summary of the hotel after the write, with the sum, the count and the average. A hotel without votes reports a count of zero and a null average.

## Policies

| Policy | `Administrator` | `User` |
|---|---|---|
| `hotels.read` | Allowed | Allowed |
| `hotels.rate` | Allowed | Allowed |
| `hotels.create` | Allowed | Forbidden |
| `hotels.update` | Allowed | Forbidden |
| `hotels.delete` | Allowed | Forbidden |

The four hotel permissions come from the API skill and cover the administrative CRUD. The rating has its own named policy because rating is an action of an account over a hotel and not an administrative change of it. No dynamic permission management exists: the five policies are static.

A request without a valid token returns `401`. A request with a valid token that lacks the policy returns `403`. Neither changes stored data.
