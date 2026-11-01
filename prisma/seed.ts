import { PrismaClient, UserRole, ContentStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding canonical database for Next Karya Digital Solutions...");

  // 1. Site Master
  const site = await prisma.site.upsert({
    where: { id: "nextkarya-main" },
    update: {
      name: "Next Karya Digital Solutions",
      domain: "nextkarya.web.id",
      isActive: true,
      isFormLocked: false,
      isAlertActive: false,
    },
    create: {
      id: "nextkarya-main",
      name: "Next Karya Digital Solutions",
      domain: "nextkarya.web.id",
      isActive: true,
      isFormLocked: false,
      isAlertActive: false,
    },
  });
  console.log("Site master seeded:", site.id);

  // 2. Three Internal Staff Accounts
  const defaultPassword = await bcrypt.hash("NextKarya2026!", 10);

  const staffMembers = [
    {
      id: "user-programmer-001",
      email: "programmer@nextkarya.web.id",
      fullName: "Staf A (Programmer)",
      jobTitle: "Full-Stack Developer",
      role: UserRole.STAFF,
    },
    {
      id: "user-designer-002",
      email: "designer@nextkarya.web.id",
      fullName: "Staf B (Desainer)",
      jobTitle: "UI/UX & Visual Designer",
      role: UserRole.STAFF,
    },
    {
      id: "user-lead-003",
      email: "lead@nextkarya.web.id",
      fullName: "Staf C (Project Lead)",
      jobTitle: "Project Lead & Client Relations",
      role: UserRole.STAFF,
    },
  ];

  for (const staff of staffMembers) {
    const user = await prisma.user.upsert({
      where: { email: staff.email },
      update: {
        fullName: staff.fullName,
        jobTitle: staff.jobTitle,
        role: staff.role,
        isActive: true,
      },
      create: {
        id: staff.id,
        email: staff.email,
        fullName: staff.fullName,
        jobTitle: staff.jobTitle,
        role: staff.role,
        passwordHash: defaultPassword,
        isActive: true,
        tokenVersion: 1,
      },
    });
    console.log("Staff account seeded:", user.email, `(${user.jobTitle})`);
  }

  // 3. Default Categories
  const categories = [
    {
      id: "cat-web",
      slug: "web-development",
      name: "Web Development",
    },
    {
      id: "cat-custom",
      slug: "aplikasi-kustom",
      name: "Aplikasi Kustom",
    },
    {
      id: "cat-mobile",
      slug: "mobile-apps",
      name: "Aplikasi Mobile",
    },
    {
      id: "cat-edu",
      slug: "edukasi-teknologi",
      name: "Edukasi & Wawasan",
    },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: {
        site_id_slug: {
          site_id: "nextkarya-main",
          slug: cat.slug,
        },
      },
      update: {
        name: cat.name,
      },
      create: {
        id: cat.id,
        site_id: "nextkarya-main",
        slug: cat.slug,
        name: cat.name,
      },
    });
  }
  console.log("Categories seeded successfully.");

  // 4. Default Services
  const services = [
    {
      id: "svc-website",
      slug: "pembuatan-website-bisnis",
      title: "Pembuatan Website Bisnis",
      icon: "Globe",
      shortDesc:
        "Website profil bisnis, company profile, dan landing page yang berfokus pada kredibilitas, konversi, dan pengalaman pengguna optimal.",
      features: [
        "Company Profile & Landing Page",
        "Optimasi SEO On-Page Google",
        "Panel Admin / CMS Mandiri",
        "Garansi Maintenance 3 Bulan",
      ],
      priceLabel: "Mulai Rp 1.500.000",
      priceNote: "Estimasi 5-10 hari kerja",
      badge: "Paling Populer",
      ctaLabel: "Konsultasi Gratis",
      ctaHref: "#konsultasi",
      sortOrder: 1,
    },
    {
      id: "svc-redesign",
      slug: "redesign-optimalisasi-website",
      title: "Redesign & Optimalisasi Website",
      icon: "Sparkles",
      shortDesc:
        "Memodernisasi tampilan dan kode website lama yang lambat atau tidak responsif menjadi antarmuka modern berkecepatan tinggi.",
      features: [
        "Penyegaran UI/UX Responsif",
        "Optimasi Core Web Vitals",
        "Pembersihan Kode & Migrasi Aman",
        "Mobile-First Layout",
      ],
      priceLabel: "Mulai Rp 1.200.000",
      priceNote: "Estimasi 3-7 hari kerja",
      badge: null,
      ctaLabel: "Optimasi Sekarang",
      ctaHref: "#konsultasi",
      sortOrder: 2,
    },
    {
      id: "svc-custom",
      slug: "aplikasi-web-dashboard-kustom",
      title: "Aplikasi Web & Dashboard Kustom",
      icon: "LayoutDashboard",
      shortDesc:
        "Pengembangan sistem internal berbasis web seperti dashboard operasional, inventaris pergudangan, portal karyawan, dan otomatisasi administrasi.",
      features: [
        "Dashboard Analitik Real-Time",
        "Database Relasional PostgreSQL",
        "Integrasi REST API & Webhook",
        "Role-Based Access Control",
      ],
      priceLabel: "Mulai Rp 5.000.000",
      priceNote: "Estimasi 3-6 minggu",
      badge: "Solusi Bisnis",
      ctaLabel: "Diskusikan Sistem",
      ctaHref: "#konsultasi",
      sortOrder: 3,
    },
    {
      id: "svc-mobile",
      slug: "pengembangan-aplikasi-mobile",
      title: "Pengembangan Aplikasi Mobile",
      icon: "Smartphone",
      shortDesc:
        "Pembuatan aplikasi Android dan iOS yang responsif, intuitif, dan terintegrasi dengan sistem alur kerja dan API server bisnis Anda.",
      features: [
        "Multi-platform Android & iOS",
        "Integrasi Payment Gateway",
        "Push Notification Real-Time",
        "Sinkronisasi Cloud Cepat",
      ],
      priceLabel: "Mulai Rp 7.500.000",
      priceNote: "Estimasi 4-8 minggu",
      badge: null,
      ctaLabel: "Bangun Aplikasi",
      ctaHref: "#konsultasi",
      sortOrder: 4,
    },
  ];

  for (const svc of services) {
    await prisma.service.upsert({
      where: {
        site_id_slug: {
          site_id: "nextkarya-main",
          slug: svc.slug,
        },
      },
      update: {
        title: svc.title,
        icon: svc.icon,
        shortDesc: svc.shortDesc,
        features: svc.features,
        priceLabel: svc.priceLabel,
        priceNote: svc.priceNote,
        badge: svc.badge,
        ctaLabel: svc.ctaLabel,
        ctaHref: svc.ctaHref,
        sortOrder: svc.sortOrder,
        status: ContentStatus.PUBLISHED,
        lastEditedById: "user-programmer-001",
      },
      create: {
        id: svc.id,
        site_id: "nextkarya-main",
        slug: svc.slug,
        title: svc.title,
        icon: svc.icon,
        shortDesc: svc.shortDesc,
        features: svc.features,
        priceLabel: svc.priceLabel,
        priceNote: svc.priceNote,
        badge: svc.badge,
        ctaLabel: svc.ctaLabel,
        ctaHref: svc.ctaHref,
        sortOrder: svc.sortOrder,
        status: ContentStatus.PUBLISHED,
        lastEditedById: "user-programmer-001",
      },
    });
  }
  console.log("Services seeded successfully.");

  // 5. Default Portfolios
  const portfolios = [
    {
      id: "port-klinik",
      slug: "klinik-pratama-sehat",
      title: "Sistem Reservasi & Profil Klinik Pratama Sehat",
      clientName: "Klinik Pratama Sehat",
      serviceCategory: "Sistem Web Internal",
      summary: "Digitalisasi sistem antrean pasien dan rekam medis dasar terintegrasi.",
      impactSummary: "Memangkas waktu tunggu pendaftaran pasien hingga 60%.",
      metricResult: "Waktu Antre -60%",
      technologies: ["Next.js", "Express.js", "PostgreSQL", "Tailwind CSS"],
      content: { description: "Studi kasus digitalisasi klinik pratama." },
      isFeatured: true,
      sortOrder: 1,
    },
    {
      id: "port-logistik",
      slug: "pt-mandiri-logistik",
      title: "ERP Pergudangan & Monitoring Armada PT Mandiri Logistik",
      clientName: "PT Mandiri Logistik",
      serviceCategory: "Sistem Web Internal",
      summary: "Platform manajemen pergudangan, tracking armada, dan laporan pengiriman barang.",
      impactSummary: "Meningkatkan akurasi pelacakan status pengiriman hingga 99.4%.",
      metricResult: "Akurasi Tracking 99.4%",
      technologies: ["React", "Express.js", "PostgreSQL", "Docker"],
      content: { description: "Sistem ERP pergudangan dan logistik." },
      isFeatured: true,
      sortOrder: 2,
    },
    {
      id: "port-pangan",
      slug: "cv-berkah-pangan",
      title: "Website B2B & Katalog Produk CV Berkah Pangan",
      clientName: "CV Berkah Pangan",
      serviceCategory: "Website Profil Bisnis",
      summary: "Landing page korporat B2B distributor bahan pangan dengan integrasi WhatsApp CRM.",
      impactSummary: "Menaikkan konversi lead inquiry distributor baru sebesar 45%.",
      metricResult: "Lead Inquiry +45%",
      technologies: ["Next.js", "Tailwind CSS", "TypeScript"],
      content: { description: "Katalog produk dan profil B2B." },
      isFeatured: true,
      sortOrder: 3,
    },
    {
      id: "port-kopi",
      slug: "studio-kopi-nusantara",
      title: "Aplikasi Pemesanan & Loyalitas Pelanggan Studio Kopi",
      clientName: "Studio Kopi Nusantara",
      serviceCategory: "Aplikasi Mobile",
      summary: "Aplikasi mobile pesan antar kopi lokal dan sistem poin reward loyalitas pelanggan.",
      impactSummary: "Meningkatkan retensi repeat order pelanggan bulanan sebesar 35%.",
      metricResult: "Repeat Order +35%",
      technologies: ["Flutter", "Express.js", "PostgreSQL"],
      content: { description: "Aplikasi mobile ordering dan loyalty points." },
      isFeatured: false,
      sortOrder: 4,
    },
    {
      id: "port-bimbel",
      slug: "bimbel-prestasi-gemilang",
      title: "Portal Ujian & Pembelajaran Daring Bimbel Prestasi Gemilang",
      clientName: "Bimbel Prestasi Gemilang",
      serviceCategory: "Sistem Web Internal",
      summary: "Platform e-learning berbasis web untuk kuis online, rapor siswa, dan absensi otomatis.",
      impactSummary: "Menghemat 120 jam kerja administratif tutor setiap bulannya.",
      metricResult: "Efisiensi 120 Jam/Bulan",
      technologies: ["Next.js", "Express.js", "Prisma"],
      content: { description: "Portal ujian dan pembelajaran daring." },
      isFeatured: false,
      sortOrder: 5,
    },
    {
      id: "port-sembako",
      slug: "toko-ritel-sembako-modern",
      title: "Sistem Kasir POS & Inventaris Multi-Cabang Toko Sembako",
      clientName: "Toko Sembako Makmur",
      serviceCategory: "Sistem Web Internal",
      summary: "Aplikasi kasir Point of Sale (POS) cloud dengan sinkronisasi stok riil antar 4 cabang.",
      impactSummary: "Meniadakan selisih stok fisik dan pencatatan kasir hingga 0%.",
      metricResult: "Selisih Stok 0%",
      technologies: ["React", "Express.js", "PostgreSQL"],
      content: { description: "Sistem kasir multi-cabang terintegrasi." },
      isFeatured: false,
      sortOrder: 6,
    },
  ];

  for (const port of portfolios) {
    await prisma.portfolio.upsert({
      where: {
        site_id_slug: {
          site_id: "nextkarya-main",
          slug: port.slug,
        },
      },
      update: {
        title: port.title,
        clientName: port.clientName,
        serviceCategory: port.serviceCategory,
        summary: port.summary,
        impactSummary: port.impactSummary,
        metricResult: port.metricResult,
        technologies: port.technologies,
        thumbnailUrl: `/portfolio/${port.slug}.jpg`,
        thumbnailAlt: port.title,
        content: port.content,
        isFeatured: port.isFeatured,
        sortOrder: port.sortOrder,
        status: ContentStatus.PUBLISHED,
        lastEditedById: "user-programmer-001",
        publishedAt: new Date(),
      },
      create: {
        id: port.id,
        site_id: "nextkarya-main",
        slug: port.slug,
        title: port.title,
        clientName: port.clientName,
        serviceCategory: port.serviceCategory,
        summary: port.summary,
        impactSummary: port.impactSummary,
        metricResult: port.metricResult,
        technologies: port.technologies,
        thumbnailUrl: `/portfolio/${port.slug}.jpg`,
        thumbnailAlt: port.title,
        content: port.content,
        isFeatured: port.isFeatured,
        sortOrder: port.sortOrder,
        status: ContentStatus.PUBLISHED,
        lastEditedById: "user-programmer-001",
        publishedAt: new Date(),
      },
    });
  }
  console.log("Portfolios seeded successfully.");

  // 6. Default FAQs
  const faqs = [
    {
      id: "faq-1",
      question: "Berapa lama estimasi pengerjaan website atau aplikasi?",
      answer:
        "Waktu pengerjaan bergantung pada kompleksitas proyek. Landing page atau company profile standar umumnya selesai dalam 5-10 hari kerja. Untuk sistem web kustom atau aplikasi mobile, waktu berkisar antara 3-8 minggu.",
      category: "Umum",
      sortOrder: 1,
    },
    {
      id: "faq-2",
      question: "Apakah website yang dibuat sudah termasuk domain dan hosting?",
      answer:
        "Ya, setiap paket pembuatan website Next Karya sudah mencakup konfigurasi domain, penyediaan hosting cloud berkecepatan tinggi, serta setup sertifikat SSL gratis.",
      category: "Layanan",
      sortOrder: 2,
    },
    {
      id: "faq-3",
      question: "Apakah saya bisa mengelola atau mengedit konten website sendiri?",
      answer:
        "Tentu saja. Kami menyediakan panel admin CMS yang intuitif dan mudah dipahami tanpa perlu kemampuan coding. Kami juga menyediakan panduan penggunaan dan sesi walkthrough.",
      category: "Layanan",
      sortOrder: 3,
    },
    {
      id: "faq-4",
      question: "Bagaimana sistem pembayaran proyek di Next Karya?",
      answer:
        "Pembayaran dilakukan bertahap sesuai milestone proyek: Down Payment (DP) 40% di awal proyek, termin kedua 30% setelah tahap preview/demo sistem, dan pelunasan 30% setelah proyek selesai diuji dan siap tayang.",
      category: "Biaya",
      sortOrder: 4,
    },
    {
      id: "faq-5",
      question: "Apakah ada garansi dan dukungan teknis setelah website live?",
      answer:
        "Ya. Kami memberikan garansi pemeliharaan teknis dan perbaikan bug gratis selama 3 bulan pertama setelah peluncuran. Kami juga menyediakan paket retainer maintenance bulanan untuk pengembangan berkelanjutan.",
      category: "Garansi",
      sortOrder: 5,
    },
    {
      id: "faq-6",
      question: "Di mana lokasi kantor Next Karya dan apakah melayani klien luar kota?",
      answer:
        "Next Karya Digital Solutions berbasis di Parongpong, Bandung Barat, Jawa Barat. Kami melayani klien di seluruh Indonesia dengan komunikasi intensif melalui WhatsApp, Google Meet, dan portal pelacakan proyek transparan.",
      category: "Umum",
      sortOrder: 6,
    },
  ];

  for (const faq of faqs) {
    const existing = await prisma.faq.findFirst({
      where: {
        site_id: "nextkarya-main",
        question: faq.question,
      },
    });

    if (existing) {
      await prisma.faq.update({
        where: { id: existing.id },
        data: {
          answer: faq.answer,
          category: faq.category,
          sortOrder: faq.sortOrder,
          isActive: true,
          lastEditedById: "user-programmer-001",
        },
      });
    } else {
      await prisma.faq.create({
        data: {
          id: faq.id,
          site_id: "nextkarya-main",
          question: faq.question,
          answer: faq.answer,
          category: faq.category,
          sortOrder: faq.sortOrder,
          isActive: true,
          lastEditedById: "user-programmer-001",
        },
      });
    }
  }
  console.log("FAQs seeded successfully.");

  // 7. Default Articles / Posts
  const posts = [
    {
      id: "post-tech-stack-2026",
      slug: "tips-memilih-tech-stack-website-2026",
      title: "Tips Memilih Tech Stack Website 2026 untuk UMKM dan Bisnis Modern",
      excerpt:
        "Panduan praktis memilih teknologi pembuatan website yang cepat, aman, dan mudah dikembangkan untuk jangka panjang.",
      categoryId: "cat-web",
      tags: ["Web Development", "Teknologi", "Tips Bisnis"],
      readingTimeMinutes: 4,
      seoTitle: "Tips Memilih Tech Stack Website 2026 | Next Karya",
      seoDescription:
        "Panduan praktis memilih teknologi pembuatan website yang cepat, aman, dan mudah dikembangkan untuk jangka panjang.",
      content: [
        {
          type: "paragraph",
          text: "Memilih teknologi yang tepat untuk website bisnis di tahun 2026 bukan sekadar mengikuti tren, melainkan mempertimbangkan kecepatan akses, kemudahan pemeliharaan, serta skalabilitas masa depan.",
        },
        {
          type: "heading",
          level: 2,
          text: "1. Utamakan Server Components dan Kecepatan Render",
        },
        {
          type: "paragraph",
          text: "Penggunaan React Server Components (RSC) pada Next.js memungkinkan pengiriman HTML utuh yang langsung dibaca oleh Googlebot pada first wave crawl, mempercepat indeksasi halaman.",
        },
      ],
    },
    {
      id: "post-seo-onpage-umkm",
      slug: "mengapa-seo-on-page-kunci-sukses-website-umkm",
      title: "Mengapa SEO On-Page Menjadi Kunci Sukses Website Bisnis Lokal",
      excerpt:
        "Strategi optimasi mesin pencari Google agar profil bisnis dan produk Anda mudah ditemukan calon pelanggan potensial.",
      categoryId: "cat-edu",
      tags: ["SEO", "Google", "UMKM"],
      readingTimeMinutes: 5,
      seoTitle: "Mengapa SEO On-Page Kunci Sukses Website Bisnis | Next Karya",
      seoDescription:
        "Strategi optimasi mesin pencari Google agar profil bisnis dan produk Anda mudah ditemukan calon pelanggan potensial.",
      content: [
        {
          type: "paragraph",
          text: "Banyak bisnis memiliki website dengan desain menarik namun minim pengunjung karena mengabaikan optimasi SEO on-page yang tepat sejak awal perancangan.",
        },
        {
          type: "heading",
          level: 2,
          text: "Pentingnya Data Terstruktur Schema.org",
        },
        {
          type: "paragraph",
          text: "Dengan menyematkan data terstruktur LocalBusiness dan FAQPage, Google dapat menampilkan cuplikan kaya (rich snippet) yang meningkatkan rasio klik (CTR) pengunjung.",
        },
      ],
    },
    {
      id: "post-migrasi-website-modern",
      slug: "panduan-migrasi-website-lama-ke-modern",
      title: "Panduan Migrasi Website Lama ke Arsitektur Modern Berkecepatan Tinggi",
      excerpt:
        "Langkah aman memperbarui website lawas tanpa kehilangan data, peringkat SEO, maupun mengganggu operasional bisnis.",
      categoryId: "cat-custom",
      tags: ["Redesign", "Performance", "Cloud"],
      readingTimeMinutes: 4,
      seoTitle: "Panduan Migrasi Website Lama ke Modern | Next Karya",
      seoDescription:
        "Langkah aman memperbarui website lawas tanpa kehilangan data, peringkat SEO, maupun mengganggu operasional bisnis.",
      content: [
        {
          type: "paragraph",
          text: "Website lama dengan arsitektur monolitik yang lambat sering kali membebani konversi bisnis. Proses migrasi terencana memastikan transisi berjalan mulus tanpa downtime.",
        },
      ],
    },
  ];

  for (const post of posts) {
    await prisma.post.upsert({
      where: {
        site_id_slug: {
          site_id: "nextkarya-main",
          slug: post.slug,
        },
      },
      update: {
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        tags: post.tags,
        readingTimeMinutes: post.readingTimeMinutes,
        seoTitle: post.seoTitle,
        seoDescription: post.seoDescription,
        status: ContentStatus.PUBLISHED,
        categoryId: post.categoryId,
        authorId: "user-programmer-001",
        lastEditedById: "user-programmer-001",
        publishedAt: new Date(),
      },
      create: {
        id: post.id,
        site_id: "nextkarya-main",
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        tags: post.tags,
        readingTimeMinutes: post.readingTimeMinutes,
        seoTitle: post.seoTitle,
        seoDescription: post.seoDescription,
        status: ContentStatus.PUBLISHED,
        categoryId: post.categoryId,
        authorId: "user-programmer-001",
        lastEditedById: "user-programmer-001",
        publishedAt: new Date(),
      },
    });
  }
  console.log("Articles/Posts seeded successfully.");

  // 8. Default Static Pages
  const pages = [
    {
      id: "page-privacy",
      slug: "kebijakan-privasi",
      title: "Kebijakan Privasi",
      seoTitle: "Kebijakan Privasi | Next Karya Digital Solutions",
      seoDescription:
        "Komitmen Next Karya Digital Solutions dalam melindungi data pribadi dan informasi bisnis klien.",
      content: {
        updatedLabel: "Diperbarui Oktober 2026",
        blocks: [
          {
            type: "paragraph",
            text: "Next Karya Digital Solutions berkomitmen menjaga kerahasiaan data pribadi dan informasi bisnis yang Anda sampaikan melalui formulir konsultasi maupun komunikasi resmi.",
          },
          {
            type: "heading",
            level: 2,
            text: "1. Penggunaan Informasi Kontak",
          },
          {
            type: "paragraph",
            text: "Data nama, nomor WhatsApp, dan alamat email yang Anda kirimkan semata-mata digunakan untuk menindaklanjuti permintaan konsultasi teknis dan penyusunan proposal proyek.",
          },
        ],
      },
    },
    {
      id: "page-terms",
      slug: "syarat-ketentuan",
      title: "Syarat dan Ketentuan Layanan",
      seoTitle: "Syarat dan Ketentuan Layanan | Next Karya Digital Solutions",
      seoDescription:
        "Ketentuan kerja sama pengembangan website, sistem informasi web, dan aplikasi mobile di Next Karya.",
      content: {
        updatedLabel: "Diperbarui Oktober 2026",
        blocks: [
          {
            type: "paragraph",
            text: "Dokumen ini mengatur hak dan kewajiban antara Next Karya Digital Solutions dan klien dalam setiap tahapan pengembangan perangkat lunak.",
          },
          {
            type: "heading",
            level: 2,
            text: "1. Ruang Lingkup dan Garansi Pemeliharaan",
          },
          {
            type: "paragraph",
            text: "Setiap proyek pengembangan sistem dilengkapi masa garansi perbaikan bug teknis sesuai kesepakatan kontrak kerja sama.",
          },
        ],
      },
    },
  ];

  for (const pg of pages) {
    await prisma.page.upsert({
      where: {
        site_id_slug: {
          site_id: "nextkarya-main",
          slug: pg.slug,
        },
      },
      update: {
        title: pg.title,
        content: pg.content,
        seoTitle: pg.seoTitle,
        seoDescription: pg.seoDescription,
        status: ContentStatus.PUBLISHED,
        lastEditedById: "user-programmer-001",
      },
      create: {
        id: pg.id,
        site_id: "nextkarya-main",
        slug: pg.slug,
        title: pg.title,
        content: pg.content,
        seoTitle: pg.seoTitle,
        seoDescription: pg.seoDescription,
        status: ContentStatus.PUBLISHED,
        lastEditedById: "user-programmer-001",
      },
    });
  }
  console.log("Static Pages seeded successfully.");

  // 9. Default Testimonials
  const testimonials = [
    {
      id: "testi-klinik",
      clientName: "dr. Hendra Wijaya",
      clientRole: "Kepala Klinik",
      companyName: "Klinik Pratama Sehat",
      content:
        "Sejak sistem reservasi web berjalan, antrean pasien pagi jauh lebih tertib dan staf administrasi tidak lagi kewalahan mencatat manual.",
      rating: 5,
      portfolioId: "port-klinik",
      sortOrder: 1,
    },
    {
      id: "testi-logistik",
      clientName: "Budi Santoso",
      clientRole: "Manajer Operasional",
      companyName: "PT Mandiri Logistik",
      content:
        "Dashboard monitoring armada dan stok gudang sangat membantu tim kami memantau pengiriman antarkota secara real-time.",
      rating: 5,
      portfolioId: "port-logistik",
      sortOrder: 2,
    },
    {
      id: "testi-pangan",
      clientName: "Siti Rahmawati",
      clientRole: "Direktur Pemasaran",
      companyName: "CV Berkah Pangan",
      content:
        "Katalog B2B yang dibangun tim Next Karya cepat diakses dari HP dan langsung terhubung ke WhatsApp tim sales kami.",
      rating: 5,
      portfolioId: "port-pangan",
      sortOrder: 3,
    },
  ];

  for (const testi of testimonials) {
    await prisma.testimonial.upsert({
      where: { id: testi.id },
      update: {
        clientName: testi.clientName,
        clientRole: testi.clientRole,
        companyName: testi.companyName,
        content: testi.content,
        rating: testi.rating,
        portfolioId: testi.portfolioId,
        sortOrder: testi.sortOrder,
        status: ContentStatus.PUBLISHED,
        lastEditedById: "user-programmer-001",
      },
      create: {
        id: testi.id,
        site_id: "nextkarya-main",
        clientName: testi.clientName,
        clientRole: testi.clientRole,
        companyName: testi.companyName,
        content: testi.content,
        rating: testi.rating,
        portfolioId: testi.portfolioId,
        sortOrder: testi.sortOrder,
        status: ContentStatus.PUBLISHED,
        lastEditedById: "user-programmer-001",
      },
    });
  }
  console.log("Testimonials seeded successfully.");

  // 14. Canonical Analytics Daily (Docs v2.2 & API Contracts 5.5)
  const canonicalDate = new Date("2026-10-30");
  // Overview record (path = '*')
  await prisma.analyticsDaily.upsert({
    where: {
      site_id_date_path_source_device: {
        site_id: "nextkarya-main",
        date: canonicalDate,
        path: "*",
        source: "all",
        device: "all",
      },
    },
    update: {
      visitors: 4250,
      sessions: 5120,
      pageviews: 18450,
      durationSec: 742400,
      bounces: 1956,
      whatsappClicks: 210,
      formSubmits: 85,
      conversions: 295,
    },
    create: {
      site_id: "nextkarya-main",
      date: canonicalDate,
      path: "*",
      source: "all",
      device: "all",
      visitors: 4250,
      sessions: 5120,
      pageviews: 18450,
      durationSec: 742400,
      bounces: 1956,
      whatsappClicks: 210,
      formSubmits: 85,
      conversions: 295,
    },
  });

  // Top pages ranking records (path != '*')
  const canonicalPages = [
    {
      path: "/",
      pageviews: 7520,
      visitors: 3100,
      sessions: 3500,
      bounces: 1124,
      whatsappClicks: 100,
      formSubmits: 40,
      conversions: 140,
      source: "google",
    },
    {
      path: "/layanan",
      pageviews: 3840,
      visitors: 1950,
      sessions: 2100,
      bounces: 596,
      whatsappClicks: 65,
      formSubmits: 30,
      conversions: 95,
      source: "direct",
    },
    {
      path: "/portofolio",
      pageviews: 2910,
      visitors: 1420,
      sessions: 1600,
      bounces: 560,
      whatsappClicks: 30,
      formSubmits: 12,
      conversions: 42,
      source: "instagram",
    },
    {
      path: "/tentang-kami",
      pageviews: 2380,
      visitors: 1100,
      sessions: 1250,
      bounces: 515,
      whatsappClicks: 10,
      formSubmits: 2,
      conversions: 12,
      source: "google",
    },
    {
      path: "/blog",
      pageviews: 1800,
      visitors: 950,
      sessions: 1020,
      bounces: 454,
      whatsappClicks: 5,
      formSubmits: 1,
      conversions: 6,
      source: "referral",
    },
  ];

  for (const cp of canonicalPages) {
    await prisma.analyticsDaily.upsert({
      where: {
        site_id_date_path_source_device: {
          site_id: "nextkarya-main",
          date: canonicalDate,
          path: cp.path,
          source: cp.source,
          device: "all",
        },
      },
      update: {
        pageviews: cp.pageviews,
        visitors: cp.visitors,
        sessions: cp.sessions,
        bounces: cp.bounces,
        durationSec: cp.sessions * 130,
        whatsappClicks: cp.whatsappClicks,
        formSubmits: cp.formSubmits,
        conversions: cp.conversions,
      },
      create: {
        site_id: "nextkarya-main",
        date: canonicalDate,
        path: cp.path,
        source: cp.source,
        device: "all",
        pageviews: cp.pageviews,
        visitors: cp.visitors,
        sessions: cp.sessions,
        bounces: cp.bounces,
        durationSec: cp.sessions * 130,
        whatsappClicks: cp.whatsappClicks,
        formSubmits: cp.formSubmits,
        conversions: cp.conversions,
      },
    });
  }
  console.log("Analytics canonical records seeded successfully.");

  console.log("Canonical database seeding completed 100%!");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
