# Production Integration Checklist

## DNS Setup
- [x] In Vercel → Project Settings → Domains → add your custom domain
- [x] Copy the CNAME record Vercel provides (e.g. `cname.vercel-dns.com`)
- [x] In Cloudflare DNS → add that CNAME record
- [x] Set Cloudflare proxy to **DNS only (grey cloud)** — do NOT use the orange proxy cloud or SSL will break

---

## Vercel Environment Variables
Set all of these in **Vercel → Project Settings → Environment Variables**.

### Database (NeonDB)
- [x] `DATABASE_URL` — pooled connection string (auto-populated by Neon integration, verify it's set)
- [x] `DATABASE_URL_UNPOOLED` — direct connection for migrations (check Neon dashboard → Connection Details)

### Auth
- [x] `NEXTAUTH_SECRET` — generate: `openssl rand -base64 32`
- [x] `NEXTAUTH_URL` — `https://your-domain.com`
- [x] `GOOGLE_CLIENT_ID`
- [x] `GOOGLE_CLIENT_SECRET`

### Redis (Upstash via Vercel marketplace)
- [x] `UPSTASH_REDIS_URL` — auto-populated by Upstash integration, verify it's set (the app checks this first)
- [x] `REDIS_URL` — fallback if not using Upstash

### Storage (Cloudflare R2)
- [x] `STORAGE_MODE` = `r2`
- [x] `R2_BUCKET_NAME`
- [x] `R2_REGION` = `auto`
- [x] `R2_ACCESS_KEY_ID` — from Cloudflare → R2 → Manage API Tokens
- [x] `R2_SECRET_ACCESS_KEY` — from the same token
- [x] `R2_ENDPOINT` = `https://<account_id>.r2.cloudflarestorage.com`
- [ ] `R2_PUBLIC_URL_BASE` — public URL for the bucket (e.g. `https://pub-<hash>.r2.dev` or custom domain)

### Services
- [x] `TTS_SERVICE_URL` = `https://api.runpod.ai/v2/<ENDPOINT_ID>/run`
- [ ] `TTS_SERVICE_TOKEN` — shared secret for TTS auth (must match RunPod worker env)
- [ ] `CHAT_SYSTEM_URL` — URL where Chat service is deployed
- [ ] `CHAT_SERVICE_SECRET` — shared secret for UI → Chat auth

### Stripe
- [ ] `STRIPE_SECRET_KEY` = `sk_live_...` (note: NOT `STRIPE_ADMIN` — that var name is wrong in `.env.example`)
- [ ] `STRIPE_WEBHOOK_SECRET` = `whsec_...` — from Stripe webhook setup

### Email
- [ ] `RESEND_API_KEY`

### Security / Misc
- [ ] `ENCRYPTION_KEY` — generate: `openssl rand -hex 32`
- [ ] `APP_KEY` — check how the app uses this and generate a matching secret
- [ ] `NODE_ENV` = `production`

---

## Cloudflare R2 Setup
- [ ] Cloudflare dashboard → R2 → Manage API Tokens → create token with **Object Read & Write** scoped to your bucket
- [ ] Copy Access Key ID → `R2_ACCESS_KEY_ID`
- [ ] Copy Secret Access Key → `R2_SECRET_ACCESS_KEY`
- [ ] Decide on public access: enable public bucket (get `pub-*.r2.dev` URL) or add a custom domain to the R2 bucket
- [ ] Set `R2_PUBLIC_URL_BASE` to whichever public URL you chose

---

## RunPod TTS
- [ ] Get your Endpoint ID from RunPod dashboard (Serverless → your endpoint)
- [ ] Set `TTS_SERVICE_URL` = `https://api.runpod.ai/v2/<ENDPOINT_ID>/run`
- [ ] Set `TTS_SERVICE_TOKEN` in Vercel AND in the RunPod worker environment (same value)
- [ ] Verify the RunPod worker is deployed and the endpoint is active

---

## Google OAuth
- [ ] Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 client
- [ ] Add to **Authorized redirect URIs**: `https://your-domain.com/api/auth/callback/google`
- [ ] Add to **Authorized JavaScript origins**: `https://your-domain.com`

---

## Stripe Webhook
- [ ] Stripe Dashboard → Developers → Webhooks → Add endpoint
- [ ] Endpoint URL: `https://your-domain.com/api/webhooks/stripe`
- [ ] Copy the signing secret → `STRIPE_WEBHOOK_SECRET` in Vercel

---

## .env.example Fixes (code bugs to patch)
- [ ] Replace `CLOUDFLARE_BUCKET_ACCESS_ID` / `CLOUDFLARE_BUCKET_SECRET_KEY` / `CLOUDFLARE_BUCKET_JURIDICTION_ENDPOINT` with `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_ENDPOINT` — the code never reads the `CLOUDFLARE_BUCKET_*` names
- [ ] Replace `STRIPE_ADMIN` with `STRIPE_SECRET_KEY` and add `STRIPE_WEBHOOK_SECRET`

---

## Chat Service (Unresolved — pick one path)
The Chat service requires Ollama (LLM) and ChromaDB (vector DB) which cannot run on Vercel.

- [ ] **Option A — VPS/self-hosted**: Run Chat + Ollama + ChromaDB on a GPU server; set `CHAT_SYSTEM_URL` to that server's public URL
- [ ] **Option B — RunPod pod**: Deploy Chat alongside TTS on a RunPod pod with GPU and persistent storage
- [ ] **Option C — Replace dependencies**: Swap Ollama for an API-based LLM (OpenAI, Anthropic) and use a hosted vector DB (Pinecone, Qdrant Cloud) to make Chat fully serverless on Vercel

---

## Final Verification
- [ ] `tsc --noEmit` passes in UI
- [ ] Deploy preview to Vercel and test auth flow end-to-end
- [ ] Test file upload → verify file lands in R2 bucket
- [ ] Test TTS request → verify RunPod endpoint responds
- [ ] Test Redis-backed rate limiting is active (check Upstash dashboard for activity)
- [ ] Stripe test webhook fires successfully (`stripe trigger payment_intent.created`)
