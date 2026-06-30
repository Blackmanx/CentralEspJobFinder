import express from 'express';
import cors from 'cors';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { exec } from 'child_process';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

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

app.post('/api/analyze-cv', upload.single('cv'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No se ha subido ningún archivo de currículum (CV).' });
    }

    const { jobTitle, jobDescription, jobRequirements } = req.body;

    let cvText = '';
    const originalName = file.originalname.toLowerCase();

    if (originalName.endsWith('.pdf')) {
      const pdfData = await pdfParse(file.buffer);
      cvText = pdfData.text;
    } else if (originalName.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      cvText = result.value;
    } else {
      return res.status(400).json({ error: 'Formato de archivo no soportado. Por favor, sube un archivo PDF o DOCX.' });
    }

    if (!cvText.trim()) {
      return res.status(400).json({ error: 'No se pudo extraer texto del archivo provisto.' });
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

app.post('/api/scrape', (req, res) => {
  if (isScraping) {
    return res.status(409).json({ error: 'Ya hay una actualización de ofertas en curso.' });
  }

  isScraping = true;
  lastScrapeError = null;

  console.log('Iniciando scraper en segundo plano...');
  
  exec('npx tsx scripts/scrape.ts', (error, stdout, stderr) => {
    isScraping = false;
    if (error) {
      console.error('Error al ejecutar el scraper:', error);
      lastScrapeError = error.message;
    } else {
      console.log('Scraper ejecutado correctamente.');
      lastScrapeSuccessTime = new Date().toISOString();
    }
  });

  return res.json({ message: 'Actualización iniciada en segundo plano.' });
});

app.get('/api/scrape/status', (req, res) => {
  return res.json({
    isScraping,
    error: lastScrapeError,
    lastSuccess: lastScrapeSuccessTime
  });
});

app.listen(port, () => {
  console.log(`Servidor de análisis de CV levantado en http://localhost:${port}`);
});
