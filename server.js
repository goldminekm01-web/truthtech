const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'content', 'articles.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'antigravity2024';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'goldminekm01-web';
const GITHUB_REPO = process.env.GITHUB_REPO || 'truthtech';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/content/articles.json`;

// Site config (single source of truth)
const site = {
  name: "TruthMedia",
  tagline: "Teknologi, uden støj.",
  description: "Dansk teknologinyheder og analyse om AI, startups, cybersikkerhed, gadgets, grøn tech, gaming og det nordiske tech-miljø.",
  language: "da-DK",
  url: "https://truthmedia.dk",
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

function githubRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = path.startsWith('http') ? path : `https://api.github.com${path}`;
    const options = {
      method,
      headers: {
        'User-Agent': 'TruthMedia-Admin',
        'Authorization': GITHUB_TOKEN ? `token ${GITHUB_TOKEN}` : '',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
    };
    if (body) options.body = JSON.stringify(body);
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function loadArticles() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

async function saveArticles(articles) {
  try {
    // On Vercel serverless, filesystem is read-only — use GitHub API
    // Locally, write to the JSON file directly
    if (process.env.VERCEL) {
      const fileResp = await githubRequest('GET', GITHUB_API);
      if (fileResp.status === 404) {
        return { success: false, error: 'GitHub repo not found. Set GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO env vars.' };
      }
      if (fileResp.status >= 400) {
        return { success: false, error: `GitHub API GET failed: ${fileResp.status} — check GITHUB_TOKEN has repo scope.` };
      }
      const sha = fileResp.body.sha;
      const content = Buffer.from(JSON.stringify(articles, null, 2)).toString('base64');
      const putResp = await githubRequest('PUT', GITHUB_API, {
        message: `Update articles via TruthMedia admin (${new Date().toISOString()})`,
        content,
        sha,
      });
      if (putResp.status >= 200 && putResp.status < 300) {
        return { success: true };
      }
      return { success: false, error: `GitHub API PUT failed: ${putResp.status} — check GITHUB_TOKEN has repo scope.` };
    } else {
      // Local development — write to filesystem
      fs.writeFileSync(DATA_FILE, JSON.stringify(articles, null, 2));
      return { success: true };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function formatDateDa(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("da-DK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[æ]/g, 'ae')
    .replace(/[ø]/g, 'oe')
    .replace(/[å]/g, 'aa')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'truthmedia-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.isAdmin) {
    return res.redirect('/admin/login');
  }
  next();
}

// Views (inline HTML templates)
function layout(title, body, extraMeta = '', isAdmin = false) {
  const description = title.includes('TruthMedia') ? site.tagline : `${title} — ${site.name}`;
  const canonical = title === 'Forside' ? site.url : `${site.url}/`;
  const ogImage = `${site.url}/assets/images/placeholder.svg`;
  
  const darkModeToggle = `
    <button class="theme-toggle" id="themeToggle" aria-label="Skift til mørk tilstand">
      <span class="theme-icon">🌙</span>
    </button>
  `;

  return `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>${title} — ${site.name}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <meta property="og:title" content="${title} — ${site.name}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:locale" content="da_DK">
  <meta property="og:site_name" content="${site.name}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title} — ${site.name}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${ogImage}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="stylesheet" href="/css/style.css">
  ${extraMeta}
</head>
<body class="${isAdmin ? 'admin-page' : ''}">
  <a href="#content" class="skip-link">Spring til indhold</a>
  <header class="header">
    <div class="container header-inner">
      <a href="/" class="logo" aria-label="${site.name} — forsiden">
        <span class="logo-mark">·</span>
        <span class="logo-text">${site.name}</span>
        <span class="logo-tagline">${site.tagline}</span>
      </a>
      <nav class="main-nav">
        ${categories.map(c => `<a href="/kategori/${c.slug}/"${title === c.label ? ' aria-current="page"' : ''}>${c.label}</a>`).join('')}
        <a href="/om/"${title === 'Om ${site.name}' ? ' aria-current="page"' : ''}>Om os</a>
        <a href="/kontakt/"${title.startsWith('Kontakt') ? ' aria-current="page"' : ''}>Kontakt</a>
        <a href="/rettelser/"${title.startsWith('Rettelser') ? ' aria-current="page"' : ''}>Rettelser</a>
      </nav>
      <div class="header-actions">
        <button class="theme-toggle" id="themeToggle" aria-label="Skift til mørk tilstand">🌙</button>
        ${isAdmin ? `<a href="/admin/" class="btn">Admin</a>` : ''}
      </div>
    </div>
  </header>

  <main id="content">
    ${body}
  </main>

  <footer class="footer">
    <div class="container footer-inner">
      <div class="footer-brand">
        <div class="logo" style="text-decoration:none;color:inherit;">
          <span class="logo-mark">·</span>
          <span class="logo-text">${site.name}</span>
        </div>
        <p class="footer-tagline">${site.tagline}</p>
      </div>
      <div class="footer-links">
        <h3>Kategorier</h3>
        <ul>
          ${categories.map(c => `<li><a href="/kategori/${c.slug}/">${c.label}</a></li>`).join('')}
        </ul>
      </div>
      <div class="footer-links">
        <h3>Redaktionen</h3>
        <ul>
          <li><a href="/om/">Om TruthMedia</a></li>
          <li><a href="/rettelser/">Rettelser</a></li>
          <li><a href="/kontakt/">Kontakt</a></li>
          <li><a href="mailto:${site.email}">${site.email}</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p>© ${new Date().getFullYear()} ${site.name}. Alle rettigheder forbeholdt.</p>
      <div class="footer-social">
        <a href="/feed.xml" aria-label="RSS-feed">RSS</a>
        <a href="mailto:${site.email}" aria-label="E-mail">E-mail</a>
      </div>
    </div>
  </footer>

  <script src="/js/main.js"></script>
</body>
</html>`;
}

function cardHtml(article, isFeatured = false) {
  const readingTime = article.readingTime || '3 min læsning';
  const isSample = article.sample !== false;
  const imageUrl = article.image || '/assets/images/placeholder.svg';
  return `
    <article class="article-card reveal${isFeatured ? ' featured' : ''}">
      <a href="/artikler/${article.slug}/" class="card-link">
        <img src="${imageUrl}" alt="${article.imageAlt || 'Artikelbillede'}" class="card-image" loading="lazy">
        <div class="card-body">
          ${isSample ? '<span class="badge badge-sample">Prøve</span>' : ''}
          <span class="card-category">${article.category}</span>
          <h2 class="card-title">${article.title}</h2>
          <p class="card-excerpt">${article.summary}</p>
          <div class="card-footer">
            <span class="card-meta">${article.author} · ${formatDateDa(article.date)} · ${readingTime}</span>
            <span class="card-arrow">→</span>
          </div>
        </div>
      </a>
    </article>
  `;
}

// ============ ROUTES ============

// Home
app.get('/', async (req, res) => {
  const articles = (await loadArticles()).sort((a, b) => new Date(b.date) - new Date(a.date));
  const featured = articles.filter(a => a.featured)[0] || articles[0];
  const latest = articles.filter(a => a !== featured).slice(0, 6);

  let body = `
    <section class="hero reveal">
      <div class="container hero-inner">
        <span class="hero-badge">Topshistorie</span>
        <h1 class="hero-title">
          <a href="/artikler/${featured.slug}/" style="color:inherit;text-decoration:none;">${featured.title}</a>
        </h1>
        <p class="hero-summary">${featured.summary}</p>
        <div class="hero-meta">
          <span>${featured.author}</span>
          <span>·</span>
          <time>${formatDateDa(featured.date)}</time>
          <span>·</span>
          <span>${featured.readingTime || '3 min læsning'}</span>
        </div>
        <img src="${featured.image || '/assets/images/placeholder.svg'}" alt="${featured.imageAlt || ''}" class="hero-image" loading="eager">
        <a href="/artikler/${featured.slug}/" class="hero-cta">Læs hele artiklen<span class="arrow">→</span></a>
      </div>
    </section>

    <section class="reveal">
      <div class="container">
        <div class="category-filters">
          <a href="/" class="chip chip--active">Alle</a>
          ${categories.map(c => `<a href="/kategori/${c.slug}/" class="chip">${c.label}</a>`).join('')}
        </div>
        <h2 class="section-label section-label--no-top">Seneste artikler</h2>
        <div class="article-grid">
          ${latest.map(a => cardHtml(a)).join('')}
        </div>
      </div>
    </section>

    <section class="newsletter reveal">
      <h2>Nyhedsbrev</h2>
      <p>Få de vigtigste teknologinyheder direkte i indbakken hver fredag. Ingen spam, kun stof.</p>
      <form class="newsletter-form" action="#" method="POST" novalidate>
        <input type="email" name="email" placeholder="Din e-mailadresse" required aria-label="E-mailadresse">
        <button type="submit" class="btn">Tilmeld</button>
      </form>
      <p class="newsletter-disclaimer">Ved tilmelding accepterer du vores vilkår. Du kan til enhver tid afmelde dig.</p>
    </section>
  `;

  res.send(layout('Forside', body));
});

// Article detail
app.get('/artikler/:slug/', async (req, res) => {
  const articles = await loadArticles();
  const article = articles.find(a => a.slug === req.params.slug);
  if (!article) return res.status(404).send(layout('404', '<h1>Siden findes ikke</h1><p>Artiklen blev ikke fundet.</p><a href="/" class="btn">Gå til forsiden</a>'));

  const related = articles.filter(a => a.category === article.category && a.slug !== article.slug).slice(0, 3);

  let body = `
    <article class="article-wrap reveal">
      <header class="article-header">
        ${article.sample !== false ? '<span class="badge badge-sample">Prøve</span>' : ''}
        <span class="article-category">${article.category}</span>
        <span>·</span>
        <time date="${article.date.toISOString()}">${formatDateDa(article.date)}</time>
        <span>·</span>
        <span>${article.readingTime || '3 min læsning'}</span>
        <h1 class="article-title">${article.title}</h1>
        <img src="${article.image || '/assets/images/placeholder.svg'}" alt="${article.imageAlt || ''}" class="article-image" loading="eager">
        ${article.imageAlt ? `<p class="article-image-caption">${article.imageAlt}</p>` : ''}
      </header>
      <div class="article-body">${marked(article.content || '')}</div>
      ${article.sources && article.sources.length > 0 ? `
        <section class="sources">
          <h3>Kilder</h3>
          <ul>
            ${article.sources.map(src => `<li><a href="${src}" target="_blank" rel="noopener noreferrer">${src}</a></li>`).join('')}
          </ul>
        </section>
      ` : ''}
      <div class="share">
        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(site.url + '/artikler/' + article.slug + '/')}" target="_blank" class="share-btn" aria-label="Del på Facebook">Facebook</a>
        <a href="https://x.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(site.url + '/artikler/' + article.slug + '/')}" target="_blank" class="share-btn" aria-label="Del på X">X</a>
        <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(site.url + '/artikler/' + article.slug + '/')}" target="_blank" class="share-btn" aria-label="Del på LinkedIn">LinkedIn</a>
        <a href="mailto:?subject=${encodeURIComponent(article.title)}&body=${encodeURIComponent('Læs artiklen: ' + site.url + '/artikler/' + article.slug + '/')}" class="share-btn" aria-label="Del via e-mail">E-mail</a>
      </div>
      ${related.length > 0 ? `
        <section class="related">
          <h3>Relaterede artikler</h3>
          <div class="related-grid">
            ${related.map(r => `
              <a href="/artikler/${r.slug}/" class="related-card">
                <span class="related-cat">${r.category}</span>
                <h2 class="related-title">${r.title}</h2>
              </a>
            `).join('')}
          </div>
        </section>
      ` : ''}
    </article>
  `;

  res.send(layout(article.title, body, '', false));
});

// Category page
app.get('/kategori/:slug/', async (req, res) => {
  const cat = categories.find(c => c.slug === req.params.slug);
  if (!cat) return res.status(404).send(layout('404', '<h1>Kategori ikke fundet</h1><a href="/" class="btn">Gå til forsiden</a>'));

  const articles = (await loadArticles())
    .filter(a => a.category === cat.slug)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  let body = `
    <section class="reveal">
      <div class="container">
        <h1 class="category-title">${cat.label}</h1>
        <p class="category-desc">Artikler inden for ${cat.label.toLowerCase()}.</p>
        <div class="article-grid">
          ${articles.length > 0 ? articles.map(a => cardHtml(a)).join('') : '<p class="empty">Ingen artikler i denne kategori endnu.</p>'}
        </div>
      </div>
    </section>
  `;

  res.send(layout(`Kategori: ${cat.label}`, body));
});

// About
app.get('/om/', (req, res) => {
  const body = `
    <section class="reveal">
      <div class="container">
        <h1 class="section-title">Om ${site.name}</h1>
        <p class="intro">${site.tagline} Vi er et uafhængigt dansk medie om teknologi — for dem, der vil forstå, hvad der sker, uden støj og sensation.</p>
        <div class="about-grid">
          <div class="card">
            <h3>Vores mission</h3>
            <p>${site.name} dækker AI, startups, cybersikkerhed, gadgets, grøn tech, gaming og det danske og nordiske tech-miljø. Vi skriver til læsere i Danmark, på dansk, med respekt for tid og opmærksomhed.</p>
            <p>Vores ambition er at være et troværdigt sted at vende tilbage til — ikke den første historie, men den bedste.</p>
          </div>
          <div class="card">
            <h3>Redaktionelle principper</h3>
            <ul class="principles-list">
              <li>Vi opdager ikke historier for at skabe klik. Vi skriver for at informere.</li>
              <li>Vi adskiller tydeligt mellem nyheder, analyse og holdning.</li>
              <li>Vi kilder vores informationer og angiver, hvor du kan læse mere.</li>
              <li>Vi retter fejl hurtigt og åbent, når vi opdager dem.</li>
              <li>Vi er uafhængige af annoncører og tech-virksomheder i vores dækning.</li>
            </ul>
          </div>
        </div>
        <div class="card full-width">
          <h3>Sådan arbejder vi</h3>
          <p><strong>Kilder.</strong> Vi bygger på offentlige kilder, pressemeddelelser, officiel dokumentation og egne samtaler. Hvor det er muligt, linker vi direkte til kilderne, så du selv kan vurdere dem.</p>
          <p><strong>Uafhængighed.</strong> ${site.name} drives af sin egen redaktion. Vi tager ikke imod betaling for omtale, og annoncører har ingen indflydelse på, hvad vi skriver.</p>
          <p><strong>Rettelser.</strong> Opdager du en fejl? Rapportér den på vores <a href="/rettelser/">rettelsesside</a>. Vi retter og markerer ændringer tydeligt, så du altid kan se, hvad der er ændret.</p>
          <p><strong>Prøveindhold.</strong> Alle artikler på dette site er prøveartikler til en demonstration. Personer, virksomheder og hændelser er fiktive.</p>
        </div>
      </div>
    </section>
  `;
  res.send(layout(`Om ${site.name}`, body));
});

// Contact
app.get('/kontakt/', (req, res) => {
  const body = `
    <section class="reveal">
      <div class="container">
        <h1 class="section-title">Kontakt</h1>
        <p class="intro">Har du et tip, et spørgsmål eller en rettelse? Vi hører gerne fra dig.</p>
        <div class="contact-grid">
          <div class="card">
            <h3>Send os en besked</h3>
            <p>Du kan kontakte redaktionen på e-mail. Vi besvarer henvendelser så hurtigt som muligt.</p>
            <p><strong>E-mail:</strong> <a href="mailto:${site.email}">${site.email}</a></p>
            <p><strong>Adresse:</strong> ${site.address.city}, ${site.address.country}</p>
          </div>
          <div class="card">
            <h3>Redaktionen</h3>
            <p>${site.name} er et uafhængigt dansk medie om teknologi. Vi dækker AI, startups, cybersikkerhed, gadgets, grøn tech, gaming og det nordiske tech-miljø.</p>
            <p><strong>Ansvarshavende redaktør:</strong> ${site.author}</p>
            <p><strong>Prøveindhold:</strong> Dette site indeholder udelukkende prøveartikler til en demonstration.</p>
            <a href="/om/" class="btn">Læs mere om os</a>
          </div>
        </div>
      </div>
    </section>
  `;
  res.send(layout(`Kontakt ${site.name}`, body));
});

// Corrections
app.get('/rettelser/', (req, res) => {
  const body = `
    <section class="reveal">
      <div class="container">
        <h1 class="section-title">Rettelser</h1>
        <p class="intro">Vi stræber efter nøjagtighed, men fejl kan ske. Hvis du opdager noget, der ikke er rigtigt i en af vores artikler, vil vi gerne høre fra dig.</p>
        <div class="card">
          <h3>Sådan rapporterer du en fejl</h3>
          <p>Fortæl os, hvilken artikel det drejer sig om, hvad du mener er forkert, og helst hvor du har fundet den korrekte information.</p>
          <ol class="steps">
            <li>Kopier linket til den artikel, hvor du har fundet fejlen.</li>
            <li>Beskriv fejlen så præcist som muligt.</li>
            <li>Send en e-mail til <a href="mailto:${site.email}" class="mailto-link">${site.email}</a> med emnet "Rettelse: [artikeltitel]".</li>
          </ol>
          <p>Vi behandler alle henvendelser hurtigt og åbent. Hvis vi retter en artikel, markerer vi ændringen tydeligt nederst i artiklen, så du kan se, hvad der er blevet rettet, og hvornår.</p>
        </div>
        <div class="card card-mt">
          <h3>Vores rettelsespolitik</h3>
          <p>Faktiske fejl rettes så snart de er bekræftet. Sproglige justeringer og klarlæggelser foretages løbende uden særlig markering. Større faktuelle ændringer får en note i artiklen med dato for rettelsen.</p>
          <p><strong>Prøveindhold:</strong> Alle artikler på dette site er prøveartikler til en demonstration.</p>
        </div>
      </div>
    </section>
  `;
  res.send(layout(`Rettelser — ${site.name}`, body));
});

// 404
app.use((req, res) => {
  res.status(404).send(layout('404', '<h1>Siden findes ikke</h1><p>Vi har ledt, men kunne ikke finde den side, du søgte. Måske er linket skrevet forkert, eller siden er flyttet.</p><div class="btn-group"><a href="/" class="btn">Gå til forsiden</a><a href="/om/" class="btn btn--ghost">Om os</a></div>'));
});

// RSS feed
app.get('/feed.xml', async (req, res) => {
  const articles = (await loadArticles()).sort((a, b) => new Date(b.date) - new Date(a.date));
  const items = articles.map(a => `
    <item>
      <title><![CDATA[${a.title}]]></title>
      <description><![CDATA[${a.summary}]]></description>
      <link>${site.url}/artikler/${a.slug}/</link>
      <pubDate>${new Date(a.date).toUTCString()}</pubDate>
      <author>${a.author}</author>
      <category>${a.category}</category>
      <guid isPermaLink="false">${site.url}/artikler/${a.slug}/</guid>
    </item>
  `).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${site.name} — ${site.tagline}</title>
    <link>${site.url}/</link>
    <description>${site.tagline}</description>
    <language>da-DK</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${site.url}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  res.set('Content-Type', 'application/rss+xml; charset=utf-8');
  res.send(xml);
});

// Sitemap
app.get('/sitemap.xml', async (req, res) => {
  const articles = await loadArticles();
  const routes = [
    { url: '/', changefreq: 'weekly', priority: '1.0' },
    { url: '/om/', changefreq: 'monthly', priority: '0.5' },
    { url: '/kontakt/', changefreq: 'monthly', priority: '0.5' },
    { url: '/rettelser/', changefreq: 'monthly', priority: '0.5' },
    { url: '/feed.xml', changefreq: 'weekly', priority: '0.5' },
  ];
  categories.forEach(c => routes.push({ url: `/kategori/${c.slug}/`, changefreq: 'weekly', priority: '0.7' }));
  articles.forEach(a => routes.push({ url: `/artikler/${a.slug}/`, changefreq: 'monthly', priority: '0.8' }));

  const now = new Date().toISOString();
  const urls = routes.map(r => `
    <url>
      <loc>${site.url}${r.url}</loc>
      <lastmod>${now}</lastmod>
      <changefreq>${r.changefreq}</changefreq>
      <priority>${r.priority}</priority>
    </url>
  `).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  res.set('Content-Type', 'application/xml');
  res.send(xml);
});

// ============ ADMIN ROUTES ============

app.get('/admin/login', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin/');
  const body = `
    <section class="admin-login">
      <div class="admin-card">
        <h1>${site.name} — Admin</h1>
        <p>Log in to manage articles.</p>
        <form method="POST" action="/admin/login">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" required autocomplete="current-password">
          <button type="submit" class="btn">Log in</button>
        </form>
      </div>
    </section>
  `;
  res.send(layout('Admin — Log ind', body, '', true));
});

app.post('/admin/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.redirect('/admin/');
  } else {
    res.status(401).send('<h1>Forkert adgangskode</h1><a href="/admin/login">Prøv igen</a>');
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

app.get('/admin/', requireAuth, async (req, res) => {
  const articles = (await loadArticles()).sort((a, b) => new Date(b.date) - new Date(a.date));
  const rows = articles.map(a => `
    <tr>
      <td>${a.title}</td>
      <td>${a.category}</td>
      <td>${formatDateDa(a.date)}</td>
      <td>${a.featured ? '★' : ''}</td>
      <td>
        <a href="/admin/edit/${a.slug}/" class="btn btn--ghost btn--small">Edit</a>
        <form method="POST" action="/admin/delete/${a.slug}/" style="display:inline;" onsubmit="return confirm('Delete this article?')">
          <button type="submit" class="btn btn--ghost btn--small" style="color:#c8102e;">Delete</button>
        </form>
      </td>
    </tr>
  `).join('');

  const body = `
    <section class="admin-dashboard">
      <div class="container">
        <div class="admin-header">
          <h1>Admin — ${site.name}</h1>
          <div class="admin-actions">
            <a href="/admin/new/" class="btn">+ New article</a>
            <a href="/admin/logout" class="btn btn--ghost">Log out</a>
          </div>
        </div>
        <table class="admin-table">
          <thead>
            <tr><th>Titel</th><th>Kategori</th><th>Dato</th><th>Fremhævet</th><th>Handlinger</th></tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        ${articles.length === 0 ? '<p style="text-align:center;color:var(--tm-text-muted);">Ingen artikler endnu.</p>' : ''}
      </div>
    </section>
  `;
  res.send(layout('Admin', body, '', true));
});

app.get('/admin/new/', requireAuth, (req, res) => {
  const catOptions = categories.map(c => `<option value="${c.slug}">${c.label}</option>`).join('');
  const body = `
    <section class="admin-form">
      <div class="container">
        <h1>New article</h1>
        <form method="POST" action="/admin/new/" class="article-form">
          <div class="form-group">
            <label>Title</label>
            <input type="text" name="title" required placeholder="e.g. MitID and cybersecurity">
          </div>
          <div class="form-group">
            <label>Summary</label>
            <textarea name="summary" required placeholder="Short summary in Danish..."></textarea>
          </div>
          <div class="form-group">
            <label>Category</label>
            <select name="category">${catOptions}</select>
          </div>
          <div class="form-group">
            <label>Author</label>
            <input type="text" name="author" value="TruthMedia Editorial" required>
          </div>
          <div class="form-group">
            <label>Date (YYYY-MM-DD)</label>
            <input type="date" name="date" required value="${new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label>Reading time (e.g. "5 min read")</label>
            <input type="text" name="readingTime" value="5 min read">
          </div>
          <div class="form-group">
            <label>Image URL</label>
            <input type="text" name="image" value="/assets/images/placeholder.svg">
          </div>
          <div class="form-group">
            <label>Image alt text</label>
            <input type="text" name="imageAlt" placeholder="Beskrivelse af billedet">
          </div>
          <div class="form-group">
            <label>Sources (one per line)</label>
            <textarea name="sources" placeholder="https://example.com/1\nhttps://example.com/2"></textarea>
          </div>
          <div class="form-group">
            <label>Featured (top story on front page)?</label>
            <input type="checkbox" name="featured" value="true">
          </div>
          <div class="form-group">
            <label>Sample article?</label>
            <input type="checkbox" name="sample" value="true" checked>
          </div>
          <div class="form-group">
            <label>Content (Markdown)</label>
            <textarea name="content" required rows="20" placeholder="Write the article in Markdown..."></textarea>
          </div>
          <button type="submit" class="btn">Create article</button>
        </form>
      </div>
    </section>
  `;
  res.send(layout('Ny artikel', body, '', true));
});

app.post('/admin/new/', requireAuth, async (req, res) => {
  const articles = await loadArticles();
  const slug = slugify(req.body.title);
  const sources = req.body.sources ? req.body.sources.split('\n').filter(s => s.trim()) : [];
  const newArticle = {
    slug,
    title: req.body.title,
    summary: req.body.summary,
    category: req.body.category,
    author: req.body.author || 'TruthMedia Redaktion',
    date: req.body.date || new Date().toISOString().split('T')[0],
    image: req.body.image || '/assets/images/placeholder.svg',
    imageAlt: req.body.imageAlt || '',
    sources: sources,
    featured: req.body.featured === 'true',
    readingTime: req.body.readingTime || '3 min læsning',
    sample: req.body.sample !== 'false',
    content: req.body.content || '',
    createdAt: new Date().toISOString(),
  };
  articles.push(newArticle);
  const result = saveArticles(articles);
  if (!result.success) {
    return res.status(500).send(`<h1>Save error</h1><p>${result.error}</p><a href="/admin/new/">Try again</a>`);
  }
  res.redirect(`/artikler/${slug}/`);
});

app.get('/admin/edit/:slug/', requireAuth, async (req, res) => {
  const articles = await loadArticles();
  const article = articles.find(a => a.slug === req.params.slug);
  if (!article) return res.status(404).send('Artikel ikke fundet');

  const catOptions = categories.map(c => `<option value="${c.slug}"${c.slug === article.category ? ' selected' : ''}>${c.label}</option>`).join('');
  const sourcesText = Array.isArray(article.sources) ? article.sources.join('\n') : (article.sources || '');

  const body = `
    <section class="admin-form">
      <div class="container">
        <h1>Edit: ${article.title}</h1>
        <form method="POST" action="/admin/edit/${article.slug}/" class="article-form">
          <div class="form-group">
            <label>Title</label>
            <input type="text" name="title" required value="${escapeHtml(article.title)}">
          </div>
          <div class="form-group">
            <label>Summary</label>
            <textarea name="summary" required>${escapeHtml(article.summary)}</textarea>
          </div>
          <div class="form-group">
            <label>Category</label>
            <select name="category">${catOptions}</select>
          </div>
          <div class="form-group">
            <label>Author</label>
            <input type="text" name="author" required value="${escapeHtml(article.author)}">
          </div>
          <div class="form-group">
            <label>Date (YYYY-MM-DD)</label>
            <input type="date" name="date" required value="${article.date}">
          </div>
          <div class="form-group">
            <label>Reading time</label>
            <input type="text" name="readingTime" value="${escapeHtml(article.readingTime || '')}">
          </div>
          <div class="form-group">
            <label>Image URL</label>
            <input type="text" name="image" value="${escapeHtml(article.image || '')}">
          </div>
          <div class="form-group">
            <label>Image alt text</label>
            <input type="text" name="imageAlt" value="${escapeHtml(article.imageAlt || '')}">
          </div>
          <div class="form-group">
            <label>Sources (one per line)</label>
            <textarea name="sources">${escapeHtml(sourcesText)}</textarea>
          </div>
          <div class="form-group">
            <label>Featured?</label>
            <input type="checkbox" name="featured" value="true"${article.featured ? ' checked' : ''}>
          </div>
          <div class="form-group">
            <label>Sample article?</label>
            <input type="checkbox" name="sample" value="true"${article.sample !== false ? ' checked' : ''}>
          </div>
          <div class="form-group">
            <label>Content (Markdown)</label>
            <textarea name="content" required rows="25">${escapeHtml(article.content || '')}</textarea>
          </div>
          <button type="submit" class="btn">Save changes</button>
          <a href="/admin/" class="btn btn--ghost">Cancel</a>
        </form>
      </div>
    </section>
  `;
  res.send(layout('Edit article', body, '', true));
});

app.post('/admin/edit/:slug/', requireAuth, async (req, res) => {
  const articles = await loadArticles();
  const idx = articles.findIndex(a => a.slug === req.params.slug);
  if (idx === -1) return res.status(404).send('Article not found');

  const sources = req.body.sources ? req.body.sources.split('\n').filter(s => s.trim()) : [];
  const newSlug = slugify(req.body.title);

  articles[idx] = {
    ...articles[idx],
    slug: newSlug,
    title: req.body.title,
    summary: req.body.summary,
    category: req.body.category,
    author: req.body.author || 'TruthMedia Redaktion',
    date: req.body.date || articles[idx].date,
    image: req.body.image || '/assets/images/placeholder.svg',
    imageAlt: req.body.imageAlt || '',
    sources: sources,
    featured: req.body.featured === 'true',
    readingTime: req.body.readingTime || '3 min læsning',
    sample: req.body.sample !== 'false',
    content: req.body.content || '',
    updatedAt: new Date().toISOString(),
  };
  const result = saveArticles(articles);
  if (!result.success) {
    return res.status(500).send(`<h1>Save error</h1><p>${result.error}</p><a href="/admin/edit/${req.params.slug}/">Try again</a>`);
  }
  res.redirect(`/artikler/${newSlug}/`);
});

app.post('/admin/delete/:slug/', requireAuth, (req, res) => {
  let articles = loadArticles();
  const result = saveArticles(articles.filter(a => a.slug !== req.params.slug));
  if (!result.success) {
    return res.status(500).send(`<h1>Save error</h1><p>${result.error}</p><a href="/admin/">Try again</a>`);
  }
  res.redirect('/admin/');
});

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

app.listen(PORT, () => {
  console.log(`${site.name} running on http://localhost:${PORT}`);
});
