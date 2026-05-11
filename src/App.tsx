import React, { useState, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import { Upload, Send, Leaf, CloudRain, CalendarDays, 
  AlertTriangle, CheckCircle, Info, ShieldAlert, 
  X, Image as ImageIcon, Loader2, ThermometerSun, BookOpen, Calculator, Scale, Droplets, Menu, Download, Trash2, FileText, Settings, Bell, BellOff, Wind, MoreVertical, User, Sparkles, ArrowLeft
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PEST_DATABASE } from './data';

// Initialize Gemini API
const initializeGemini = () => {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.error("GEMINI_API_KEY is missing! Please add it to your .env file or GitHub Secrets.");
      return null;
    }
    return new GoogleGenAI({ apiKey: key });
  } catch (error) {
    console.error("Failed to initialize Gemini:", error);
    return null;
  }
};

const ai = initializeGemini();

const SYSTEM_PROMPT = `Kamu adalah "Agro-Vision AI", asisten inti untuk Sistem Manajemen Pertanian Berkelanjutan di Indonesia. Target penggunamu adalah petani lokal. Gunakan bahasa yang praktis, suportif, dan mudah dipahami, tanpa jargon akademis yang kaku. Prioritaskan solusi organik dan ramah lingkungan.

Tugas utamamu adalah merespons input dari pengguna dan mengklasifikasikannya ke dalam salah satu dari 3 kategori utama, lalu WAJIB mengembalikan output HANYA dalam format JSON mentah yang valid. Jangan tambahkan teks awalan, akhiran, atau format markdown (seperti \`\`\`json) di luar struktur JSON.

KONTEKS PENGGUNA (Jika tersedia):
Jika data profil petani diberikan (Nama, Lokasi, Luas Lahan, Komoditas Utama, Metode Bertani), gunakan informasi ini untuk memberikan solusi yang lebih personal. Misalnya, jika metode bertani adalah "Organik", hindari solusi kimiawi sama sekali. Jika "Lokasi" disebutkan, pertimbangkan kelembaban regional yang umum jika relevan.

ATURAN OUTPUT JSON BERDASARKAN KATEGORI:

Kategori 1: Deteksi Penyakit (Jika ada unggahan gambar tanaman)
{
  "kategori_respons": "deteksi_penyakit",
  "status": "success | error_image",
  "diagnosis": "Nama Umum Penyakit/Hama (Nama Ilmiah)",
  "tingkat_keparahan": "Rendah | Sedang | Tinggi",
  "penjelasan": "Penjelasan maksimal 2 kalimat dengan bahasa sederhana.",
  "solusi_organik": ["Langkah praktis 1", "Langkah praktis 2"],
  "solusi_kimiawi_opsional": "Tindakan terakhir jika organik gagal (kosongkan jika tidak perlu)",
  "pencegahan": "Tips pencegahan singkat."
}

Kategori 2: Kalender Tanam Cerdas (Jika pengguna meminta jadwal tanam/perawatan)
{
  "kategori_respons": "kalender_tanam",
  "tanaman": "Nama Tanaman",
  "estimasi_panen_hari": 0,
  "jadwal": [
    {
      "hari_ke": 0,
      "kategori_tugas": "Pemupukan Dasar | Perawatan | Hama | Panen",
      "deskripsi_tugas": "Instruksi praktis"
    }
  ]
}

Kategori 3: Asisten Cuaca (Jika pengguna memberikan data cuaca dan umur tanaman)
{
  "kategori_respons": "tindakan_cuaca",
  "tingkat_risiko": "Aman | Waspada | Bahaya",
  "analisis_singkat": "Penjelasan 1 kalimat efek cuaca tersebut pada tanaman saat ini.",
  "tindakan_preventif": ["Langkah 1 yang harus segera dilakukan", "Langkah 2"]
}`;

export default function App() {
  const [view, setView] = useState<'assistant' | 'database' | 'kalkulator' | 'cuaca' | 'laporan' | 'pengaturan' | 'profil'>('assistant');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [reportItems, setReportItems] = useState<any[]>([]);
  const [farmerProfile, setFarmerProfile] = useState(() => {
    const saved = localStorage.getItem('agro_farmer_profile');
    if (saved) return JSON.parse(saved);
    return {
      name: '',
      farmName: '',
      farmLocation: '',
      farmSize: '',
      mainCrops: [] as string[],
      farmingMethod: 'Organik',
      experienceYears: ''
    };
  });
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem('agro_notifications_enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [activeAlerts, setActiveAlerts] = useState<{id: string, title: string, message: string, type: 'danger' | 'warning'}[]>([]);
  const [inputText, setInputText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [landArea, setLandArea] = useState<number | ''>(1000);
  const [fertilizerType, setFertilizerType] = useState<'kompos' | 'poc'>('kompos');
  
  // Weather states
  const [weatherData, setWeatherData] = useState<any>(null);
  const [weatherLocation, setWeatherLocation] = useState<string>('');
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [cropType, setCropType] = useState('');
  const [cropAge, setCropAge] = useState('');
  const [weatherAIAnalysis, setWeatherAIAnalysis] = useState<any>(null);
  const [isWeatherAILoading, setIsWeatherAILoading] = useState(false);
  const [searchCity, setSearchCity] = useState('');
  const [searchPest, setSearchPest] = useState('');
  const [reportFilterType, setReportFilterType] = useState<string>('semua');
  const [reportStartDate, setReportStartDate] = useState<string>('');
  const [reportEndDate, setReportEndDate] = useState<string>('');
  const [showSaveToast, setShowSaveToast] = useState(false);


  const [selectedReportItem, setSelectedReportItem] = useState<any | null>(null);
  const [selectedPest, setSelectedPest] = useState<any | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save profile to localStorage
  React.useEffect(() => {
    localStorage.setItem('agro_farmer_profile', JSON.stringify(farmerProfile));
  }, [farmerProfile]);

  // Monitor extreme weather conditions
  React.useEffect(() => {
    if (!weatherData || !isNotificationsEnabled) return;

    const newAlerts: typeof activeAlerts = [];
    const current = weatherData.current_weather;
    const daily = weatherData.daily;

    // Wind check (> 40 km/h: Dangerous)
    if (current.windspeed > 40) {
      newAlerts.push({
        id: 'wind-danger-' + Date.now(),
        title: 'Peringatan Angin Kencang!',
        message: `Kecepatan angin saat ini ${current.windspeed} km/j. Mohon perkuat tiang penyangga tanaman atau peneduh.`,
        type: 'danger'
      });
    } else if (current.windspeed > 25) {
      newAlerts.push({
        id: 'wind-warning-' + Date.now(),
        title: 'Waspada Angin Kencang',
        message: 'Kecepatan angin meningkat. Pantau kondisi tanaman yang tinggi.',
        type: 'warning'
      });
    }

    // Rain probability / Storm (Precipitation > 80% and Thunderstorm or rain weather codes)
    // Weather code >= 80 often represents showers or thunderstorms in WMO codes used by Open-Meteo
    if (daily.precipitation_probability_max[0] > 80 && current.weathercode >= 60) {
      newAlerts.push({
        id: 'storm-danger-' + Date.now(),
        title: 'Risiko Badai/Hujan Lebat!',
        message: 'Probabilitas hujan sangat tinggi dengan intensitas lebat. Pastikan saluran drainase lahan bersih.',
        type: 'danger'
      });
    }

    // Heatwave check (Max temp > 36°C)
    if (daily.temperature_2m_max[0] > 36) {
      newAlerts.push({
        id: 'heat-danger-' + Date.now(),
        title: 'Peringatan Panas Ekstrem!',
        message: `Suhu esok hari diprediksi mencapai ${daily.temperature_2m_max[0]}°C. Tingkatkan frekuensi penyiraman pagi dan sore.`,
        type: 'danger'
      });
    }

    if (newAlerts.length > 0) {
      // Append unique alerts by title to avoid spamming
      setActiveAlerts(prev => {
        const filteredNew = newAlerts.filter(na => !prev.some(pa => pa.title === na.title));
        return [...prev, ...filteredNew];
      });
    }
  }, [weatherData, isNotificationsEnabled]);

  React.useEffect(() => {
    localStorage.setItem('agro_notifications_enabled', JSON.stringify(isNotificationsEnabled));
  }, [isNotificationsEnabled]);

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Mohon unggah file gambar yang valid.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result as string);
      setError('');
    };
    reader.readAsDataURL(file);
    
    // Reset input so the same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = () => {
    setImage(null);
  };

  const fetchWeatherData = async () => {
    setIsWeatherLoading(true);
    setWeatherError('');
    setWeatherData(null);
    setWeatherAIAnalysis(null);
    
    if (!navigator.geolocation) {
      setWeatherError('Geolocation is not supported by your browser');
      setIsWeatherLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        
        // Fetch location name
        const locResponse = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=id`);
        const locData = await locResponse.json();
        setWeatherLocation(locData.city || locData.locality || 'Lokasi Tidak Diketahui');

        // Fetch weather data from Open-Meteo
        const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&timezone=auto`);
        const data = await weatherResponse.json();
        
        setWeatherData(data);
        setIsWeatherLoading(false);
      } catch (err) {
        setWeatherError('Gagal mengambil data cuaca. Periksa koneksi internet Anda.');
        setIsWeatherLoading(false);
      }
    }, (error) => {
      setWeatherError('Tidak dapat mengakses lokasi secara otomatis. Gunakan kolom pencarian di bawah.');
      setIsWeatherLoading(false);
    });
  };

  const fetchWeatherByCity = async () => {
    if (!searchCity.trim()) {
      setWeatherError('Masukkan nama kota terlebih dahulu.');
      return;
    }

    setIsWeatherLoading(true);
    setWeatherError('');
    setWeatherData(null);
    setWeatherAIAnalysis(null);

    try {
      // Nominatim for Geocoding (Free and no key required)
      const geoResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchCity)}&limit=1`);
      const geoData = await geoResponse.json();

      if (!geoData || geoData.length === 0) {
        throw new Error('Kota tidak ditemukan.');
      }

      const { lat, lon, display_name } = geoData[0];
      setWeatherLocation(display_name.split(',')[0]);

      const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&timezone=auto`);
      const data = await weatherResponse.json();

      setWeatherData(data);
    } catch (err: any) {
      setWeatherError(err.message || 'Gagal mencari lokasi. Periksa ejaan kota Anda.');
    } finally {
      setIsWeatherLoading(false);
    }
  };

  const handleWeatherAnalysis = async () => {
    if (!weatherData) return;
    if (!cropType || !cropAge) {
      setWeatherError('Mohon isi jenis tanaman dan umur tanaman.');
      return;
    }

    setIsWeatherAILoading(true);
    setWeatherError('');
    setWeatherAIAnalysis(null);
    
    try {
      if (!ai) {
        throw new Error('API Key Gemini belum diset.');
      }

      const weatherDesc = `Suhu Saat Ini: ${weatherData.current_weather.temperature}°C, Kecepatan Angin: ${weatherData.current_weather.windspeed} km/j, Cuaca: Kode ${weatherData.current_weather.weathercode}.
Prediksi hari ini: Suhu maks ${weatherData.daily.temperature_2m_max[0]}°C, Suhu min ${weatherData.daily.temperature_2m_min[0]}°C, Probabilitas Hujan Maks: ${weatherData.daily.precipitation_probability_max[0]}%.`;

      const profileContext = farmerProfile.name ? `\nINFORMASI PETANI: Nama: ${farmerProfile.name}, Lokasi: ${farmerProfile.farmLocation}, Metode: ${farmerProfile.farmingMethod}, Luas: ${farmerProfile.farmSize}m2.` : '';

      const prompt = `Saya mempunyai tanaman: ${cropType} berumur ${cropAge}.${profileContext}
Kondisi cuaca di daerah saya: ${weatherDesc}.
Mohon berikan Asisten Cuaca untuk memberitahu bagaimana pengaruhnya pada tanaman dan apa tindakan preventif yang harus dilakukan.`;

      // Match the structure and model of the working handleSubmit
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [prompt],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          temperature: 0.2
        }
      });

      if (response.text) {
        let rawText = response.text;
        // Clean up markdown
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedResult = JSON.parse(rawText);
        setWeatherAIAnalysis(parsedResult);
      } else {
        throw new Error('Respons kosong dari AI.');
      }
    } catch (err: any) {
      setWeatherError(err.message || 'Terjadi kesalahan saat menghubungi AI.');
    } finally {
      setIsWeatherAILoading(false);
    }
  };

  const addToReport = (data: any, type: 'diagnosis' | 'kalender' | 'cuaca' | 'kalkulator') => {
    const newItem = {
      id: Date.now(),
      timestamp: new Date().toLocaleString('id-ID'),
      type,
      data: {
        ...data
      }
    };
    setReportItems([...reportItems, newItem]);
    
    // Trigger notification
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 3000);
  };

  const removeItemFromReport = (id: number) => {
    setReportItems(reportItems.filter(item => item.id !== id));
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const title = "Laporan Manajemen Pertanian - Agro-Vision AI";
    const date = new Date().toLocaleString('id-ID');

    doc.setFontSize(20);
    doc.setTextColor(27, 48, 34); // #1B3022
    doc.text(title, 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Dicetak pada: ${date}`, 14, 30);

    let yPos = 40;

    reportItems.forEach((item, index) => {
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(34, 197, 94);
      doc.text(`${index + 1}. ${item.type.toUpperCase()} - ${item.timestamp}`, 14, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setTextColor(0);
      
      const content = [];
      if (item.type === 'diagnosis') {
        content.push(["Diagnosis", item.data.diagnosis]);
        content.push(["Tingkat Keparahan", item.data.tingkat_keparahan]);
        content.push(["Penjelasan", item.data.penjelasan]);
        content.push(["Solusi Organik", item.data.solusi_organik?.join(', ')]);
        content.push(["Pencegahan", item.data.pencegahan]);
      } else if (item.type === 'kalender') {
        content.push(["Tanaman", item.data.tanaman]);
        content.push(["Estimasi Panen", `${item.data.estimasi_panen_hari} Hari`]);
        item.data.jadwal?.forEach((j: any) => {
          content.push([`Hari ke-${j.hari_ke}`, `${j.kategori_tugas}: ${j.deskripsi_tugas}`]);
        });
      } else if (item.type === 'cuaca') {
        content.push(["Tingkat Risiko", item.data.tingkat_risiko]);
        content.push(["Analisis", item.data.analisis_singkat]);
        content.push(["Tindakan", item.data.tindakan_preventif?.join(', ')]);
      } else if (item.type === 'kalkulator') {
        content.push(["Luas Lahan", `${item.data.luas} m2`]);
        content.push(["Jenis Pupuk", item.data.jenis]);
        content.push(["Kebutuhan", item.data.kebutuhan]);
      }

      autoTable(doc, {
        startY: yPos,
        head: [['Field', 'Keterangan']],
        body: content,
        theme: 'striped',
        headStyles: { fillColor: [61, 90, 69] },
        styles: { fontSize: 9 }
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    });

    doc.save(`Laporan_AgroVision_${Date.now()}.pdf`);
  };

  const exportToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID,Waktu,Tipe,Detail\n";

    reportItems.forEach(item => {
      let detail = "";
      if (item.type === 'diagnosis') {
        detail = `${item.data.diagnosis} (${item.data.tingkat_keparahan}): ${item.data.penjelasan}`;
      } else if (item.type === 'kalender') {
        detail = `Tanaman: ${item.data.tanaman}, Panen: ${item.data.estimasi_panen_hari} hari`;
      } else if (item.type === 'cuaca') {
        detail = `Risiko: ${item.data.tingkat_risiko}, Analisis: ${item.data.analisis_singkat}`;
      }
      
      const row = `${item.id},"${item.timestamp}",${item.type},"${detail.replace(/"/g, '""')}"`;
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_AgroVision_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async () => {
    if (!inputText.trim() && !image) {
      setError('Mohon berikan pertanyaan atau unggah foto tanaman Anda.');
      return;
    }

    if (!ai) {
      setError('Konfigurasi API tidak valid atau kunci API tidak ditemukan.');
      return;
    }

    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const contents: any[] = [];
      
      if (image) {
        const base64Data = image.split(',')[1];
        const mimeType = image.match(/data:(.*?);/)?.[1] || 'image/jpeg';
        contents.push({
          inlineData: { data: base64Data, mimeType }
        });
      }
      
      if (inputText.trim()) {
        const profileContext = farmerProfile.name ? `\n(KONTEKS PENGGUNA - Nama: ${farmerProfile.name}, Lokasi: ${farmerProfile.farmLocation}, Luas: ${farmerProfile.farmSize}m2, Metode: ${farmerProfile.farmingMethod}, Tanaman Utama: ${farmerProfile.mainCrops.join(', ')})` : '';
        contents.push(inputText + profileContext);
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          temperature: 0.2 // Lower temp for more consistent JSON structure
        }
      });

      if (response.text) {
        let rawText = response.text;
        // Clean up potential markdown formatting just in case
        rawText = rawText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        const parsed = JSON.parse(rawText);
        setResult(parsed);
      } else {
        setError('Respons kosong dari asisten.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat menghubungi asisten.');
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityBadge = (keparahan: string) => {
    const level = keparahan.toLowerCase();
    if (level === 'tinggi' || level === 'bahaya') {
      return <span className="px-3 py-1 text-xs font-mono rounded-full bg-red-500/20 text-red-300 border border-red-500/30 uppercase tracking-widest">Tinggi / Bahaya</span>;
    }
    if (level === 'sedang' || level === 'waspada') {
      return <span className="px-3 py-1 text-xs font-mono rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 uppercase tracking-widest">Sedang / Waspada</span>;
    }
    return <span className="px-3 py-1 text-xs font-mono rounded-full bg-green-500/20 text-green-300 border border-green-500/30 uppercase tracking-widest">Rendah / Aman</span>;
  };

  const renderResult = () => {
    if (!result) return null;

    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl mx-auto mt-6 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-5 sm:p-8 text-[#F4F1DE]">
          {/* Card Based on Category */}
          {result.kategori_respons === 'deteksi_penyakit' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/10 border border-white/20 text-green-400 rounded-xl">
                    <Leaf className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#E9EDC9]">Deteksi Penyakit & Hama</h2>
                    <p className="text-sm text-[#CCD5AE]">Hasil diagnosis gambar Anda</p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => addToReport(result, 'diagnosis')}
                  className="p-2 bg-white/10 border border-white/20 rounded-xl text-[#E9EDC9] hover:bg-white/20 transition-all flex items-center gap-2 text-xs font-bold"
                  title="Simpan ke Laporan"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Simpan Laporan</span>
                </motion.button>
              </div>

              {result.status === 'error_image' ? (
                <div className="p-4 bg-red-500/20 text-red-300 rounded-xl flex gap-3 text-sm border border-red-500/40">
                  <ShieldAlert className="w-5 h-5 shrink-0" />
                  <p>Gambar tidak jelas atau tidak menampilkan tanaman. Mohon unggah gambar daun atau tanaman yang terdampak dengan lebih jelas.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-2xl font-serif text-[#E9EDC9] flex items-center gap-3">
                      {result.diagnosis}
                      {getSeverityBadge(result.tingkat_keparahan || '')}
                    </h3>
                    <p className="mt-2 text-gray-300 bg-white/5 p-4 rounded-xl border border-white/10 italic">
                      {result.penjelasan}
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-3">
                      <h4 className="text-xs font-bold uppercase text-[#A3B18A] tracking-widest flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Solusi Organik
                      </h4>
                      <ul className="space-y-2">
                        {result.solusi_organik?.map((sol: string, idx: number) => (
                          <li key={idx} className="flex gap-2 text-sm text-gray-300">
                            <span className="text-green-400 mt-0.5">•</span>
                            <span>{sol}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-3">
                      <h4 className="text-xs font-bold uppercase text-[#D4A373] tracking-widest flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Pencegahan
                      </h4>
                      <p className="text-sm text-gray-400 pl-6">{result.pencegahan}</p>
                      
                      {result.solusi_kimiawi_opsional && (
                         <div className="mt-4 pt-4 border-t border-white/10">
                            <h4 className="text-xs font-bold uppercase text-red-400 tracking-widest flex items-center gap-2 mb-2">
                              <ShieldAlert className="w-4 h-4" />
                              Tindakan Kimiawi
                            </h4>
                            <p className="text-sm text-gray-400 pl-6 italic">{result.solusi_kimiawi_opsional}</p>
                         </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {result.kategori_respons === 'kalender_tanam' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/10 border border-white/20 text-blue-400 rounded-xl">
                    <CalendarDays className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#E9EDC9]">Kalender Tanam Cerdas</h2>
                    <p className="text-sm text-[#CCD5AE]">Jadwal perawatan untuk {result.tanaman}</p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => addToReport(result, 'kalender')}
                  className="p-2 bg-white/10 border border-white/20 rounded-xl text-[#E9EDC9] hover:bg-white/20 transition-all flex items-center gap-2 text-xs font-bold"
                  title="Simpan ke Laporan"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Simpan Laporan</span>
                </motion.button>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#CCD5AE] bg-white/10 px-4 py-2 rounded-full font-medium border border-white/20 text-sm">
                  <Info className="w-4 h-4" />
                  Estimasi Panen: ± {result.estimasi_panen_hari} Hari
                </div>
              </div>

              <div className="relative border-l-2 border-white/20 ml-4 mt-8 space-y-6">
                {result.jadwal?.map((j: any, idx: number) => (
                  <div key={idx} className="relative pl-6">
                    <span className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-green-500 border-4 border-[#1B3022] shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>
                    <h3 className="font-bold text-[#E9EDC9]">Hari ke-{j.hari_ke}</h3>
                    <p className="text-sm font-bold uppercase tracking-widest text-[#A3B18A] mt-1">{j.kategori_tugas}</p>
                    <p className="text-sm text-gray-300 bg-white/5 p-3 rounded-lg border border-white/10 inline-block mt-2">
                       {j.deskripsi_tugas}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.kategori_respons === 'tindakan_cuaca' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/10 border border-white/20 text-yellow-400 rounded-xl">
                    <ThermometerSun className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#E9EDC9]">Asisten Cuaca</h2>
                    <p className="text-sm text-[#CCD5AE]">Analisis dampak cuaca pada kebun Anda</p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => addToReport(result, 'cuaca')}
                  className="p-2 bg-white/10 border border-white/20 rounded-xl text-[#E9EDC9] hover:bg-white/20 transition-all flex items-center gap-2 text-xs font-bold"
                  title="Simpan ke Laporan"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Simpan Laporan</span>
                </motion.button>
              </div>

              <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10">
                <span className="font-medium text-gray-300">Tingkat Risiko Kondisi Ini:</span>
                {getSeverityBadge(result.tingkat_risiko || '')}
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase text-[#A3B18A] tracking-widest flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-400" />
                  Analisis Singkat
                </h4>
                <p className="text-gray-300 pl-6 text-sm">{result.analisis_singkat}</p>
              </div>

              <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-3 mt-4">
                <h4 className="text-xs font-bold uppercase text-[#D4A373] tracking-widest flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  Tindakan Preventif
                </h4>
                <div className="grid gap-2 pl-6">
                  {result.tindakan_preventif?.map((tindak: string, idx: number) => (
                    <div key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-green-400 mt-0.5">•</span>
                      <span>{tindak}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen pb-20 relative z-0">
      {/* Background Mesh Gradients */}
      <div className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-[#3D5A45] rounded-full blur-[120px] opacity-60 pointer-events-none -z-10"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-[#8B5E34] rounded-full blur-[150px] opacity-40 pointer-events-none -z-10"></div>

      {/* Header */}
      <header className="bg-white/10 backdrop-blur-md border-b border-white/20 sticky top-0 z-50">
        {/* Extreme Weather Notification Banner */}
        <AnimatePresence>
          {activeAlerts.length > 0 && isNotificationsEnabled && (
            <motion.div 
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-gradient-to-r from-red-600/90 to-orange-600/90 backdrop-blur-md border-b border-white/20 p-3">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-2 sm:gap-4">
                  <div className="flex items-center gap-2 sm:gap-3 overflow-hidden flex-1">
                    <div className="p-1.5 bg-white/20 rounded-lg animate-pulse shrink-0">
                      <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-white truncate">{activeAlerts[0].title}</p>
                      <p className="text-[10px] sm:text-xs text-white/80 truncate hidden sm:block">{activeAlerts[0].message}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <button 
                      onClick={() => setView('cuaca')}
                      className="px-2 sm:px-3 py-1 sm:py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-[9px] sm:text-[10px] font-bold text-white transition-all uppercase tracking-wider whitespace-nowrap active:scale-95"
                    >
                      Cek Detail
                    </button>
                    <button 
                      onClick={() => setActiveAlerts(prev => prev.slice(1))}
                      className="p-1 hover:bg-white/10 rounded-full text-white/60 transition-all active:scale-95 shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="bg-white/10 border border-white/20 p-1.5 sm:p-2 rounded-lg text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)] shrink-0">
              <Leaf className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold font-sans tracking-tight text-[#E9EDC9] truncate">Agro-Vision <span className="text-[#CCD5AE]">AI</span></h1>
              <p className="text-[10px] sm:text-xs text-[#A3B18A] font-medium hidden sm:block truncate">Sistem Manajemen Pertanian Berkelanjutan</p>
            </div>
          </div>
          
          {/* Unified Navigation (Three Dots Menu) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Quick Access or Label (Optional, keeping it clean for now) */}
            <div className="hidden sm:block text-right mr-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#A3B18A] leading-none mb-1">Navigasi</p>
              <p className="text-[9px] text-gray-500 font-mono">{view.toUpperCase()}</p>
            </div>
            
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-1.5 sm:p-2 bg-white/10 border border-white/20 rounded-xl text-[#E9EDC9] hover:bg-white/20 transition-all shadow-lg active:scale-95"
            >
              {isMenuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <MoreVertical className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>
          </div>
        </div>

        {/* Global Menu Overlay (Works for Desktop and Mobile) */}
        <AnimatePresence>
          {isMenuOpen && (
            <>
              {/* Click outside to close backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMenuOpen(false)}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
              />
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                className="absolute left-0 right-0 top-full border-t border-white/10 bg-[#1B3022]/95 backdrop-blur-xl overflow-y-auto custom-scrollbar z-50 shadow-2xl max-h-[75vh] sm:max-h-none"
              >
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 p-4 sm:p-6 gap-3">
                  {[
                    { id: 'assistant', label: 'Asisten AI', icon: Send, desc: 'Diagnosis & Rekomendasi' },
                    { id: 'database', label: 'Ensiklopedia', icon: BookOpen, desc: 'Kamus Hama & Penyakit' },
                    { id: 'kalkulator', label: 'Kalkulator Pupuk', icon: Calculator, desc: 'Hitung Nutrisi Lahan' },
                    { id: 'cuaca', label: 'Cuaca Real-time', icon: CloudRain, desc: 'Peringatan Ekstrem' },
                    { id: 'laporan', label: 'Laporan Saya', icon: FileText, desc: 'Riwayat Analisis' },
                    { id: 'profil', label: 'Profil Petani', icon: User, desc: 'Identitas & Lahan' },
                    { id: 'pengaturan', label: 'Pengaturan', icon: Settings, desc: 'Konfigurasi Aplikasi' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setView(item.id as any);
                        setIsMenuOpen(false);
                      }}
                      className={`group p-4 rounded-3xl text-left transition-all border ${
                        view === item.id 
                          ? 'bg-[#E9EDC9] text-[#1B3022] border-[#E9EDC9] shadow-[0_0_20px_rgba(233,237,201,0.3)]' 
                          : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2.5 rounded-2xl ${
                          view === item.id ? 'bg-[#1B3022] text-[#E9EDC9]' : 'bg-white/10 text-[#A3B18A] group-hover:bg-white/20'
                        }`}>
                          <item.icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold">{item.label}</p>
                          <p className={`text-[10px] ${view === item.id ? 'opacity-80' : 'opacity-40'}`}>{item.desc}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-6 sm:mt-8 space-y-6 sm:space-y-8">
        {view === 'profil' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6 sm:space-y-8"
          >
            <div className="text-center space-y-2 sm:space-y-3 mb-6 sm:mb-10 text-pretty">
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#E9EDC9]">Profil Petani & Lahan</h2>
              <p className="text-[#CCD5AE] px-4 max-w-2xl mx-auto text-base sm:text-lg">
                Lengkapi data pertanian Anda untuk mendapatkan rekomendasi yang lebih akurat dan personal dari Agro-Vision AI.
              </p>
            </div>

            <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
              {/* Profile Sidebar/Summary */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 sm:p-8 shadow-2xl text-center">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 bg-[#E9EDC9] rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white/10 shadow-lg">
                    <User className="w-10 h-10 sm:w-12 sm:h-12 text-[#1B3022]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#E9EDC9]">{farmerProfile.name || 'Petani Hebat'}</h3>
                  <p className="text-sm text-[#A3B18A] mb-6">{farmerProfile.farmName || 'Lahan Pertanian'}</p>
                  
                  <div className="space-y-3 text-left">
                    <div className="flex items-center gap-3 text-xs text-gray-400 bg-white/5 p-3 rounded-xl border border-white/10">
                      <Scale className="w-4 h-4 text-[#A3B18A]" />
                      <span>Luas: <b className="text-white">{farmerProfile.farmSize || '0'} m²</b></span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 bg-white/5 p-3 rounded-xl border border-white/10">
                      <Leaf className="w-4 h-4 text-[#A3B18A]" />
                      <span>Metode: <b className="text-white">{farmerProfile.farmingMethod}</b></span>
                    </div>
                  </div>
                </div>

                <div className="bg-green-500/10 border border-green-500/20 rounded-3xl p-5 sm:p-6 text-center">
                  <ShieldAlert className="w-6 h-6 sm:w-8 sm:h-8 text-green-400 mx-auto mb-2" />
                  <p className="text-[10px] uppercase font-bold text-green-400 tracking-widest mb-1">Status Keamanan</p>
                  <p className="text-xs sm:text-sm text-gray-300">Data Anda tersimpan secara lokal dan aman di perangkat ini.</p>
                </div>
              </div>

              {/* Edit Form */}
              <div className="lg:col-span-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-5 sm:p-8 shadow-2xl space-y-6 sm:space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#A3B18A] ml-1">Nama Lengkap</label>
                    <input 
                      type="text"
                      value={farmerProfile.name}
                      onChange={(e) => setFarmerProfile({...farmerProfile, name: e.target.value})}
                      placeholder="Nama Anda"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-[#F4F1DE] outline-none focus:ring-2 focus:ring-[#E9EDC9]/30 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#A3B18A] ml-1">Nama Lahan / Kelompok</label>
                    <input 
                      type="text"
                      value={farmerProfile.farmName}
                      onChange={(e) => setFarmerProfile({...farmerProfile, farmName: e.target.value})}
                      placeholder="Maju Bersama"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-[#F4F1DE] outline-none focus:ring-2 focus:ring-[#E9EDC9]/30 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#A3B18A] ml-1">Lokasi Lahan</label>
                    <input 
                      type="text"
                      value={farmerProfile.farmLocation}
                      onChange={(e) => setFarmerProfile({...farmerProfile, farmLocation: e.target.value})}
                      placeholder="Desa, Kecamatan, Kota"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-[#F4F1DE] outline-none focus:ring-2 focus:ring-[#E9EDC9]/30 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#A3B18A] ml-1">Luas Lahan (m²)</label>
                    <input 
                      type="number"
                      value={farmerProfile.farmSize}
                      onChange={(e) => setFarmerProfile({...farmerProfile, farmSize: e.target.value})}
                      placeholder="1000"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-[#F4F1DE] outline-none focus:ring-2 focus:ring-[#E9EDC9]/30 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#A3B18A] ml-1">Pengalaman Bertani (Tahun)</label>
                    <input 
                      type="number"
                      value={farmerProfile.experienceYears}
                      onChange={(e) => setFarmerProfile({...farmerProfile, experienceYears: e.target.value})}
                      placeholder="5"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-[#F4F1DE] outline-none focus:ring-2 focus:ring-[#E9EDC9]/30 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#A3B18A] ml-1">Metode Bertani Utama</label>
                    <select 
                      value={farmerProfile.farmingMethod}
                      onChange={(e) => setFarmerProfile({...farmerProfile, farmingMethod: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-[#F4F1DE] outline-none focus:ring-2 focus:ring-[#E9EDC9]/30 transition-all appearance-none"
                    >
                      <option value="Organik">Sepenuhnya Organik</option>
                      <option value="Semi-Organik">Semi-Organik</option>
                      <option value="Konvensional">Konvensional</option>
                      <option value="Hidroponik">Hidroponik / Greenhouse</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#A3B18A] ml-1 block">Komoditas / Tanaman Utama</label>
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    {['Padi', 'Jagung', 'Cabai', 'Bawang Merah', 'Tomat', 'Singkong', 'Kedelai'].map(crop => (
                      <button
                        key={crop}
                        onClick={() => {
                          const crops = [...farmerProfile.mainCrops];
                          if (crops.includes(crop)) {
                            setFarmerProfile({...farmerProfile, mainCrops: crops.filter(c => c !== crop)});
                          } else {
                            setFarmerProfile({...farmerProfile, mainCrops: [...crops, crop]});
                          }
                        }}
                        className={`px-4 sm:px-6 py-2 rounded-full text-[10px] sm:text-xs font-bold transition-all border shrink-0 ${
                          farmerProfile.mainCrops.includes(crop)
                            ? 'bg-[#E9EDC9] text-[#1B3022] border-[#E9EDC9]'
                            : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/30 hover:bg-white/10'
                        }`}
                      >
                        {crop}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-500 italic">Pilih tanaman yang paling sering Anda tanam untuk mempersonalisasi tips harian.</p>
                </div>

                <div className="pt-6 border-t border-white/10">
                   <div className="flex items-center gap-4 bg-[#E9EDC9]/10 p-5 rounded-2xl border border-[#E9EDC9]/20">
                      <CheckCircle className="w-8 h-8 text-[#A3B18A]" />
                      <div>
                        <h4 className="font-bold text-[#E9EDC9]">Data Otomatis Tersimpan</h4>
                        <p className="text-xs text-gray-400">Setiap perubahan yang Anda buat akan langsung disimpan ke memori penyimpanan aplikasi.</p>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        {view === 'pengaturan' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 sm:space-y-8"
          >
            <div className="text-center space-y-2 sm:space-y-3 mb-6 sm:mb-10">
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#E9EDC9]">Pengaturan Aplikasi</h2>
              <p className="text-[#CCD5AE] px-4 max-w-2xl mx-auto text-base sm:text-lg">
                Sesuaikan pengalaman Agro-Vision Anda untuk pemberitahuan dan preferensi lainnya.
              </p>
            </div>

            <div className="max-w-2xl mx-auto bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-5 sm:p-8 shadow-2xl space-y-6 sm:space-y-8">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10 gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={`p-2.5 sm:p-3 rounded-xl ${isNotificationsEnabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                    {isNotificationsEnabled ? <Bell className="w-5 h-5 sm:w-6 sm:h-6" /> : <BellOff className="w-5 h-5 sm:w-6 sm:h-6" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-[#E9EDC9] text-sm sm:text-base">Notifikasi Cuaca Ekstrem</h4>
                    <p className="text-xs sm:text-sm text-gray-400 line-clamp-2">Sistem peringatan badai dan panas.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsNotificationsEnabled(!isNotificationsEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#E9EDC9] focus:ring-offset-2 focus:ring-offset-[#1B3022] ${
                    isNotificationsEnabled ? 'bg-green-500' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isNotificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-widest text-[#A3B18A]">Tentang Agro-Vision AI</h4>
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10 text-sm text-gray-300 space-y-4">
                  <p>
                    Agro-Vision AI adalah asisten pintar untuk petani Indonesia yang mendukung praktik pertanian berkelanjutan dan organik.
                  </p>
                  <div className="flex items-center gap-2 text-[#E9EDC9]">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span>Versi 1.1.0</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        {view === 'assistant' && (
          <>
            {/* Hidden when result exists or loading */}
            {!result && !isLoading && (
              <>
                {/* Intro */}
                <div className="text-center space-y-2 sm:space-y-3 mb-8 sm:mb-12">
                  <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#E9EDC9]">Solusi Pintar untuk Panen Optimal</h2>
                  <p className="text-[#CCD5AE] max-w-lg mx-auto text-base sm:text-lg leading-relaxed px-4">
                    Tanya tentang penyakit daun, minta panduan kalender tanam, atau berikan kondisi cuaca untuk menerima saran tindakan preventif organik.
                  </p>
                </div>

                {/* Input Card */}
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-2 sm:p-4 max-w-3xl mx-auto shadow-2xl focus-within:ring-2 focus-within:ring-[#E9EDC9]/50 focus-within:ring-offset-2 focus-within:ring-offset-[#1B3022] transition-all">
                  <div className="p-3 sm:p-5 rounded-2xl bg-white/5 border border-white/10">
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Contoh: 'Tiba-tiba banyak bercak hitam di daun cabai saya' atau 'Kapan waktu terbaik memupuk jagung umur 20 hari?'"
                      className="w-full bg-transparent border-none resize-none focus:ring-0 text-[#F4F1DE] placeholder:text-gray-400/80 min-h-[100px] text-lg outline-none"
                    />
                    
                    <AnimatePresence>
                      {image && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="relative inline-block mt-4 rounded-xl overflow-hidden shadow-sm border border-white/20"
                        >
                          <img src={image} alt="Preview Daun" className="h-32 object-cover" />
                          <button 
                            onClick={removeImage}
                            className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 backdrop-blur-sm transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex items-center justify-between mt-4 px-2">
                    <div className="flex gap-2">
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-[#A3B18A] bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-colors"
                      >
                        <ImageIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Unggah Foto</span>
                      </button>
                    </div>

                    <button 
                      onClick={handleSubmit}
                      disabled={isLoading || (!inputText.trim() && !image)}
                      className="flex items-center gap-2 px-8 py-3 text-sm font-bold text-[#1B3022] bg-[#E9EDC9] hover:bg-white disabled:bg-white/10 disabled:text-white/30 rounded-full transition-all shadow-lg hover:shadow-xl hover:scale-105 disabled:hover:scale-100 disabled:shadow-none"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Menganalisis
                        </>
                      ) : (
                        <>
                          Tanya AI <Send className="w-4 h-4 ml-1" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Error Handling */}
            {error && (
              <div className="max-w-3xl mx-auto mt-6 p-4 text-sm font-medium text-red-200 bg-red-500/20 backdrop-blur-md rounded-2xl border border-red-500/40 flex items-center gap-3 shadow-lg">
                <AlertTriangle className="w-5 h-5 shrink-0 text-red-400" />
                <p>{error}</p>
              </div>
            )}

            {/* Loading Indicator */}
            {isLoading && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-3xl mx-auto mt-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 sm:p-14 shadow-2xl flex flex-col items-center justify-center space-y-8"
              >
                <div className="relative w-24 h-24 flex items-center justify-center">
                  {/* Glowing background */}
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.3, 0.6, 0.3],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="absolute inset-0 bg-[#E9EDC9]/30 rounded-full blur-xl"
                  />
                  
                  {/* Dots / Nucleus */}
                  <div className="relative flex gap-2.5">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{
                          y: ["0%", "-50%", "0%"],
                          scale: [1, 1.2, 1]
                        }}
                        transition={{
                          duration: 0.8,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: i * 0.15
                        }}
                        className="w-3.5 h-3.5 bg-[#E9EDC9] rounded-full shadow-[0_0_15px_rgba(233,237,201,0.8)]"
                      />
                    ))}
                  </div>
                  
                  {/* Outer spinning ring indicator logic */}
                  <motion.svg 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 w-full h-full text-[#E9EDC9]/40 drop-shadow-[0_0_8px_rgba(233,237,201,0.5)]" 
                    viewBox="0 0 100 100"
                  >
                    <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="60 40" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="30 20" className="opacity-50" />
                  </motion.svg>

                  <motion.svg 
                    animate={{ rotate: -360 }}
                    transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-2 w-[calc(100%-16px)] h-[calc(100%-16px)] text-green-400/30" 
                    viewBox="0 0 100 100"
                  >
                    <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="15 30" />
                  </motion.svg>
                </div>
                
                <div className="space-y-3 text-center">
                  <motion.div 
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="flex items-center gap-2 justify-center"
                  >
                    <Sparkles className="w-5 h-5 text-[#E9EDC9]" />
                    <p className="text-[#E9EDC9] font-bold text-lg sm:text-xl tracking-wide uppercase">
                      Agro-Vision AI Menganalisis
                    </p>
                    <Sparkles className="w-5 h-5 text-[#E9EDC9]" />
                  </motion.div>
                  <p className="text-[#A3B18A] text-xs sm:text-sm max-w-sm mx-auto leading-relaxed">
                    Memproses konteks lahan, mengumpulkan data agrikultur, dan merumuskan rekomendasi khusus untuk Anda...
                  </p>
                </div>
              </motion.div>
            )}

            {/* Result Area */}
            {!isLoading && result && (
              <div className="w-full max-w-3xl mx-auto mt-6 mb-4 flex justify-between items-center px-2">
                <button 
                  onClick={() => {
                    setResult(null);
                    setInputText('');
                    setImage(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#E9EDC9] hover:bg-white/10 rounded-full transition-colors active:scale-95"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Pertanyaan Baru
                </button>
              </div>
            )}
            {!isLoading && renderResult()}
          </>
        )}

        {view === 'database' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6 sm:space-y-8"
          >
            <div className="text-center space-y-2 sm:space-y-3 mb-6 sm:mb-10 text-pretty">
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#E9EDC9]">Kamus Hama & Penyakit</h2>
              <p className="text-[#CCD5AE] px-4 max-w-2xl mx-auto text-base sm:text-lg">
                Kenali ciri hama dan penyakit utama di Indonesia beserta siklusnya untuk strategi penanganan yang tepat.
              </p>
            </div>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto group px-2 sm:px-0">
              <div className="relative">
                <input
                  type="text"
                  value={searchPest}
                  onChange={(e) => setSearchPest(e.target.value)}
                  placeholder="Cari... (Misal: Wereng, Xanthomonas)"
                  className="w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-5 py-4 pl-12 sm:pl-14 text-[#F4F1DE] placeholder:text-gray-500 focus:ring-2 focus:ring-[#E9EDC9]/50 focus:border-transparent outline-none shadow-xl transition-all group-hover:bg-white/15 text-sm sm:text-base"
                />
                <BookOpen className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-[#A3B18A]" />
                {searchPest && (
                  <button 
                    onClick={() => setSearchPest('')}
                    className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {PEST_DATABASE.filter(pest => 
                pest.commonName.toLowerCase().includes(searchPest.toLowerCase()) || 
                pest.scientificName.toLowerCase().includes(searchPest.toLowerCase())
              ).map((pest) => (
                <motion.div 
                  layout
                  whileHover={{ y: -5 }}
                  onClick={() => setSelectedPest(pest)}
                  key={pest.id} 
                  className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2rem] sm:rounded-3xl overflow-hidden flex flex-col shadow-2xl group hover:border-white/40 transition-all cursor-pointer"
                >
                  <div className="relative h-48 sm:h-56 overflow-hidden">
                    <img 
                      src={pest.image} 
                      alt={pest.commonName} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1B3022] to-transparent opacity-90"></div>
                    <div className="absolute bottom-4 left-5 sm:left-6 right-5 sm:right-6">
                      <h3 className="text-xl sm:text-2xl font-serif text-[#E9EDC9] tracking-wide line-clamp-1">{pest.commonName}</h3>
                      <p className="text-xs sm:text-sm font-mono text-[#A3B18A] tracking-wider italic mt-1 line-clamp-1">{pest.scientificName}</p>
                    </div>
                  </div>
                  <div className="p-5 sm:p-6 space-y-4 sm:space-y-6 flex-1 flex flex-col">
                    <div className="space-y-2">
                       <h4 className="text-[10px] sm:text-xs font-bold uppercase text-[#D4A373] tracking-widest flex items-center gap-2">
                         <AlertTriangle className="w-3.5 h-3.5" />
                         Gejala Serangan
                       </h4>
                       <p className="text-xs sm:text-sm text-gray-300 leading-relaxed pl-5 sm:pl-6 line-clamp-3 font-medium">{pest.symptoms}</p>
                    </div>
                  </div>
                  <div className="px-5 sm:px-6 pb-5 sm:pb-6 mt-auto">
                    <button className="w-full py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] sm:text-xs font-bold text-[#E9EDC9] group-hover:bg-[#E9EDC9] group-hover:text-[#1B3022] transition-all flex items-center justify-center gap-2">
                       Detail Selengkapnya <Info className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
              {PEST_DATABASE.filter(pest => 
                pest.commonName.toLowerCase().includes(searchPest.toLowerCase()) || 
                pest.scientificName.toLowerCase().includes(searchPest.toLowerCase())
              ).length === 0 && (
                <div className="col-span-full py-20 text-center bg-white/5 border border-white/10 border-dashed rounded-3xl">
                   <AlertTriangle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                   <p className="text-gray-400 font-bold">Tidak ada data ditemukan untuk "{searchPest}"</p>
                   <button 
                     onClick={() => setSearchPest('')}
                     className="mt-4 text-[#E9EDC9] hover:underline transition-all text-sm font-bold"
                   >
                     Reset Pencarian
                   </button>
                </div>
              )}
            </div>

            {/* Pest Detail Modal */}
            <AnimatePresence>
              {selectedPest && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSelectedPest(null)}
                    className="absolute inset-0 bg-black/80 backdrop-blur-md"
                  />
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative w-full max-w-2xl bg-[#1B3022] border border-white/20 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]"
                  >
                    <div className="relative h-48 sm:h-64 shrink-0">
                       <img 
                         src={selectedPest.image} 
                         alt={selectedPest.commonName} 
                         className="w-full h-full object-cover"
                       />
                       <div className="absolute inset-0 bg-gradient-to-t from-[#1B3022] via-[#1B3022]/40 to-transparent"></div>
                       <button 
                        onClick={() => setSelectedPest(null)}
                        className="absolute top-4 sm:top-6 right-4 sm:right-6 p-2 bg-black/40 hover:bg-red-500/60 rounded-xl text-white transition-all backdrop-blur-md border border-white/10"
                      >
                        <X className="w-6 h-6" />
                      </button>
                      <div className="absolute bottom-4 sm:bottom-6 left-6 sm:left-8 right-6 sm:right-8">
                        <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#A3B18A] block mb-1 sm:mb-2 px-3 py-1 bg-white/5 border border-white/10 w-fit rounded-full">Database Ensiklopedia</span>
                        <h2 className="text-2xl sm:text-4xl font-serif text-[#E9EDC9] tracking-tight truncate">{selectedPest.commonName}</h2>
                        <p className="text-sm sm:text-lg font-mono text-[#A3B18A] tracking-wider italic mt-0.5 sm:mt-1 truncate">{selectedPest.scientificName}</p>
                      </div>
                    </div>

                    <div className="p-5 sm:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6 sm:space-y-8">
                       <div className="space-y-3 sm:space-y-4">
                         <h4 className="text-[10px] sm:text-xs font-bold uppercase text-[#D4A373] tracking-[0.2em] flex items-center gap-2">
                           <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                           Gejala & Tanda
                         </h4>
                         <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 text-sm sm:text-base text-gray-300 leading-relaxed italic">
                           {selectedPest.symptoms}
                         </div>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                         <div className="space-y-3 sm:space-y-4">
                           <h4 className="text-[10px] sm:text-xs font-bold uppercase text-[#A3B18A] tracking-[0.2em] flex items-center gap-2">
                             <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                             Siklus Hidup
                           </h4>
                           <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 text-xs sm:text-sm text-gray-400 leading-relaxed">
                             {selectedPest.lifeCycle}
                           </div>
                         </div>
                         <div className="space-y-3 sm:space-y-4">
                           <h4 className="text-[10px] sm:text-xs font-bold uppercase text-green-400 tracking-[0.2em] flex items-center gap-2">
                             <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                             Pengendalian
                           </h4>
                           <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 text-xs sm:text-sm text-gray-300 leading-relaxed">
                              Gunakan Deteksi AI untuk langkah spesifik stadium tanaman.
                           </div>
                         </div>
                       </div>

                       <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 sm:p-6 flex gap-3 sm:gap-4 items-start">
                         <div className="p-2.5 sm:p-3 bg-orange-500/20 rounded-xl text-orange-400 shrink-0">
                           <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
                         </div>
                         <div>
                            <h5 className="font-bold text-[#E9EDC9] mb-0.5 sm:mb-1 text-sm sm:text-base">Peringatan Tindakan</h5>
                            <p className="text-[10px] sm:text-xs text-gray-400 leading-relaxed">Prioritaskan organik (Mimba, Gadung) sebelum kimiawi.</p>
                         </div>
                       </div>
                    </div>

                    <div className="p-5 sm:p-8 border-t border-white/10 bg-black/20">
                       <button
                         onClick={() => setSelectedPest(null)}
                         className="w-full py-3.5 sm:py-4 bg-[#E9EDC9] text-[#1B3022] rounded-2xl font-bold hover:bg-white transition-all shadow-xl active:scale-95"
                       >
                         Tutup Detail
                       </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {view === 'kalkulator' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6 sm:space-y-8"
          >
            <div className="text-center space-y-2 sm:space-y-3 mb-6 sm:mb-10 text-pretty">
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#E9EDC9]">Kalkulator Pupuk Organik</h2>
              <p className="text-[#CCD5AE] px-4 max-w-2xl mx-auto text-base sm:text-lg">
                Hitung estimasi kebutuhan pupuk organik (Kompos atau POC) berdasarkan luas lahan Anda.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-5 sm:p-8 max-w-3xl mx-auto shadow-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                <div className="space-y-6 border-b md:border-b-0 md:border-r border-white/10 pb-6 sm:pb-8 md:pb-0 md:pr-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#A3B18A] block ml-1">
                      Luas Lahan (m²)
                    </label>
                    <input 
                      type="number" 
                      value={landArea}
                      onChange={(e) => setLandArea(e.target.value ? Number(e.target.value) : '')}
                      placeholder="Contoh: 1000"
                      className="w-full bg-white/5 border border-white/20 rounded-2xl px-5 py-3 text-[#F4F1DE] focus:ring-2 focus:ring-[#E9EDC9]/50 focus:border-transparent outline-none transition-all text-sm sm:text-lg"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#A3B18A] block ml-1">
                      Jenis Pupuk Organik
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setFertilizerType('kompos')}
                        className={`py-3 px-4 rounded-2xl flex flex-col items-center gap-2 transition-all border active:scale-95 ${
                          fertilizerType === 'kompos'
                            ? 'bg-[#E9EDC9] text-[#1B3022] border-[#E9EDC9] shadow-lg'
                            : 'bg-white/5 text-gray-400 hover:text-[#CCD5AE] border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <Scale className="w-5 h-5 sm:w-6 sm:h-6" />
                        <span className="font-bold text-[10px] sm:text-sm">Kompos Padat</span>
                      </button>
                      <button
                        onClick={() => setFertilizerType('poc')}
                        className={`py-3 px-4 rounded-2xl flex flex-col items-center gap-2 transition-all border active:scale-95 ${
                          fertilizerType === 'poc'
                            ? 'bg-[#E9EDC9] text-[#1B3022] border-[#E9EDC9] shadow-lg'
                            : 'bg-white/5 text-gray-400 hover:text-[#CCD5AE] border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <Droplets className="w-5 h-5 sm:w-6 sm:h-6" />
                        <span className="font-bold text-[10px] sm:text-sm">POC (Cair)</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-center space-y-4 pt-2 sm:pt-0">
                  <h3 className="text-base sm:text-lg font-bold text-[#E9EDC9] ml-1">Estimasi Kebutuhan</h3>
                  
                  {landArea ? (
                    <div className="bg-[#E9EDC9]/5 rounded-2xl p-5 sm:p-6 border border-[#E9EDC9]/20 shadow-inner">
                      {fertilizerType === 'kompos' ? (
                        <>
                          <div className="flex items-end gap-2 text-green-400 mb-2">
                            <span className="text-3xl sm:text-4xl font-bold font-mono">{(Number(landArea) / 10000 * 2000).toLocaleString('id-ID')}</span>
                            <span className="text-lg sm:text-xl mb-1 font-serif">Kg</span>
                          </div>
                          <p className="text-xs sm:text-sm text-gray-400 leading-relaxed italic">
                            Taburkan secara merata pada bedengan sebelum proses tanam (2 ton/Ha).
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-end gap-2 text-blue-400 mb-2">
                            <span className="text-3xl sm:text-4xl font-bold font-mono">{(Number(landArea) / 1000 * 10).toLocaleString('id-ID')}</span>
                            <span className="text-lg sm:text-xl mb-1 font-serif">Liter</span>
                          </div>
                          <p className="text-xs sm:text-sm text-gray-400 leading-relaxed italic">
                            Semprotkan rutin setiap 1-2 minggu. Encerkan dengan air (1:10).
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10 border-dashed text-center">
                      <p className="text-gray-400 text-xs sm:text-sm">Masukkan luas lahan untuk melihat hasil.</p>
                    </div>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => addToReport({
                      luas: landArea,
                      jenis: fertilizerType === 'kompos' ? 'Kompos Padat' : 'POC',
                      kebutuhan: `${landArea ? (fertilizerType === 'kompos' ? (Number(landArea) / 10000 * 2000).toLocaleString('id-ID') : (Number(landArea) / 1000 * 10).toLocaleString('id-ID')) : '0'} ${fertilizerType === 'kompos' ? 'Kg' : 'Liter'}`
                    }, 'kalkulator')}
                    disabled={!landArea}
                    className="w-full py-3 sm:py-4 bg-[#E9EDC9] text-[#1B3022] font-bold rounded-2xl hover:bg-white transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 min-h-[48px]"
                  >
                    <Download className="w-5 h-5" /> Simpan Laporan
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'cuaca' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            <div className="text-center space-y-3 mb-10">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#E9EDC9]">Sistem Informasi Cuaca Pertanian</h2>
              <p className="text-[#CCD5AE] px-4 max-w-2xl mx-auto text-lg">
                Dapatkan prediksi cuaca di lokasi Anda dan analisis dampaknya terhadap tanaman Anda melalui AI.
              </p>
            </div>

            <div className="max-w-3xl mx-auto space-y-6">
              {!weatherData ? (
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 text-center shadow-2xl">
                  <CloudRain className="w-16 h-16 text-[#A3B18A] mx-auto mb-4 opacity-50" />
                  <h3 className="text-xl font-bold text-[#E9EDC9] mb-2">Periksa Cuaca Saat Ini</h3>
                  <p className="text-[#CCD5AE] mb-6">Kami memerlukan akses lokasi Anda untuk memberikan prakiraan cuaca yang akurat atau ketik nama kota Anda di bawah.</p>
                  
                  <div className="max-w-md mx-auto space-y-4">
                    <button
                      onClick={fetchWeatherData}
                      disabled={isWeatherLoading}
                      className="w-full py-3 bg-[#E9EDC9] text-[#1B3022] font-bold rounded-full hover:scale-105 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:hover:scale-100"
                    >
                      {isWeatherLoading && !searchCity ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Sedang Mengambil Data...</>
                      ) : (
                        <><ShieldAlert className="w-5 h-5" /> Deteksi Lokasi Otomatis</>
                      )}
                    </button>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-white/10"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-[#1B3022] text-gray-400 font-bold uppercase tracking-widest text-[10px]">Atau Cari Manual</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={searchCity}
                        onChange={(e) => setSearchCity(e.target.value)}
                        placeholder="Nama Kota (Contoh: Jakarta)"
                        className="flex-1 bg-white/5 border border-white/20 rounded-xl px-4 py-2 text-[#F4F1DE] focus:ring-2 focus:ring-[#E9EDC9] outline-none"
                        onKeyDown={(e) => e.key === 'Enter' && fetchWeatherByCity()}
                      />
                      <button
                        onClick={fetchWeatherByCity}
                        disabled={isWeatherLoading}
                        className="px-4 py-2 bg-white/10 border border-white/20 text-[#E9EDC9] rounded-xl hover:bg-white/20 transition-all disabled:opacity-50"
                      >
                        {isWeatherLoading && searchCity ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {weatherError && (
                    <p className="text-red-400 text-sm mt-4">{weatherError}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Weather Dashboard */}
                  <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-5 sm:p-6 shadow-2xl">
                    <div className="flex justify-between items-start mb-6 border-b border-white/10 pb-6 gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-xl sm:text-2xl font-bold text-[#E9EDC9]">{weatherLocation}</h3>
                          <button 
                            onClick={() => { setWeatherData(null); setWeatherAIAnalysis(null); }}
                            className="p-1 hover:bg-white/10 rounded-lg text-[#A3B18A] transition-all"
                            title="Ganti Lokasi"
                          >
                            <CalendarDays className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm text-[#A3B18A]">Cuaca Real-time / Prediksi Harian</p>
                      </div>
                      <div className="text-right">
                        <div className="text-4xl font-mono font-bold text-white mb-1">
                          {weatherData.current_weather.temperature}°C
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest text-[#CCD5AE]">Suhu Saat Ini</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-center">
                        <ThermometerSun className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                        <div className="text-sm text-gray-400">Rentang Suhu</div>
                        <div className="font-bold text-[#E9EDC9]">{weatherData.daily.temperature_2m_min[0]}° - {weatherData.daily.temperature_2m_max[0]}°</div>
                      </div>
                      <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-center">
                        <CloudRain className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                        <div className="text-sm text-gray-400">Peluang Hujan</div>
                        <div className="font-bold text-[#E9EDC9]">{weatherData.daily.precipitation_probability_max[0]}%</div>
                      </div>
                      <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-center">
                        <Leaf className="w-6 h-6 text-green-400 mx-auto mb-2" />
                        <div className="text-sm text-gray-400">Angin</div>
                        <div className="font-bold text-[#E9EDC9]">{weatherData.current_weather.windspeed} km/j</div>
                      </div>
                    </div>
                  </div>

                  {/* AI Prediction Input */}
                  <div className="bg-white/10 backdrop-blur-xl border border-[#E9EDC9]/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                      <Scale className="w-32 h-32" />
                    </div>
                    <h3 className="text-lg font-bold text-[#E9EDC9] mb-4 relative z-10">Analisis Dampak Tanaman</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 relative z-10">
                      <input
                        type="text"
                        value={cropType}
                        onChange={(e) => setCropType(e.target.value)}
                        placeholder="Jenis Tanaman (Misal: Jagung)"
                        className="bg-white/5 border border-white/20 rounded-xl px-4 py-2 text-[#F4F1DE] focus:ring-2 focus:ring-[#E9EDC9] outline-none w-full"
                      />
                      <input
                        type="text"
                        value={cropAge}
                        onChange={(e) => setCropAge(e.target.value)}
                        placeholder="Umur (Misal: 2 Minggu)"
                        className="bg-white/5 border border-white/20 rounded-xl px-4 py-2 text-[#F4F1DE] focus:ring-2 focus:ring-[#E9EDC9] outline-none w-full"
                      />
                    </div>
                    {weatherError && <p className="text-red-400 text-sm mb-4 relative z-10">{weatherError}</p>}
                      <button
                        onClick={handleWeatherAnalysis}
                        disabled={isWeatherAILoading}
                        className="w-full py-3 bg-[#E9EDC9] text-[#1B3022] font-bold rounded-xl hover:bg-white transition-colors relative z-10 flex justify-center items-center gap-2 shadow-lg disabled:opacity-75"
                      >
                        {isWeatherAILoading ? (
                          <><Loader2 className="w-5 h-5 animate-spin" /> Menganalisis Dampak...</>
                        ) : (
                          <><Send className="w-4 h-4" /> Dapatkan Tindakan Preventif</>
                        )}
                      </button>
                    </div>
  
                    {/* AI Response Display */}
                    {weatherAIAnalysis && weatherAIAnalysis.kategori_respons === 'tindakan_cuaca' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-5 sm:p-6 shadow-2xl mt-6"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10 mb-6 gap-3">
                          <div className="flex items-center gap-3">
                             <span className="text-xs font-medium text-gray-300">Risiko:</span>
                             {getSeverityBadge(weatherAIAnalysis.tingkat_risiko || '')}
                          </div>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => addToReport(weatherAIAnalysis, 'cuaca')}
                            className="w-full sm:w-auto p-2 bg-white/10 border border-white/20 rounded-xl text-[#E9EDC9] hover:bg-white/20 transition-all flex items-center justify-center gap-2 text-xs font-bold active:scale-95"
                          >
                            <Download className="w-4 h-4" />
                            Simpan Laporan
                          </motion.button>
                        </div>

                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase text-[#A3B18A] tracking-widest flex items-center gap-2">
                          <Info className="w-4 h-4 text-blue-400" />
                          Analisis Singkat
                        </h4>
                        <p className="text-gray-300 pl-6 text-sm">{weatherAIAnalysis.analisis_singkat}</p>
                      </div>

                      <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-3 mt-6">
                        <h4 className="text-xs font-bold uppercase text-[#D4A373] tracking-widest flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          Tindakan Preventif
                        </h4>
                        <div className="grid gap-2 pl-6">
                          {weatherAIAnalysis.tindakan_preventif?.map((tindak: string, idx: number) => (
                            <div key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                              <span className="text-green-400 mt-0.5">•</span>
                              <span>{tindak}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {view === 'laporan' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6 sm:space-y-8"
          >
            <div className="text-center space-y-2 sm:space-y-3 mb-6 sm:mb-10 text-pretty">
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#E9EDC9]">Laporan Pertanian Saya</h2>
              <p className="text-[#CCD5AE] px-4 max-w-2xl mx-auto text-base sm:text-lg">
                Kumpulan diagnosis, jadwal tanam, dan analisis cuaca yang telah Anda simpan.
              </p>
            </div>

            <div className="max-w-4xl mx-auto space-y-6">
              {reportItems.length === 0 ? (
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 sm:p-12 text-center shadow-2xl">
                  <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-[#A3B18A] mx-auto mb-4 opacity-50" />
                  <h3 className="text-xl font-bold text-[#E9EDC9] mb-2">Belum Ada Laporan</h3>
                  <p className="text-[#CCD5AE] mb-8 text-sm sm:text-base">Gunakan asisten AI untuk mendeteksi penyakit atau menganalisis cuaca, lalu tekan tombol "Simpan Laporan".</p>
                  <button
                    onClick={() => setView('assistant')}
                    className="px-8 py-3 bg-[#E9EDC9] text-[#1B3022] font-bold rounded-full hover:scale-105 transition-all shadow-lg flex items-center gap-2 mx-auto active:scale-95"
                  >
                    <Send className="w-5 h-5" /> Mulai Analisis Baru
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {/* Header Info & Export */}
                    <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white/5 p-4 rounded-3xl border border-white/10">
                      <div className="flex items-center justify-center sm:justify-start gap-2 text-sm text-[#A3B18A] font-bold">
                        <FileText className="w-5 h-5 text-green-400" />
                        <span>{reportItems.length} Total Laporan</span>
                      </div>
                      <div className="flex gap-2">
                         <button
                          onClick={exportToCSV}
                          className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-[#E9EDC9] hover:bg-white/20 transition-all flex items-center justify-center gap-2 text-[10px] sm:text-xs font-bold active:scale-95 min-h-[44px]"
                        >
                          <Download className="w-4 h-4" /> CSV
                        </button>
                        <button
                          onClick={exportToPDF}
                          className="flex-1 px-4 py-2 bg-[#E9EDC9] text-[#1B3022] rounded-xl hover:bg-white transition-all flex items-center justify-center gap-2 text-[10px] sm:text-xs font-bold active:scale-95 min-h-[44px]"
                        >
                          <FileText className="w-4 h-4" /> PDF
                        </button>
                      </div>
                    </div>

                    {/* Filter Controls */}
                    <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldAlert className="w-4 h-4 text-[#A3B18A]" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#A3B18A]">Filter Laporan</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Tipe Laporan</label>
                          <select 
                            value={reportFilterType}
                            onChange={(e) => setReportFilterType(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-[#F4F1DE] outline-none focus:ring-1 focus:ring-[#E9EDC9]/30 transition-all"
                          >
                            <option value="semua">Semua Tipe</option>
                            <option value="diagnosis">Deteksi Penyakit</option>
                            <option value="kalender">Kalender Tanam</option>
                            <option value="cuaca">Analisis Cuaca</option>
                            <option value="kalkulator">Kalkulator Pupuk</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Dari Tanggal</label>
                          <input 
                            type="date"
                            value={reportStartDate}
                            onChange={(e) => setReportStartDate(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-[#F4F1DE] outline-none focus:ring-1 focus:ring-[#E9EDC9]/30 transition-all [color-scheme:dark]"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Sampai Tanggal</label>
                          <div className="relative">
                            <input 
                              type="date"
                              value={reportEndDate}
                              onChange={(e) => setReportEndDate(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-[#F4F1DE] outline-none focus:ring-1 focus:ring-[#E9EDC9]/30 transition-all [color-scheme:dark]"
                            />
                            {(reportFilterType !== 'semua' || reportStartDate || reportEndDate) && (
                              <button 
                                onClick={() => {
                                  setReportFilterType('semua');
                                  setReportStartDate('');
                                  setReportEndDate('');
                                }}
                                className="absolute -right-1 -top-8 text-[10px] text-red-400 hover:text-red-300 font-bold uppercase transition-colors"
                              >
                                Reset Filter
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {reportItems
                      .filter(item => {
                        // Type Filter
                        if (reportFilterType !== 'semua' && item.type !== reportFilterType) return false;
                        
                        // Date filtering
                        // item.timestamp is like "8/5/2024, 10:30:00" or similar local format
                        // For basic robustness, we'll try to compare dates
                        const itemDateParts = item.timestamp.split(',')[0].split('/');
                        // Expected: [day, month, year] from id-ID
                        const itemDate = new Date(Number(itemDateParts[2]), Number(itemDateParts[1]) - 1, Number(itemDateParts[0]));
                        
                        if (reportStartDate) {
                          const start = new Date(reportStartDate);
                          start.setHours(0,0,0,0);
                          if (itemDate < start) return false;
                        }
                        
                        if (reportEndDate) {
                          const end = new Date(reportEndDate);
                          end.setHours(23,59,59,999);
                          if (itemDate > end) return false;
                        }
                        
                        return true;
                      })
                      .map((item) => (
                      <motion.div 
                        layout
                        whileHover={{ y: -8, scale: 1.01 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        onClick={() => setSelectedReportItem(item)}
                        key={item.id} 
                        className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl overflow-hidden flex flex-col shadow-2xl group hover:border-white/40 hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition-all duration-500 cursor-pointer"
                      >
                        {/* Card Header with Icon Background */}
                        <div className={`relative h-24 flex items-center justify-center overflow-hidden ${
                          item.type === 'diagnosis' ? 'bg-gradient-to-br from-green-500/20 to-emerald-900/40' :
                          item.type === 'kalender' ? 'bg-gradient-to-br from-blue-500/20 to-indigo-900/40' :
                          item.type === 'cuaca' ? 'bg-gradient-to-br from-yellow-500/20 to-orange-900/40' :
                          'bg-gradient-to-br from-orange-500/20 to-amber-900/40'
                        }`}>
                          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                          
                          <div className={`p-4 rounded-2xl border border-white/20 backdrop-blur-md shadow-xl z-10 ${
                            item.type === 'diagnosis' ? 'text-green-400' :
                            item.type === 'kalender' ? 'text-blue-400' :
                            item.type === 'cuaca' ? 'text-yellow-400' :
                            'text-orange-400'
                          }`}>
                            {item.type === 'diagnosis' && <Leaf className="w-8 h-8" />}
                            {item.type === 'kalender' && <CalendarDays className="w-8 h-8" />}
                            {item.type === 'cuaca' && <ThermometerSun className="w-8 h-8" />}
                            {item.type === 'kalkulator' && <Scale className="w-8 h-8" />}
                          </div>

                          <div className="absolute top-4 right-4 z-20">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                removeItemFromReport(item.id);
                              }}
                              className="p-2 bg-black/20 hover:bg-red-500/40 text-white/60 hover:text-white rounded-xl transition-all backdrop-blur-sm border border-white/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="p-6 flex-1 flex flex-col pt-4">
                          <div className="flex items-center gap-2 mb-2">
                             <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A3B18A] leading-none">{item.type}</span>
                             <span className="w-1 h-1 rounded-full bg-white/20"></span>
                             <p className="text-[9px] text-gray-500 font-mono">{item.timestamp}</p>
                          </div>

                          <h4 className="text-lg font-bold text-[#E9EDC9] leading-tight mb-3 group-hover:text-white transition-colors">
                            {item.type === 'diagnosis' ? (item.data.diagnosis || 'Diagnosis Tanaman') : 
                             item.type === 'kalender' ? `Program ${item.data.tanaman}` : 
                             item.type === 'kalkulator' ? 'Kalkulasi Nutrisi' :
                             'Analisis Cuaca'}
                          </h4>
                          
                          <div className="text-xs text-gray-400 line-clamp-3 mb-6 flex-1 leading-relaxed italic border-l border-white/10 pl-3">
                            {item.type === 'diagnosis' ? item.data.penjelasan : 
                             item.type === 'kalender' ? `${item.data.jadwal?.length} aktivitas pemeliharaan terjadwal.` : 
                             item.type === 'kalkulator' ? `Dosis ${item.data.kebutuhan} untuk luas lahan ${item.data.luas} m².` : 
                             item.data.analisis_singkat}
                          </div>

                          <div className="pt-4 border-t border-white/5 flex items-center justify-between mt-auto">
                             <div className="flex gap-2">
                               {item.type === 'diagnosis' && item.data.tingkat_keparahan && (
                                 <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase border ${
                                   item.data.tingkat_keparahan === 'Tinggi' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                                   item.data.tingkat_keparahan === 'Sedang' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                                   'bg-green-500/20 text-green-300 border-green-500/30'
                                 }`}>
                                   {item.data.tingkat_keparahan}
                                 </span>
                               )}
                               {(item.type === 'cuaca' || item.type === 'diagnosis') && (
                                  <span className="px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase border bg-white/5 text-gray-400 border-white/10">
                                    AI Verified
                                  </span>
                               )}
                             </div>
                             <div 
                               onClick={() => setSelectedReportItem(item)}
                               className="flex items-center gap-1 text-[10px] font-bold text-[#E9EDC9] group-hover:gap-2 transition-all cursor-pointer hover:text-white"
                             >
                               View <Send className="w-3 h-3" />
                             </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Detail Report Modal */}
                  <AnimatePresence>
                    {selectedReportItem && (
                      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setSelectedReportItem(null)}
                          className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        />
                        <motion.div
                          initial={{ scale: 0.9, opacity: 0, y: 20 }}
                          animate={{ scale: 1, opacity: 1, y: 0 }}
                          exit={{ scale: 0.9, opacity: 0, y: 20 }}
                          className="relative w-full max-w-2xl bg-[#1B3022] border border-white/20 rounded-3xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]"
                        >
                          {/* Modal Header */}
                          <div className={`p-5 sm:p-8 pb-4 flex justify-between items-start ${
                            selectedReportItem.type === 'diagnosis' ? 'bg-gradient-to-b from-green-500/10 to-transparent' :
                            selectedReportItem.type === 'kalender' ? 'bg-gradient-to-b from-blue-500/10 to-transparent' :
                            selectedReportItem.type === 'cuaca' ? 'bg-gradient-to-b from-yellow-500/10 to-transparent' :
                            'bg-gradient-to-b from-orange-500/10 to-transparent'
                          }`}>
                            <div className="flex items-center gap-4">
                              <div className={`p-4 rounded-2xl border border-white/10 ${
                                selectedReportItem.type === 'diagnosis' ? 'bg-green-500/20 text-green-400' :
                                selectedReportItem.type === 'kalender' ? 'bg-blue-500/20 text-blue-400' :
                                selectedReportItem.type === 'cuaca' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-orange-500/20 text-orange-400'
                              }`}>
                                {selectedReportItem.type === 'diagnosis' && <Leaf className="w-6 h-6" />}
                                {selectedReportItem.type === 'kalender' && <CalendarDays className="w-6 h-6" />}
                                {selectedReportItem.type === 'cuaca' && <ThermometerSun className="w-6 h-6" />}
                                {selectedReportItem.type === 'kalkulator' && <Scale className="w-6 h-6" />}
                              </div>
                              <div>
                                <span className="text-xs font-bold uppercase tracking-widest text-[#A3B18A] block mb-1">{selectedReportItem.type}</span>
                                <h3 className="text-2xl font-bold text-[#E9EDC9]">
                                  {selectedReportItem.type === 'diagnosis' ? selectedReportItem.data.diagnosis : 
                                   selectedReportItem.type === 'kalender' ? `Kalender ${selectedReportItem.data.tanaman}` :
                                   selectedReportItem.type === 'kalkulator' ? 'Kalkulasi Pupuk' :
                                   'Analisis Cuaca Lengkap'}
                                </h3>
                              </div>
                            </div>
                            <button 
                              onClick={() => setSelectedReportItem(null)}
                              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white/60 hover:text-white transition-all shadow-lg shadow-black/20"
                            >
                              <X className="w-6 h-6" />
                            </button>
                          </div>

                          {/* Modal Body */}
                          <div className="p-8 pt-4 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                             <div className="flex items-center gap-2 text-xs text-gray-500 font-mono bg-black/20 self-start px-3 py-1 rounded-full border border-white/5">
                                <CalendarDays className="w-3 h-3" />
                                {selectedReportItem.timestamp}
                             </div>

                             {selectedReportItem.type === 'diagnosis' && (
                               <div className="space-y-6">
                                 <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                   <label className="text-[10px] uppercase font-bold text-[#A3B18A] tracking-[0.2em] mb-4 block">Hasil Diagnosis & Penjelasan</label>
                                   <p className="text-gray-200 leading-relaxed italic border-l-4 border-green-500/50 pl-6 text-lg">{selectedReportItem.data.penjelasan}</p>
                                 </div>
                                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                   <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                     <label className="text-[10px] uppercase font-bold text-[#A3B18A] tracking-[0.2em] mb-3 block">Rekomendasi Penanganan</label>
                                     <p className="text-sm text-gray-300 leading-relaxed font-mono">{selectedReportItem.data.rekomendasi}</p>
                                   </div>
                                   <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                     <label className="text-[10px] uppercase font-bold text-[#A3B18A] tracking-[0.2em] mb-3 block">Status Urgensi</label>
                                     <div className="flex items-center gap-3">
                                       <div className={`w-3 h-3 rounded-full animate-pulse ${
                                         selectedReportItem.data.tingkat_keparahan === 'Tinggi' ? 'bg-red-500' : 'bg-yellow-500'
                                       }`}></div>
                                       <span className="text-xl font-bold text-white">{selectedReportItem.data.tingkat_keparahan}</span>
                                     </div>
                                     <p className="text-xs text-gray-400 mt-2">Segera lakukan tindakan pencegahan sesuai rekomendasi asisten AI.</p>
                                   </div>
                                 </div>
                               </div>
                             )}

                             {selectedReportItem.type === 'kalender' && (
                               <div className="space-y-6">
                                  <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                                    <h4 className="text-lg font-bold text-[#E9EDC9] mb-6 flex items-center gap-3">
                                      <CalendarDays className="w-5 h-5 text-blue-400" />
                                      Jadwal Perawatan Terpadu
                                    </h4>
                                    <div className="space-y-6">
                                      {selectedReportItem.data.jadwal.map((step: any, idx: number) => (
                                        <div key={idx} className="relative pl-10 border-l border-white/10 pb-6 last:pb-0">
                                           <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-blue-500 border-4 border-[#1B3022] shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                                           <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">{step.waktu}</p>
                                           <p className="text-sm text-gray-300 leading-relaxed">{step.aktivitas}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                               </div>
                             )}

                             {selectedReportItem.type === 'cuaca' && (
                               <div className="space-y-6">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                     <div className="bg-white/5 border border-white/10 p-4 rounded-2xl text-center">
                                        <ThermometerSun className="w-5 h-5 text-orange-400 mx-auto mb-2" />
                                        <p className="text-[10px] text-gray-500 uppercase font-bold">Max Temp</p>
                                        <p className="text-xl font-bold text-white">{selectedReportItem.data.suhu_max}°C</p>
                                     </div>
                                     <div className="bg-white/5 border border-white/10 p-4 rounded-2xl text-center">
                                        <CloudRain className="w-5 h-5 text-blue-400 mx-auto mb-2" />
                                        <p className="text-[10px] text-gray-500 uppercase font-bold">Hujan</p>
                                        <p className="text-xl font-bold text-white">{selectedReportItem.data.curah_hujan} mm</p>
                                     </div>
                                     <div className="bg-white/5 border border-white/10 p-4 rounded-2xl text-center">
                                        <Droplets className="w-5 h-5 text-teal-400 mx-auto mb-2" />
                                        <p className="text-[10px] text-gray-500 uppercase font-bold">Kelembaban</p>
                                        <p className="text-xl font-bold text-white">{selectedReportItem.data.kelembaban}%</p>
                                     </div>
                                     <div className="bg-white/5 border border-white/10 p-4 rounded-2xl text-center">
                                        <Wind className="w-5 h-5 text-gray-400 mx-auto mb-2" />
                                        <p className="text-[10px] text-gray-500 uppercase font-bold">Angin</p>
                                        <p className="text-xl font-bold text-white">{selectedReportItem.data.angin} km/j</p>
                                     </div>
                                  </div>
                                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                    <label className="text-[10px] uppercase font-bold text-[#A3B18A] tracking-[0.2em] mb-4 block">Analisis Cuaca Pertanian</label>
                                    <p className="text-gray-300 leading-relaxed">{selectedReportItem.data.analisis_lengkap}</p>
                                  </div>
                               </div>
                             )}

                             {selectedReportItem.type === 'kalkulator' && (
                               <div className="space-y-6">
                                  <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center space-y-4">
                                     <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto border border-orange-500/30">
                                        <Scale className="w-10 h-10 text-orange-400" />
                                     </div>
                                     <div>
                                        <p className="text-sm text-gray-400 uppercase font-bold tracking-widest">Kebutuhan Nutrisi Lahan</p>
                                        <div className="flex items-center justify-center gap-2 mt-2">
                                           <span className="text-5xl font-black text-[#E9EDC9]">{selectedReportItem.data.jumlah}</span>
                                           <span className="text-xl font-bold text-[#A3B18A] uppercase">{selectedReportItem.data.satuan}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">Estimasi total {selectedReportItem.data.kebutuhan} untuk lahan {selectedReportItem.data.luas} m².</p>
                                     </div>
                                  </div>
                                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                    <label className="text-[10px] uppercase font-bold text-[#A3B18A] tracking-[0.2em] mb-3 block">Catatan Kalkulasi</label>
                                    <p className="text-sm text-gray-300 leading-relaxed font-mono">Dihitung berdasarkan standar pemupukan organik berkelanjutan. Pastikan penyebaran merata pada seluruh area lahan.</p>
                                  </div>
                               </div>
                             )}
                          </div>

                          {/* Modal Footer */}
                          <div className="p-8 border-t border-white/10 bg-black/20 flex gap-4">
                            <button
                              onClick={() => {
                                exportToPDF();
                                setSelectedReportItem(null);
                              }}
                              className="flex-1 px-8 py-4 bg-[#E9EDC9] text-[#1B3022] rounded-2xl font-bold hover:bg-white transition-all shadow-xl flex items-center justify-center gap-3"
                            >
                              <FileText className="w-5 h-5" /> Download Report (PDF)
                            </button>
                            <button
                              onClick={() => setSelectedReportItem(null)}
                              className="px-8 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-bold hover:bg-white/10 transition-all"
                            >
                              Close
                            </button>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>
          </motion.div>
        )}
      </main>

      {/* Premium Toast Notification */}
      <AnimatePresence>
        {showSaveToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] w-[min(90vw,400px)]"
          >
            <div className="bg-[#1B3022]/90 backdrop-blur-2xl border border-green-500/30 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_20px_rgba(34,197,94,0.2)] flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center border border-green-500/40 shrink-0">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 15, delay: 0.1 }}
                >
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </motion.div>
              </div>
              <div className="flex-1">
                <h4 className="text-[#E9EDC9] font-bold text-sm">Laporan Tersimpan!</h4>
                <p className="text-gray-400 text-[11px] leading-tight">Berhasil ditambahkan ke menu Laporan Saya.</p>
              </div>
              <motion.div 
                className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,1)]"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
