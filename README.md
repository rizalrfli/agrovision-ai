# Agro-Vision AI

Agro-Vision AI adalah Sistem Manajemen Pertanian Berkelanjutan yang dilengkapi dengan Asisten AI. Aplikasi ini dibangun dengan React, Tailwind CSS, dan Google Gemini AI untuk membantu petani mengidentifikasi penyakit tanaman, mendapatkan rekomendasi penanganan, serta berbagai fitur pendukung lainnya.

## Fitur Utama

- **Asisten AI**: Diagnosis cerdas penyakit tanaman berdasarkan foto dan keluhan (ditenagai oleh Google Gemini AI).
- **Ensiklopedia Hama & Penyakit**: Basis data interaktif yang dapat dicari tentang berbagai hama dan penyakit serta cara penanganannya.
- **Cuaca & Peringatan Dini**: Integrasi data cuaca nyata dan analisis cuaca berbasis AI untuk rekomendasi aktivitas pertanian.
- **Kalkulator Pertanian**: Alat untuk menghitung kebutuhan pupuk, bibit, dan pestisida berdasarkan luas lahan.
- **Laporan Aktivitas**: Pencatatan aktivitas harian petani, deteksi penyakit, cuaca ekstrem, hingga panen, yang dapat disaring dan diunduh dalam format PDF.
- **Profil Petani**: Pengaturan konteks profil dan lahan untuk personalisasi rekomendasi AI.

## Teknologi yang Digunakan

- [React](https://reactjs.org/) (Vite)
- [Tailwind CSS](https://tailwindcss.com/)
- [Google Gemini API](https://ai.google.dev/) (@google/genai)
- [Framer Motion](https://www.framer.com/motion/) (Animasi)
- [Lucide React](https://lucide.dev/) (Ikon)
- [jsPDF](https://parall.ax/products/jspdf) (Ekspor PDF)

## Prasyarat

Pastikan Anda telah memiliki API Key dari Google Gemini AI.

## Instalasi

1. Clone repositori ini:
   ```bash
   git clone <url-repositori-anda>
   cd <nama-folder>
   ```

2. Instal dependensi:
   ```bash
   npm install
   ```

3. Buat file `.env` berdasarkan `.env.example` dan isi dengan konfigurasi Anda:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

4. Jalankan development server:
   ```bash
   npm run dev
   ```

5. Buka `http://localhost:3000` di peramban Anda.
