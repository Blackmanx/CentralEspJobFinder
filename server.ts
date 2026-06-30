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

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

    const prompt = `Eres un consultor de recursos humanos experto en contratación de personal docente (Educación Infantil, maestros, auxiliares de guardería) en España.
Analiza el siguiente Currículum Vitae (CV) en relación con la oferta de empleo provista.

== DETALLES DE LA OFERTA DE EMPLEO ==
Puesto: ${jobTitle || 'No especificado'}
Descripción: ${jobDescription || 'No especificada'}
Requisitos: ${jobRequirements || 'No especificados'}

== CURRÍCULUM VITAE DEL CANDIDATO ==
${cvText}

== TAREA ==
Proporciona un informe detallado con las siguientes secciones:
1. COMPATIBILIDAD GENERAL: Clasifica el ajuste del currículum con la oferta en porcentaje (0-100%) y nivel (Alto, Medio, Bajo). Justifica brevemente.
2. FORTALEZAS: Puntos fuertes detectados en el CV para esta oferta específica.
3. CARENCIAS CRÍTICAS: Brechas importantes entre el perfil del CV y los requisitos del puesto (por ejemplo, falta de mención de certificaciones específicas de inglés, titulaciones requeridas, experiencia necesaria).
4. MEJORAS RECOMENDADAS: Sugerencias específicas de redacción y contenido paso a paso para optimizar y enriquecer el CV para este puesto concreto (qué secciones ampliar, qué destacar, vocabulario sugerido).

Redacta el informe completo en español, utilizando un tono directo, profesional, estructurado en Markdown y sin emojis de ningún tipo.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    return res.json({ analysis: responseText });

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
