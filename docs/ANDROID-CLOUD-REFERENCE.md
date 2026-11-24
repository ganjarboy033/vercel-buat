# Referensi integrasi Nexora Cloud Android

Dokumen ini merangkum fitur yang tampak pada arsip `NEXORA-CLOUD-TDLIB.zip` dan menjelaskan bagian mana yang benar-benar disediakan Nexora Link (Vercel). Ringkasan ini mencegah dashboard mengklaim API yang tidak ada pada proyek bridge.

## Konektor yang memiliki jalur di Nexora Link

### Google
- OAuth Google dengan PKCE dan state terenkripsi.
- Tiket AES-256-GCM untuk menghindari penyimpanan refresh token mentah di URL/deep link.
- Endpoint token Google dan revoke.
- Scope alias: `drive`, `drive_file`, `photos_upload`, `photos_appdata`, `photos_picker`.
- Di aplikasi Android, `RemoteStores.kt` mengimplementasikan Google Drive untuk listing, unggah resumable, unduh/ekspor, pindah/salin/trash; Google Photos untuk unggah/media buatan aplikasi dan impor media melalui Photos Picker.
- File besar dikirim langsung dari aplikasi ke provider; bukan melalui body Vercel.

### GitHub
- OAuth App melalui bridge dan endpoint token.
- Aplikasi Android juga menyebut dukungan Personal Access Token, repository, Git tree, read/write/delete/rename/move/copy, create repository, dan sinkron pustaka.
- API base GitHub dapat diubah di pengaturan aplikasi untuk instance Enterprise.

### Telegram
- Nexora Link menyediakan proxy Telegram **Bot API** dengan token server dan allowlist metode.
- Nexora Cloud Android memiliki alur TDLib terpisah untuk login akun pengguna, Telegram Saved Messages/channel, upload/download, folder virtual, chunk, trash, dan aktivitas.
- Jangan menyamakan Telegram Bot API proxy dengan TDLib account session; session pribadi tidak menjadi endpoint Vercel.

## Nexora Cloud Backend terpisah

Arsip Android juga memuat folder `backend/` Node.js dan `backend/sql/` PostgreSQL. Dokumentasi proyek menyebut route seperti katalog `/api/v1/files`, statistik `/api/v1/stats`, aktivitas `/api/v1/activity`, trash, restore, transfer, dan backup/restore. Itu bukan bagian dari folder `nexora-link-vercel` dan tidak dimasukkan ke deploy statis/Vercel Functions karena memerlukan konfigurasi layanan/database tersendiri.

## Kustomisasi Android yang dijadikan acuan

- Kepadatan UI, list/grid, kolom galeri, tab awal, label navigasi, thumbnail/tag.
- Sinkronisasi otomatis, interval refresh, Wi-Fi only.
- Batas ukuran upload dan chunk Telegram.
- FAB upload: show/hide, posisi, lock, reset.
- Endpoint bridge URL dan GitHub API base.
- Secret bridge key, API token/hash, kata sandi, proxy secret ditampilkan sebagai field sensitif.
- Backup/import `.nexora` terenkripsi opsional.

Theme Studio di dashboard web mengadaptasi bagian warna, radius, blur, font, navigasi, branding, export/import config dan endpoint. Nilai dashboard tetap lokal di browser; pengaturan perilaku transfer dan rahasia Android tetap di aplikasi/Android Keystore atau environment server sesuai perannya.

## Batas sumber

Ringkasan ini berdasarkan README dan `TDLIB_INTEGRATION.md` serta implementasi Kotlin pada arsip referensi. Dashboard web tidak mengklaim bahwa operasi cloud Android sudah tersedia sebagai API browser baru. Untuk operasi Drive/Photos/GitHub file yang sebenarnya, aplikasi Nexora Cloud tetap menjadi klien penyedia.
