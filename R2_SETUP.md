# Cloudflare R2 setup for Finwise transaction attachments

## 1. Create a private bucket
1. Open Cloudflare Dashboard → R2 Object Storage.
2. Create a bucket, for example `finwise-transaction-attachments`.
3. Keep the bucket private. Do not enable public access for financial receipts.
4. Create an R2 API token with Object Read & Write access limited to this bucket.
5. Copy the Account ID, Access Key ID, and Secret Access Key. The secret is shown only once.

## 2. Configure environment
Copy the variables from `.env.r2.example` into `.env.local` (or your deployment environment):

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

Do not commit `.env.local` or expose these values in client-side code. Restart Next.js after setting them.

## 3. Install dependencies and run

```bash
bun install
bun run dev
```

## Current behavior / important note
- The receipt scan flow keeps the selected image/PDF and uploads it to R2 when the transaction is saved.
- You can also attach an image/PDF manually in the transaction form.
- Files are private. API `GET /api/transaction-attachments?key=...` returns a short-lived signed URL for the authenticated owner.
- The attachment key is currently stored with the transaction in the browser's local Dexie database, because this project's transaction form currently saves transactions locally. The R2 file itself is in cloud storage, but the transaction metadata/key will not automatically appear on another device until the app's transaction sync is connected. Do not delete the browser data until that sync is implemented.
- Uploaded files can become orphaned if the user uploads successfully but the transaction save subsequently fails. A cleanup process can be added later.
