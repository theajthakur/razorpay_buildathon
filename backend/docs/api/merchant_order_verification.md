# Server-to-Server Merchant Order Verification API

The **Order Verification API** enables merchants to perform a secure server-to-server handshake with ShopAgent after receiving an `order.payment_completed` webhook event. By querying this endpoint, merchants can verify payment capture status, Razorpay payment ID, and order total directly against the platform database before fulfilling orders.

---

## Endpoint Details

- **HTTP Method**: `GET`
- **Paths**:
  - `/merchant/orders/verify`
  - `/api/merchant/orders/verify`

---

## Authentication

All requests must include a valid **ShopAgent API Key** generated from your merchant dashboard (`sk_live_...` or `sk_test_...`).

Pass the API key using either of the following headers:

### Header Format

```http
Authorization: Bearer <YOUR_SHOPAGENT_API_KEY>
```

*or*

```http
X-API-Key: <YOUR_SHOPAGENT_API_KEY>
```

---

## Query Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `merchant_order_id` | `string` | **Yes** | The merchant-side order ID returned during initial order creation. |

---

## Example Request

```http
GET /merchant/orders/verify?merchant_order_id=ORD1234 HTTP/1.1
Host: api.shopagent.com
Authorization: Bearer sk_live_abc123xyz789
Accept: application/json
```

---

## Code Demos

### Node.js / JavaScript (Axios)

```javascript
const axios = require('axios');

async function verifyOrder(merchantOrderId, apiKey) {
  const verifyUrl = 'https://api.shopagent.com/merchant/orders/verify';
  
  try {
    const response = await axios.get(verifyUrl, {
      params: { merchant_order_id: merchantOrderId },
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    console.log('Order Verification Result:', response.data);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(`Verification Failed (${error.response.status}):`, error.response.data);
    } else {
      console.error('Network Error:', error.message);
    }
    throw error;
  }
}
```

### Python (Requests)

```python
import requests

def verify_order(merchant_order_id: str, api_key: str):
    url = "https://api.shopagent.com/merchant/orders/verify"
    headers = {
        "Authorization": f"Bearer {api_key}"
    }
    params = {
        "merchant_order_id": merchant_order_id
    }
    
    response = requests.get(url, headers=headers, params=params)
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Error {response.status_code}: {response.json()}")
        response.raise_for_status()
```

### cURL

```bash
curl -X GET "https://api.shopagent.com/merchant/orders/verify?merchant_order_id=ORD1234" \
  -H "Authorization: Bearer sk_test_TVzSHrm9a8N2Ja" \
  -H "Accept: application/json"
```

---

## Response Specifications

### 200 OK — Successful Verification

```json
{
  "payment": {
    "status": "captured",
    "razorpay_payment_id": "pay_TWi0ng1nT7mDW2"
  },
  "data": {
    "order": {
      "order_total": 500.0
    }
  }
}
```

#### Response Field Definitions

- `payment.status` (`string`): The payment state. Returns `"captured"` for successful payments, or `"awaiting_payment"`, `"failed"`, `"initiated"`.
- `payment.razorpay_payment_id` (`string` | `null`): The Razorpay payment transaction ID (populated once payment is captured).
- `data.order.order_total` (`number`): The verified total price of the order.

---

## Error Responses

### 401 Unauthorized — Invalid or Expired API Key

```json
{
  "detail": "Invalid or missing API Key"
}
```

### 404 Not Found — Order Not Found

Returned if no order matching `merchant_order_id` exists for the authenticated merchant account.

```json
{
  "detail": "order_not_found"
}
```
