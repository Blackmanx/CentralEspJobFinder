import express from 'express';
import cors from 'cors';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { exec, spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowedMimeTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const allowedExtensions = /\.(pdf|docx)$/i;
    if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.test(file.originalname)) {
      callback(null, true);
    } else {
      callback(new Error('Formato de archivo no soportado. Por favor, sube un archivo PDF o DOCX.'));
    }
  }
});

// Helper to locally anonymize CV text before sending it to the Gemini API
const anonymizeText = (text: string): string => {
  let anonymized = text;

  // 1. Email Redaction
  anonymized = anonymized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[CORREO-ANONIMIZADO]');

  // 2. Phone Redaction (Using horizontal space only)
  anonymized = anonymized.replace(/\b(\+34|0034)?[ \t.-]*[6789](\d[ \t.-]*){8}\b/g, '[TELEFONO-ANONIMIZADO]');
  anonymized = anonymized.replace(/\b\+?\d{2,4}[ \t.-]?\d{3,4}[ \t.-]?\d{3,4}\b/g, '[TELEFONO-ANONIMIZADO]');

  // 3. DNI / NIE Redaction
  anonymized = anonymized.replace(/\b[XYZxyz]?\d{7,8}[A-ZZa-zz]\b/g, '[IDENTIFICACION-ANONIMIZADA]');

  // 4. Social Security Number (NUSS)
  anonymized = anonymized.replace(/\b\d{2}[ \t.-]?\d{8}[ \t.-]?\d{2}\b/g, '[SEG-SOCIAL-ANONIMIZADO]');

  // 5. Postal Codes (Spanish CP)
  anonymized = anonymized.replace(/\b(0[1-9]|[1-4]\d|5[0-2])\d{3}\b/g, '[CODIGO-POSTAL-ANONIMIZADO]');

  // 6. Headings with label patterns
  anonymized = anonymized.replace(/(nombre\s*y\s*apellidos|nombre|candidato|propietario|director|contacto|nombre\s+completo|email|tfno|telefono|teléfono|dni|nie|nif|dirección|direccion|cp|nacimiento|fecha\s+de\s+nacimiento)\s*:\s*[^\n]+/gi, (match, p1) => {
    return p1 + ': [DATO-PERSONAL-ANONIMIZADO]';
  });

  // 7. Standalone Candidate Name Heuristic on first 4 lines
  let lines = anonymized.split('\n');
  for (let i = 0; i < Math.min(lines.length, 4); i++) {
    const line = lines[i].trim();
    if (/^[A-ZÁÉÍÓÚÑ][a-zñáéíóúü]+(?:[ \t]+(?:de[ \t]+la[ \t]+|de[ \t]+|del[ \t]+|y[ \t]+)?[A-ZÁÉÍÓÚÑ][a-zñáéíóúü]+){1,4}$/.test(line)) {
      lines[i] = '[NOMBRE-CANDIDATO-ANONIMIZADO]';
    }
  }
  anonymized = lines.join('\n');

  return anonymized;
};

async function extractCVText(buffer: Buffer, originalName: string): Promise<string> {
  const nameLower = originalName.toLowerCase();
  if (nameLower.endsWith('.pdf')) {
    const pdfData = await pdfParse(buffer);
    return pdfData.text;
  } else if (nameLower.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } else {
    throw new Error('Formato de archivo no soportado. Por favor, sube un archivo PDF o DOCX.');
  }
}

app.post('/api/analyze-cv', upload.single('cv'), async (req, res) => {
  try {
    const { jobTitle, jobDescription, jobRequirements } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Debes adjuntar un archivo de currículum (PDF o DOCX).' });
    }

    const fileBuffer = req.file.buffer;
    const originalName = req.file.originalname;

    let cvText = '';
    try {
      cvText = await extractCVText(fileBuffer, originalName);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }

    if (!cvText.trim()) {
      return res.status(400).json({ error: 'No se pudo extraer texto del archivo de currículum.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Falta la clave GEMINI_API_KEY en el archivo de entorno (.env) del servidor.' });
    }

    // Locally anonymize PII before sending it to Gemini
    const anonymizedCV = anonymizeText(cvText);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

    const prompt = `Eres un consultor de recursos humanos experto en contratación de personal docente (Educación Infantil, maestros, auxiliares de guardería) en España.
Analiza el siguiente Currículum Vitae (CV) en relación con la oferta de empleo provista.

== DETALLES DE LA OFERTA DE EMPLEO ==
Puesto: ${jobTitle || 'No especificado'}
Descripción: ${jobDescription || 'No especificada'}
Requisitos: ${jobRequirements || 'No especificados'}

== CURRÍCULUM VITAE DEL CANDIDATO ==
${anonymizedCV}

== TAREA ==
Tu tarea es analizar el currículum del candidato y devolver un objeto JSON con dos claves:
1. "summary": Un resumen en Markdown con el ajuste general del CV, fortalezas generales y carencias críticas frente a los requisitos.
2. "annotatedCV": El texto completo del currículum original (anonimizado), conservando sus saltos de línea y estructura, pero envolviendo los fragmentos de texto específicos que deseas comentar o proponer mejoras con la siguiente etiqueta HTML:
   <annotation type="strength|improvement|correction" comment="comentario de mejora o fortaleza">texto original del CV</annotation>

   Donde:
   - "strength" se usa para resaltar puntos fuertes.
   - "improvement" se usa para sugerir cambios en redacción, añadir detalles u optimizar perfil.
   - "correction" se usa para señalar omisiones graves de requisitos indispensables.

Devuelve exclusivamente un objeto JSON válido, sin envolverlo en bloques de código markdown (\`\`\`json).`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text().trim();

    // Parse JSON
    try {
      const cleanJson = responseText.replace(/^```json/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleanJson);
      return res.json(parsed);
    } catch (parseError) {
      console.warn('Fallo al parsear JSON devuelto por Gemini, devolviendo texto plano:', responseText);
      return res.json({
        summary: responseText,
        annotatedCV: anonymizedCV
      });
    }

  } catch (err: any) {
    console.error('Error durante el análisis del CV:', err);
    return res.status(500).json({ error: 'Error interno en el servidor al analizar el CV: ' + err.message });
  }
});

let isScraping = false;
let lastScrapeError: string | null = null;
let lastScrapeSuccessTime: string | null = null;
let scrapeProgress = '';

app.post('/api/scrape', (req, res) => {
  if (isScraping) {
    return res.status(409).json({ error: 'Ya hay una actualización de ofertas en curso.' });
  }

  runScraperProcess();
  return res.json({ message: 'Actualización iniciada en segundo plano.' });
});

function runScraperProcess() {
  isScraping = true;
  lastScrapeError = null;
  scrapeProgress = 'Iniciando scraper modular...';

  console.log(`[Scheduler/Trigger] Iniciando scraper programado: ${new Date().toLocaleString('es-ES')}`);
  
  const child = spawn('npx', ['tsx', 'scripts/scrape.ts'], { shell: true });

  child.stdout.on('data', (data) => {
    const output = data.toString().trim();
    const lines = output.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && trimmed.length < 120) {
        scrapeProgress = trimmed;
      }
    }
  });

  child.stderr.on('data', (data) => {
    const output = data.toString().trim();
    console.error(`[Scraper Error] ${output}`);
  });

  child.on('close', (code) => {
    isScraping = false;
    if (code !== 0) {
      console.error(`El scraper falló con código de salida ${code}`);
      lastScrapeError = `El scraper falló con código de salida ${code}`;
      scrapeProgress = 'Error';
    } else {
      console.log('Scraper ejecutado correctamente.');
      lastScrapeSuccessTime = new Date().toISOString();
      scrapeProgress = 'Completado';
    }
  });
}

// Automated Periodic Scraping Scheduler:
// Runs automatically every 12 hours to keep childhood education and monitor positions fresh
const SCRAPE_INTERVAL_HOURS = 12;
const SCRAPE_INTERVAL_MS = SCRAPE_INTERVAL_HOURS * 60 * 60 * 1000;

setInterval(() => {
  if (!isScraping) {
    console.log(`[Automated Scheduler] Ejecutando escaneo periódico automático (cada ${SCRAPE_INTERVAL_HOURS}h)...`);
    runScraperProcess();
  }
}, SCRAPE_INTERVAL_MS);

app.get('/api/scrape/status', (req, res) => {
  return res.json({
    isScraping,
    error: lastScrapeError,
    lastSuccess: lastScrapeSuccessTime,
    progress: scrapeProgress
  });
});

// Rate limit tracking for email notifications (max 2 sends every 4 hours)
const EMAIL_RATELIMIT_FILE = path.join(process.cwd(), 'public/data/email_ratelimit.json');
const RATELIMIT_WINDOW_MS = 4 * 60 * 60 * 1000; // 4 hours
const MAX_EMAILS_PER_WINDOW = 2;

async function checkAndApplyEmailRateLimit(identifier: string): Promise<{ allowed: boolean; remaining: number; waitMinutes?: number }> {
  try {
    await fs.mkdir(path.dirname(EMAIL_RATELIMIT_FILE), { recursive: true });
    let history: Record<string, number[]> = {};
    try {
      const content = await fs.readFile(EMAIL_RATELIMIT_FILE, 'utf-8');
      history = JSON.parse(content);
    } catch {
      history = {};
    }

    const now = Date.now();
    const userTimestamps = (history[identifier] || []).filter(ts => (now - ts) < RATELIMIT_WINDOW_MS);

    if (userTimestamps.length >= MAX_EMAILS_PER_WINDOW) {
      const oldestInWindow = userTimestamps[0];
      const waitMs = (oldestInWindow + RATELIMIT_WINDOW_MS) - now;
      const waitMinutes = Math.ceil(waitMs / (60 * 1000));
      return { allowed: false, remaining: 0, waitMinutes };
    }

    // Add current send timestamp
    userTimestamps.push(now);
    history[identifier] = userTimestamps;

    await fs.writeFile(EMAIL_RATELIMIT_FILE, JSON.stringify(history, null, 2), 'utf-8');
    return { allowed: true, remaining: MAX_EMAILS_PER_WINDOW - userTimestamps.length };
  } catch (err) {
    console.error('Error al verificar rate limit:', err);
    return { allowed: true, remaining: 1 };
  }
}

app.post('/api/notify-email', async (req, res) => {
  try {
    const { to, jobs } = req.body || {};
    
    // Normalize recipient email or default
    const targetEmail = (to || process.env.EMAIL_TO || 'velsi12blackman@gmail.com').trim().toLowerCase();
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(targetEmail)) {
      return res.status(400).json({ error: 'El formato de correo electrónico introducido no es válido.' });
    }

    // Identify by email or client IP
    const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
    const rateLimitKey = `${targetEmail}_${clientIp}`;

    const rateLimit = await checkAndApplyEmailRateLimit(rateLimitKey);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: `Has alcanzado el límite de envíos (máximo 2 cada 4 horas). Por favor espera unos minutos.`
      });
    }

    const { sendJobsEmail } = await import('./scripts/emailNotifier');
    const result = await sendJobsEmail(targetEmail, jobs);
    return res.json({
      success: true,
      message: 'Correo enviado correctamente'
    });
  } catch (err: any) {
    console.error('Error al enviar correo:', err);
    return res.status(500).json({ error: 'Error al enviar correo' });
  }
});

app.post('/api/generate-cover-letter', upload.single('cv'), async (req, res) => {
  try {
    const { jobTitle, jobCompany, jobDescription, jobRequirements } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Debes adjuntar un archivo de currículum (PDF o DOCX).' });
    }

    const fileBuffer = req.file.buffer;
    const originalName = req.file.originalname;

    let cvText = '';
    try {
      cvText = await extractCVText(fileBuffer, originalName);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }

    if (!cvText.trim()) {
      return res.status(400).json({ error: 'No se pudo extraer texto del archivo de currículum.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Falta la clave GEMINI_API_KEY en el servidor.' });
    }

    const anonymizedCV = anonymizeText(cvText);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

    const prompt = `Eres un redactor profesional de recursos humanos experto en contratación de personal docente y educativo en España.
Redacta una carta de presentación formal, persuasiva y adaptada específicamente al puesto y los requisitos de la oferta de empleo provista, basándote de forma exclusiva y fiel en la experiencia y formación que aparecen en el perfil del candidato provisto.

== DETALLES DE LA OFERTA DE EMPLEO OBJETIVO ==
Puesto: ${jobTitle || 'No especificado'}
Colegio/Centro: ${jobCompany || 'el centro'}
Descripción: ${jobDescription || 'No especificada'}
Requisitos: ${jobRequirements || 'No especificados'}

== PERFIL ANONIMIZADO DEL CANDIDATO ==
${anonymizedCV}

== INSTRUCCIONES DE REDACCIÓN ==
1. Dirige la carta a la atención del equipo de selección del centro si se conoce (${jobCompany || 'el centro directivo / equipo de selección'}).
2. Menciona claramente el puesto al que opta: ${jobTitle || 'la vacante convocada'}.
3. Conecta de manera natural y profesional las experiencias, competencias y formación del candidato que figuren en su CV con las necesidades concretas de la vacante.
4. Si el CV contiene datos personales anonimizados, utiliza marcadores limpios como "[Nombre del Candidato]", "[Teléfono]" o "[Correo]" para que el usuario pueda rellenarlos.
5. No inventes experiencia, títulos ni puestos que no aparezcan en el currículum del candidato.
6. Mantén un tono formal, motivador y respetuoso. No utilices emojis de ningún tipo.
7. Devuelve directamente el texto de la carta de presentación formateada en Markdown, sin introducciones ni comentarios adicionales de tu parte.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text().trim();

    return res.json({ coverLetter: responseText });
  } catch (err: any) {
    console.error('Error al generar carta de presentación:', err);
    return res.status(500).json({ error: 'Error interno en el servidor: ' + err.message });
  }
});

app.get('/api/notifications', async (req, res) => {
  const notifications = [
    {
      id: '1',
      title: 'Última actualización de ofertas completada',
      message: `El scraper finalizó con éxito. Se han indexado vacantes docentes y oficiales.`,
      timestamp: lastScrapeSuccessTime || new Date().toISOString(),
      read: true
    }
  ];
  return res.json(notifications);
});

app.listen(port, () => {
  console.log(`Servidor de análisis de CV levantado en http://localhost:${port}`);
});
