import * as fs from 'fs/promises';
import * as path from 'path';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { Job } from '../src/types/job';
import { isOfficialPublicJob } from '../src/jobCategories';

dotenv.config();

interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  emailFrom: string;
  emailTo: string;
}

function getEmailConfig(): EmailConfig {
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;
  const smtpUser = process.env.SMTP_USER || '';
  const smtpPass = process.env.SMTP_PASS || '';
  const emailFrom = process.env.EMAIL_FROM || smtpUser || 'jobcrawling@noreply.com';
  const emailTo = process.env.EMAIL_TO || process.env.DEFAULT_RECIPIENT_EMAIL || '';

  return {
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUser,
    smtpPass,
    emailFrom,
    emailTo
  };
}

export function generateEmailHtml(jobs: Job[], recipientEmail: string, isIncremental: boolean = false): string {
  const escapeHtml = (value: unknown): string => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const total = jobs.length;
  const tseiJobs = jobs.filter(j => j.certificationTags?.includes('TSEI'));
  const monitorJobs = jobs.filter(j => j.certificationTags?.includes('Monitor_Ocio'));
  const unedJobs = jobs.filter(j => j.source?.includes('UNED'));
  const bolsasJobs = jobs.filter(j => isOfficialPublicJob(j) && !j.source?.includes('UNED'));
  const toledoJobs = jobs.filter(j => (j.province || '').toLowerCase().includes('toledo') || (j.location || '').toLowerCase().includes('toledo'));
  const otherInfantil = jobs.filter(j => 
    !j.certificationTags?.includes('TSEI') && 
    !j.certificationTags?.includes('Monitor_Ocio') &&
    !isOfficialPublicJob(j) &&
    !j.source?.includes('UNED') &&
    (j.title.toLowerCase().includes('infantil') || j.convenioInfo?.stage === '0-3_años' || j.convenioInfo?.stage === '3-6_años')
  );

  const formatCard = (job: Job) => {
    const source = escapeHtml(job.source || 'Portal');
    const url = escapeHtml(job.url);
    const title = escapeHtml(job.title);
    const companyName = escapeHtml(job.companyName);
    const companyType = escapeHtml(job.companyType || '');
    const location = escapeHtml(job.location || 'España');
    const hours = escapeHtml(job.hours || 'Jornada completa');
    const salary = escapeHtml(job.salary || 'Según convenio');
    const publishDate = escapeHtml(job.publishDate || 'Reciente');
    const convenio = job.convenioInfo ? {
      name: escapeHtml(job.convenioInfo.convenioName),
      category: escapeHtml(job.convenioInfo.applicableCategory || ''),
      referenceSalary: escapeHtml(job.convenioInfo.referenceSalary || '')
    } : null;
    const badges = [
      job.source ? `<span style="background-color: #e0e7ff; color: #3730a3; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase;">${source}</span>` : '',
      job.isOlderThanMonth ? '<span style="background-color: #fef3c7; color: #b45309; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase;">&gt;1 mes</span>' : '',
      job.certificationTags?.map(t => {
        const label = t === 'TSEI' ? 'FP TSEI' : t === 'Monitor_Ocio' ? 'Monitor Ocio' : t === 'Magisterio_Infantil' ? 'Grado Infantil' : 'Auxiliar';
        const color = t === 'TSEI' ? '#0284c7; background-color: #e0f2fe' : t === 'Monitor_Ocio' ? '#c2410c; background-color: #ffedd5' : '#4f46e5; background-color: #ede9fe';
        return `<span style="background-color: ${color}; color: ${color.split(';')[0]}; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">${label}</span>`;
      }).join(' ') || ''
    ].filter(Boolean).join(' ');

    const convenioBlock = convenio ? `
      <div style="margin-top: 6px; padding: 6px 10px; background-color: #f8fafc; border-left: 3px solid #0284c7; font-size: 11px; color: #475569; border-radius: 0 4px 4px 0;">
        <strong>Convenio:</strong> ${convenio.name}
        ${convenio.category ? ` | <strong>Cat:</strong> ${convenio.category}` : ''}
        ${convenio.referenceSalary ? ` | <strong>Baremación:</strong> ${convenio.referenceSalary}` : ''}
      </div>
    ` : '';

    return `
      <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 12px;">
        <div style="margin-bottom: 5px;">
          ${badges}
        </div>
        <h3 style="margin: 0 0 3px 0; font-size: 15px; color: #0f172a;">
          <a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: none; font-weight: 600;">
            ${title} &rarr;
          </a>
        </h3>
        <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">
          <strong>${companyName}</strong> ${job.companyType ? `• <em>${companyType}</em>` : ''}
        </p>
        <div style="font-size: 11px; color: #334155; margin-bottom: 6px;">
          📍 ${location} &nbsp;|&nbsp;
          ⏱️ ${hours} &nbsp;|&nbsp;
          💶 ${salary} &nbsp;|&nbsp;
          📅 ${publishDate}
        </div>
        ${convenioBlock}
        <div style="margin-top: 8px; text-align: right;">
          <a href="${url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 11px; font-weight: 600; padding: 5px 12px; border-radius: 5px; text-decoration: none;">
            Ver y Postular en ${source} &raquo;
          </a>
        </div>
      </div>
    `;
  };

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Resumen de Ofertas de Empleo - JobCrawling</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #1e293b;">
    <div style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 24px; color: #ffffff; text-align: center;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em;">JobCrawling</h1>
        <p style="margin: 6px 0 0 0; font-size: 13px; color: ${isIncremental ? '#38bdf8' : '#94a3b8'}; font-weight: ${isIncremental ? '600' : 'normal'};">
          ${isIncremental ? '✨ Nuevas ofertas detectadas desde el último boletín' : 'Boletín de Ofertas: Educación Infantil, TSEI, UNED BICI, Bolsas Oficiales y Monitores'}
        </p>
        <div style="margin-top: 12px; display: inline-block; background-color: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; color: #e2e8f0;">
          📅 ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>

        <!-- Web Portal Banner Link -->
        <div style="margin-top: 16px;">
          <a href="https://jobcrawling.sajl.cc" target="_blank" style="display: inline-block; background-color: #0284c7; color: #ffffff; font-size: 13px; font-weight: 700; padding: 8px 18px; border-radius: 6px; text-decoration: none; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
            🌐 Abrir Portal Web Completo (${total} ofertas activas) &raquo;
          </a>
        </div>
      </div>

      <!-- Quick Metrics Bar -->
      <div style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 12px 18px; display: flex; justify-content: space-around; text-align: center;">
        <div>
          <span style="font-size: 16px; font-weight: 700; color: #0284c7; display: block;">${tseiJobs.length}</span>
          <span style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600;">TSEI / 0-3</span>
        </div>
        <div>
          <span style="font-size: 16px; font-weight: 700; color: #b45309; display: block;">${unedJobs.length}</span>
          <span style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600;">UNED BICI</span>
        </div>
        <div>
          <span style="font-size: 16px; font-weight: 700; color: #059669; display: block;">${bolsasJobs.length}</span>
          <span style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600;">Bolsas Oficiales</span>
        </div>
        <div>
          <span style="font-size: 16px; font-weight: 700; color: #ea580c; display: block;">${toledoJobs.length}</span>
          <span style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600;">Toledo</span>
        </div>
        <div>
          <span style="font-size: 16px; font-weight: 700; color: #0f172a; display: block;">${total}</span>
          <span style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600;">Total Base</span>
        </div>
      </div>

      <!-- Main Body -->
      <div style="padding: 20px;">

        <!-- Section 1: TSEI (0-3) -->
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 15px; color: #0369a1; border-bottom: 2px solid #bae6fd; padding-bottom: 5px; margin-bottom: 12px;">
            🧸 Vacantes para Técnico de Educación Infantil (TSEI / 0-3 años) (${tseiJobs.length})
          </h2>
          ${tseiJobs.length > 0 ? tseiJobs.map(formatCard).join('') : '<p style="font-size: 12px; color: #64748b;">No hay nuevas ofertas directas de TSEI en esta tanda.</p>'}
        </div>

        <!-- Section 2: Monitores y Comedores -->
        <div style="margin-bottom: 24px;">
          <h2 style="font-size: 15px; color: #c2410c; border-bottom: 2px solid #fed7aa; padding-bottom: 5px; margin-bottom: 12px;">
            🎨 Vacantes de Monitores, Ocio y Comedor Infantil (${monitorJobs.length})
          </h2>
          ${monitorJobs.length > 0 ? monitorJobs.slice(0, 10).map(formatCard).join('') : '<p style="font-size: 12px; color: #64748b;">No hay nuevas ofertas de monitores en esta tanda.</p>'}
          ${monitorJobs.length > 10 ? `<div style="text-align: center; margin-top: 8px;"><a href="https://jobcrawling.sajl.cc" style="font-size: 12px; color: #c2410c; text-decoration: underline;">+ Ver las ${monitorJobs.length - 10} ofertas restantes de monitores en la app web &raquo;</a></div>` : ''}
        </div>

        <!-- Section 3: Otras plazas infantiles y colegios -->
        ${otherInfantil.length > 0 ? `
          <div style="margin-bottom: 24px;">
            <h2 style="font-size: 15px; color: #4338ca; border-bottom: 2px solid #c7d2fe; padding-bottom: 5px; margin-bottom: 12px;">
              📚 Otras Ofertas en Colegios y Escuelas Infantiles (${otherInfantil.length})
            </h2>
            ${otherInfantil.slice(0, 6).map(formatCard).join('')}
            ${otherInfantil.length > 6 ? `<div style="text-align: center; margin-top: 8px;"><a href="https://jobcrawling.sajl.cc" style="font-size: 12px; color: #4338ca; text-decoration: underline;">+ Ver las ${otherInfantil.length - 6} ofertas restantes en la app web &raquo;</a></div>` : ''}
          </div>
        ` : ''}

        <!-- Section 4: UNED BICI - Contratos de Investigación en Educación / Infancia -->
        ${unedJobs.length > 0 ? `
          <div style="margin-bottom: 24px;">
            <h2 style="font-size: 15px; color: #b45309; border-bottom: 2px solid #fde68a; padding-bottom: 5px; margin-bottom: 12px;">
              🎓 UNED BICI: Contratos de Investigación en Educación e Infancia (${unedJobs.length})
            </h2>
            ${unedJobs.map(formatCard).join('')}
          </div>
        ` : ''}

        <!-- Section 5: Ofertas y Bolsas Oficiales de España - Al final del correo -->
        ${bolsasJobs.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h2 style="font-size: 15px; color: #047857; border-bottom: 2px solid #a7f3d0; padding-bottom: 5px; margin-bottom: 12px;">
              🏛️ Ofertas y Bolsas de Empleo Público Oficiales (España) (${bolsasJobs.length})
            </h2>
            ${bolsasJobs.map(formatCard).join('')}
          </div>
        ` : ''}

      </div>

      <!-- Footer -->
      <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 20px; font-size: 11px; color: #94a3b8; text-align: center;">
        <p style="margin: 0 0 4px 0;">Este resumen fue generado automáticamente por JobCrawling.</p>
        <p style="margin: 0 0 6px 0;">Destinatario: <strong>${escapeHtml(recipientEmail)}</strong></p>
        <p style="margin: 0;"><a href="https://jobcrawling.sajl.cc" style="color: #0284c7; text-decoration: none; font-weight: 600;">Acceder a JobCrawling Portal Web</a></p>
      </div>

    </div>
  </body>
  </html>
  `;
}

const SENT_JOBS_FILE = path.join(process.cwd(), 'public/data/sent_jobs_history.json');

export interface RecipientSentHistory {
  sentIds: string[];
  lastSentAt: string;
  lastBatchCount: number;
}

export type SentJobsHistory = Record<string, RecipientSentHistory>;

export async function loadSentJobsHistory(): Promise<SentJobsHistory> {
  try {
    await fs.mkdir(path.dirname(SENT_JOBS_FILE), { recursive: true });
    const content = await fs.readFile(SENT_JOBS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export async function saveSentJobsHistory(history: SentJobsHistory): Promise<void> {
  try {
    await fs.mkdir(path.dirname(SENT_JOBS_FILE), { recursive: true });
    await fs.writeFile(SENT_JOBS_FILE, JSON.stringify(history, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error al guardar historial de ofertas enviadas:', err);
  }
}

export interface SendJobsEmailOptions {
  forceAll?: boolean;
  resetHistory?: boolean;
  dryRun?: boolean;
}

export async function sendJobsEmail(
  customRecipient?: string, 
  customJobs?: Job[], 
  options: SendJobsEmailOptions = {}
): Promise<{ success: boolean; message: string; sentCount?: number }> {
  const config = getEmailConfig();
  const rawRecipient = customRecipient || config.emailTo;

  if (!rawRecipient) {
    throw new Error('No se ha especificado un correo destinatario.');
  }

  if (!config.smtpUser || !config.smtpPass) {
    throw new Error('Configuración de correo no disponible en el servidor.');
  }

  // Support multiple recipients separated by comma or semicolon
  const recipients = rawRecipient.split(/[,;]+/).map(r => r.trim()).filter(Boolean);

  let allJobs: Job[] = [];
  if (customJobs && Array.isArray(customJobs) && customJobs.length > 0) {
    allJobs = customJobs;
  } else {
    const jobsPath = path.join(process.cwd(), 'public/data/jobs.json');
    const fileContent = await fs.readFile(jobsPath, 'utf-8');
    allJobs = JSON.parse(fileContent);
  }

  const history = await loadSentJobsHistory();

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass
    }
  });

  let totalEmailsSent = 0;
  let totalVacanciesSent = 0;

  for (const recipient of recipients) {
    const normRecipient = recipient.toLowerCase().trim();

    if (options.resetHistory) {
      delete history[normRecipient];
      await saveSentJobsHistory(history);
      console.log(`🔄 Historial de ofertas enviadas reseteado para ${recipient}`);
    }

    const previousSentIds = new Set(history[normRecipient]?.sentIds || []);
    
    // Filter to only new jobs that haven't been sent to this recipient yet
    const jobsToSend = options.forceAll 
      ? allJobs 
      : allJobs.filter(j => !previousSentIds.has(j.id));

    if (jobsToSend.length === 0) {
      console.log(`ℹ️ [${recipient}] No hay ofertas nuevas desde el último boletín (${previousSentIds.size} ofertas ya enviadas previamente). Se omite el correo.`);
      continue;
    }

    const isFirstTime = previousSentIds.size === 0;
    const isIncremental = !isFirstTime && !options.forceAll;

    console.log(`Preparando envío de correo para ${jobsToSend.length} ofertas ${isIncremental ? '(Nuevas desde el último envío) ' : ''}a: ${recipient}...`);

    if (options.dryRun) {
      console.log(`[DRY-RUN] Se habrían enviado ${jobsToSend.length} ofertas a ${recipient}.`);
      continue;
    }

    const tseiCount = jobsToSend.filter(j => j.certificationTags?.includes('TSEI')).length;
    const monitorCount = jobsToSend.filter(j => j.certificationTags?.includes('Monitor_Ocio')).length;
    const subjectPrefix = isIncremental ? 'Nuevas vacantes detectadas: ' : 'Boletín de Empleo: ';
    const subject = `${subjectPrefix}${jobsToSend.length} ofertas (${tseiCount} Infantil / TSEI, ${monitorCount} monitores)`;

    const htmlContent = generateEmailHtml(jobsToSend, recipient, isIncremental);

    const textAlternative = `Boletín de Ofertas JobCrawling${isIncremental ? ' (Nuevas ofertas)' : ''}
Resumen de Empleo: ${jobsToSend.length} vacantes disponibles (${tseiCount} Infantil / TSEI y ${monitorCount} puestos de Monitores y Ocio).

Visita la plataforma web para ver los enlaces directos de inscripción: https://jobcrawling.sajl.cc

Destinatario: ${recipient}
JobCrawling`;

    const info = await transporter.sendMail({
      from: `"JobCrawling" <${config.emailFrom}>`,
      to: recipient,
      subject,
      text: textAlternative,
      html: htmlContent,
      headers: {
        'List-Unsubscribe': `<mailto:${config.emailFrom}?subject=unsubscribe>`,
        'X-Entity-Ref-ID': Date.now().toString(),
        'Precedence': 'bulk'
      }
    });

    console.log(`✅ Correo enviado exitosamente a ${recipient} (ID: ${info.messageId}) - ${jobsToSend.length} vacantes.`);

    // Record the newly sent job IDs
    const updatedSentIds = Array.from(new Set([...previousSentIds, ...jobsToSend.map(j => j.id)]));
    history[normRecipient] = {
      sentIds: updatedSentIds,
      lastSentAt: new Date().toISOString(),
      lastBatchCount: jobsToSend.length
    };
    await saveSentJobsHistory(history);

    totalEmailsSent++;
    totalVacanciesSent += jobsToSend.length;
  }

  if (totalEmailsSent === 0) {
    return { 
      success: true, 
      message: 'No había nuevas ofertas pendientes para los destinatarios.',
      sentCount: 0 
    };
  }

  return { 
    success: true, 
    message: `Se enviaron ${totalVacanciesSent} vacantes a ${totalEmailsSent} destinatario(s).`,
    sentCount: totalVacanciesSent
  };
}

// CLI execution handling
if (process.argv[1] && process.argv[1].endsWith('emailNotifier.ts')) {
  (async () => {
    try {
      // Allow passing custom recipient: npx tsx scripts/emailNotifier.ts --to user@example.com
      const toIndex = process.argv.indexOf('--to');
      const customTo = toIndex !== -1 && process.argv[toIndex + 1] ? process.argv[toIndex + 1] : undefined;
      const forceAll = process.argv.includes('--all') || process.argv.includes('--force-all');
      const resetHistory = process.argv.includes('--reset-history');
      const dryRun = process.argv.includes('--dry-run');

      await sendJobsEmail(customTo, undefined, { forceAll, resetHistory, dryRun });
      process.exit(0);
    } catch (err: any) {
      console.error(`❌ Error al enviar el correo: ${err.message}`);
      process.exit(1);
    }
  })();
}
