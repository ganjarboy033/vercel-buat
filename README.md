# Nexora Link — API Bridge untuk Vercel

Server tanpa-state yang menjembatani aplikasi Android Nexora Cloud dengan **Google (Drive & Photos)**, **GitHub**, dan **Telegram Bot API** tanpa menaruh *client secret* atau token bot di APK.

```
Android ──(x-nexora-key)──► Nexora Link (Vercel) ──► Google / GitHub / Telegram
   ▲                                │
   └──── deep link nexoracloud://link?code=… (PKCE) ◄──┘
```

## Cara kerja singkat
1. Aplikasi membuat `verifier` acak (PKCE) dan membuka `GET /api/google/start?state=…&challenge=…` di browser.
2. Pengguna menyetujui akses di Google. Google memanggil `/api/google/callback`; server menukar kode dengan *refresh token* memakai `client_secret` miliknya.
3. Server mengenkripsi refresh token menjadi **tiket** (AES‑256‑GCM) dan mengirim aplikasi **kode penukar 5 menit** lewat deep link. Refresh token tidak pernah muncul di URL.
4. Aplikasi menukar kode + `verifier` di `POST /api/link/exchange` → mendapat tiket (disimpan di Android Keystore).
5. Setiap kali butuh akses, aplikasi memanggil `POST /api/google/token` dengan tiket → dapat *access token* 1 jam, lalu memanggil Google API langsung (jadi file besar tidak melewati Vercel).

Server **tidak menyimpan apa pun** (tanpa database). Mencabut akses: `POST /api/google/revoke`, atau hapus aplikasi di myaccount.google.com/permissions.

## Deploy
```bash
cd nexora-link-vercel
npm i -g vercel
vercel link
# isi variabel lingkungan (lihat .env.example) — minimal NEXORA_API_KEY, BRIDGE_SECRET, PUBLIC_BASE_URL
vercel env add NEXORA_API_KEY production
vercel env add BRIDGE_SECRET production
vercel env add PUBLIC_BASE_URL production      # https://nama-proyek.vercel.app
vercel --prod
```
Buat nilai acak: `openssl rand -base64 48`. **Jangan mengganti `BRIDGE_SECRET`** setelah dipakai (semua tiket lama menjadi tidak valid).

Cek: `GET https://nama-proyek.vercel.app/health` → `{"ok":true,…,"providers":{…}}`.

## Variabel lingkungan
| Nama | Wajib | Fungsi |
|---|---|---|
| `NEXORA_API_KEY` | ya | Kunci header `x-nexora-key` (≥32 karakter). Isi sama di aplikasi: Setting → Nexora Link. |
| `BRIDGE_SECRET` | ya | Kunci enkripsi tiket/kode/state (≥32 karakter). |
| `PUBLIC_BASE_URL` | ya | URL publik `https://…` tanpa garis miring akhir. |
| `APP_REDIRECT_URI` | tidak | Default `nexoracloud://link` (sudah sesuai APK). |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | untuk Google | Lihat bagian Google Cloud di bawah. |
| `GOOGLE_DEFAULT_SCOPES` | tidak | Alias dipisah koma. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | untuk login GitHub | OAuth App. (Aplikasi juga bisa memakai Personal Access Token tanpa bridge.) |
| `TELEGRAM_BOT_TOKEN` | untuk proxy Telegram | Token bot. |
| `ALLOWED_TELEGRAM_METHODS` | tidak | Allowlist metode Bot API. |
| `RATE_LIMIT_PER_MINUTE` | tidak | Default 60 per IP (best‑effort per instance). |
| `TICKET_TTL_DAYS` | tidak | Masa berlaku tiket, default 180 hari. |

## Menyiapkan Google Cloud
1. console.cloud.google.com → buat proyek → **APIs & Services → Library**: aktifkan **Google Drive API**, **Photos Library API**, dan **Google Photos Picker API**.
2. **OAuth consent screen**: tipe External; tambahkan akun Anda sebagai *Test user* (tanpa verifikasi, mode Testing berlaku untuk pengguna uji; refresh token mode Testing kedaluwarsa 7 hari — publikasikan aplikasi untuk penggunaan jangka panjang).
3. **Credentials → Create OAuth client ID → Web application**. *Authorized redirect URI*: `https://nama-proyek.vercel.app/api/google/callback`.
4. Salin Client ID & Secret ke variabel lingkungan Vercel.

Catatan Google:
- Scope `drive` penuh adalah *restricted* (butuh verifikasi untuk publik); `drive.file` hanya melihat file yang dibuat aplikasi. Pilih sesuai kebutuhan di Setting → Nexora Link.
- **Google Photos**: sejak 31 Maret 2025 Library API hanya dapat membaca/mengelola media **yang dibuat aplikasi itu sendiri**. Untuk membaca foto pengguna dipakai **Picker API** (pengguna memilih foto di aplikasi Google Photos; aplikasi mengimpornya).

## Endpoint
| Metode & jalur | Auth | Fungsi |
|---|---|---|
| `GET /health` | – | Status & provider yang terkonfigurasi |
| `GET /api/info` | key | Kemampuan server |
| `GET /api/google/start`, `/callback` | – | OAuth Google (PKCE + state terenkripsi) |
| `GET /api/github/start`, `/callback` | – | OAuth GitHub |
| `POST /api/link/exchange` | key | Tukar kode deep link + verifier → tiket |
| `POST /api/google/token` · `/revoke` | key | Access token baru · cabut akses |
| `POST /api/github/token` | key | Access token GitHub dari tiket |
| `POST /api/telegram/{metode}` | key | Proxy Telegram Bot API (allowlist) |

## Batas & keamanan
- Body fungsi Vercel ±4,5 MB: bridge untuk **metadata dan token**, bukan transfer file besar (aplikasi mengunggah/mengunduh langsung ke Google/GitHub/Telegram).
- Tiket = akses ke akun penyedia; aplikasi menyimpannya terenkripsi di Android Keystore. Jika tiket bocor, cabut lewat `/api/google/revoke`.
- Rate limit bersifat *best‑effort* (memori per instance serverless). Untuk produksi besar tambahkan Vercel Firewall / Upstash.
- Tes: `npm test` (10 tes: kripto, PKCE, alur OAuth penuh dengan fetch tiruan, isolasi provider, proxy Telegram, rate limit).
