# Ticket screens say where a ticket really is (copy only)

Why: `my_tickets_v1` returns only orders with `buyer_user_id` = the caller; a guest order is never linked by email. So "in My tickets" is false for any order not bought while signed in. No linking is added here (needs a database and privacy decision).

## Chosen wording (one shared object, `TICKET_WHERE` in `myTicketsModel.ts`)
- Thank-you, zero tickets: "Your tickets are in your email."
- Thank-you, read failed: "We couldn't load your door codes just now. Your tickets are in your email. You can also try My tickets in a minute." (My tickets is a 44px link.)
- Checkout, signed out only, under the email field: "You are not signed in, so your tickets come by email only. Sign in first to keep them in My tickets." plus a 44px Sign in link back to the same path and query.

## Rejected
- Keep "in your email, and in My tickets" everywhere: false for guest orders; the link lands on "No tickets yet".
- Hide the checkout note and only reword the email label: guests still learn it only after paying; no way to sign in first.
