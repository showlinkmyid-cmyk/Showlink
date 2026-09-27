/* ============================================================
   ShowLink Theme + Language Manager
   ============================================================ */
(() => {
  "use strict";

  const THEME_KEY = "showlink-theme";
  const LANG_KEY = "showlink-language";

  const translations = {
    id: {
      platformInfo:"Informasi Platform", howItWorks:"Cara Kerja", help:"Bantuan",
      login:"Login", register:"Register", dashboard:"Dashboard", pasteLink:"PasteLink",
      paymentLink:"Payment Link", analytics:"Analytics", settings:"Pengaturan", manageLinks:"Kelola tautan", shortlink:"Shortlink", sub4unlock:"Sub4unlock", notifications:"Notifikasi", payment:"Payment", profile:"Profil", about:"About", comingSoon:"Segera hadir", sectionPlaceholder:"Halaman sudah disiapkan dengan fondasi yang sama. Fitur detail akan kita kerjakan satu per satu.", manageLinksIntro:"Kelola semua jenis tautan ShowLink dari satu tempat.", shortlinkIntro:"Buat dan kelola Shortlink ShowLink. Fitur akan kita isi bertahap.", paymentLinkIntro:"Buat dan kelola tautan pembayaran. Fitur akan kita isi bertahap.", sub4unlockIntro:"Kelola akses konten berbasis aksi pengguna.", notificationsIntro:"Lihat notifikasi akun, transaksi, dan aktivitas ShowLink.", paymentIntro:"Kelola pembayaran, saldo, dan aktivitas transaksi akun.", profileIntro:"Kelola informasi profil akun ShowLink.", settingsIntro:"Kelola preferensi akun, bahasa, tema, dan pengaturan ShowLink.", aboutIntro:"Informasi tentang ShowLink dan layanan yang tersedia.",
      openMenu:"Buka menu", mainNavigation:"Navigasi utama", displayOptions:"Opsi tampilan",
      theme:"Tema", light:"Terang", dark:"Gelap", language:"Bahasa",
      indonesia:"Indonesia", english:"Inggris", terms:"Terms of Service",
      privacy:"Privacy Policy", contact:"Contact Person", footerNavigation:"Navigasi footer",
      footerTagline:"Simple digital links.", copyright:"Copyright © {year} ShowLink. All Rights Reserved.",
      themeLight:"Tema terang", themeDark:"Tema gelap", chooseLanguage:"Pilih bahasa", authWelcome:"Selamat datang kembali", authWelcomeSub:"Masuk untuk melanjutkan ke akun ShowLink.", authCreate:"Buat akun ShowLink", authCreateSub:"Daftar untuk mulai membuat dan mengelola link.", email:"Email", username:"Username", usernameHint:"3–30 karakter, hanya huruf, angka, dan underscore.", usernameInvalid:"Username 3–30 karakter, hanya huruf, angka, dan underscore.", password:"Password", confirmPassword:"Konfirmasi password", rememberMe:"Ingat saya", forgotPassword:"Lupa password?", signIn:"Masuk", signUp:"Daftar", noAccount:"Belum punya akun?", haveAccount:"Sudah punya akun?", createAccount:"Buat akun", backHome:"Kembali ke beranda", orContinue:"atau lanjutkan dengan", secureAuth:"Akses akun yang aman", authTerms:"Dengan melanjutkan, kamu menyetujui Ketentuan Layanan dan Kebijakan Privasi ShowLink.", authManage:"Kelola PasteLink dan Payment Link", authAnalytics:"Lihat performa dan aktivitas akun", authSecure:"Akses akun dengan aman", passwordHint:"Minimal 8 karakter", passwordMismatch:"Password tidak sama.", invalidEmail:"Masukkan email yang valid.", requiredField:"Kolom ini wajib diisi.", showPassword:"Tampilkan password", hidePassword:"Sembunyikan password", loginTitle:"Login — ShowLink", registerTitle:"Register — ShowLink", loginDescription:"Masuk ke akun ShowLink untuk mengelola konten dan link.",
      loginSuccess:"Login berhasil. Mengalihkan ke dashboard...", loginFailed:"Email atau password salah.",
      registerSuccess:"Akun berhasil dibuat. Mengalihkan ke dashboard...", registerFailed:"Pendaftaran gagal.",
      confirmEmail:"Akun berhasil dibuat. Silakan cek email untuk konfirmasi akun sebelum login.",
      enterEmailFirst:"Masukkan email terlebih dahulu.",
      resetSent:"Link reset password telah dikirim ke email.", resetFailed:"Gagal mengirim reset password.",
      authConfigError:"Supabase belum dikonfigurasi.", dashboardWelcome:"Selamat datang",
      accountOverview:"Ringkasan akun", accountEmail:"Email akun", accountPlan:"Paket",
      accountCreated:"Bergabung sejak", signOut:"Keluar", editProfile:"Edit profil",
      quickActions:"Aksi cepat", createPasteLink:"Buat PasteLink", createPaymentLink:"Buat Payment Link",
      totalLinks:"Total link", totalViews:"Total views", totalSales:"Total penjualan",
      recentActivity:"Aktivitas terbaru", noActivity:"Belum ada aktivitas.",
      dashboardIntro:"Kelola akun dan aktivitas ShowLink kamu dari satu tempat.",
      freePlan:"Free", registerDescription:"Buat akun ShowLink untuk membuat dan mengelola link.",
      accountSaved:"Data akun berhasil disimpan.", passwordHidden:"Password tidak ditampilkan demi keamanan.", passwordReceiptNote:"Password ditampilkan hanya di perangkat ini agar bisa kamu simpan sebagai catatan. Password tidak disimpan ke database oleh ShowLink.",
      saveScreenshot:"Simpan screenshot", continueDashboard:"Lanjut ke Dashboard", registerSuccessTitle:"Pendaftaran berhasil!",
      googleFailed:"Login Google gagal. Silakan coba lagi.", changePassword:"Ubah password",
      changePasswordSub:"Masukkan password baru dan konfirmasi password.", newPassword:"Password baru",
      changePasswordButton:"Ubah password", resetPasswordTitle:"Reset password", resetPasswordSub:"Masukkan Gmail, lalu buat password baru dan konfirmasi password.", resetPasswordHint:"Demi keamanan, ShowLink akan mengirim link verifikasi ke Gmail. Setelah link dibuka, password baru dapat diterapkan.", rememberPassword:"Ingat password?", processingLogin:"Memproses login...", pleaseWait:"Mohon tunggu sebentar."
    },
    en: {
      platformInfo:"Platform Information", howItWorks:"How It Works", help:"Help",
      login:"Login", register:"Register", dashboard:"Dashboard", pasteLink:"PasteLink",
      paymentLink:"Payment Link", analytics:"Analytics", settings:"Settings", manageLinks:"Manage links", shortlink:"Shortlink", sub4unlock:"Sub4unlock", notifications:"Notifications", payment:"Payment", profile:"Profile", about:"About", comingSoon:"Coming soon", sectionPlaceholder:"This page is prepared with the same foundation. We will build the detailed features one by one.", manageLinksIntro:"Manage all ShowLink link types from one place.", shortlinkIntro:"Create and manage ShowLink Shortlinks. We will build the features step by step.", paymentLinkIntro:"Create and manage payment links. We will build the features step by step.", sub4unlockIntro:"Manage content access based on user actions.", notificationsIntro:"View account, transaction, and ShowLink activity notifications.", paymentIntro:"Manage payments, balance, and account transaction activity.", profileIntro:"Manage your ShowLink profile information.", settingsIntro:"Manage account preferences, language, theme, and ShowLink settings.", aboutIntro:"Information about ShowLink and the available service.",
      openMenu:"Open menu", mainNavigation:"Main navigation", displayOptions:"Display options",
      theme:"Theme", light:"Light", dark:"Dark", language:"Language",
      indonesia:"Indonesian", english:"English", terms:"Terms of Service",
      privacy:"Privacy Policy", contact:"Contact Person", footerNavigation:"Footer navigation",
      footerTagline:"Simple digital links.", copyright:"Copyright © {year} ShowLink. All Rights Reserved.",
      themeLight:"Light theme", themeDark:"Dark theme", chooseLanguage:"Choose language", authWelcome:"Welcome back", authWelcomeSub:"Sign in to continue to your ShowLink account.", authCreate:"Create your ShowLink account", authCreateSub:"Register to start creating and managing links.", email:"Email", username:"Username", usernameHint:"3–30 characters, letters, numbers, and underscores only.", usernameInvalid:"Username must be 3–30 characters using only letters, numbers, and underscores.", password:"Password", confirmPassword:"Confirm password", rememberMe:"Remember me", forgotPassword:"Forgot password?", signIn:"Sign in", signUp:"Sign up", noAccount:"Don't have an account?", haveAccount:"Already have an account?", createAccount:"Create account", backHome:"Back to home", orContinue:"or continue with", secureAuth:"Secure account access", authTerms:"By continuing, you agree to the ShowLink Terms of Service and Privacy Policy.", authManage:"Manage PasteLink and Payment Link", authAnalytics:"View account performance and activity", authSecure:"Secure account access", passwordHint:"At least 8 characters", passwordMismatch:"Passwords do not match.", invalidEmail:"Enter a valid email address.", requiredField:"This field is required.", showPassword:"Show password", hidePassword:"Hide password", loginTitle:"Login — ShowLink", registerTitle:"Register — ShowLink", loginDescription:"Sign in to your ShowLink account to manage content and links.",
      loginSuccess:"Login successful. Redirecting to dashboard...", loginFailed:"Incorrect email or password.",
      registerSuccess:"Account created. Redirecting to dashboard...", registerFailed:"Registration failed.",
      confirmEmail:"Account created. Check your email to confirm your account before signing in.",
      enterEmailFirst:"Enter your email first.",
      resetSent:"Password reset link sent to your email.", resetFailed:"Could not send the password reset link.",
      authConfigError:"Supabase is not configured.", dashboardWelcome:"Welcome",
      accountOverview:"Account overview", accountEmail:"Account email", accountPlan:"Plan",
      accountCreated:"Joined", signOut:"Sign out", editProfile:"Edit profile",
      quickActions:"Quick actions", createPasteLink:"Create PasteLink", createPaymentLink:"Create Payment Link",
      totalLinks:"Total links", totalViews:"Total views", totalSales:"Total sales",
      recentActivity:"Recent activity", noActivity:"No activity yet.",
      dashboardIntro:"Manage your ShowLink account and activity from one place.",
      accountSaved:"Account details have been saved.", passwordHidden:"Your password is hidden for security.", passwordReceiptNote:"Your password is shown only on this device so you can save it as a record. ShowLink does not store your password in the database.",
      saveScreenshot:"Save screenshot", continueDashboard:"Continue to Dashboard", registerSuccessTitle:"Registration successful!",
      googleFailed:"Google login failed. Please try again.", changePassword:"Change password",
      changePasswordSub:"Enter your new password and confirm it.", newPassword:"New password",
      changePasswordButton:"Change password", resetPasswordTitle:"Reset password", resetPasswordSub:"Enter your Gmail, then create and confirm your new password.", resetPasswordHint:"For security, ShowLink will send a verification link to your Gmail. After opening the link, your new password can be applied.", rememberPassword:"Remember your password?", processingLogin:"Signing you in...", pleaseWait:"Please wait.",
      freePlan:"Free", registerDescription:"Create a ShowLink account to create and manage links."
    }
  };

  const pageTranslations = {
    id: {
      "SHOWLINK • SIMPLE DIGITAL LINKS":"SHOWLINK • SIMPLE DIGITAL LINKS",
      "Buat link yang":"Buat link yang", "punya tujuan.":"punya tujuan.",
      "Bagikan konten lewat":"Bagikan konten lewat",
      "atau buat":"atau buat",
      "untuk menjual akses. Satu link, satu pengalaman yang simpel.":"untuk menjual akses. Satu link, satu pengalaman yang simpel.",
      "Buat PasteLink":"Buat PasteLink","Buat Payment Link":"Buat Payment Link",
      "Mudah dibuat":"Mudah dibuat","Akses terkontrol":"Akses terkontrol","Mobile friendly":"Mobile friendly",
      "Your content.":"Your content.","Your link.":"Your link.","Live":"Live",
      "PUBLIC LINK":"PUBLIC LINK","Share your content":"Share your content","Sell access":"Sell access",
      "views":"views","sales":"sales","growth":"growth",
      "Publish content instantly":"Publish content instantly","Sell access with one URL":"Sell access with one URL",
      "See views & transactions":"See views & transactions","Manage your balance":"Manage your balance",
      "Satu halaman untuk semua kontenmu.":"Satu halaman untuk semua kontenmu.",
      "Buat halaman yang berisi teks, link, informasi, panduan, atau konten lain. Setelah selesai, ShowLink memberikan URL pendek yang mudah dibagikan.":"Buat halaman yang berisi teks, link, informasi, panduan, atau konten lain. Setelah selesai, ShowLink memberikan URL pendek yang mudah dibagikan.",
      "Edit seluruh isi":"Edit seluruh isi","Konten, judul, deskripsi, dan pengaturan tetap bisa dikelola setelah dibuat.":"Konten, judul, deskripsi, dan pengaturan tetap bisa dikelola setelah dibuat.",
      "URL pendek":"URL pendek","Statistik":"Statistik","Pantau kunjungan dan performa halaman.":"Pantau kunjungan dan performa halaman.",
      "Mulai membuat PasteLink":"Mulai membuat PasteLink",
      "Jual akses dengan satu link pembayaran.":"Jual akses dengan satu link pembayaran.",
      "Buat Payment Link, tentukan harga, lalu bagikan link. Pengunjung akan diarahkan ke pembayaran terlebih dahulu. Konten dibuka setelah pembayaran berhasil diverifikasi.":"Buat Payment Link, tentukan harga, lalu bagikan link. Pengunjung akan diarahkan ke pembayaran terlebih dahulu. Konten dibuka setelah pembayaran berhasil diverifikasi.",
      "Tentukan harga":"Tentukan harga","Atur harga produk atau akses sesuai kebutuhanmu.":"Atur harga produk atau akses sesuai kebutuhanmu.",
      "Konten terlindungi":"Konten terlindungi","Konten tidak dibuka sebelum status pembayaran valid.":"Konten tidak dibuka sebelum status pembayaran valid.",
      "Akses otomatis":"Akses otomatis","Setelah pembayaran terverifikasi, sistem memberikan akses.":"Setelah pembayaran terverifikasi, sistem memberikan akses.",
      "Secure checkout":"Secure checkout","DIGITAL CONTENT":"DIGITAL CONTENT","Premium Content":"Premium Content",
      "Access after payment":"Access after payment","Total":"Total","Bayar & Buka Konten":"Bayar & Buka Konten",
      "Payment verified before content access":"Payment verified before content access",
      "Semudah membuat dan membagikan link.":"Semudah membuat dan membagikan link.",
      "ShowLink dibuat supaya creator tidak perlu melewati alur yang rumit.":"ShowLink dibuat supaya creator tidak perlu melewati alur yang rumit.",
      "Buat":"Buat","Pilih PasteLink atau Payment Link lalu isi konten yang ingin kamu publikasikan.":"Pilih PasteLink atau Payment Link lalu isi konten yang ingin kamu publikasikan.",
      "Dapatkan Link":"Dapatkan Link","Setelah dibuat, kamu mendapatkan URL pendek ShowLink yang mudah dibagikan.":"Setelah dibuat, kamu mendapatkan URL pendek ShowLink yang mudah dibagikan.",
      "Bagikan":"Bagikan","Kirim link ke WhatsApp, Telegram, Instagram, website, atau platform lainnya.":"Kirim link ke WhatsApp, Telegram, Instagram, website, atau platform lainnya.",
      "Kelola":"Kelola","Lihat performa, transaksi, dan penghasilan dari dashboard akunmu.":"Lihat performa, transaksi, dan penghasilan dari dashboard akunmu.",
      "Fokus pada link yang benar-benar berguna.":"Fokus pada link yang benar-benar berguna.",
      "Tidak perlu puluhan menu. ShowLink dibuat untuk dua kebutuhan utama: membagikan konten dan menjual akses.":"Tidak perlu puluhan menu. ShowLink dibuat untuk dua kebutuhan utama: membagikan konten dan menjual akses.",
      "Simple":"Simple","Flow singkat dari pembuatan sampai link siap dibagikan.":"Flow singkat dari pembuatan sampai link siap dibagikan.",
      "Beautiful":"Beautiful","Halaman link dibuat bersih, modern, dan nyaman di mobile.":"Halaman link dibuat bersih, modern, dan nyaman di mobile.",
      "Controlled":"Controlled","Payment Link menggunakan status transaksi sebagai dasar pemberian akses.":"Payment Link menggunakan status transaksi sebagai dasar pemberian akses.",
      "Trackable":"Trackable","Performa link dan transaksi bisa dipantau dari dashboard.":"Performa link dan transaksi bisa dipantau dari dashboard.",
      "Pertanyaan umum.":"Pertanyaan umum.","Informasi dasar sebelum kamu mulai menggunakan ShowLink.":"Informasi dasar sebelum kamu mulai menggunakan ShowLink.",
      "Apakah PasteLink bisa dibuka tanpa login?":"Apakah PasteLink bisa dibuka tanpa login?",
      "Ya. Link publik dapat dibuka melalui URL ShowLink. Login digunakan untuk membuat dan mengelola konten.":"Ya. Link publik dapat dibuka melalui URL ShowLink. Login digunakan untuk membuat dan mengelola konten.",
      "Bagaimana Payment Link bekerja?":"Bagaimana Payment Link bekerja?",
      "Pengunjung membuka Payment Link, melihat informasi checkout, melakukan pembayaran, lalu konten diberikan setelah pembayaran berhasil diverifikasi.":"Pengunjung membuka Payment Link, melihat informasi checkout, melakukan pembayaran, lalu konten diberikan setelah pembayaran berhasil diverifikasi.",
      "Apakah saya bisa mengedit PasteLink?":"Apakah saya bisa mengedit PasteLink?",
      "Konten yang dibuat disimpan sebagai satu kesatuan sehingga nantinya dapat diedit kembali, bukan hanya judulnya.":"Konten yang dibuat disimpan sebagai satu kesatuan sehingga nantinya dapat diedit kembali, bukan hanya judulnya.",
      "Seperti apa URL ShowLink?":"Seperti apa URL ShowLink?",
      "Mulai dengan satu link.":"Mulai dengan satu link.",
      "Buat PasteLink untuk berbagi konten atau Payment Link untuk menjual akses.":"Buat PasteLink untuk berbagi konten atau Payment Link untuk menjual akses.",
      "Mulai Gratis":"Mulai Gratis","READY TO CREATE?":"READY TO CREATE?"
    },
    en: {
      "SHOWLINK • SIMPLE DIGITAL LINKS":"SHOWLINK • SIMPLE DIGITAL LINKS",
      "Buat link yang":"Create a link with a", "punya tujuan.":"purpose.",
      "Bagikan konten lewat":"Share content with", "atau buat":"or create a",
      "untuk menjual akses. Satu link, satu pengalaman yang simpel.":"to sell access. One link, one simple experience.",
      "Buat PasteLink":"Create PasteLink","Buat Payment Link":"Create Payment Link",
      "Mudah dibuat":"Easy to create","Akses terkontrol":"Controlled access","Mobile friendly":"Mobile friendly",
      "Your content.":"Your content.","Your link.":"Your link.","Live":"Live",
      "PUBLIC LINK":"PUBLIC LINK","Share your content":"Share your content","Sell access":"Sell access",
      "views":"views","sales":"sales","growth":"growth",
      "Publish content instantly":"Publish content instantly","Sell access with one URL":"Sell access with one URL",
      "See views & transactions":"See views & transactions","Manage your balance":"Manage your balance",
      "Satu halaman untuk semua kontenmu.":"One page for all your content.",
      "Buat halaman yang berisi teks, link, informasi, panduan, atau konten lain. Setelah selesai, ShowLink memberikan URL pendek yang mudah dibagikan.":"Create a page with text, links, information, guides, or other content. When finished, ShowLink gives you a short URL that is easy to share.",
      "Edit seluruh isi":"Edit everything","Konten, judul, deskripsi, dan pengaturan tetap bisa dikelola setelah dibuat.":"Content, title, description, and settings can still be managed after creation.",
      "URL pendek":"Short URL","Statistik":"Analytics","Pantau kunjungan dan performa halaman.":"Track visits and page performance.",
      "Mulai membuat PasteLink":"Start creating PasteLink",
      "Jual akses dengan satu link pembayaran.":"Sell access with one payment link.",
      "Buat Payment Link, tentukan harga, lalu bagikan link. Pengunjung akan diarahkan ke pembayaran terlebih dahulu. Konten dibuka setelah pembayaran berhasil diverifikasi.":"Create a Payment Link, set a price, and share it. Visitors are sent to checkout first. Content opens after payment is successfully verified.",
      "Tentukan harga":"Set a price","Atur harga produk atau akses sesuai kebutuhanmu.":"Set the product or access price you need.",
      "Konten terlindungi":"Protected content","Konten tidak dibuka sebelum status pembayaran valid.":"Content stays locked until payment is valid.",
      "Akses otomatis":"Automatic access","Setelah pembayaran terverifikasi, sistem memberikan akses.":"Access is granted automatically after payment is verified.",
      "Secure checkout":"Secure checkout","DIGITAL CONTENT":"DIGITAL CONTENT","Premium Content":"Premium Content",
      "Access after payment":"Access after payment","Total":"Total","Bayar & Buka Konten":"Pay & Open Content",
      "Payment verified before content access":"Payment verified before content access",
      "Semudah membuat dan membagikan link.":"As easy as creating and sharing a link.",
      "ShowLink dibuat supaya creator tidak perlu melewati alur yang rumit.":"ShowLink keeps the creator flow simple.",
      "Buat":"Create","Pilih PasteLink atau Payment Link lalu isi konten yang ingin kamu publikasikan.":"Choose PasteLink or Payment Link and add the content you want to publish.",
      "Dapatkan Link":"Get the Link","Setelah dibuat, kamu mendapatkan URL pendek ShowLink yang mudah dibagikan.":"After creation, you get a short ShowLink URL that is easy to share.",
      "Bagikan":"Share","Kirim link ke WhatsApp, Telegram, Instagram, website, atau platform lainnya.":"Send the link to WhatsApp, Telegram, Instagram, your website, or other platforms.",
      "Kelola":"Manage","Lihat performa, transaksi, dan penghasilan dari dashboard akunmu.":"View performance, transactions, and earnings from your dashboard.",
      "Fokus pada link yang benar-benar berguna.":"Focus on links that matter.",
      "Tidak perlu puluhan menu. ShowLink dibuat untuk dua kebutuhan utama: membagikan konten dan menjual akses.":"No need for dozens of menus. ShowLink focuses on two core needs: sharing content and selling access.",
      "Simple":"Simple","Flow singkat dari pembuatan sampai link siap dibagikan.":"A short flow from creation to a shareable link.",
      "Beautiful":"Beautiful","Halaman link dibuat bersih, modern, dan nyaman di mobile.":"Link pages are clean, modern, and mobile friendly.",
      "Controlled":"Controlled","Payment Link menggunakan status transaksi sebagai dasar pemberian akses.":"Payment Links use transaction status as the basis for access.",
      "Trackable":"Trackable","Performa link dan transaksi bisa dipantau dari dashboard.":"Link and transaction performance can be tracked from the dashboard.",
      "Pertanyaan umum.":"Frequently asked questions.","Informasi dasar sebelum kamu mulai menggunakan ShowLink.":"Basic information before you start using ShowLink.",
      "Apakah PasteLink bisa dibuka tanpa login?":"Can PasteLink be opened without login?",
      "Ya. Link publik dapat dibuka melalui URL ShowLink. Login digunakan untuk membuat dan mengelola konten.":"Yes. Public links can be opened through their ShowLink URL. Login is used to create and manage content.",
      "Bagaimana Payment Link bekerja?":"How does Payment Link work?",
      "Pengunjung membuka Payment Link, melihat informasi checkout, melakukan pembayaran, lalu konten diberikan setelah pembayaran berhasil diverifikasi.":"Visitors open a Payment Link, view checkout information, pay, and receive the content after payment is verified.",
      "Apakah saya bisa mengedit PasteLink?":"Can I edit a PasteLink?",
      "Konten yang dibuat disimpan sebagai satu kesatuan sehingga nantinya dapat diedit kembali, bukan hanya judulnya.":"Created content is stored as one complete piece so it can be edited later, not just the title.",
      "Seperti apa URL ShowLink?":"What does a ShowLink URL look like?",
      "Mulai dengan satu link.":"Start with one link.",
      "Buat PasteLink untuk berbagi konten atau Payment Link untuk menjual akses.":"Create a PasteLink to share content or a Payment Link to sell access.",
      "Mulai Gratis":"Start Free","READY TO CREATE?":"READY TO CREATE?"
    }
  };

  function getTheme() {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "dark" || v === "light") return v;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function getLanguage() {
    return localStorage.getItem(LANG_KEY) === "en" ? "en" : "id";
  }

  function t(key) {
    const lang = getLanguage();
    let value = translations[lang][key] ?? key;
    if (key === "copyright") value = value.replace("{year}", new Date().getFullYear());
    return value;
  }

  function applyTheme(theme, persist=true) {
    theme = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    if (persist) localStorage.setItem(THEME_KEY, theme);
    window.dispatchEvent(new CustomEvent("showlink:theme-change", { detail: { theme } }));

    document.querySelectorAll("[data-theme-label]").forEach(el => {
      el.textContent = theme === "dark" ? t("dark") : t("light");
    });
    document.querySelectorAll("[data-theme-icon]").forEach(el => {
      el.innerHTML = theme === "dark" ? '<i class="fa-solid fa-sun" aria-hidden="true"></i>' : '<i class="fa-solid fa-moon" aria-hidden="true"></i>';
    });
    document.querySelectorAll("[data-theme-option]").forEach(el => {
      const active = el.dataset.themeOption === theme;
      el.classList.toggle("is-active", active);
      const c = el.querySelector(".sl-check"); if (c) c.textContent = active ? "✓" : "";
    });
  }

  function translatePage() {
    const lang = getLanguage();
    document.documentElement.lang = lang;

    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.dataset.i18n;
      if (translations[lang][key] !== undefined) {
        el.textContent = t(key);
      }
    });

    // Translate static index text nodes without forcing page authors to duplicate markup.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (n.parentElement?.closest("[data-no-translate]")) continue;
      if (n.parentElement?.matches("script,style")) continue;
      nodes.push(n);
    }
    const map = pageTranslations[lang];
    nodes.forEach(n => {
      const original = n.nodeValue.trim();
      if (!original || !map[original]) return;
      const leading = n.nodeValue.match(/^\s*/)?.[0] || "";
      const trailing = n.nodeValue.match(/\s*$/)?.[0] || "";
      n.nodeValue = leading + map[original] + trailing;
    });

    document.querySelectorAll("[data-lang-option]").forEach(el => {
      const active = el.dataset.langOption === lang;
      el.classList.toggle("is-active", active);
      const c = el.querySelector(".sl-check"); if (c) c.textContent = active ? "✓" : "";
    });
    document.querySelectorAll("[data-lang-label]").forEach(el => el.textContent = lang === "en" ? "EN" : "ID");

    // Page metadata: auth and future pages can provide their own localized title/description.
    const pageTitle = document.body?.dataset?.pageTitleId;
    const pageTitleEn = document.body?.dataset?.pageTitleEn;
    const pageDesc = document.body?.dataset?.pageDescriptionId;
    const pageDescEn = document.body?.dataset?.pageDescriptionEn;
    if (pageTitle || pageTitleEn) {
      document.title = lang === "en" ? (pageTitleEn || pageTitle) : (pageTitle || pageTitleEn);
      const desc = lang === "en" ? (pageDescEn || pageDesc) : (pageDesc || pageDescEn);
      if (desc) document.querySelector('meta[name="description"]')?.setAttribute("content", desc);
    } else if (lang === "en") {
      document.title = "ShowLink — Create. Share. Get Paid.";
      document.querySelector('meta[name="description"]')?.setAttribute("content",
        "ShowLink — create PasteLinks and Payment Links. Share content, sell access, and manage earnings in one platform.");
      document.querySelector('meta[property="og:title"]')?.setAttribute("content","ShowLink — Create. Share. Get Paid.");
      document.querySelector('meta[property="og:description"]')?.setAttribute("content","Create PasteLinks and Payment Links easily with ShowLink.");
    } else {
      document.title = "ShowLink — Create. Share. Get Paid.";
      document.querySelector('meta[name="description"]')?.setAttribute("content",
        "ShowLink — buat PasteLink dan Payment Link. Bagikan konten, jual akses, dan kelola penghasilan dalam satu platform.");
      document.querySelector('meta[property="og:title"]')?.setAttribute("content","ShowLink — Create. Share. Get Paid.");
      document.querySelector('meta[property="og:description"]')?.setAttribute("content","Buat PasteLink dan Payment Link dengan mudah di ShowLink.");
    }
  }

  function closeMenus(except) {
    document.querySelectorAll(".showlink-tool.is-open").forEach(x => {
      if (x !== except) {
        x.classList.remove("is-open");
        x.querySelector(".showlink-tool-btn")?.setAttribute("aria-expanded", "false");
      }
    });
  }

  function syncControlState() {
    const theme = getTheme();
    const lang = getLanguage();

    document.querySelectorAll("[data-theme-option]").forEach(el => {
      const active = el.dataset.themeOption === theme;
      el.classList.toggle("is-active", active);
      const check = el.querySelector(".sl-check");
      if (check) check.innerHTML = active ? '<i class="fa-solid fa-check" aria-hidden="true"></i>' : "";
    });
    document.querySelectorAll("[data-lang-option]").forEach(el => {
      const active = el.dataset.langOption === lang;
      el.classList.toggle("is-active", active);
      const check = el.querySelector(".sl-check");
      if (check) check.innerHTML = active ? '<i class="fa-solid fa-check" aria-hidden="true"></i>' : "";
    });
    document.querySelectorAll("[data-theme-label]").forEach(el => {
      el.textContent = theme === "dark" ? t("dark") : t("light");
    });
    document.querySelectorAll("[data-theme-icon]").forEach(el => {
      el.innerHTML = theme === "dark" ? '<i class="fa-solid fa-sun" aria-hidden="true"></i>' : '<i class="fa-solid fa-moon" aria-hidden="true"></i>';
    });
    document.querySelectorAll("[data-lang-label]").forEach(el => {
      el.textContent = lang === "en" ? "EN" : "ID";
    });
  }

  function buildControls() {
    document.querySelectorAll("[data-showlink-tools]").forEach(container => {
      container.dataset.slToolsReady = "true";
      container.innerHTML = `
        <div class="showlink-tool" data-theme-tool>
          <button class="showlink-tool-btn" type="button" aria-label="${t("theme")}" aria-expanded="false" data-theme-toggle>
            <span class="sl-tool-icon" data-theme-icon></span><span class="showlink-tool-text" data-theme-label></span>
          </button>
          <div class="showlink-tool-menu" role="menu" aria-label="${t("theme")}">
            <button class="showlink-tool-option" type="button" role="menuitem" data-theme-option="light"><span class="sl-option-icon sl-option-sun"><i class="fa-solid fa-sun" aria-hidden="true"></i></span><span data-i18n="light">${t("light")}</span><span class="sl-check" aria-hidden="true"></span></button>
            <button class="showlink-tool-option" type="button" role="menuitem" data-theme-option="dark"><span class="sl-option-icon sl-option-moon"><i class="fa-solid fa-moon" aria-hidden="true"></i></span><span data-i18n="dark">${t("dark")}</span><span class="sl-check" aria-hidden="true"></span></button>
          </div>
        </div>
        <div class="showlink-tool" data-language-tool>
          <button class="showlink-tool-btn" type="button" aria-label="${t("language")}" aria-expanded="false" data-language-toggle>
            <span class="sl-tool-icon"><i class="fa-solid fa-language" aria-hidden="true"></i></span><span class="showlink-lang-label" data-lang-label></span>
          </button>
          <div class="showlink-tool-menu" role="menu" aria-label="${t("language")} ">
            <button class="showlink-tool-option" type="button" role="menuitem" data-lang-option="id"><span class="sl-option-icon"><i class="fa-solid fa-flag" aria-hidden="true"></i></span><span data-i18n="indonesia">${t("indonesia")}</span><span class="sl-check" aria-hidden="true"></span></button>
            <button class="showlink-tool-option" type="button" role="menuitem" data-lang-option="en"><span class="sl-option-icon"><i class="fa-solid fa-earth-americas" aria-hidden="true"></i></span><span data-i18n="english">${t("english")}</span><span class="sl-check" aria-hidden="true"></span></button>
          </div>
        </div>`;
    });
    syncControlState();
  }

  // Delegated click handler: survives navbar/footer re-rendering and works on
  // both desktop and mobile without relying on stale element listeners.
  function initControlEvents() {
    if (window.__showLinkControlEventsReady) return;
    window.__showLinkControlEventsReady = true;

    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const themeToggle = target.closest("[data-theme-toggle]");
      if (themeToggle) {
        event.preventDefault();
        event.stopPropagation();
        const tool = themeToggle.closest("[data-theme-tool]");
        const open = !tool?.classList.contains("is-open");
        closeMenus(tool);
        tool?.classList.toggle("is-open", open);
        themeToggle.setAttribute("aria-expanded", String(open));
        return;
      }

      const languageToggle = target.closest("[data-language-toggle]");
      if (languageToggle) {
        event.preventDefault();
        event.stopPropagation();
        const tool = languageToggle.closest("[data-language-tool]");
        const open = !tool?.classList.contains("is-open");
        closeMenus(tool);
        tool?.classList.toggle("is-open", open);
        languageToggle.setAttribute("aria-expanded", String(open));
        return;
      }

      const themeOption = target.closest("[data-theme-option]");
      if (themeOption) {
        event.preventDefault();
        event.stopPropagation();
        applyTheme(themeOption.dataset.themeOption);
        closeMenus();
        return;
      }

      const languageOption = target.closest("[data-lang-option]");
      if (languageOption) {
        event.preventDefault();
        event.stopPropagation();
        localStorage.setItem(LANG_KEY, languageOption.dataset.langOption === "en" ? "en" : "id");
        closeMenus();
        window.ShowLinkNavbar?.refresh(); window.ShowLinkFooter?.refresh();
        buildControls();
        translatePage();
        applyTheme(getTheme(), false);
        syncControlState();
        window.dispatchEvent(new CustomEvent("showlink:language-change", { detail: { language: getLanguage() } }));
        return;
      }

      if (!target.closest(".showlink-tool")) closeMenus();
    }, true);
  }

  window.addEventListener("showlink:navbar-rendered", () => {
    buildControls();
    translatePage();
    applyTheme(getTheme(), false);
    syncControlState();
  });

  function boot() {
    initControlEvents();
    applyTheme(getTheme(), false);
    // Render the shared navbar/footer on every page, then attach the
    // theme/language controls to the top navbar.
    window.ShowLinkNavbar?.refresh();
    window.ShowLinkFooter?.refresh();
    translatePage();
    syncControlState();
  }

  window.ShowLinkLanguage = { getLanguage, applyLanguage(lang) {
    localStorage.setItem(LANG_KEY, lang === "en" ? "en" : "id");
    window.ShowLinkNavbar?.refresh(); window.ShowLinkFooter?.refresh();
    translatePage();
    buildControls();
    window.dispatchEvent(new CustomEvent("showlink:language-change", { detail: { language: getLanguage() } }));
  }, t, translations };

  window.ShowLinkTheme = { getTheme, applyTheme };

  document.addEventListener("DOMContentLoaded", boot);
})();
