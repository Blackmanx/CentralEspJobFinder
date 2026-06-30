import express from 'express';
import cors from 'cors';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const STATES_FILE = path.join(process.cwd(), 'public/data/user_states.json');
const GLOBAL_CV_PATH = path.join(process.cwd(), 'public/data/global_cv.bin');
const GLOBAL_CV_META_PATH = path.join(process.cwd(), 'public/data/global_cv_meta.json');

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
    
    let fileBuffer: Buffer;
    let originalName = '';

    if (req.file) {
      fileBuffer = req.file.buffer;
      originalName = req.file.originalname;
    } else {
      try {
        const metaData = await fs.readFile(GLOBAL_CV_META_PATH, 'utf-8');
        const meta = JSON.parse(metaData);
        fileBuffer = await fs.readFile(GLOBAL_CV_PATH);
        originalName = meta.originalname;
      } catch (err) {
        return res.status(400).json({ error: 'No se ha subido ningún archivo de currículum.' });
      }
    }

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

app.get('/api/user-states', async (req, res) => {
  try {
    await fs.mkdir(path.dirname(STATES_FILE), { recursive: true });
    let data = '{}';
    try {
      data = await fs.readFile(STATES_FILE, 'utf-8');
    } catch (readErr) {
      await fs.writeFile(STATES_FILE, '{}', 'utf-8');
    }
    return res.json(JSON.parse(data));
  } catch (err: any) {
    console.error('Error al leer user-states:', err);
    return res.status(500).json({ error: 'Error al leer la base de datos de estados.' });
  }
});

app.post('/api/user-states', async (req, res) => {
  try {
    await fs.mkdir(path.dirname(STATES_FILE), { recursive: true });
    const body = req.body;
    await fs.writeFile(STATES_FILE, JSON.stringify(body, null, 2), 'utf-8');
    return res.json({ success: true });
  } catch (err: any) {
    console.error('Error al guardar user-states:', err);
    return res.status(500).json({ error: 'Error al escribir la base de datos de estados.' });
  }
});

app.post('/api/generate-cover-letter', upload.single('cv'), async (req, res) => {
  try {
    const { jobTitle, jobCompany, jobDescription, jobRequirements } = req.body;
    
    let fileBuffer: Buffer;
    let originalName = '';

    if (req.file) {
      fileBuffer = req.file.buffer;
      originalName = req.file.originalname;
    } else {
      try {
        const metaData = await fs.readFile(GLOBAL_CV_META_PATH, 'utf-8');
        const meta = JSON.parse(metaData);
        fileBuffer = await fs.readFile(GLOBAL_CV_PATH);
        originalName = meta.originalname;
      } catch (err) {
        return res.status(400).json({ error: 'No se ha subido ningún archivo de currículum.' });
      }
    }

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

    const prompt = `Eres un redactor profesional de recursos humanos experto en contratación de personal docente en España.
Redacta una carta de presentación formal y persuasiva adaptada específicamente al puesto y los requisitos de la oferta de empleo provista.

Debes basarte en la estructura, estilo de redacción, tono y detalles específicos de la siguiente plantilla provista por el usuario:

== PLANTILLA DE CARTA DE PRESENTACIÓN DE REFERENCIA ==
A la atención del equipo de selección de [Nombre del Colegio o Centro],
Me dirijo a ustedes con gran entusiasmo para presentar mi candidatura al puesto de [Puesto Docente]. Como graduada en Magisterio de Educación Infantil y en el Máster en Investigación e Innovación en Educación (UNED), mi trayectoria se ha centrado en entender y honrar la infancia desde una mirada profundamente respetuosa y científica. Fruto de este compromiso, participo activamente en redes de colaboración con investigadores y en la redacción de artículos especializados encaminados a mejorar la educación actual, lo que me permite trasladar las últimas evidencias educativas directamente a la práctica en el aula.
Cuento con una sólida base pedagógica y experiencia práctica que se alinea con los valores de su escuela infantil, por ejemplo:
En mi paso por Cruz Roja y mis prácticas en centros como el CEIP Guernica, he gestionado grupos de primera infancia, priorizando siempre el bienestar socioemocional y el respeto a los ritmos individuales del niño. Por otro lado, he desarrollado proyectos de vanguardia como "Pimpoyo", un chatbot basado en IA generativa diseñado para fomentar el pensamiento crítico en un entorno seguro y de confianza, lo que demuestra mi capacidad para crear espacios de aprendizaje adaptados a los retos actuales.
Actualmente, desempeño mi labor como profesora de inglés en dos colegios simultáneamente (Colegio ADDIS y Mater Purissima) a jornada partida. Esta experiencia no solo ha consolidado mi fluidez y competencia bilingüe diaria, sino que me ha dotado de una gran capacidad de organización, iniciativa y energía para gestionar diferentes entornos educativos. Asimismo, mi faceta como asistente de fotografía infantil me ha aportado una sensibilidad especial para establecer una comunicación fluida, empática y profesional con las familias, fundamental para el éxito de una escuela.
Por último, basándome en mi sólida formación académica y experiencia práctica, concibo su escuela como un espacio ideal para crear un entorno de aprendizaje activo y respetuoso; un entorno preparado para ofrecer seguridad y retos evolutivos adaptados a las necesidades individuales de cada niño y niña en las etapas 0-3 y 3-6 años.
Cabe destacar que resido en Madrid, lo que me permite total puntualidad y compromiso con el horario requerido. Mi objetivo es aportar en su aula una combinación de mi rigor investigador y calidez humana para garantizar que cada niño y niña se sienta visto, escuchado y protegido.
Agradezco de antemano su tiempo y quedo a su entera disposición para concertar una entrevista.
Atentamente,
[Nombre del Candidato]

== DETALLES DE LA OFERTA DE EMPLEO OBJETIVO ==
Puesto: ${jobTitle || 'No especificado'}
Colegio/Centro: ${jobCompany || 'el centro'}
Descripción: ${jobDescription || 'No especificada'}
Requisitos: ${jobRequirements || 'No especificados'}

== PERFIL ANONIMIZADO DEL CANDIDATO ==
${anonymizedCV}

== INSTRUCCIONES DE REDACCIÓN ==
1. Adapta la carta de referencia para dirigirla específicamente a la atención del equipo de selección del colegio objetivo (reemplaza "[Nombre del Colegio o Centro]" con el nombre real del centro si está disponible: ${jobCompany || 'el centro'}).
2. Modifica el nombre del puesto docente [Puesto Docente] por el título de la oferta de empleo provista.
3. Asegúrate de mantener la redacción académica y profesional del candidato (Magisterio, Máster UNED, chatbot Pimpoyo, colegios ADDIS y Mater Purissima) pero adaptando suavemente los argumentos para responder a las necesidades particulares del colegio y su descripción de puesto.
4. No utilices emojis de ningún tipo.
5. Devuelve directamente el texto de la carta de presentación formateada en Markdown, sin introducciones ni comentarios adicionales de tu parte.`;

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
      title: '¡Nueva vacante de Infantil en Alcobendas!',
      message: 'Se ha detectado una oferta del Colegio Brains. Nivel de ajuste estimado del CV: Alto (89%).',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      read: false
    },
    {
      id: '2',
      title: '¡Puesto de Auxiliar de Escuela Infantil en Segovia!',
      message: 'Colegio en Segovia busca educador de 0-3 años. Se adapta a tu zona límite de Castilla y León.',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      read: false
    },
    {
      id: '3',
      title: 'Última actualización de ofertas completada',
      message: `El scraper finalizó con éxito. Se han indexado 98 vacantes locales en total.`,
      timestamp: lastScrapeSuccessTime || new Date().toISOString(),
      read: true
    }
  ];
  return res.json(notifications);
});

app.post('/api/global-cv', upload.single('cv'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No se ha subido ningún archivo.' });
    }

    await fs.mkdir(path.dirname(GLOBAL_CV_PATH), { recursive: true });
    await fs.writeFile(GLOBAL_CV_PATH, file.buffer);
    await fs.writeFile(GLOBAL_CV_META_PATH, JSON.stringify({
      originalname: file.originalname,
      mimetype: file.mimetype
    }, null, 2));

    return res.json({ success: true, originalname: file.originalname });
  } catch (err: any) {
    console.error('Error al guardar el currículum global:', err);
    return res.status(500).json({ error: 'Error al guardar el currículum: ' + err.message });
  }
});

app.get('/api/global-cv', async (req, res) => {
  try {
    await fs.access(GLOBAL_CV_META_PATH);
    const metaData = await fs.readFile(GLOBAL_CV_META_PATH, 'utf-8');
    return res.json({ exists: true, ...JSON.parse(metaData) });
  } catch {
    return res.json({ exists: false });
  }
});

app.get('/api/global-cv/download', async (req, res) => {
  try {
    const metaData = await fs.readFile(GLOBAL_CV_META_PATH, 'utf-8');
    const meta = JSON.parse(metaData);
    const fileBuffer = await fs.readFile(GLOBAL_CV_PATH);
    
    res.setHeader('Content-Type', meta.mimetype);
    res.setHeader('Content-Disposition', `inline; filename="${meta.originalname}"`);
    return res.send(fileBuffer);
  } catch (err) {
    return res.status(404).json({ error: 'Currículum no encontrado' });
  }
});

app.listen(port, () => {
  console.log(`Servidor de análisis de CV levantado en http://localhost:${port}`);
});
