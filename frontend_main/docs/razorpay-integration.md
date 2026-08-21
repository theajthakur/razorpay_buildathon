# Razorpay Integration Documentation

This document summarizes the current mock state and the future production architecture requirements to connect merchant Razorpay accounts with the conversational shopping agent platform.

## Current Setup (IFSC Lookup Integration)

In the `/onboarding` step, the merchant provides:
1. **Bank Account Number**
2. **IFSC Code** (e.g., `HDFC0000261`)

When a user completes the 11-digit IFSC code, the app makes an HTTP request to Razorpay's public bank validation API:
```
GET https://ifsc.razorpay.com/{IFSC}
```
Response data automatically resolves to display the Bank Name (`data.BANK`) and Branch Name (`data.BRANCH`). The step validation succeeds and unlocks navigation only if the IFSC code is successfully resolved.

---

## Production Integration Plan

To implement the real Razorpay payment link generation and merchant deposit splits, the following production backend wiring is required:

### 1. OAuth Onboarding Route (`/api/razorpay/connect`)
Instead of faking client-side state, this endpoint will redirect merchants to Razorpay Route / OAuth login URL:
```
https://easy-link.razorpay.com/v1/oauth/authorize?client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}&response_type=code
```
Upon successful login, Razorpay redirects back with an authorization `code`. The server must exchange this code for access tokens:
- **POST** `https://api.razorpay.com/v1/oauth/token`
- Retrieve `razorpay_user_id` (the merchant account ID) and the access/refresh token pair.

### 2. Secure Secret Storage
Store access tokens securely in the database:
- **Encrypt** tokens using AES-256 before storage in the database.
- Scope backend database access so only the checkout runtime worker can retrieve token credentials.

### 3. Dynamic Payment Link Creation
When a customer checkout session is completed in `frontend_agent`:
1. The common-backend calls Razorpay API:
   - **POST** `https://api.razorpay.com/v1/payment_links`
2. Authenticate the call using the merchant's stored OAuth token or Razorpay Route split credentials (split payouts).
3. Specify parameters:
   ```json
   {
     "amount": 149900,
     "currency": "INR",
     "accept_partial": false,
     "first_min_partial_amount": 0,
     "reference_id": "order_agent_92819",
     "description": "Payment for order via AI Assistant",
     "customer": {
       "name": "Amit Sharma",
       "email": "amit@sharma.com",
       "contact": "+919999999999"
     },
     "notify": {
       "sms": true,
       "email": true
     },
     "reminder_enable": true
   }
   ```
4. Return the generated `payment_link_url` to the customer chatbot UI.

### 4. Razorpay Webhooks
Configure webhooks to listen for:
- `payment_link.paid`: Mark order status as paid in `orders` database and notify customer via agent UI.
- `payment_link.cancelled`: Cancel reservation on products catalog inventory.
