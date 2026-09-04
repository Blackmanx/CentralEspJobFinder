import React from 'react';
import { Job, ApplicationStatus, UserJobState } from '../types/job';
import { isOfficialPublicJob } from '../jobCategories';
import { 
  Building2, 
  MapPin, 
  Clock, 
  Coins, 
  Calendar, 
  Eye, 
  CheckCircle,
  Sparkles,
  CalendarCheck,
  XCircle,
  Award,
  ExternalLink
} from 'lucide-react';
import { groupJobsByDate, formatJobDate } from '../utils/jobFreshness';

interface JobTableProps {
  jobs: Job[];
  userStates: { [jobId: string]: UserJobState };
  onSelectJob: (job: Job) => void;
  onUpdateStatus: (jobId: string, status: ApplicationStatus) => void;
  selectedScope: 'infantil' | 'monitor_ocio' | 'bolsas' | 'uned' | 'docente_otros' | 'apoyo_otros' | 'all';
  selectedJobId?: string;
}

const BiciAgeBadge: React.FC<{ job: Job }> = ({ job }) => {
  if (!job.source?.includes('UNED BICI') || !job.isOlderThanMonth) return null;

  return (
    <span
      title="Convocatoria BICI publicada hace más de un mes"
      style={{
        backgroundColor: 'rgba(245, 158, 11, 0.14)',
        color: '#b45309',
        fontSize: '0.65rem',
        fontWeight: 'bold',
        padding: '2px 6px',
        borderRadius: '4px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}
    >
      &gt;1 mes
    </span>
  );
};

export const JobTable: React.FC<JobTableProps> = ({
  jobs,
  userStates,
  onSelectJob,
  onUpdateStatus,
  selectedScope,
  selectedJobId
}) => {
  

  if (jobs.length === 0) {
    return (
      <div className="glass-panel text-center p-12 animate-fade-in" style={{ marginTop: '2rem' }}>
        <p className="text-secondary" style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
          No se encontraron ofertas con los filtros seleccionados.
        </p>
        {selectedScope === 'infantil' && (
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>
            Prueba a cambiar el filtro de "Ámbito" o buscar "Todos los ámbitos" para ver más puestos docentes o de apoyo.
          </p>
        )}
      </div>
    );
  }

  const dateGroups = groupJobsByDate(jobs);

  return (
    <div className="animate-fade-in" style={{ marginTop: '1.5rem' }}>
      
      {/* Desktop Table View (Hidden on mobile) */}
      <div className="table-container hidden-mobile">
        <table>
          <thead>
            <tr>
              <th>Oferta</th>
              <th>Colegio / Centro</th>
              <th>Ubicación</th>
              <th>Jornada</th>
              <th>Salario</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {dateGroups.map((group) => (
              <React.Fragment key={`group-${group.key}`}>
                <tr style={{ backgroundColor: group.isToday ? 'rgba(16, 185, 129, 0.08)' : group.isYesterday ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-tertiary)' }}>
                  <td colSpan={8} style={{
                    padding: '8px 16px',
                    borderTop: '1px solid var(--border-color)',
                    borderBottom: '1px solid var(--border-color)',
                    borderLeft: `4px solid ${group.color}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Calendar size={14} style={{ color: group.color }} />
                        <span style={{ fontWeight: 700, fontSize: '0.84rem', color: group.color }}>
                          {group.title}
                        </span>
                        {group.subTitle && (
                          <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            • {group.subTitle}
                          </span>
                        )}
                      </div>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '10px',
                        backgroundColor: 'var(--bg-element)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-color)'
                      }}>
                        {group.jobs.length} {group.jobs.length === 1 ? 'oferta' : 'ofertas'}
                      </span>
                    </div>
                  </td>
                </tr>
                {group.jobs.map((job) => {
                  const state = userStates[job.id] || { status: 'not_applied', notes: '', updatedAt: '' };
                  const isSelected = selectedJobId === job.id;
                  
                  return (
                    <tr 
                      key={job.id} 
                      className={isSelected ? 'selected' : ''}
                    >
                      {/* Job Title */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {job.title}
                          </span>
                          <BiciAgeBadge job={job} />
                          {state.cvAnalysis && (
                        <span style={{
                          backgroundColor: 'rgba(245, 158, 11, 0.12)',
                          color: '#f59e0b',
                          fontSize: '0.65rem',
                          fontWeight: 'bold',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <Sparkles size={10} />
                          Analizado
                        </span>
                      )}
                      {job.source && (
                        <a 
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            backgroundColor: job.source.includes('UNED') ? 'rgba(217, 119, 6, 0.15)' :
                                             isOfficialPublicJob(job) ? 'rgba(5, 150, 105, 0.15)' :
                                             job.source === 'Colejobs' ? 'rgba(59, 130, 246, 0.12)' :
                                             job.source === 'Indeed' ? 'rgba(16, 185, 129, 0.12)' :
                                             'rgba(139, 92, 246, 0.12)',
                            color: job.source.includes('UNED') ? '#b45309' :
                                   isOfficialPublicJob(job) ? '#059669' :
                                   job.source === 'Colejobs' ? '#3b82f6' :
                                   job.source === 'Indeed' ? '#10b981' :
                                   '#8b5cf6',
                            fontSize: '0.65rem',
                            fontWeight: 'bold',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            transition: 'opacity 0.2s',
                            cursor: 'pointer'
                          }}
                          title={`Ver oferta original en ${job.source}`}
                        >
                          {job.source}
                          <ExternalLink size={8} />
                        </a>
                      )}
                      {job.certificationTags?.map((tag) => (
                        <span key={tag} style={{
                          backgroundColor: tag === 'TSEI' ? 'rgba(14, 165, 233, 0.15)' :
                                           tag === 'Magisterio_Infantil' ? 'rgba(99, 102, 241, 0.15)' :
                                           tag === 'Monitor_Ocio' ? 'rgba(234, 88, 12, 0.15)' :
                                           'rgba(168, 85, 247, 0.15)',
                          color: tag === 'TSEI' ? '#0284c7' :
                                 tag === 'Magisterio_Infantil' ? '#4f46e5' :
                                 tag === 'Monitor_Ocio' ? '#c2410c' :
                                 '#7e22ce',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          letterSpacing: '0.03em'
                        }}>
                          {tag === 'TSEI' ? 'FP TSEI' :
                           tag === 'Magisterio_Infantil' ? 'Grado Infantil' :
                           tag === 'Monitor_Ocio' ? 'Monitor Ocio' :
                           'Auxiliar'}
                        </span>
                      ))}
                    </div>
                    {job.companyType && (
                      <span className="text-muted" style={{ fontSize: '0.75rem', marginTop: '2px', display: 'block' }}>
                        {job.companyType}
                      </span>
                    )}
                  </td>
                  
                  {/* College / Company */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {job.companyLogo ? (
                        <img 
                          src={job.companyLogo} 
                          alt={job.companyName} 
                          style={{ width: '28px', height: '28px', borderRadius: '4px', objectFit: 'contain', backgroundColor: 'white', padding: '2px' }} 
                        />
                      ) : (
                        <div style={{ width: '28px', height: '28px', borderRadius: '4px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
                          <Building2 size={14} className="text-secondary" />
                        </div>
                      )}
                      <span style={{ fontWeight: 500 }}>{job.companyName}</span>
                    </div>
                  </td>
                  
                  {/* Location */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                      <MapPin size={14} className="text-muted" />
                      <span>{job.location || 'Madrid'}</span>
                    </div>
                  </td>
                  
                  {/* Weekly Hours */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                      <Clock size={14} className="text-muted" />
                      <span>{job.hours || 'N/D'}</span>
                    </div>
                  </td>
                  
                  {/* Salary */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                      <Coins size={14} className="text-muted" />
                      <span style={{ fontSize: '0.85rem' }}>{job.salary || 'Según convenio'}</span>
                    </div>
                  </td>
                  
                  {/* Publish / Scraped Date */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)' }}>
                      <Calendar size={13} className="text-muted" />
                      <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                        {formatJobDate(job)}
                      </span>
                    </div>
                  </td>
                  
                  {/* Application Status Badge */}
                  <td>
                    <select
                      value={state.status}
                      onChange={(e) => onUpdateStatus(job.id, e.target.value as any)}
                      className={`badge badge-${state.status}`}
                      style={{ 
                        border: '1px solid currentColor',
                        background: 'transparent',
                        padding: '4px 20px 4px 8px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        appearance: 'none',
                        outline: 'none',
                        backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 6px center',
                        backgroundSize: '10px',
                        minWidth: '105px'
                      }}
                    >
                      <option value="not_applied" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>Sin aplicar</option>
                      <option value="applied" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>Postulado</option>
                      <option value="interviewing" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>Entrevista</option>
                      <option value="offered" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>Ofrecido</option>
                      <option value="rejected" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>Rechazado</option>
                    </select>
                  </td>
                  
                  {/* Actions */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                      {/* Mark as Applied Shortcut */}
                      {state.status === 'not_applied' && (
                        <button
                          onClick={() => onUpdateStatus(job.id, 'applied')}
                          className="btn-icon"
                          style={{
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            color: 'var(--accent-primary)',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 600
                          }}
                          title="Marcar como postulado rápidamente"
                        >
                          <CheckCircle size={12} />
                          Postularse
                        </button>
                      )}

                      {/* State transitions shortcuts */}
                      {state.status === 'applied' && (
                        <>
                          <button
                            onClick={() => onUpdateStatus(job.id, 'interviewing')}
                            className="btn-icon"
                            style={{
                              background: 'rgba(245, 158, 11, 0.1)',
                              border: '1px solid rgba(245, 158, 11, 0.2)',
                              color: '#d97706',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 600
                            }}
                            title="Mover a entrevista"
                          >
                            <CalendarCheck size={12} />
                            Entrevista
                          </button>
                          <button
                            onClick={() => onUpdateStatus(job.id, 'rejected')}
                            className="btn-icon"
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              color: 'var(--accent-red)',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 600
                            }}
                            title="Marcar como rechazado"
                          >
                            <XCircle size={12} />
                            Rechazar
                          </button>
                        </>
                      )}

                      {state.status === 'interviewing' && (
                        <>
                          <button
                            onClick={() => onUpdateStatus(job.id, 'offered')}
                            className="btn-icon"
                            style={{
                              background: 'rgba(139, 92, 246, 0.1)',
                              border: '1px solid rgba(139, 92, 246, 0.2)',
                              color: '#7c3aed',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 600
                            }}
                            title="Marcar como ofrecido"
                          >
                            <Award size={12} />
                            Ofrecido
                          </button>
                          <button
                            onClick={() => onUpdateStatus(job.id, 'rejected')}
                            className="btn-icon"
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              color: 'var(--accent-red)',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 600
                            }}
                            title="Marcar como rechazado"
                          >
                            <XCircle size={12} />
                            Rechazar
                          </button>
                        </>
                      )}
                      
                      {/* View Details */}
                      <button
                        onClick={() => onSelectJob(job)}
                        className="btn-icon"
                        style={{
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 500
                        }}
                      >
                        <Eye size={12} />
                        Detalles
                      </button>
                    </div>
                  </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Grid (Hidden on desktop) */}
      <div className="visible-mobile card-grid">
        {dateGroups.map((group) => (
          <div key={`mobile-group-${group.key}`} style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              marginBottom: '10px',
              backgroundColor: group.isToday ? 'rgba(16, 185, 129, 0.08)' : group.isYesterday ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-tertiary)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              borderLeft: `4px solid ${group.color}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} style={{ color: group.color }} />
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: group.color }}>
                  {group.title}
                </span>
                {group.subTitle && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    • {group.subTitle}
                  </span>
                )}
              </div>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '2px 7px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-element)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)'
              }}>
                {group.jobs.length} {group.jobs.length === 1 ? 'oferta' : 'ofertas'}
              </span>
            </div>

            {group.jobs.map((job) => {
              const state = userStates[job.id] || { status: 'not_applied', notes: '', updatedAt: '' };
              
              return (
                <div 
                  key={job.id} 
                  className="glass-card" 
                  style={{ 
                    padding: '16px', 
                    marginBottom: '12px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '12px'
                  }}
                >
                  {/* Header: Title and Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{job.title}</h4>
                        <BiciAgeBadge job={job} />
                        {state.cvAnalysis && (
                      <span style={{
                        backgroundColor: 'rgba(245, 158, 11, 0.12)',
                        color: '#f59e0b',
                        fontSize: '0.6rem',
                        fontWeight: 'bold',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}>
                        <Sparkles size={8} />
                        Analizado
                      </span>
                    )}
                    {job.source && (
                      <a 
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          backgroundColor: job.source.includes('UNED') ? 'rgba(217, 119, 6, 0.15)' :
                                           isOfficialPublicJob(job) ? 'rgba(5, 150, 105, 0.15)' :
                                           job.source === 'Colejobs' ? 'rgba(59, 130, 246, 0.12)' :
                                           job.source === 'Indeed' ? 'rgba(16, 185, 129, 0.12)' :
                                           'rgba(139, 92, 246, 0.12)',
                          color: job.source.includes('UNED') ? '#b45309' :
                                 isOfficialPublicJob(job) ? '#059669' :
                                 job.source === 'Colejobs' ? '#3b82f6' :
                                 job.source === 'Indeed' ? '#10b981' :
                                 '#8b5cf6',
                          fontSize: '0.6rem',
                          fontWeight: 'bold',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}
                        title={`Ver oferta original en ${job.source}`}
                      >
                        {job.source}
                        <ExternalLink size={7} />
                      </a>
                    )}
                    {job.certificationTags?.map((tag) => (
                      <span key={tag} style={{
                        backgroundColor: tag === 'TSEI' ? 'rgba(14, 165, 233, 0.15)' :
                                         tag === 'Magisterio_Infantil' ? 'rgba(99, 102, 241, 0.15)' :
                                         tag === 'Monitor_Ocio' ? 'rgba(234, 88, 12, 0.15)' :
                                         'rgba(168, 85, 247, 0.15)',
                        color: tag === 'TSEI' ? '#0284c7' :
                               tag === 'Magisterio_Infantil' ? '#4f46e5' :
                               tag === 'Monitor_Ocio' ? '#c2410c' :
                               '#7e22ce',
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '3px',
                        letterSpacing: '0.03em'
                      }}>
                        {tag === 'TSEI' ? 'FP TSEI' :
                         tag === 'Magisterio_Infantil' ? 'Grado Infantil' :
                         tag === 'Monitor_Ocio' ? 'Monitor Ocio' :
                         'Auxiliar'}
                      </span>
                    ))}
                  </div>
                  <span className="text-muted" style={{ fontSize: '0.75rem', marginTop: '2px', display: 'block' }}>
                    {job.companyType || 'Docente'}
                  </span>
                </div>
                <select
                  value={state.status}
                  onChange={(e) => onUpdateStatus(job.id, e.target.value as any)}
                  className={`badge badge-${state.status}`}
                  style={{ 
                    border: '1px solid currentColor',
                    background: 'transparent',
                    padding: '4px 20px 4px 8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.7rem',
                    appearance: 'none',
                    outline: 'none',
                    backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 6px center',
                    backgroundSize: '10px',
                    minWidth: '105px'
                  }}
                >
                  <option value="not_applied" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>Sin aplicar</option>
                  <option value="applied" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>Postulado</option>
                  <option value="interviewing" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>Entrevista</option>
                  <option value="offered" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>Ofrecido</option>
                  <option value="rejected" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>Rechazado</option>
                </select>
              </div>

              {/* Company Info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {job.companyLogo ? (
                  <img 
                    src={job.companyLogo} 
                    alt={job.companyName} 
                    style={{ width: '24px', height: '24px', borderRadius: '4px', objectFit: 'contain', backgroundColor: 'white', padding: '1px' }} 
                  />
                ) : (
                  <Building2 size={16} className="text-secondary" />
                )}
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  {job.companyName}
                </span>
              </div>

              {/* Meta details list */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                  <MapPin size={12} style={{ flexShrink: 0 }} />
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {job.location || 'Madrid'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                  <Clock size={12} style={{ flexShrink: 0 }} />
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{job.hours || 'N/D'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                  <Coins size={12} style={{ flexShrink: 0 }} />
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{job.salary || 'S/C'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                  <Calendar size={12} className="text-muted" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: '0.78rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {formatJobDate(job)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  onClick={() => onSelectJob(job)}
                  style={{
                    flex: 1,
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    padding: '8px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <Eye size={14} />
                  Ver Detalles
                </button>
                {state.status === 'not_applied' && (
                  <button
                    onClick={() => onUpdateStatus(job.id, 'applied')}
                    style={{
                      flex: 1,
                      background: 'var(--accent-primary-light)',
                      border: '1px solid var(--accent-primary)',
                      color: 'var(--accent-primary)',
                      padding: '8px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <CheckCircle size={14} />
                    Postularse
                  </button>
                )}
                
                {state.status === 'applied' && (
                  <>
                    <button
                      onClick={() => onUpdateStatus(job.id, 'interviewing')}
                      style={{
                        flex: 1,
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                        color: '#d97706',
                        padding: '8px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      <CalendarCheck size={14} />
                      Entrevista
                    </button>
                    <button
                      onClick={() => onUpdateStatus(job.id, 'rejected')}
                      style={{
                        flex: 1,
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: 'var(--accent-red)',
                        padding: '8px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      <XCircle size={14} />
                      Rechazar
                    </button>
                  </>
                )}

                {state.status === 'interviewing' && (
                  <>
                    <button
                      onClick={() => onUpdateStatus(job.id, 'offered')}
                      style={{
                        flex: 1,
                        background: 'rgba(139, 92, 246, 0.1)',
                        border: '1px solid rgba(139, 92, 246, 0.2)',
                        color: '#7c3aed',
                        padding: '8px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      <Award size={14} />
                      Ofrecido
                    </button>
                    <button
                      onClick={() => onUpdateStatus(job.id, 'rejected')}
                      style={{
                        flex: 1,
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: 'var(--accent-red)',
                        padding: '8px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      <XCircle size={14} />
                      Rechazar
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    ))}
  </div>

      {/* CSS injected directly for responsive hiding of mobile view */}
      <style dangerouslySetInnerHTML={{__html: `
        @media (min-width: 769px) {
          .hidden-mobile { display: block !important; }
          .visible-mobile { display: none !important; }
        }
        @media (max-width: 768px) {
          .hidden-mobile { display: none !important; }
          .visible-mobile { display: block !important; width: 100% !important; }
        }
      `}} />

    </div>
  );
};
