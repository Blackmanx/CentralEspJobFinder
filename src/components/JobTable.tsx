import React from 'react';
import { Job, ApplicationStatus, UserJobState } from '../types/job';
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
  Award
} from 'lucide-react';

interface JobTableProps {
  jobs: Job[];
  userStates: { [jobId: string]: UserJobState };
  onSelectJob: (job: Job) => void;
  onUpdateStatus: (jobId: string, status: ApplicationStatus) => void;
  selectedScope: 'infantil' | 'docente_otros' | 'apoyo_otros' | 'all';
  selectedJobId?: string;
}

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
            {jobs.map((job) => {
            const state = userStates[job.id] || { status: 'not_applied', notes: '', updatedAt: '' };
            const isSelected = selectedJobId === job.id;
            
            return (
              <tr key={job.id} className={isSelected ? 'selected' : ''}>
                  {/* Job Title */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {job.title}
                      </span>
                      {(() => {
                        const diffTime = Math.abs(new Date().getTime() - new Date(job.scrapedAt).getTime());
                        const diffHours = diffTime / (1000 * 60 * 60);
                        if (diffHours <= 24) {
                          return (
                            <span style={{
                              backgroundColor: 'rgba(16, 185, 129, 0.12)',
                              color: '#10b981',
                              fontSize: '0.65rem',
                              fontWeight: 'bold',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}>
                              Nuevo
                            </span>
                          );
                        }
                        return null;
                      })()}
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
                  
                  {/* Publish Date */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                      <Calendar size={14} />
                      <span style={{ whiteSpace: 'nowrap' }}>{job.publishDate || 'Reciente'}</span>
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
          </tbody>
        </table>
      </div>

      {/* Mobile Card Grid (Hidden on desktop) */}
      <div className="visible-mobile card-grid">
        {jobs.map((job) => {
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
                    {(() => {
                      const diffTime = Math.abs(new Date().getTime() - new Date(job.scrapedAt).getTime());
                      const diffHours = diffTime / (1000 * 60 * 60);
                      if (diffHours <= 24) {
                        return (
                          <span style={{
                            backgroundColor: 'rgba(16, 185, 129, 0.12)',
                            color: '#10b981',
                            fontSize: '0.6rem',
                            fontWeight: 'bold',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>
                            Nuevo
                          </span>
                        );
                      }
                      return null;
                    })()}
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={12} />
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {job.location || 'Madrid'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} />
                  <span>{job.hours || 'N/D'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Coins size={12} />
                  <span>{job.salary || 'S/C'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} />
                  <span>{job.publishDate || 'Reciente'}</span>
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

      {/* CSS injected directly for responsive hiding of mobile view */}
      <style dangerouslySetInnerHTML={{__html: `
        @media (min-width: 769px) {
          .hidden-mobile { display: block !important; }
          .visible-mobile { display: none !important; }
        }
        @media (max-width: 768px) {
          .hidden-mobile { display: none !important; }
          .visible-mobile { display: block !important; }
        }
      `}} />

    </div>
  );
};
