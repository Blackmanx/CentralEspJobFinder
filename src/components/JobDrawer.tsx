import React, { useState, useEffect } from 'react';
import { Job, ApplicationStatus, UserJobState } from '../types/job';
import { 
  X, 
  MapPin, 
  Clock, 
  Coins, 
  Calendar, 
  Building2, 
  Globe, 
  FileText, 
  CheckSquare, 
  StickyNote,
  ExternalLink,
  Save,
  Check,
  UploadCloud,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Configure Leaflet Default Icon using CDN resources to ensure Vite processes it correctly
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Helper function to parse basic markdown to styled HTML for CV analysis results
const parseMarkdownToHtml = (markdown: string): string => {
  let html = markdown;
  // Headers
  html = html.replace(/^### (.*$)/gim, '<h5 style="font-size:0.9rem;font-weight:600;margin-top:12px;margin-bottom:6px;color:var(--text-primary)">$1</h5>');
  html = html.replace(/^## (.*$)/gim, '<h4 style="font-size:1rem;font-weight:600;margin-top:16px;margin-bottom:8px;color:var(--text-primary);border-bottom:1px solid var(--border-color);padding-bottom:4px">$1</h4>');
  html = html.replace(/^# (.*$)/gim, '<h3 style="font-size:1.15rem;font-weight:700;margin-top:20px;margin-bottom:10px;color:var(--text-primary)">$1</h3>');
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--text-primary);font-weight:600">$1</strong>');
  // Lists
  html = html.replace(/^\s*-\s*(.*$)/gim, '<li style="margin-left:14px;margin-bottom:4px;list-style-type:disc">$1</li>');
  // Numbered lists
  html = html.replace(/^\s*\d+\.\s*(.*$)/gim, '<li style="margin-left:14px;margin-bottom:4px;list-style-type:decimal">$1</li>');
  // Line breaks
  html = html.replace(/\n/g, '<br />');
  return html;
};

interface JobDrawerProps {
  job: Job | null;
  onClose: () => void;
  userState: UserJobState;
  onUpdateState: (jobId: string, status: ApplicationStatus, notes: string) => void;
}

// Helper component to center Leaflet map on coordinate changes
const MapRecenter = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13);
  }, [center, map]);
  return null;
};

export const JobDrawer: React.FC<JobDrawerProps> = ({
  job,
  onClose,
  userState,
  onUpdateState
}) => {
  const [status, setStatus] = useState<ApplicationStatus>('not_applied');
  const [notes, setNotes] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [mapLoading, setMapLoading] = useState(false);

  // AI CV Optimizer state
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [annotatedCV, setAnnotatedCV] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [showCVModal, setShowCVModal] = useState(false);

  // AI Cover Letter Generator state
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [generatingLetter, setGeneratingLetter] = useState(false);
  const [letterError, setLetterError] = useState<string | null>(null);

  // Sync state with selected job
  useEffect(() => {
    if (job) {
      setStatus(userState.status);
      setNotes(userState.notes);
      setIsSaved(false);
      setCvFile(null);
      setSummary(null);
      setAnnotatedCV(null);
      setAnalysisError(null);
      setAnalyzing(false);
      setShowCVModal(false);
      setCoverLetter(null);
      setGeneratingLetter(false);
      setLetterError(null);

      // Fetch geocoding for Leaflet Map
      if (job.location) {
        setMapLoading(true);
        // Geocode municipality in Madrid, Spain
        const query = `${job.location}, Madrid, Espana`;
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`)
          .then(res => res.json())
          .then(data => {
            if (data && data.length > 0) {
              const lat = parseFloat(data[0].lat);
              const lon = parseFloat(data[0].lon);
              setCoords([lat, lon]);
            } else {
              // Fallback to Madrid center
              setCoords([40.416775, -3.703790]);
            }
            setMapLoading(false);
          })
          .catch(() => {
            // Fallback to Madrid center
            setCoords([40.416775, -3.703790]);
            setMapLoading(false);
          });
      } else {
        setCoords([40.416775, -3.703790]);
      }
    }
  }, [job, userState]);

  if (!job) return null;

  const handleSaveState = () => {
    onUpdateState(job.id, status, notes);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleStatusChange = (newStatus: ApplicationStatus) => {
    setStatus(newStatus);
    onUpdateState(job.id, newStatus, notes);
  };

  const handleAnalyzeCV = async () => {
    if (!cvFile || !job) return;
    setAnalyzing(true);
    setAnalysisError(null);
    setSummary(null);
    setAnnotatedCV(null);

    const formData = new FormData();
    formData.append('cv', cvFile);
    formData.append('jobTitle', job.title);
    formData.append('jobDescription', job.description || '');
    formData.append('jobRequirements', job.requirements ? job.requirements.join('\n') : '');

    try {
      const response = await fetch('http://localhost:3001/api/analyze-cv', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Error al comunicar con el servidor.');
      }

      const data = await response.json();
      setSummary(data.summary || null);
      setAnnotatedCV(data.annotatedCV || null);
    } catch (err: any) {
      console.error(err);
      setAnalysisError(err.message || 'No se pudo completar el análisis del CV.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateCoverLetter = async () => {
    if (!cvFile || !job) return;
    setGeneratingLetter(true);
    setLetterError(null);
    setCoverLetter(null);

    const formData = new FormData();
    formData.append('cv', cvFile);
    formData.append('jobTitle', job.title);
    formData.append('jobDescription', job.description || '');
    formData.append('jobRequirements', job.requirements ? job.requirements.join('\n') : '');

    try {
      const response = await fetch('http://localhost:3001/api/generate-cover-letter', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Error al comunicar con el servidor.');
      }

      const data = await response.json();
      setCoverLetter(data.coverLetter || null);
    } catch (err: any) {
      console.error(err);
      setLetterError(err.message || 'No se pudo generar la carta de presentación.');
    } finally {
      setGeneratingLetter(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="drawer-backdrop" 
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="drawer-container">
        {/* Header */}
        <div 
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>Detalles del Puesto</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Publicado: {job.publishDate || 'Fecha no disponible'}
            </span>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content (Scrollable) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          
          {/* Main Card */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            {job.companyLogo ? (
              <img 
                src={job.companyLogo} 
                alt={job.companyName} 
                style={{ width: '56px', height: '56px', borderRadius: '8px', objectFit: 'contain', backgroundColor: 'white', padding: '4px', border: '1px solid var(--border-color)' }} 
              />
            ) : (
              <div style={{ width: '56px', height: '56px', borderRadius: '8px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
                <Building2 size={24} className="text-secondary" />
              </div>
            )}
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{job.title}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{job.companyName}</span>
                {job.companyType && (
                  <span style={{ color: 'var(--text-muted)' }}>• {job.companyType}</span>
                )}
              </div>
              {job.companyWeb && (
                <a 
                  href={job.companyWeb} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--accent-blue)', textDecoration: 'none', marginTop: '4px' }}
                >
                  <Globe size={12} />
                  Sitio web del colegio
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>

          {/* Job Info Grid */}
          <div 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '16px', 
              padding: '16px', 
              backgroundColor: 'var(--bg-tertiary)', 
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              marginBottom: '24px' 
            }}
          >
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <MapPin size={18} className="text-secondary" />
              <div>
                <span className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>Localizacion</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{job.location || 'Madrid'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <Clock size={18} className="text-secondary" />
              <div>
                <span className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>Jornada Laboral</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{job.hours || 'N/D'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <Coins size={18} className="text-secondary" />
              <div>
                <span className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>Salario</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{job.salary || 'Según convenio'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <Calendar size={18} className="text-secondary" />
              <div>
                <span className="text-muted" style={{ display: 'block', fontSize: '0.75rem' }}>Tipo Contrato</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{job.contract || 'Vacante'}</span>
              </div>
            </div>
          </div>

          {/* Application Status Tracker */}
          <div 
            style={{ 
              padding: '16px', 
              backgroundColor: 'rgba(255, 255, 255, 0.02)', 
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              marginBottom: '24px' 
            }}
          >
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', marginBottom: '12px', color: 'var(--text-primary)' }}>
              <CheckSquare size={16} className="text-secondary" />
              Seguimiento de la Candidatura
            </h4>
            
            {/* Status Buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {(['not_applied', 'applied', 'interviewing', 'offered', 'rejected'] as ApplicationStatus[]).map((s) => {
                const isActive = status === s;
                let bg = 'var(--bg-tertiary)';
                let color = 'var(--text-secondary)';
                let border = '1px solid var(--border-color)';
                
                if (isActive) {
                  if (s === 'applied') { bg = 'var(--accent-blue-light)'; color = 'var(--accent-blue)'; border = '1px solid var(--accent-blue)'; }
                  else if (s === 'interviewing') { bg = 'var(--accent-gold-light)'; color = 'var(--accent-gold)'; border = '1px solid var(--accent-gold)'; }
                  else if (s === 'offered') { bg = 'var(--accent-purple-light)'; color = 'var(--accent-purple)'; border = '1px solid var(--accent-purple)'; }
                  else if (s === 'rejected') { bg = 'var(--accent-red-light)'; color = 'var(--accent-red)'; border = '1px solid var(--accent-red)'; }
                  else { bg = 'rgba(255,255,255,0.1)'; color = 'var(--text-primary)'; border = '1px solid var(--text-primary)'; }
                }
                
                const labelMap: Record<ApplicationStatus, string> = {
                  not_applied: 'Sin aplicar',
                  applied: 'Postulado',
                  interviewing: 'Entrevista',
                  offered: 'Ofrecido',
                  rejected: 'Rechazado'
                };

                return (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    style={{
                      backgroundColor: bg,
                      color: color,
                      border: border,
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {labelMap[s]}
                  </button>
                );
              })}
            </div>

            {/* Notes Section */}
            <div>
              <label 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '4px', 
                  fontSize: '0.8rem', 
                  color: 'var(--text-secondary)',
                  marginBottom: '6px' 
                }}
              >
                <StickyNote size={14} />
                Notas personales
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Escribe notas sobre tu candidatura (ej: fecha de entrevista, requisitos que te faltan, persona de contacto...)"
                style={{
                  width: '100%',
                  height: '100px',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '10px',
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                  fontSize: '0.85rem',
                  resize: 'none',
                  outline: 'none'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  onClick={handleSaveState}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: isSaved ? 'var(--accent-primary-light)' : 'var(--bg-tertiary)',
                    border: '1px solid ' + (isSaved ? 'var(--accent-primary)' : 'var(--border-color)'),
                    color: isSaved ? 'var(--accent-primary)' : 'var(--text-primary)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isSaved ? (
                    <>
                      <Check size={12} />
                      Guardado
                    </>
                  ) : (
                    <>
                      <Save size={12} />
                      Guardar notas
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Map */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', marginBottom: '10px', color: 'var(--text-primary)' }}>
              <Globe size={16} className="text-secondary" />
              Ubicación Geográfica
            </h4>
            
            <div className="map-container">
              {mapLoading ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-tertiary)' }}>
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>Geocodificando ubicación...</span>
                </div>
              ) : coords ? (
                <MapContainer 
                  center={coords} 
                  zoom={13} 
                  scrollWheelZoom={false}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={coords}>
                    <Popup>
                      <h4>{job.companyName}</h4>
                      <p>{job.location || 'Madrid, España'}</p>
                    </Popup>
                  </Marker>
                  <MapRecenter center={coords} />
                </MapContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-tertiary)' }}>
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>No se pudo cargar el mapa.</span>
                </div>
              )}
            </div>
          </div>

          {/* Requirements List */}
          {job.requirements && job.requirements.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', marginBottom: '10px', color: 'var(--text-primary)' }}>
                <CheckSquare size={16} className="text-secondary" />
                Requisitos del puesto
              </h4>
              <ul style={{ paddingLeft: '20px', fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {job.requirements.map((req, index) => (
                  <li key={index} style={{ lineHeight: 1.4 }}>{req}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Description */}
          {job.description && (
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', marginBottom: '10px', color: 'var(--text-primary)' }}>
                <FileText size={16} className="text-secondary" />
                Descripción del Empleo
              </h4>
              <div 
                dangerouslySetInnerHTML={{ __html: job.description }} 
                style={{ 
                  fontSize: '0.875rem', 
                  color: 'var(--text-secondary)', 
                  lineHeight: 1.6,
                  wordBreak: 'break-word'
                }}
              />
            </div>
          )}

          {/* Original Offer Link */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '32px' }}>
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--accent-primary)',
                color: '#fff',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.9rem',
                textDecoration: 'none',
                boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-primary-hover)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-primary)'}
            >
              Ver Oferta Original en Colejobs
              <ExternalLink size={14} />
            </a>
          </div>

          {/* AI CV Optimizer Section */}
          <div style={{ 
            marginTop: '32px', 
            paddingTop: '24px', 
            borderTop: '1px solid var(--border-color)',
            marginBottom: '24px' 
          }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', marginBottom: '12px', color: 'var(--text-primary)' }}>
              <Sparkles size={16} className="text-secondary" style={{ color: 'var(--accent-primary)' }} />
              Optimizar CV con IA (gemini-3.1-flash-lite)
            </h4>
            <p className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '16px', lineHeight: 1.4 }}>
              Sube tu currículum (PDF o DOCX) para recibir un análisis y sugerencias de mejora "en vivo" adaptadas a los requisitos exactos de esta oferta.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ 
                border: '2px dashed var(--border-color)', 
                borderRadius: '6px', 
                padding: '16px', 
                textAlign: 'center',
                backgroundColor: 'var(--bg-app)',
                cursor: 'pointer',
                position: 'relative'
              }}>
                <input
                  type="file"
                  accept=".pdf,.docx"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setCvFile(e.target.files[0]);
                      setSummary(null);
                      setAnnotatedCV(null);
                      setAnalysisError(null);
                    }
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer'
                  }}
                />
                <UploadCloud size={24} className="text-muted" style={{ margin: '0 auto 8px' }} />
                <span style={{ fontSize: '0.8rem', display: 'block', color: cvFile ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {cvFile ? cvFile.name : 'Haz clic o arrastra un archivo PDF o DOCX'}
                </span>
              </div>

              {cvFile && (
                <button
                  className="btn-primary"
                  onClick={handleAnalyzeCV}
                  disabled={analyzing}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {analyzing ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" style={{ animation: 'spin 2s linear infinite' }} />
                      Analizando currículum...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Analizar currículum
                    </>
                  )}
                </button>
              )}

              {analysisError && (
                <div style={{ 
                  backgroundColor: 'var(--accent-red-light)', 
                  color: 'var(--accent-red)', 
                  padding: '10px 12px', 
                  borderRadius: '6px', 
                  fontSize: '0.8rem',
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                  lineHeight: 1.4
                }}>
                  {analysisError}
                </div>
              )}

              {summary && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                  <div style={{ 
                    backgroundColor: 'var(--bg-app)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '6px', 
                    padding: '16px',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5
                  }}>
                    <h5 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                      Análisis Completado
                    </h5>
                    <p style={{ marginBottom: '12px' }}>
                      Gemini ha revisado tu currículum frente a las necesidades de este colegio. Se han generado sugerencias de mejora directamente sobre el texto de tu currículum.
                    </p>
                    <button
                      className="btn-primary"
                      onClick={() => setShowCVModal(true)}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      <Sparkles size={14} />
                      Ver mejoras sobre el documento original
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Fullscreen CV Optimization Modal */}
      {showCVModal && annotatedCV && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            width: 'min(1100px, 95vw)',
            height: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-app)'
            }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Visualizador de Mejoras de CV
                </h3>
                <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                  {job.title} | {job.companyName}
                </span>
              </div>
              <button 
                onClick={() => setShowCVModal(false)}
                className="btn-secondary"
                style={{ padding: '6px 12px', minWidth: 'auto' }}
              >
                Cerrar
              </button>
            </div>

            {/* Modal Content Split */}
            <div style={{
              flex: 1,
              display: 'flex',
              overflow: 'hidden'
            }}>
              {/* Left Side: Summary / HR report & Cover Letter */}
              {summary && (
                <div style={{
                  width: '380px',
                  borderRight: '1px solid var(--border-color)',
                  padding: '24px',
                  overflowY: 'auto',
                  backgroundColor: 'var(--bg-app)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '24px'
                }}>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)', marginBottom: '12px' }}>
                      Informe de Ajuste
                    </h4>
                    <div 
                      className="text-secondary" 
                      style={{ fontSize: '0.8rem', lineHeight: 1.5 }}
                      dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(summary) }} 
                    />
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-primary)', marginBottom: '12px' }}>
                      Carta de Presentación AI
                    </h4>
                    {coverLetter ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <textarea
                          readOnly
                          value={coverLetter}
                          style={{
                            width: '100%',
                            height: '220px',
                            fontSize: '0.75rem',
                            padding: '8px',
                            backgroundColor: 'var(--bg-element)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            color: 'var(--text-primary)',
                            resize: 'none',
                            fontFamily: 'monospace',
                            lineHeight: 1.4
                          }}
                        />
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            navigator.clipboard.writeText(coverLetter);
                            alert('¡Carta de presentación copiada al portapapeles!');
                          }}
                          style={{ fontSize: '0.75rem', justifyContent: 'center' }}
                        >
                          Copiar al portapapeles
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                          Genera una carta formal adaptada al perfil del colegio usando tus datos anonimizados.
                        </p>
                        <button
                          className="btn-primary"
                          onClick={handleGenerateCoverLetter}
                          disabled={generatingLetter}
                          style={{ width: '100%', justifyContent: 'center', fontSize: '0.75rem' }}
                        >
                          {generatingLetter ? 'Generando...' : 'Generar Carta con AI'}
                        </button>
                        {letterError && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--accent-red)' }}>{letterError}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Right Side: Original CV with inline highlighted annotations */}
              <div style={{
                flex: 1,
                padding: '32px',
                overflowY: 'auto',
                backgroundColor: 'var(--bg-element)',
                display: 'flex',
                justifyContent: 'center'
              }}>
                <div style={{
                  backgroundColor: '#ffffff',
                  color: '#1e293b',
                  width: '100%',
                  maxWidth: '700px',
                  minHeight: '100%',
                  borderRadius: '4px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  padding: '40px',
                  fontFamily: 'Georgia, serif',
                  fontSize: '0.875rem',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                  position: 'relative'
                }}>
                  {/* Title of document sheet */}
                  <div style={{ 
                    borderBottom: '2px solid #e2e8f0', 
                    paddingBottom: '8px', 
                    marginBottom: '20px', 
                    fontSize: '0.75rem', 
                    color: '#64748b', 
                    fontFamily: 'var(--font-sans)',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <span>CURRICULUM VITAE ANALIZADO</span>
                    <span>Pasa el cursor por las zonas subrayadas</span>
                  </div>
                  
                  {/* Dynamic parsed nodes */}
                  <div style={{ color: '#334155' }}>
                    {(() => {
                      const parser = new DOMParser();
                      const doc = parser.parseFromString(`<div>${annotatedCV}</div>`, 'text/html');
                      
                      const renderNodes = (node: Node): React.ReactNode => {
                        if (node.nodeType === Node.TEXT_NODE) {
                          return node.textContent;
                        }
                        if (node.nodeType === Node.ELEMENT_NODE) {
                          const el = node as HTMLElement;
                          if (el.tagName.toLowerCase() === 'annotation') {
                            const type = el.getAttribute('type') || 'improvement';
                            const comment = el.getAttribute('comment') || '';
                            return (
                              <span 
                                key={Math.random()}
                                className={`cv-annotation cv-annotation-${type}`}
                                style={{
                                  position: 'relative',
                                  cursor: 'help',
                                  borderRadius: '3px',
                                  padding: '2px 4px',
                                  margin: '0 2px'
                                }}
                              >
                                {Array.from(el.childNodes).map((child) => renderNodes(child))}
                                <span className="cv-annotation-tooltip">{comment}</span>
                              </span>
                            );
                          }
                          if (el.tagName.toLowerCase() === 'br') {
                            return <br />;
                          }
                          return (
                            <span key={Math.random()}>
                              {Array.from(el.childNodes).map((child) => renderNodes(child))}
                            </span>
                          );
                        }
                        return null;
                      };
                      
                      return renderNodes(doc.body.firstChild || doc.body);
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Styles for responsive drawer sizing */}
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 550px) {
          .drawer-container {
            width: 100vw !important;
            border-left: none !important;
          }
        }
      `}} />
    </>
  );
};
