const express = require('express');
const session = require('express-session');
const path = require('path');
const { marked } = require('marked');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'antigravity2024';

// ---------- Firestore: database / truth ----------
let adminDb;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
    adminDb = admin.firestore();
  }
} catch (e) {
  console.warn('Firebase init failed (non-fatal):', e.message);
}

// ---------- Seed articles (fallback when Firestore unavailable) ----------
const SEED_ARTICLES = [
  {
    slug: "mitid-cybersikkerhed-2026",
    title: "MitID og cybersikkerhed: Hvad danskerne skal vide",
    summary: "MitID er Danmarks digitale nøgle, men nye trusler gør det vigtigere end nogensinde at forstå, hvordan man beskytter sin identitet online.",
    category: "cybersikkerhed",
    author: "TruthMedia Redaktion",
    date: "2026-11-10",
    image: "/assets/images/placeholder.svg",
    imageAlt: "MitID login-skærm på smartphone",
    sources: ["https://www.mitid.dk/", "https://www.cybersikkerhed.dk/"],
    featured: true,
    readingTime: "5 min læsning",
    sample: true,
    content: "# MitID og cybersikkerhed\n\nMitID er Danmarks fælles digitale identitet, der bruges af millioner af danskere til netbank, offentlige tjenester og private tjenester. Men med udbredelsen følger nye sikkerhedsudfordringer.\n\n## Hvad du skal gøre\n\nBrug totrinsgodkendelse, del aldrig din kode, og hold din app opdateret.\n\n## Kilder\n\nSe MitID's egne sikkerhedsvejledninger for de nyeste anbefalinger.",
  },
  {
    slug: "eu-ai-lov-danmark",
    title: "EU's AI-lov træder i kraft: Hvad betyder det for danske virksomheder?",
    summary: "Den nye EU-forordning om kunstig intelligens sætter krav til gennemsigtighed, risikovurdering og menneskeligt tilsyn. Sådan påvirker det dansk erhvervsliv.",
    category: "ai",
    author: "TruthMedia Redaktion",
    date: "2026-11-08",
    image: "/assets/images/placeholder.svg",
    imageAlt: "AI-hjerne illustration",
    sources: ["https://digital-strategi.ekst.dk/"],
    featured: false,
    readingTime: "6 min læsning",
    sample: true,
    content: "# EU's AI-lov\n\nEU's AI-forordning er verdens første omfattende lov om kunstig intelligens. Den træder gradvist i kraft og påvirker alle virksomheder, der udvikler eller bruger AI i EU.\n\n## Højrisiko-systemer\n\nKrav om risikovurdering, dokumentation og menneskeligt tilsyn.\n\n## Generel AI\n\nKrav om gennemsigtighed om, hvornår indhold er AI-genereret.",
  },
  {
    slug: "copenhagen-startup-finansiering",
    title: "Copenhagen-startups rejser rekordbeløb i 2026",
    summary: "Københavnske iværksætterselskaber har rejst mere end 2 milliarder kroner i første halvår. Vi ser på de største runder og de sektorer, investorer satser på.",
    category: "startups",
    author: "TruthMedia Redaktion",
    date: "2026-11-05",
    image: "/assets/images/placeholder.svg",
    imageAlt: "Startup-kontor i København",
    sources: [],
    featured: false,
    readingTime: "4 min læsning",
    sample: true,
    content: "# Copenhagen-startups\n\nKøbenhavn har etableret sig som en af Nordens vigtigste startup-hubber. I første halvår af 2026 blev der rejst mere end 2 mia. kr. til danske iværksætterselskaber.\n\n## Sektorer i vækst\n\nGrøn teknologi, sundhedsteknologi og fintech leder feltet.\n\n## Udfordringer\n\nTilgængelighed af kapital og kvalificeret arbejdskraft er de største barrierer.",
  },
  {
    slug: "offshore-vind-data-centre",
    title: "Grøn tech: Offshore vindmøller drev danske datacentre",
    summary: "Nye aftaler mellem energiselskaber og cloud-udbydere betyder, at flere danske datacentre nu kører på strøm fra havvindmøller uden for kysten.",
    category: "groen-tech",
    author: "TruthMedia Redaktion",
    date: "2026-11-03",
    image: "/assets/images/placeholder.svg",
    imageAlt: "Offshore vindmøller på havet",
    sources: [],
    featured: false,
    readingTime: "5 min læsning",
    sample: true,
    content: "# Offshore vind og datacentre\n\nDanmark har nogle af verdens største havvindparker, og nu bliver strømmen brugt til at drive landets voksende datacentre.\n\n## Sammenhængen\n\nCloud-udbydere indgår direkte aftaler om vedvarende energi fra havmøller.\n\n## Klimaregnskab\n\nDenne kobling reducerer datacentrenes CO2-aftryk markant.",
  },
  {
    slug: "nordisk-gaming-esport",
    title: "Nordisk gaming vokser: Esport får større plads i dansk kultur",
    summary: "Fra små LAN-fester til store arena-events. Esport og gaming bliver en naturlig del af det danske kulturliv, og investeringerne følger med.",
    category: "gaming",
    author: "TruthMedia Redaktion",
    date: "2026-10-29",
    image: "/assets/images/placeholder.svg",
    imageAlt: "Esport-turnering i Danmark",
    sources: [],
    featured: false,
    readingTime: "4 min læsning",
    sample: true,
    content: "# Nordisk gaming\n\nEsport er ikke længere en niche. I Danmark og resten af Norden vokser gaming som både kultur, sport og forretning.\n\n## Arenaer og events\n\nNye gaming-arenaer skyder op i København, Aarhus og Stockholm.\n\n## Investeringer\n\nDanske investorer ser gaming som en voksende industri med international rækkevidde.",
  },
  {
    slug: "gadgets-2026-dansk-test",
    title: "Gadgets 2026: Det danske bud på næste generations bærbare tech",
    summary: "Danske designere og ingeniører arbejder på bærbare enheder, der kombinerer skandinavisk minimalisme med avanceret teknologi.",
    category: "gadgets",
    author: "TruthMedia Redaktion",
    date: "2026-10-25",
    image: "/assets/images/placeholder.svg",
    imageAlt: "Danske gadgets på bord",
    sources: [],
    featured: false,
    readingTime: "3 min læsning",
    sample: true,
    content: "# Gadgets 2026\n\nDet danske tech-design er kendt for enkelhed og funktionalitet. En ny generation af bærbare gadgets bringer den arv ind i 2026.\n\n## Designfilosofi\n\nMindre, smukkere og mere holdbart.\n\n## Eksempler\n\nFra trådløse høretelefoner til smarte ure med dansk design.",
  },
  {
    slug: "dansk-ai-model-sprog",
    title: "Dansk AI-model: Når sproget skal forstås på dansk",
    summary: "En ny danskudviklet sprogmodel viser, at man ikke behøver at stole på amerikanske modeller for at få AI, der taler flydende dansk.",
    category: "dansk-tech",
    author: "TruthMedia Redaktion",
    date: "2026-10-20",
    image: "/assets/images/placeholder.svg",
    imageAlt: "AI-sprogmodel interface",
    sources: [],
    featured: false,
    readingTime: "5 min læsning",
    sample: true,
    content: "# Dansk AI-model\n\nFlere danske forskergrupper arbejder på sprogmodeller, der er trænet specifikt på dansk og de nordiske sprog.\n\n## Fordelene\n\nBedre forståelse af danske udtryk, dialekter og kulturelle referencer.\n\n## Udfordringen\n\nMindre træningsdata end de store internationale modeller.",
  },
  {
    slug: "cybersikkerhed-kommune-angreb",
    title: "Cybersikkerhed: Kommuner styrker forsvar efter angreb",
    summary: "Flere danske kommuner har været udsat for cyberangreb i det seneste år. Nu investeres der i bedre beskyttelse af borgernes data og kommunale systemer.",
    category: "cybersikkerhed",
    author: "TruthMedia Redaktion",
    date: "2026-10-15",
    image: "/assets/images/placeholder.svg",
    imageAlt: "Cybersikkerhed illustration",
    sources: [],
    featured: false,
    readingTime: "4 min læsning",
    sample: true,
    content: "# Cybersikkerhed i kommuner\n\nCyberangreb mod danske kommuner er steget, og det har skubbet til investeringer i bedre digital sikkerhed.\n\n## Tiltag\n\nTo-faktor-godkendelse, bedre backup og medarbejdertræning.\n\n## Ansvar\n\nBorgernes data skal beskyttes, uanset om de ligger i en kommune eller en privat virksomhed.",
  },
];

let articlesCache = [...SEED_ARTICLES];

async function loadArticles() {
  try {
    if (adminDb) {
      const snapshot = await adminDb.collection('truth').get();
      if (snapshot.empty) {
        await saveArticles(SEED_ARTICLES);
        return [...SEED_ARTICLES];
      }
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      articlesCache = docs;
      return docs;
    }
    return [...SEED_ARTICLES];
  } catch (e) {
    console.warn('loadArticles failed, using cache:', e.message);
    return [...articlesCache];
  }
}

async function saveArticles(articles) {
  try {
    articlesCache = articles;
    if (adminDb) {
      const batch = adminDb.batch();
      const existing = await adminDb.collection('truth').get();
      existing.forEach(doc => batch.delete(doc.ref));
      articles.forEach((a, i) => {
        const docRef = adminDb.collection('truth').doc(a.id || `article_${i}`);
        const { id, ...data } = a;
        batch.set(docRef, data);
      });
      await batch.commit();
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function formatDateDa(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });
  } catch (e) { return dateStr; }
}

function slugify(title) {
  return title.toLowerCase().replace(/[æ]/g, 'ae').replace(/[ø]/g, 'oe').replace(/[å]/g, 'aa').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

const site = {
  name: "TruthMedia",
  tagline: "Teknologi, uden støj.",
  description: "Dansk teknologinyheder og analyse om AI, startups, cybersikkerhed, gadgets, grøn tech, gaming og det nordiske tech-miljø.",
  language: "da-DK",
  url: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://truthmedia.dk",
  author: "TruthMedia Redaktion",
  email: "redaktion@truthmedia.dk",
  address: { city: "København", country: "Danmark" },
};

const categories = [
  { slug: "ai", label: "AI" },
  { slug: "startups", label: "Startups" },
  { slug: "cybersikkerhed", label: "Cybersikkerhed" },
  { slug: "gadgets", label: "Gadgets" },
  { slug: "groen-tech", label: "Grøn tech" },
  { slug: "gaming", label: "Gaming" },
  { slug: "dansk-tech", label: "Dansk tech" },
];

let visitors = [];

function getClientIp(req) {
  return req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown';
}

async function getGeoLocation(ip) {
  if (ip === 'unknown' || ip.startsWith('127.') || ip.startsWith('::1') || ip.startsWith('192.168.')) {
    return { country: 'Local', city: 'Local', ip };
  }
  try {
    const resp = await fetch(`https://ipapi.co/${ip}/json/`);
    const data = await resp.json();
    return { ip: data.ip || ip, country: data.country_name || 'Unknown', city: data.city || 'Unknown' };
  } catch (e) {
    return { ip, country: 'Unknown', city: 'Unknown' };
  }
}

function recordVisitor(req) {
  const ip = getClientIp(req);
  const visitor = { ip, country: 'Looking up...', city: 'Looking up...', timestamp: new Date().toISOString(), path: req.originalUrl || req.url };
  visitors.unshift(visitor);
  if (visitors.length > 500) visitors.pop();
  getGeoLocation(ip).then((geo) => {
    const v = visitors.find((v) => v.ip === ip && v.timestamp === visitor.timestamp);
    if (v) { v.country = geo.country; v.city = geo.city; }
  });
  return visitor;
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({ secret: 'truthmedia-secret-key-change-in-production', resave: false, saveUninitialized: false, cookie: { maxAge: 24 * 60 * 60 * 1000 } }));

app.use((req, res, next) => { recordVisitor(req); next(); });

function requireAuth(req, res, next) {
  if (!req.session.isAdmin) return res.redirect('/admin/login');
  next();
}

function layout(title, body, extraMeta = '', isAdmin = false) {
  const description = title.includes('TruthMedia') ? site.tagline : `${title} — ${site.name}`;
  const canonical = title === 'Forside' ? site.url : `${site.url}/`;
  const ogImage = `${site.url}/assets/images/placeholder.svg`;
  return `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark">
  <title>${escapeHtml(title)} — ${site.name}</title><meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website"><meta property="og:url" content="${canonical}">
  <meta property="og:title" content="${escapeHtml(title)} — ${site.name}"><meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${ogImage}"><meta property="og:locale" content="da_DK"><meta property="og:site_name" content="${site.name}">
  <meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)} — ${site.name}">
  <meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${ogImage}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="stylesheet" href="/css/style.css">${extraMeta}
</head>
<body class="${isAdmin ? 'admin-page' : ''}">
  <a href="#content" class="skip-link">Spring til indhold</a>
  <header class="header">
    <div class="container header-inner">
      <a href="/" class="logo" aria-label="${site.name} — forsiden"><span class="logo-mark">·</span><span class="logo-text">${site.name}</span><span class="logo-tagline">${site.tagline}</span></a>
      <nav class="main-nav">${categories.map(c => `<a href="/kategori/${c.slug}/"${title === c.label ? ' aria-current="page"' : ''}>${c.label}</a>`).join('')}<a href="/om/"${title === 'Om ${site.name}' ? ' aria-current="page"' : ''}>Om os</a><a href="/kontakt/"${title.startsWith('Kontakt') ? ' aria-current="page"' : ''}>Kontakt</a><a href="/rettelser/"${title.startsWith('Rettelser') ? ' aria-current="page"' : ''}>Rettelser</a></nav>
      <div class="header-actions"><button class="theme-toggle" id="themeToggle" aria-label="Skift til mørk tilstand">🌙</button>${isAdmin ? `<a href="/admin/" class="btn">Admin</a>` : ''}</div>
    </div>
  </header>
  <main id="content">${body}</main>
  <footer class="footer"><div class="container footer-inner">
    <div class="footer-brand"><div class="logo" style="text-decoration:none;color:inherit;"><span class="logo-mark">·</span><span class="logo-text">${site.name}</span></div><p class="footer-tagline">${site.tagline}</p></div>
    <div class="footer-links"><h3>Kategorier</h3><ul>${categories.map(c => `<li><a href="/kategori/${c.slug}/">${c.label}</a></li>`).join('')}</ul></div>
    <div class="footer-links"><h3>Redaktionen</h3><ul><li><a href="/om/">Om TruthMedia</a></li><li><a href="/rettelser/">Rettelser</a></li><li><a href="/kontakt/">Kontakt</a></li><li><a href="mailto:${site.email}">${site.email}</a></li></ul></div>
    </div>
    <div class="footer-bottom"><p>© ${new Date().getFullYear()} ${site.name}. Alle rettigheder forbeholdt.</p><div class="footer-social"><a href="/feed.xml" aria-label="RSS-feed">RSS</a><a href="mailto:${site.email}" aria-label="E-mail">E-mail</a></div></div>
  </footer>
  <script src="/js/main.js"></script></body>
</html>`;
}

function cardHtml(article, isFeatured = false) {
  const readingTime = article.readingTime || '3 min læsning';
  const isSample = article.sample !== false;
  const imageUrl = article.image || '/assets/images/placeholder.svg';
  return `<article class="article-card reveal${isFeatured ? ' featured' : ''}"><a href="/artikler/${article.slug}/" class="card-link"><img src="${imageUrl}" alt="${article.imageAlt || 'Artikelbillede'}" class="card-image" loading="lazy"><div class="card-body">${isSample ? '<span class="badge badge-sample">Prøve</span>' : ''}<span class="card-category">${article.category}</span><h2 class="card-title">${article.title}</h2><p class="card-excerpt">${article.summary}</p><div class="card-footer"><span class="card-meta">${article.author} · ${formatDateDa(article.date)} · ${readingTime}</span><span class="card-arrow">→</span></div></div></a></article>`;
}

app.get('/', async (req, res) => {
  try {
    const articles = (await loadArticles()).sort((a, b) => new Date(b.date) - new Date(a.date));
    const featured = articles.filter(a => a.featured)[0] || articles[0];
    const latest = articles.filter(a => a !== featured).slice(0, 6);
    let body = `<section class="hero reveal"><div class="container hero-inner"><span class="hero-badge">Topshistorie</span><h1 class="hero-title"><a href="/artikler/${featured.slug}/" style="color:inherit;text-decoration:none;">${featured.title}</a></h1><p class="hero-summary">${featured.summary}</p><div class="hero-meta"><span>${featured.author}</span><span>·</span><time>${formatDateDa(featured.date)}</time><span>·</span><span>${featured.readingTime || '3 min læsning'}</span></div><img src="${featured.image || '/assets/images/placeholder.svg'}" alt="${featured.imageAlt || ''}" class="hero-image" loading="eager"><a href="/artikler/${featured.slug}/" class="hero-cta">Læs hele artiklen<span class="arrow">→</span></a></div></section><section class="reveal"><div class="container"><div class="category-filters"><a href="/" class="chip chip--active">Alle</a>${categories.map(c => `<a href="/kategori/${c.slug}/" class="chip">${c.label}</a>`).join('')}</div><h2 class="section-label section-label--no-top">Seneste artikler</h2><div class="article-grid">${latest.map(a => cardHtml(a)).join('')}</div></div></section><section class="newsletter reveal"><h2>Nyhedsbrev</h2><p>Få de vigtigste teknologinyheder direkte i indbakken hver fredag. Ingen spam, kun stof.</p><form class="newsletter-form" action="#" method="POST" novalidate><input type="email" name="email" placeholder="Din e-mailadresse" required aria-label="E-mailadresse"><button type="submit" class="btn">Tilmeld</button></form><p class="newsletter-disclaimer">Ved tilmelding accepterer du vores vilkår. Du kan til enhver tid afmelde dig.</p></section>`;
    res.send(layout('Forside', body));
  } catch (e) {
    res.status(500).send('<h1>Fejl</h1><p>' + e.message + '</p><a href="/">Prøv igen</a>');
  }
});

app.get('/artikler/:slug/', async (req, res) => {
  try {
    const articles = await loadArticles();
    const article = articles.find(a => a.slug === req.params.slug);
    if (!article) return res.status(404).send(layout('404', '<h1>Siden findes ikke</h1><p>Artiklen blev ikke fundet.</p><a href="/" class="btn">Gå til forsiden</a>'));
    const related = articles.filter(a => a.category === article.category && a.slug !== article.slug).slice(0, 3);
    let body = `<article class="article-wrap reveal"><header class="article-header">${article.sample !== false ? '<span class="badge badge-sample">Prøve</span>' : ''}<span class="article-category">${article.category}</span><span>·</span><time date="${article.date.toISOString()}">${formatDateDa(article.date)}</time><span>·</span><span>${article.readingTime || '3 min læsning'}</span><h1 class="article-title">${article.title}</h1><img src="${article.image || '/assets/images/placeholder.svg'}" alt="${article.imageAlt || ''}" class="article-image" loading="eager">${article.imageAlt ? `<p class="article-image-caption">${article.imageAlt}</p>` : ''}</header><div class="article-body">${marked(article.content || '')}</div>`;
    if (article.sources && article.sources.length > 0) {
      body += `<section class="sources"><h3>Kilder</h3><ul>${article.sources.map(src => `<li><a href="${src}" target="_blank" rel="noopener noreferrer">${src}</a></li>`).join('')}</ul></section>`;
    }
    body += `<div class="share"><a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(site.url + '/artikler/' + article.slug + '/')}" target="_blank" class="share-btn" aria-label="Del på Facebook">Facebook</a><a href="https://x.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(site.url + '/artikler/' + article.slug + '/')}" target="_blank" class="share-btn" aria-label="Del på X">X</a><a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(site.url + '/artikler/' + article.slug + '/')}" target="_blank" class="share-btn" aria-label="Del på LinkedIn">LinkedIn</a><a href="mailto:?subject=${encodeURIComponent(article.title)}&body=${encodeURIComponent('Læs artiklen: ' + site.url + '/artikler/' + article.slug + '/')}" class="share-btn" aria-label="Del via e-mail">E-mail</a></div>`;
    if (related.length > 0) {
      body += `<section class="related"><h3>Relaterede artikler</h3><div class="related-grid">${related.map(r => `<a href="/artikler/${r.slug}/" class="related-card"><span class="related-cat">${r.category}</span><h2 class="related-title">${r.title}</h2></a>`).join('')}</div></section>`;
    }
    body += `</article>`;
    res.send(layout(article.title, body, '', false));
  } catch (e) {
    res.status(500).send('<h1>Fejl</h1><p>' + e.message + '</p><a href="/">Prøv igen</a>');
  }
});

app.get('/kategori/:slug/', async (req, res) => {
  try {
    const cat = categories.find(c => c.slug === req.params.slug);
    if (!cat) return res.status(404).send(layout('404', '<h1>Kategori ikke fundet</h1><a href="/" class="btn">Gå til forsiden</a>'));
    const articles = (await loadArticles()).filter(a => a.category === cat.slug).sort((a, b) => new Date(b.date) - new Date(a.date));
    let body = `<section class="reveal"><div class="container"><h1 class="category-title">${cat.label}</h1><p class="category-desc">Artikler inden for ${cat.label.toLowerCase()}.</p><div class="article-grid">${articles.length > 0 ? articles.map(a => cardHtml(a)).join('') : '<p class="empty">Ingen artikler i denne kategori endnu.</p>'}</div></div></section>`;
    res.send(layout(`Kategori: ${cat.label}`, body));
  } catch (e) {
    res.status(500).send('<h1>Fejl</h1><p>' + e.message + '</p><a href="/">Prøv igen</a>');
  }
});

app.get('/om/', (req, res) => {
  try {
    const body = `<section class="reveal"><div class="container"><h1 class="section-title">Om ${site.name}</h1><p class="intro">${site.tagline} Vi er et uafhængigt dansk medie om teknologi — for dem, der vil forstå, hvad der sker, uden støj og sensation.</p><div class="about-grid"><div class="card"><h3>Vores mission</h3><p>${site.name} dækker AI, startups, cybersikkerhed, gadgets, grøn tech, gaming og det danske og nordiske tech-miljø. Vi skriver til læsere i Danmark, på dansk, med respekt for tid og opmærksomhed.</p><p>Vores ambition er at være et troværdigt sted at vende tilbage til — ikke den første historie, men den bedste.</p></div><div class="card"><h3>Redaktionelle principper</h3><ul class="principles-list"><li>Vi opdager ikke historier for at skabe klik. Vi skriver for at informere.</li><li>Vi adskiller tydeligt mellem nyheder, analyse og holdning.</li><li>Vi kilder vores informationer og angiver, hvor du kan læse mere.</li><li>Vi retter fejl hurtigt og åbent, når vi opdager dem.</li><li>Vi er uafhængige af annoncører og tech-virksomheder i vores dækning.</li></ul></div></div><div class="card full-width"><h3>Sådan arbejder vi</h3><p><strong>Kilder.</strong> Vi bygger på offentlige kilder, pressemeddelelser, officiel dokumentation og egne samtaler. Hvor det er muligt, linker vi direkte til kilderne, så du selv kan vurdere dem.</p><p><strong>Uafhængighed.</strong> ${site.name} drives af sin egen redaktion. Vi tager ikke imod betaling for omtale, og annoncører har ingen indflydelse på, hvad vi skriver.</p><p><strong>Rettelser.</strong> Opdager du en fejl? Rapportér den på vores <a href="/rettelser/">rettelsesside</a>. Vi retter og markerer ændringer tydeligt, så du altid kan se, hvad der er ændret.</p><p><strong>Prøveindhold.</strong> Alle artikler på dette site er prøveartikler til en demonstration.</p></div></div></section>`;
    res.send(layout(`Om ${site.name}`, body));
  } catch (e) {
    res.status(500).send('<h1>Fejl</h1><p>' + e.message + '</p><a href="/">Prøv igen</a>');
  }
});

app.get('/kontakt/', (req, res) => {
  try {
    const body = `<section class="reveal"><div class="container"><h1 class="section-title">Kontakt</h1><p class="intro">Har du et tip, et spørgsmål eller en rettelse? Vi hører gerne fra dig.</p><div class="contact-grid"><div class="card"><h3>Send os en besked</h3><p>Du kan kontakte redaktionen på e-mail. Vi besvarer henvendelser så hurtigt som muligt.</p><p><strong>E-mail:</strong> <a href="mailto:${site.email}">${site.email}</a></p><p><strong>Adresse:</strong> ${site.address.city}, ${site.address.country}</p></div><div class="card"><h3>Redaktionen</h3><p>${site.name} er et uafhængigt dansk medie om teknologi. Vi dækker AI, startups, cybersikkerhed, gadgets, grøn tech, gaming og det nordiske tech-miljø.</p><p><strong>Ansvarshavende redaktør:</strong> ${site.author}</p><p><strong>Prøveindhold:</strong> Dette site indeholder udelukkende prøveartikler til en demonstration.</p><a href="/om/" class="btn">Læs mere om os</a></div></div></div></section>`;
    res.send(layout(`Kontakt ${site.name}`, body));
  } catch (e) {
    res.status(500).send('<h1>Fejl</h1><p>' + e.message + '</p><a href="/">Prøv igen</a>');
  }
});

app.get('/rettelser/', (req, res) => {
  try {
    const body = `<section class="reveal"><div class="container"><h1 class="section-title">Rettelser</h1><p class="intro">Vi stræber efter nøjagtighed, men fejl kan ske. Hvis du opdager noget, der ikke er rigtigt i en af vores artikler, vil vi gerne høre fra dig.</p><div class="card"><h3>Sådan rapporterer du en fejl</h3><p>Fortæl os, hvilken artikel det drejer sig om, hvad du mener er forkert, og helst hvor du har fundet den korrekte information.</p><ol class="steps"><li>Kopier linket til den artikel, hvor du har fundet fejlen.</li><li>Beskriv fejlen så præcist som muligt.</li><li>Send en e-mail til <a href="mailto:${site.email}" class="mailto-link">${site.email}</a> med emnet "Rettelse: [artikeltitel]".</li></ol><p>Vi behandler alle henvendelser hurtigt og åbent. Hvis vi retter en artikel, markerer vi ændringen tydeligt nederst i artiklen, så du kan se, hvad der er blevet rettet, og hvornår.</p></div><div class="card card-mt"><h3>Vores rettelsespolitik</h3><p>Faktiske fejl rettes så snart de er bekræftet. Sproglige justeringer og klarlæggelser foretages løbende uden særlig markering. Større faktuelle ændringer får en note i artiklen med dato for rettelsen.</p><p><strong>Prøveindhold.</strong> Alle artikler på dette site er prøveartikler til en demonstration.</p></div></div></section>`;
    res.send(layout(`Rettelser — ${site.name}`, body));
  } catch (e) {
    res.status(500).send('<h1>Fejl</h1><p>' + e.message + '</p><a href="/">Prøv igen</a>');
  }
});

app.get('/404', (req, res) => {
  res.status(404).send(layout('404', '<h1>Siden findes ikke</h1><p>Vi har ledt, men kunne ikke finde den side, du søgte.</p><div class="btn-group"><a href="/" class="btn">Gå til forsiden</a><a href="/om/" class="btn btn--ghost">Om os</a></div>'));
});

app.get('/feed.xml', async (req, res) => {
  try {
    const articles = (await loadArticles()).sort((a, b) => new Date(b.date) - new Date(a.date));
    const items = articles.map(a => `<item><title><![CDATA[${a.title}]]></title><description><![CDATA[${a.summary}]]></description><link>${site.url}/artikler/${a.slug}/</link><pubDate>${new Date(a.date).toUTCString()}</pubDate><author>${a.author}</author><category>${a.category}</category><guid isPermaLink="false">${site.url}/artikler/${a.slug}/</guid></item>`).join('');
    const xml = `<?xml version="1.0" encoding="UTF-8" ?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${site.name} — ${site.tagline}</title><link>${site.url}/</link><description>${site.tagline}</description><language>da-DK</language><lastBuildDate>${new Date().toUTCString()}</lastBuildDate><atom:link href="${site.url}/feed.xml" rel="self" type="application/rss+xml" />${items}</channel></rss>`;
    res.set('Content-Type', 'application/rss+xml; charset=utf-8').send(xml);
  } catch (e) {
    res.status(500).send('<h1>Fejl</h1><p>' + e.message + '</p>');
  }
});

app.get('/sitemap.xml', async (req, res) => {
  try {
    const articles = await loadArticles();
    const routes = [{ url: '/', changefreq: 'weekly', priority: '1.0' }, { url: '/om/', changefreq: 'monthly', priority: '0.5' }, { url: '/kontakt/', changefreq: 'monthly', priority: '0.5' }, { url: '/rettelser/', changefreq: 'monthly', priority: '0.5' }, { url: '/feed.xml', changefreq: 'weekly', priority: '0.5' }];
    categories.forEach(c => routes.push({ url: `/kategori/${c.slug}/`, changefreq: 'weekly', priority: '0.7' }));
    articles.forEach(a => routes.push({ url: `/artikler/${a.slug}/`, changefreq: 'monthly', priority: '0.8' }));
    const now = new Date().toISOString();
    const urls = routes.map(r => `<url><loc>${site.url}${r.url}</loc><lastmod>${now}</lastmod><changefreq>${r.changefreq}</changefreq><priority>${r.priority}</priority></url>`).join('');
    const xml = `<?xml version="1.0" encoding="UTF-8" ?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
    res.set('Content-Type', 'application/xml').send(xml);
  } catch (e) {
    res.status(500).send('<h1>Fejl</h1><p>' + e.message + '</p>');
  }
});

app.get('/admin/login', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin/');
  const body = `<section class="admin-login"><div class="admin-card"><h1>${site.name} — Admin</h1><p>Log in to manage articles.</p><form method="POST" action="/admin/login"><label for="password">Password</label><input type="password" id="password" name="password" required autocomplete="current-password"><button type="submit" class="btn">Log in</button></form></div></section>`;
  res.send(layout('Admin — Log ind', body, '', true));
});

app.post('/admin/login', (req, res) => {
  try {
    if (req.body.password === ADMIN_PASSWORD) { req.session.isAdmin = true; res.redirect('/admin/'); }
    else { res.status(401).send('<h1>Wrong password</h1><a href="/admin/login">Try again</a>'); }
  } catch (e) {
    res.status(500).send('<h1>Fejl</h1><p>' + e.message + '</p>');
  }
});

app.get('/admin/logout', (req, res) => { req.session.destroy(); res.redirect('/admin/login'); });

app.get('/admin/', requireAuth, (req, res) => {
  try {
    const visitorsList = visitors.map((v) => `<tr><td>${v.ip}</td><td>${v.country}</td><td>${v.city}</td><td>${new Date(v.timestamp).toLocaleString('da-DK')}</td><td>${v.path}</td></tr>`).join('');
    const body = `<section class="admin-visitors"><div class="container"><div class="admin-header"><h1>Visitor Log</h1><div class="admin-actions"><a href="/admin/new/" class="btn">+ New article</a><a href="/admin/logout" class="btn btn--ghost">Log out</a></div></div><p>Showing the last ${Math.min(visitors.length, 500)} visitors.</p><table class="admin-table"><thead><tr><th>IP Address</th><th>Country</th><th>City</th><th>Time (CET)</th><th>Page</th></tr></thead><tbody>${visitorsList || '<tr><td colspan="5">No visitors yet.</td></tr>'}</tbody></table></div></section>`;
    res.send(layout('Visitor Log', body, '', true));
  } catch (e) {
    res.status(500).send('<h1>Fejl</h1><p>' + e.message + '</p>');
  }
});

app.get('/admin/new/', requireAuth, (req, res) => {
  try {
    const catOptions = categories.map(c => `<option value="${c.slug}">${c.label}</option>`).join('');
    const body = `<section class="admin-form"><div class="container"><h1>New article</h1><form method="POST" action="/admin/new/" class="article-form"><div class="form-group"><label>Title</label><input type="text" name="title" required placeholder="e.g. MitID and cybersecurity"></div><div class="form-group"><label>Summary</label><textarea name="summary" required placeholder="Short summary in Danish..."></textarea></div><div class="form-group"><label>Category</label><select name="category">${catOptions}</select></div><div class="form-group"><label>Author</label><input type="text" name="author" value="TruthMedia Editorial" required></div><div class="form-group"><label>Date (YYYY-MM-DD)</label><input type="date" name="date" required value="${new Date().toISOString().split('T')[0]}"></div><div class="form-group"><label>Reading time (e.g. "5 min read")</label><input type="text" name="readingTime" value="5 min read"></div><div class="form-group"><label>Image URL</label><input type="text" name="image" value="/assets/images/placeholder.svg"></div><div class="form-group"><label>Image alt text</label><input type="text" name="imageAlt" placeholder="Description of image"></div><div class="form-group"><label>Sources (one per line)</label><textarea name="sources" placeholder="https://example.com/1\\nhttps://example.com/2"></textarea></div><div class="form-group"><label>Featured (top story on front page)?</label><input type="checkbox" name="featured" value="true"></div><div class="form-group"><label>Sample article?</label><input type="checkbox" name="sample" value="true" checked></div><div class="form-group"><label>Content (Markdown)</label><textarea name="content" required rows="20" placeholder="Write the article in Markdown..."></textarea></div><button type="submit" class="btn">Create article</button></form></div></section>`;
    res.send(layout('New article', body, '', true));
  } catch (e) {
    res.status(500).send('<h1>Fejl</h1><p>' + e.message + '</p>');
  }
});

app.post('/admin/new/', requireAuth, async (req, res) => {
  try {
    const articles = await loadArticles();
    const slug = slugify(req.body.title);
    const sources = req.body.sources ? req.body.sources.split('\n').filter(s => s.trim()) : [];
    const newArticle = { slug, title: req.body.title, summary: req.body.summary, category: req.body.category, author: req.body.author || 'TruthMedia Editorial', date: req.body.date || new Date().toISOString().split('T')[0], image: req.body.image || '/assets/images/placeholder.svg', imageAlt: req.body.imageAlt || '', sources, featured: req.body.featured === 'true', readingTime: req.body.readingTime || '5 min read', sample: req.body.sample !== 'false', content: req.body.content || '', createdAt: new Date().toISOString() };
    articles.push(newArticle);
    const result = await saveArticles(articles);
    if (!result.success) { return res.status(500).send(`<h1>Save error</h1><p>${result.error}</p><a href="/admin/new/">Try again</a>`); }
    res.redirect(`/artikler/${slug}/`);
  } catch (e) {
    res.status(500).send('<h1>Fejl</h1><p>' + e.message + '</p>');
  }
});

app.get('/admin/edit/:slug/', requireAuth, async (req, res) => {
  try {
    const articles = await loadArticles();
    const article = articles.find(a => a.slug === req.params.slug);
    if (!article) return res.status(404).send('Edit article not found');
    const catOptions = categories.map(c => `<option value="${c.slug}"${c.slug === article.category ? ' selected' : ''}>${c.label}</option>`).join('');
    const sourcesText = Array.isArray(article.sources) ? article.sources.join('\n') : (article.sources || '');
    const body = `<section class="admin-form"><div class="container"><h1>Edit: ${article.title}</h1><form method="POST" action="/admin/edit/${article.slug}/" class="article-form"><div class="form-group"><label>Title</label><input type="text" name="title" required value="${escapeHtml(article.title)}"></div><div class="form-group"><label>Summary</label><textarea name="summary" required>${escapeHtml(article.summary)}</textarea></div><div class="form-group"><label>Category</label><select name="category">${catOptions}</select></div><div class="form-group"><label>Author</label><input type="text" name="author" required value="${escapeHtml(article.author)}"></div><div class="form-group"><label>Date (YYYY-MM-DD)</label><input type="date" name="date" required value="${article.date}"></div><div class="form-group"><label>Reading time</label><input type="text" name="readingTime" value="${escapeHtml(article.readingTime || '')}"></div><div class="form-group"><label>Image URL</label><input type="text" name="image" value="${escapeHtml(article.image || '')}"></div><div class="form-group"><label>Image alt text</label><input type="text" name="imageAlt" value="${escapeHtml(article.imageAlt || '')}"></div><div class="form-group"><label>Sources (one per line)</label><textarea name="sources">${escapeHtml(sourcesText)}</textarea></div><div class="form-group"><label>Featured?</label><input type="checkbox" name="featured" value="true"${article.featured ? ' checked' : ''}></div><div class="form-group"><label>Sample article?</label><input type="checkbox" name="sample" value="true"${article.sample !== false ? ' checked' : ''}></div><div class="form-group"><label>Content (Markdown)</label><textarea name="content" required rows="25">${escapeHtml(article.content || '')}</textarea></div><button type="submit" class="btn">Save changes</button><a href="/admin/" class="btn btn--ghost">Cancel</a></form></div></section>`;
    res.send(layout('Edit article', body, '', true));
  } catch (e) {
    res.status(500).send('<h1>Fejl</h1><p>' + e.message + '</p>');
  }
});

app.post('/admin/edit/:slug/', requireAuth, async (req, res) => {
  try {
    const articles = await loadArticles();
    const idx = articles.findIndex(a => a.slug === req.params.slug);
    if (idx === -1) return res.status(404).send('Article not found');
    const sources = req.body.sources ? req.body.sources.split('\n').filter(s => s.trim()) : [];
    const newSlug = slugify(req.body.title);
    articles[idx] = { ...articles[idx], slug: newSlug, title: req.body.title, summary: req.body.summary, category: req.body.category, author: req.body.author || 'TruthMedia Editorial', date: req.body.date || articles[idx].date, image: req.body.image || '/assets/images/placeholder.svg', imageAlt: req.body.imageAlt || '', sources, featured: req.body.featured === 'true', readingTime: req.body.readingTime || '3 min læsning', sample: req.body.sample !== 'false', content: req.body.content || '', updatedAt: new Date().toISOString() };
    const result = await saveArticles(articles);
    if (!result.success) { return res.status(500).send(`<h1>Save error</h1><p>${result.error}</p><a href="/admin/edit/${req.params.slug}/">Try again</a>`); }
    res.redirect(`/artikler/${newSlug}/`);
  } catch (e) {
    res.status(500).send('<h1>Fejl</h1><p>' + e.message + '</p>');
  }
});

app.post('/admin/delete/:slug/', requireAuth, async (req, res) => {
  try {
    let articles = await loadArticles();
    const result = await saveArticles(articles.filter(a => a.slug !== req.params.slug));
    if (!result.success) { return res.status(500).send(`<h1>Save error</h1><p>${result.error}</p><a href="/admin/">Try again</a>`); }
    res.redirect('/admin/');
  } catch (e) {
    res.status(500).send('<h1>Fejl</h1><p>' + e.message + '</p>');
  }
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).send('<h1>Server Error</h1><p>' + (err && err.message ? err.message : 'Unknown error') + '</p><a href="/">Home</a>');
});

app.use((req, res) => {
  res.status(404).send(layout('404', '<h1>Siden findes ikke</h1><p>Vi har ledt, men kunne ikke finde den side, du søgte.</p><a href="/" class="btn">Gå til forsiden</a>'));
});

app.listen(PORT, () => { console.log(`${site.name} running on http://localhost:${PORT}`); });

module.exports = app;