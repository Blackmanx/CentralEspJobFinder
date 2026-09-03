import * as fs from 'fs/promises';
import * as path from 'path';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { Job } from '../src/types/job';

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

export function generateEmailHtml(jobs: Job[], recipientEmail: string): string {
  const total = jobs.length;
  const tseiJobs = jobs.filter(j => j.certificationTags?.includes('TSEI'));
  const monitorJobs = jobs.filter(j => j.certificationTags?.includes('Monitor_Ocio'));
  const bolsasJobs = jobs.filter(j => j.source?.includes('Bolsa') || j.companyType?.includes('Bolsa'));
  const toledoJobs = jobs.filter(j => (j.province || '').toLowerCase().includes('toledo') || (j.location || '').toLowerCase().includes('toledo'));
  const otherInfantil = jobs.filter(j => 
    !j.certificationTags?.includes('TSEI') && 
    !j.certificationTags?.includes('Monitor_Ocio') &&
    !j.source?.includes('Bolsa') &&
    (j.title.toLowerCase().includes('infantil') || j.convenioInfo?.stage === '0-3_años' || j.convenioInfo?.stage === '3-6_años')
  );

  const formatCard = (job: Job) => {
    const badges = [
      job.source ? `<span style="background-color: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase;">${job.source}</span>` : '',
      job.certificationTags?.map(t => {
        const label = t === 'TSEI' ? 'FP TSEI' : t === 'Monitor_Ocio' ? 'Monitor Ocio' : t === 'Magisterio_Infantil' ? 'Grado Infantil' : 'Auxiliar';
        const color = t === 'TSEI' ? '#0284c7; background-color: #e0f2fe' : t === 'Monitor_Ocio' ? '#c2410c; background-color: #ffedd5' : '#4f46e5; background-color: #ede9fe';
        return `<span style="background-color: ${color}; color: ${color.split(';')[0]}; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">${label}</span>`;
      }).join(' ') || ''
    ].filter(Boolean).join(' ');

    const convenioBlock = job.convenioInfo ? `
      <div style="margin-top: 8px; padding: 8px 12px; background-color: #f8fafc; border-left: 3px solid #0284c7; font-size: 12px; color: #475569; border-radius: 0 4px 4px 0;">
        <strong>Convenio:</strong> ${job.convenioInfo.convenioName} <br/>
        ${job.convenioInfo.applicableCategory ? `<strong>Categoría:</strong> ${job.convenioInfo.applicableCategory} | ` : ''}
        ${job.convenioInfo.referenceSalary ? `<strong>Baremación:</strong> ${job.convenioInfo.referenceSalary}` : ''}
      </div>
    ` : '';

    return `
      <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="margin-bottom: 6px;">
          ${badges}
        </div>
        <h3 style="margin: 0 0 4px 0; font-size: 16px; color: #0f172a;">
          <a href="${job.url}" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: 600;">
            ${job.title} &rarr;
          </a>
        </h3>
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b; font-weight: 500;">
          <strong>${job.companyName}</strong> ${job.companyType ? `• <em>${job.companyType}</em>` : ''}
        </p>
        <div style="font-size: 12px; color: #334155; margin-bottom: 8px;">
          📍 <strong>Ubicación:</strong> ${job.location || 'Madrid'} &nbsp;|&nbsp; 
          ⏱️ <strong>Jornada:</strong> ${job.hours || 'N/D'} &nbsp;|&nbsp; 
          💶 <strong>Salario:</strong> ${job.salary || 'Según convenio'} &nbsp;|&nbsp; 
          📅 <strong>Fecha:</strong> ${job.publishDate || 'Reciente'}
        </div>
        ${convenioBlock}
        <div style="margin-top: 10px; text-align: right;">
          <a href="${job.url}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 6px; text-decoration: none;">
            Ver y Postular en ${job.source || 'Portal'} &raquo;
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
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b;">
    <div style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 28px 24px; color: #ffffff; text-align: center;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.02em;">JobCrawling</h1>
        <p style="margin: 6px 0 0 0; font-size: 14px; color: #94a3b8;">
          Boletín de Ofertas: Educación Infantil, TSEI, Bolsas Oficiales y Monitores
        </p>
        <div style="margin-top: 14px; display: inline-block; background-color: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; color: #e2e8f0;">
          📅 ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <!-- Quick Metrics Bar -->
      <div style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 14px 24px; display: flex; justify-content: space-around; text-align: center;">
        <div>
          <span style="font-size: 18px; font-weight: 700; color: #0284c7; display: block;">${tseiJobs.length}</span>
          <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">TSEI / 0-3</span>
        </div>
        <div>
          <span style="font-size: 18px; font-weight: 700; color: #059669; display: block;">${bolsasJobs.length}</span>
          <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">Bolsas Oficiales</span>
        </div>
        <div>
          <span style="font-size: 18px; font-weight: 700; color: #ea580c; display: block;">${toledoJobs.length}</span>
          <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">Toledo</span>
        </div>
        <div>
          <span style="font-size: 18px; font-weight: 700; color: #0f172a; display: block;">${total}</span>
          <span style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">Total Base</span>
        </div>
      </div>

      <!-- Main Body -->
      <div style="padding: 24px;">

        <!-- Section 1: TSEI (0-3) -->
        <div style="margin-bottom: 28px;">
          <h2 style="font-size: 16px; color: #0369a1; border-bottom: 2px solid #bae6fd; padding-bottom: 6px; margin-bottom: 14px;">
            🧸 Vacantes para Técnico de Educación Infantil (TSEI / 0-3 años) (${tseiJobs.length})
          </h2>
          ${tseiJobs.length > 0 ? tseiJobs.map(formatCard).join('') : '<p style="font-size: 13px; color: #64748b;">No hay nuevas ofertas directas de TSEI en esta tanda.</p>'}
        </div>

        <!-- Section 2: Monitores y Comedores -->
        <div style="margin-bottom: 28px;">
          <h2 style="font-size: 16px; color: #c2410c; border-bottom: 2px solid #fed7aa; padding-bottom: 6px; margin-bottom: 14px;">
            🎨 Vacantes de Monitores, Ocio y Comedor Infantil (${monitorJobs.length})
          </h2>
          ${monitorJobs.length > 0 ? monitorJobs.map(formatCard).join('') : '<p style="font-size: 13px; color: #64748b;">No hay nuevas ofertas de monitores en esta tanda.</p>'}
        </div>

        <!-- Section 3: Otras plazas infantiles y colegios -->
        ${otherInfantil.length > 0 ? `
          <div style="margin-bottom: 28px;">
            <h2 style="font-size: 16px; color: #4338ca; border-bottom: 2px solid #c7d2fe; padding-bottom: 6px; margin-bottom: 14px;">
              📚 Otras Ofertas en Colegios y Escuelas Infantiles (${otherInfantil.length})
            </h2>
            ${otherInfantil.slice(0, 10).map(formatCard).join('')}
          </div>
        ` : ''}

        <!-- Section 4: Bolsas de Empleo Oficiales (Madrid y Toledo) - Al final del correo -->
        ${bolsasJobs.length > 0 ? `
          <div style="margin-bottom: 24px;">
            <h2 style="font-size: 16px; color: #047857; border-bottom: 2px solid #a7f3d0; padding-bottom: 6px; margin-bottom: 14px;">
              🏛️ Bolsas de Empleo Público Oficiales (Madrid y Toledo) (${bolsasJobs.length})
            </h2>
            ${bolsasJobs.map(formatCard).join('')}
          </div>
        ` : ''}

      </div>

      <!-- Footer -->
      <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; font-size: 12px; color: #94a3b8; text-align: center;">
        <p style="margin: 0 0 6px 0;">Este correo fue generado automáticamente por JobCrawling en Raspberry Pi / Servidor Local.</p>
        <p style="margin: 0;">Destinatario(s): <strong>${recipientEmail}</strong></p>
      </div>

    </div>
  </body>
  </html>
  `;
}

export async function sendJobsEmail(customRecipient?: string): Promise<{ success: boolean; message: string }> {
  const config = getEmailConfig();
  const rawRecipient = customRecipient || config.emailTo;

  if (!rawRecipient) {
    throw new Error('No se ha especificado un email destinatario. Configura EMAIL_TO en .env o pásalo como argumento: --to tu_email@dominio.com');
  }

  if (!config.smtpUser || !config.smtpPass) {
    throw new Error('Faltan credenciales SMTP (SMTP_USER / SMTP_PASS) en el archivo .env.');
  }

  // Support multiple recipients separated by comma or semicolon
  const recipients = rawRecipient.split(/[,;]+/).map(r => r.trim()).filter(Boolean);

  const jobsPath = path.join(process.cwd(), 'public/data/jobs.json');
  const fileContent = await fs.readFile(jobsPath, 'utf-8');
  const jobs: Job[] = JSON.parse(fileContent);

  console.log(`Preparando envío de correo para ${jobs.length} ofertas a: ${recipients.join(', ')}...`);

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass
    }
  });

  const tseiCount = jobs.filter(j => j.certificationTags?.includes('TSEI')).length;
  const monitorCount = jobs.filter(j => j.certificationTags?.includes('Monitor_Ocio')).length;
  const subject = `Boletín Diario de Empleo Infantil y TSEI: ${tseiCount} vacantes 0-3 y ${monitorCount} monitores`;

  const sentIds: string[] = [];

  for (const recipient of recipients) {
    const htmlContent = generateEmailHtml(jobs, recipient);

    const textAlternative = `Boletín de Ofertas JobCrawling
Resumen de Empleo: ${tseiCount} vacantes TSEI / 0-3 años y ${monitorCount} puestos de Monitores y Ocio.

Visita la plataforma o consulta la versión HTML del mensaje para ver los enlaces directos de inscripción y los convenios colectivos aplicables.

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

    console.log(`✅ Correo enviado exitosamente a ${recipient} (ID: ${info.messageId})`);
    sentIds.push(info.messageId);
  }

  return { success: true, message: `Correo enviado a ${recipients.join(', ')} con IDs: ${sentIds.join(', ')}` };
}

// CLI execution handling
if (process.argv[1] && process.argv[1].endsWith('emailNotifier.ts')) {
  (async () => {
    try {
      // Allow passing custom recipient: npx tsx scripts/emailNotifier.ts --to user@example.com
      const toIndex = process.argv.indexOf('--to');
      const customTo = toIndex !== -1 && process.argv[toIndex + 1] ? process.argv[toIndex + 1] : undefined;

      await sendJobsEmail(customTo);
      process.exit(0);
    } catch (err: any) {
      console.error(`❌ Error al enviar el correo: ${err.message}`);
      process.exit(1);
    }
  })();
}
