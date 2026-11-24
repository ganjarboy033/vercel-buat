# Nexora Link — Control Center & Vercel API Bridge

Nexora Link adalah API bridge serverless untuk aplikasi Android Nexora Cloud. Versi ini mempertahankan endpoint bridge yang sudah ada, menambahkan dashboard web di root, dan menyediakan Theme Studio untuk mengatur tampilan browser.

## 1. Struktur proyek yang benar

Semua file di ZIP ini sudah berada langsung pada root proyek. Saat ZIP diekstrak, struktur pentingnya terlihat seperti berikut:

```text
.
├── index.html                 # Dashboard utama — root web
├── vercel.json                # Konfigurasi routing Vercel
├── package.json
├── manifest.webmanifest
├── assets/
│   ├── css/styles.css
│   ├── js/app.js
│   └── nexora-mark.svg
├── api/
│   ├── health.js
│   ├── info.js
│   ├── google/
│   ├── github/
│   ├── telegram/
│   └── link/exchange.js
├── lib/
└── tests/
```

**Jangan mengunggah folder pembungkus yang membuat `index.html` berada satu tingkat di bawah Root Directory Vercel.** Di repository yang dipilih Vercel, `index.html`, `vercel.json`, `api/`, dan `lib/` harus terlihat pada tingkat root yang sama.

## 2. Deploy ke Vercel

1. Ekstrak ZIP ini.
2. Upload seluruh isi folder hasil ekstrak ke root repository GitHub. Jangan hanya mengunggah ZIP.
3. Buka Vercel → Add New → Project → Import Git Repository.
4. Pilih repository tersebut.
5. Gunakan **Framework Preset: Other**.
6. Gunakan **Root Directory: root repository** (kosong / `.`). Bila proyek memang disimpan di subfolder repository, pilih tepat subfolder yang berisi `index.html`, `vercel.json`, `api/`, dan `lib/`.
7. Biarkan Build Command dan Output Directory kosong/default; proyek ini tidak memerlukan bundler atau build step.
8. Tambahkan Environment Variables pada langkah berikut, lalu Deploy.

Sesudah deploy, uji:

- `https://DOMAIN-ANDA/` — dashboard HTML.
- `https://DOMAIN-ANDA/health` — alias health check.
- `https://DOMAIN-ANDA/api/health` — fungsi health secara langsung.

`/health` diarahkan ke `/api/health`. Tidak ada catch-all rewrite yang menelan `/api/...`; seluruh endpoint API dipertahankan sebagai Vercel Functions.

## 3. Environment Variables

Atur melalui Vercel → Project → Settings → Environment Variables. Pilih environment yang tepat (Production, Preview, Development), kemudian lakukan Redeploy setelah perubahan.

| Variabel | Wajib | Keterangan |
|---|---:|---|
| `NEXORA_API_KEY` | Ya | API key yang dikirim aplikasi lewat header `x-nexora-key`, minimal 32 karakter acak. |
| `BRIDGE_SECRET` | Ya | Rahasia enkripsi AES-256-GCM untuk state, kode, dan tiket, minimal 32 karakter. Jangan diganti setelah dipakai karena tiket lama tidak akan bisa dibuka. |
| `PUBLIC_BASE_URL` | Ya | URL HTTPS deployment, tanpa garis miring akhir, misalnya `https://nexora-link.vercel.app`. |
| `APP_REDIRECT_URI` | Tidak | Default `nexoracloud://link`, harus sesuai deep link aplikasi. |
| `GOOGLE_CLIENT_ID` | Untuk Google | OAuth Web Client ID dari Google Cloud. |
| `GOOGLE_CLIENT_SECRET` | Untuk Google | OAuth Web Client Secret; simpan hanya di Vercel. |
| `GOOGLE_DEFAULT_SCOPES` | Tidak | Default `drive_file,photos_upload,photos_picker`. |
| `GITHUB_CLIENT_ID` | Untuk GitHub OAuth | OAuth App Client ID. |
| `GITHUB_CLIENT_SECRET` | Untuk GitHub OAuth | OAuth App Client Secret. |
| `GITHUB_DEFAULT_SCOPE` | Tidak | Default `repo`. |
| `TELEGRAM_BOT_TOKEN` | Untuk Telegram | Token Telegram Bot API dari BotFather. |
| `ALLOWED_TELEGRAM_METHODS` | Tidak | Allowlist metode Bot API, dipisah koma. |
| `RATE_LIMIT_PER_MINUTE` | Tidak | Default 60 permintaan per menit per IP/instance. Best-effort pada serverless. |
| `TICKET_TTL_DAYS` | Tidak | Masa berlaku tiket, default 180 hari. |

Buat dua nilai rahasia utama secara acak, misalnya memakai password manager atau `openssl rand -base64 48`. Jangan memasukkan client secret, bot token, atau `BRIDGE_SECRET` ke HTML, JavaScript browser, APK, maupun repository publik.

### Urutan pengisian `PUBLIC_BASE_URL`

Jika alamat Vercel belum diketahui, deploy pertama dapat dibuat untuk memperoleh domain. Setelah itu isi `PUBLIC_BASE_URL` dengan domain final, tambahkan Environment Variables lainnya, lalu Redeploy. Nilai tersebut dipakai untuk menyusun callback OAuth Google dan GitHub.

## 4. Google Drive & Google Photos

Di Google Cloud Console:

1. Buat atau pilih proyek Google Cloud.
2. Aktifkan Google Drive API, Google Photos Library API, dan Google Photos Picker API sesuai kebutuhan/eligibilitas proyek.
3. Atur OAuth consent screen dan tambahkan akun penguji ketika aplikasi masih berstatus Testing.
4. Buat OAuth Client ID tipe **Web application**.
5. Tambahkan Authorized redirect URI: `https://DOMAIN-ANDA/api/google/callback`.
6. Salin Client ID dan Client Secret ke Environment Variables Vercel.

Scope yang dikenal bridge:

- `drive` — akses Drive penuh; izin ini lebih sensitif dan dapat membutuhkan verifikasi Google.
- `drive_file` — file yang dibuat/dibuka dengan aplikasi.
- `photos_upload` — menambah media melalui Photos API.
- `photos_appdata` — data media app-created.
- `photos_picker` — membaca media yang dipilih pengguna melalui Photos Picker.

Bridge hanya mengurus OAuth, tiket, dan refresh access token. File besar tidak melewati Vercel: aplikasi/klien Nexora Cloud mengirimnya langsung ke layanan penyedia. Pembatasan Google Photos berubah dari waktu ke waktu; implementasi Android pada arsip referensi memakai Picker untuk impor media pilihan pengguna dan Photos API untuk alur media yang dibuat aplikasi.

## 5. GitHub OAuth

1. Buka GitHub → Settings → Developer settings → OAuth Apps.
2. Buat OAuth App.
3. Set Homepage URL ke domain deployment.
4. Set Authorization callback URL ke `https://DOMAIN-ANDA/api/github/callback`.
5. Simpan Client ID dan Client Secret di Environment Variables Vercel.

Aplikasi Nexora Cloud juga mendukung Personal Access Token secara langsung pada jalur Multi-Cloud. API GitHub dapat diubah di aplikasi jika memakai GitHub Enterprise.

## 6. Telegram

Buat bot dengan @BotFather dan masukkan token sebagai `TELEGRAM_BOT_TOKEN`. Batasi metode di `ALLOWED_TELEGRAM_METHODS`. Route proxy hanya menerima POST JSON, memerlukan API key Nexora, dan menolak metode yang tidak ada pada allowlist.

**Pembedaan penting:** endpoint Telegram pada proyek ini adalah **Telegram Bot API proxy**, bukan login akun Telegram pribadi/TDLib. TDLib dan sesi akun Telegram pada Nexora Cloud Android berjalan di aplikasi, bukan dikirim ke bridge ini.

## 7. Dashboard & Theme Studio

Dashboard tersedia di `/` dan memuat:

- Ringkasan status server/provider.
- Theme Studio: mode Dark, Light, AMOLED; picker warna HEX; preset; radius; blur/glass; ukuran font; navigasi HP; branding nama/subjudul/logo.
- Simpan otomatis ke `localStorage` browser dan tombol Export/Import JSON serta Reset Default.
- Integrasi Google Drive/Photos, GitHub, Telegram, dan referensi Nexora Cloud Backend.
- Form endpoint, API key, URL backend opsional, GitHub API base, webhook, batas upload/timeout lokal.
- Ping `/health`, tes `/api/info`, tes backend dan webhook, serta log aktivitas browser.
- Panduan langkah demi langkah deploy dan pairing Android.

### Batas penting konfigurasi UI

Theme Studio dan form API menyimpan preferensi pada browser/perangkat yang sedang dipakai. UI statis ini **tidak dapat mengubah Environment Variables Vercel**. Secret server tetap harus diatur melalui Vercel Project Settings. API key yang disimpan di localStorage dapat dibaca oleh JavaScript yang berjalan pada origin tersebut; gunakan hanya pada perangkat/browser tepercaya dan kosongkan setelah selesai pada perangkat bersama.

Export JSON secara default dapat dilakukan tanpa API key dan webhook. Pengguna akan diminta konfirmasi sebelum memasukkan data sensitif ke file export. Jangan membagikan file export yang berisi rahasia.

Log pada panel adalah aktivitas yang dilakukan dashboard di browser ini, bukan log runtime server Vercel. Log server yang sesungguhnya tersedia di Vercel → Project → Logs / Observability.

## 8. Koneksi ke aplikasi Android Nexora Cloud

Berdasarkan referensi proyek Nexora Cloud yang disertakan:

1. Buka **Setting → Kustomisasi Penuh → Endpoint API** dan isi URL Nexora Link.
2. Buka halaman **Nexora Link (API Bridge)**.
3. Isi URL bridge yang sama dan API key yang sama dengan `NEXORA_API_KEY` Vercel.
4. Simpan dan tekan **Tes Koneksi**. Aplikasi memeriksa `/health`, lalu `/api/info` dengan header `x-nexora-key`.
5. Untuk Google, pilih scope yang diperlukan lalu mulai login. Aplikasi membuat PKCE verifier, browser menjalankan OAuth, dan callback membawa kode penukar melalui deep link `nexoracloud://link`. Aplikasi menukar kode dan menyimpan tiket melalui SecretStore.
6. Setelah Google tersambung, halaman Google Drive & Photos pada aplikasi dapat menggunakan remote-store yang tercantum di proyek Android.

Jangan menaruh Google Client Secret, GitHub Client Secret, atau Telegram Bot Token ke dalam aplikasi Android.

## 9. Endpoint API yang dipertahankan

| Metode | Jalur | Autentikasi | Fungsi |
|---|---|---|---|
| GET | `/health` | Tidak | Rewrite ke health function. |
| GET | `/api/health` | Tidak | Status konfigurasi server dan status provider tanpa menampilkan rahasia. |
| GET | `/api/info` | `x-nexora-key` | Kemampuan bridge, alias scope, metode Telegram yang diizinkan. |
| GET | `/api/google/start` | PKCE query | Mulai OAuth Google. |
| GET | `/api/google/callback` | State terenkripsi | Callback OAuth Google dan deep link. |
| POST | `/api/google/token` | `x-nexora-key` + tiket | Memperbarui access token Google. |
| POST | `/api/google/revoke` | `x-nexora-key` + tiket | Mencabut token Google. |
| GET | `/api/github/start` | PKCE query | Mulai OAuth GitHub. |
| GET | `/api/github/callback` | State terenkripsi | Callback OAuth GitHub dan deep link. |
| POST | `/api/github/token` | `x-nexora-key` + tiket | Mengambil access token GitHub. |
| POST | `/api/link/exchange` | `x-nexora-key` + PKCE verifier | Menukar kode singkat menjadi tiket terenkripsi. |
| POST | `/api/telegram/{method}` | `x-nexora-key` + allowlist | Proxy Telegram Bot API. |

API bridge tidak menyediakan route katalog `/api/v1/...` milik backend Node/PostgreSQL Nexora Cloud. Backend itu merupakan layanan terpisah dan harus di-deploy/diatur tersendiri bila dibutuhkan.

## 10. Batas dan keamanan

- Batas body Vercel Functions sekitar 4,5 MB. Gunakan bridge untuk metadata dan token, bukan transfer file besar.
- Ticket OAuth terenkripsi AES-256-GCM; kode singkat hanya berlaku lima menit dan diverifikasi dengan PKCE.
- Rate limiting yang saat ini ada bersifat best-effort per instance serverless; bukan sistem rate limiting global/persisten.
- `/api/health` menampilkan status provider dan masalah konfigurasi, tetapi tidak menampilkan nilai rahasia.
- Jangan mengaktifkan scope Google yang tidak diperlukan.
- Gunakan Vercel logs/monitoring untuk audit runtime. Log browser tidak menggantikan log server.

## 11. Pengujian lokal

Node.js 20 atau lebih baru:

```bash
npm test
```

Untuk menjalankan server lokal dengan Vercel CLI:

```bash
npm install -g vercel
vercel dev
```

Isi environment lokal (misalnya melalui `.env.local`) sebelum menguji flow OAuth. Jangan commit file environment yang berisi secret.
