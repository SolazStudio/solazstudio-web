export const BASELINE_COMMIT = "880610411ecb4d66f652e8bfaf89e5794231409d";

export const ROOT_HTML_FILES = Object.freeze([
  "404.html",
  "arquitectura-espacios.html",
  "cobertura-eventos.html",
  "contacto.html",
  "contenido-redes-sociales.html",
  "fotografia-comercial.html",
  "fotografia-corporativa.html",
  "fotografia-industrial.html",
  "index.html",
  "nosotros.html",
  "politica-privacidad.html",
  "portafolio.html",
  "produccion-audiovisual.html",
  "servicios.html",
  "terminos-uso.html"
]);

export const PROJECT_HTML_FILES = Object.freeze([
  "proyectos/campana-publicitaria-elige-educar-mineduc.html",
  "proyectos/clew-evento-internacional-world-vaper-show.html",
  "proyectos/cobertura-evento-kifit-tnf-trail.html",
  "proyectos/cobertura-maraton-santiago-2025.html",
  "proyectos/contenido-marca-red-bull-rb-zero.html",
  "proyectos/contenido-redes-sociales-cdm-medical.html",
  "proyectos/fotografia-arquitectura-cassone.html",
  "proyectos/video-corporativo-weg-chile.html",
  "proyectos/weg-cobertura-evento-seminario-chile.html"
]);

export const EXPECTED_HTML_FILES = Object.freeze([
  ...ROOT_HTML_FILES,
  ...PROJECT_HTML_FILES
]);

export const EXPECTED_TEMPLATE_FILES = Object.freeze(
  EXPECTED_HTML_FILES.map((file) => `src/${file.replace(/\.html$/, ".njk")}`)
);

export const ROOT_PUBLIC_FILES = Object.freeze([
  "apple-touch-icon.png",
  "favicon-192.png",
  "favicon-512.png",
  "favicon.ico",
  "favicon.svg",
  "og-image.jpg",
  "robots.txt",
  "sitemap.xml"
]);

export const PASSTHROUGH_DIRECTORIES = Object.freeze(["img"]);

export const PROHIBITED_OUTPUT_ENTRIES = Object.freeze([
  ".git",
  ".github",
  "docs",
  "config",
  "scripts",
  "src",
  "functions",
  "node_modules",
  "package.json",
  "package-lock.json",
  ".node-version",
  ".gitignore",
  "eleventy.config.js"
]);
