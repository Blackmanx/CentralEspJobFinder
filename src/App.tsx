import { useState, useEffect } from 'react';
import { Job, ApplicationStatus, UserJobState, LocalStorageAppState } from './types/job';
import { JobTable } from './components/JobTable';
import { JobDrawer } from './components/JobDrawer';
import { 
  Search, 
  Briefcase, 
  RefreshCw, 
  Filter,
  CheckCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';

const LOCAL_STORAGE_KEY = 'jobfinder_states';

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [userStates, setUserStates] = useState<LocalStorageAppState>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected Job for Drawer
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isInfantilFilter, setIsInfantilFilter] = useState(true);

  // Fetch Jobs Data
  const loadJobs = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await fetch('/data/jobs.json');
      if (!response.ok) {
        throw new Error('El archivo jobs.json no existe o no se puede cargar.');
      }
      const data: Job[] = await response.json();
      setJobs(data);
    } catch (error) {
      console.warn('Fallo al cargar jobs.json, reintentando o usando mocks...', error);
      setErrorMsg('No se encontro el archivo de ofertas o aun se esta scrapeando. Intentando volver a cargar...');
      // Fallback: If scraping is still running, check back in 4 seconds
      setTimeout(loadJobs, 4000);
    } finally {
      setLoading(false);
    }
  };

  // Load jobs and localStorage on mount
  useEffect(() => {
    loadJobs();
    
    // Load LocalStorage
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        setUserStates(JSON.parse(stored));
      } catch (e) {
        console.error('Error parsing LocalStorage:', e);
      }
    }
  }, []);

  // Check if scraper is running in background by checking folder/file status
  useEffect(() => {
    const checkScrapingStatus = async () => {
      // Simple poll to see if jobs.json was updated
      try {
        const response = await fetch('/data/jobs.json');
        if (response.ok) {
          const data: Job[] = await response.json();
          if (data.length !== jobs.length) {
            setJobs(data);
            setErrorMsg(null);
          }
        }
      } catch (e) {
        // file doesn't exist yet
      }
    };
    
    const interval = setInterval(checkScrapingStatus, 5000);
    return () => clearInterval(interval);
  }, [jobs.length]);

  // Update Application Status & Notes
  const handleUpdateJobState = (jobId: string, status: ApplicationStatus, notes: string = '') => {
    const newState: UserJobState = {
      status,
      notes,
      updatedAt: new Date().toISOString()
    };

    const updatedStates = {
      ...userStates,
      [jobId]: newState
    };

    setUserStates(updatedStates);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedStates));

    // Confetti triggers!
    if (status === 'applied' || status === 'offered') {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: status === 'offered' ? ['#8b5cf6', '#10b981', '#f59e0b'] : ['#10b981', '#3b82f6']
      });
    }

    // Keep drawer in sync
    if (selectedJob && selectedJob.id === jobId) {
      // No-op, react handles props update
    }
  };

  const handleUpdateStatusOnly = (jobId: string, status: ApplicationStatus) => {
    const currentState = userStates[jobId] || { status: 'not_applied', notes: '', updatedAt: '' };
    handleUpdateJobState(jobId, status, currentState.notes);
  };

  // Helper to determine if a job matches "Educación Infantil"
  const isInfantilJob = (job: Job): boolean => {
    const textToSearch = `${job.title} ${job.description || ''} ${job.requirements.join(' ')}`.toLowerCase();
    const keywords = [
      'infantil', 'maestra', 'maestro', 'guarderia', 'guardería', 'preescolar', 
      '0-3', '0-6', 'educador', 'educadora', 'párvulo', 'parvulo', 
      'auxiliar infantil', 'kids', 'preschool', 'nursery', 'early years', 'kindergarten'
    ];
    return keywords.some(keyword => textToSearch.includes(keyword));
  };

  // Filter Logic
  const filteredJobs = jobs.filter((job) => {
    // 1. Text Search (title, company, description)
    const matchesSearch = 
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.description && job.description.toLowerCase().includes(searchQuery.toLowerCase()));

    // 2. Location
    const matchesLocation = selectedLocation === 'all' || job.location === selectedLocation;

    // 3. School/Company Type
    const matchesType = selectedType === 'all' || 
      (selectedType === 'concertado' && job.companyType?.toLowerCase().includes('concertado')) ||
      (selectedType === 'privado' && job.companyType?.toLowerCase().includes('privado')) ||
      (selectedType === 'catolico' && job.companyType?.toLowerCase().includes('catolico'));

    // 4. Application Status
    const jobState = userStates[job.id] || { status: 'not_applied' };
    const matchesStatus = selectedStatus === 'all' || jobState.status === selectedStatus;

    // 5. Infantil Filter
    const matchesInfantil = !isInfantilFilter || isInfantilJob(job);

    return matchesSearch && matchesLocation && matchesType && matchesStatus && matchesInfantil;
  });

  // Extract unique locations for filter dropdown
  const uniqueLocations = Array.from(
    new Set(jobs.map((job) => job.location).filter(Boolean))
  ).sort() as string[];

  // Statistics Calculations
  const stats = {
    total: jobs.length,
    infantil: jobs.filter(isInfantilJob).length,
    applied: Object.values(userStates).filter((s) => s.status === 'applied').length,
    interviewing: Object.values(userStates).filter((s) => s.status === 'interviewing').length,
    offered: Object.values(userStates).filter((s) => s.status === 'offered').length,
  };

  // Last update time
  const lastScrapedTime = jobs.length > 0 ? new Date(jobs[0].scrapedAt).toLocaleString('es-ES') : '';

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header Panel */}
      <header className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              <span>👶</span> JobFinder <span style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--accent-primary-light)', border: '1px solid var(--accent-primary)' }}>Madrid & Alrededores</span>
            </h1>
            <p className="text-secondary" style={{ marginTop: '4px', fontSize: '0.9rem' }}>
              Bolsa de trabajo docente en Educacion Infantil, Colegios Privados y Concertados.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {lastScrapedTime && (
              <span>Ultimo scrapeo: <strong>{lastScrapedTime}</strong></span>
            )}
            <button 
              onClick={loadJobs}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600
              }}
              title="Recargar ofertas de empleo"
            >
              <RefreshCw size={12} />
              Actualizar
            </button>
          </div>
        </div>

        {/* Dashboard Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginTop: '8px' }}>
          <div className="glass-card" style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ backgroundColor: 'var(--bg-tertiary)', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Briefcase size={18} className="text-secondary" />
            </div>
            <div>
              <span className="text-muted" style={{ fontSize: '0.75rem', display: 'block' }}>Total Ofertas</span>
              <strong style={{ fontSize: '1.25rem' }}>{stats.total}</strong>
              <span className="text-muted" style={{ fontSize: '0.7rem', display: 'block' }}>{stats.infantil} Infantil</span>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ backgroundColor: 'var(--accent-blue-light)', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={18} style={{ color: 'var(--accent-blue)' }} />
            </div>
            <div>
              <span className="text-muted" style={{ fontSize: '0.75rem', display: 'block' }}>Postulados</span>
              <strong style={{ fontSize: '1.25rem', color: 'var(--accent-blue)' }}>{stats.applied}</strong>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ backgroundColor: 'var(--accent-gold-light)', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={18} style={{ color: 'var(--accent-gold)' }} />
            </div>
            <div>
              <span className="text-muted" style={{ fontSize: '0.75rem', display: 'block' }}>Entrevistas</span>
              <strong style={{ fontSize: '1.25rem', color: 'var(--accent-gold)' }}>{stats.interviewing}</strong>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ backgroundColor: 'var(--accent-primary-light)', width: '38px', height: '38px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={18} style={{ color: 'var(--accent-primary)' }} />
            </div>
            <div>
              <span className="text-muted" style={{ fontSize: '0.75rem', display: 'block' }}>Ofrecidos</span>
              <strong style={{ fontSize: '1.25rem', color: 'var(--accent-primary)' }}>{stats.offered}</strong>
            </div>
          </div>
        </div>
      </header>

      {/* Filter and Control Panel */}
      <section className="glass-panel" style={{ padding: '20px 24px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '16px' }}>
          <Filter size={16} className="text-secondary" />
          Filtros de Busqueda
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'flex-end' }}>
          {/* Text Search */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Palabra Clave</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Ej: Maestra, Ingles, Colegio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '8px 10px 8px 32px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Location Dropdown */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Poblacion / Municipio</label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '8px 10px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            >
              <option value="all">Todas las poblaciones ({uniqueLocations.length})</option>
              {uniqueLocations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Center Type Dropdown */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Tipo de Centro</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '8px 10px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            >
              <option value="all">Todos los centros</option>
              <option value="concertado">Colegios Concertados</option>
              <option value="privado">Colegios Privados</option>
              <option value="catolico">Colegios Catolicos</option>
            </select>
          </div>

          {/* Application Status Dropdown */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Estado Candidatura</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '8px 10px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            >
              <option value="all">Todos los estados</option>
              <option value="not_applied">Sin aplicar</option>
              <option value="applied">Postulado</option>
              <option value="interviewing">En Entrevista</option>
              <option value="offered">Ofrecido / Aceptado</option>
              <option value="rejected">Rechazado</option>
            </select>
          </div>
        </div>

        {/* Toggle Infantil Filter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="switch">
              <input
                type="checkbox"
                checked={isInfantilFilter}
                onChange={(e) => setIsInfantilFilter(e.target.checked)}
              />
              <span className="slider"></span>
            </label>
            <div>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
                Solo Educacion Infantil
              </span>
              <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                Filtra por maestras, educadoras, preescolar y tecnicos infantiles.
              </span>
            </div>
          </div>
          
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Mostrando <strong>{filteredJobs.length}</strong> de <strong>{jobs.length}</strong> vacantes
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      {loading ? (
        <div className="glass-panel text-center p-12 animate-fade-in" style={{ marginTop: '2rem', padding: '3rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <RefreshCw size={24} className="text-secondary" style={{ animation: 'spin 2s linear infinite' }} />
            <p className="text-secondary">Cargando base de datos de ofertas de empleo...</p>
            {errorMsg && <p className="text-muted" style={{ fontSize: '0.8rem', fontStyle: 'italic' }}>{errorMsg}</p>}
          </div>
        </div>
      ) : (
        <JobTable
          jobs={filteredJobs}
          userStates={userStates}
          onSelectJob={setSelectedJob}
          onUpdateStatus={handleUpdateStatusOnly}
          isInfantilFilter={isInfantilFilter}
        />
      )}

      {/* Detail Drawer Panel */}
      <JobDrawer
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        userState={selectedJob ? (userStates[selectedJob.id] || { status: 'not_applied', notes: '', updatedAt: '' }) : { status: 'not_applied', notes: '', updatedAt: '' }}
        onUpdateState={handleUpdateJobState}
      />

      {/* Custom spin animation inline CSS */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}} />

    </div>
  );
}
