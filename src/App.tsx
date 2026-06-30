import { useState, useEffect } from 'react';
import { Job, ApplicationStatus, UserJobState, LocalStorageAppState } from './types/job';
import { JobTable } from './components/JobTable';
import { JobDrawer } from './components/JobDrawer';
import { 
  Search, 
  Briefcase, 
  RefreshCw, 
  CheckCircle,
  Clock,
  Sparkles,
  Sun,
  Moon
} from 'lucide-react';
import confetti from 'canvas-confetti';

const LOCAL_STORAGE_KEY = 'jobfinder_states';

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [userStates, setUserStates] = useState<LocalStorageAppState>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('jobfinder_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  // Apply theme to document element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
    localStorage.setItem('jobfinder_theme', theme);
  }, [theme]);

  // Selected Job for Drawer
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Scraping State
  const [scraping, setScraping] = useState(false);

  const loadJobsQuietly = async () => {
    try {
      const response = await fetch('/data/jobs.json');
      if (response.ok) {
        const data: Job[] = await response.json();
        setJobs(data);
      }
    } catch (error) {
      console.warn('Fallo al recargar silenciosamente:', error);
    }
  };

  const checkScrapingStatus = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/scrape/status');
      if (res.ok) {
        const data = await res.json();
        if (data.isScraping) {
          setScraping(true);
          loadJobsQuietly();
          setTimeout(checkScrapingStatus, 3000);
        } else {
          setScraping(false);
          loadJobs();
        }
      }
    } catch (err) {
      console.error('Error al comprobar estado del scraper:', err);
      setScraping(false);
    }
  };

  const triggerScrape = async () => {
    if (scraping) return;
    setScraping(true);
    try {
      const res = await fetch('http://localhost:3001/api/scrape', { method: 'POST' });
      if (res.ok) {
        setTimeout(checkScrapingStatus, 2000);
      } else {
        setScraping(false);
      }
    } catch (err) {
      console.error('Error al iniciar scraping:', err);
      setScraping(false);
    }
  };

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
    checkScrapingStatus();
    
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

  // Helper to determine if a job matches strictly "Educación Infantil"
  const isInfantilJob = (job: Job): boolean => {
    const title = job.title.toLowerCase();
    const description = (job.description || '').toLowerCase();
    const requirements = job.requirements.map(r => r.toLowerCase()).join(' ');
    const text = `${title} ${description} ${requirements}`.toLowerCase();

    // Exclude jobs requiring strict C2 English (allow if C1/B2 is offered as an alternative)
    if (/\b(c2|proficiency|cpe)\b/.test(text)) {
      const isAlternative = 
        /\b(c1|b2|cae)\b/.test(text) && 
        (text.includes('c1/c2') || 
         text.includes('c1-c2') || 
         text.includes('c1 o c2') || 
         text.includes('b2 y c1-c2') ||
         text.includes('c1–c2'));
      if (!isAlternative) {
        return false;
      }
    }

    // 1. Exclude titles that explicitly target older ages/subjects or other fields
    const negativeTitleKeywords = [
      'secundaria', 'eso', 'bachillerato', 'bach', 'bto', 'primaria', 'fp', 
      'ciclo formativo', 'judo', 'limpieza', 'mantenimiento', 'orientador', 
      'tecnico informatico', 'relaciones laborales', 'geografia', 'historia',
      'biologia', 'quimica', 'fisica', 'filosofia', 'economia', 'matematicas',
      'dibujo', 'plastica', 'musica primaria', 'secondary', 'primary', 'limpiador'
    ];
    
    if (negativeTitleKeywords.some(keyword => title.includes(keyword))) {
      return false;
    }

    // 2. Title has explicit early years indicators
    const positiveTitleKeywords = [
      'infantil', 'preescolar', 'guarderia', 'guardería', 'educador', 
      'educadora', '0-3', '3-6', '0-6', 'preschool', 'nursery', 
      'kindergarten', 'primer ciclo', 'segundo ciclo'
    ];

    const titleHasPositive = positiveTitleKeywords.some(keyword => title.includes(keyword));

    // 3. Description must strictly indicate an early years classroom/role (not just context)
    const strictDescKeywords = [
      'educacion infantil', 'educación infantil', 
      'maestro de infantil', 'maestro/a de infantil', 'maestra de infantil',
      'maestro infantil', 'maestra infantil',
      'educador infantil', 'educadora infantil', 'educador/a infantil',
      'tecnico infantil', 'técnico infantil',
      'auxiliar de infantil', 'auxiliar infantil',
      'aula de 2', 'aula de dos', 'primer ciclo', '0 a 3', '0-3', '3-6',
      'preschool teacher', 'nursery teacher', 'kindergarten teacher',
      'early years teacher'
    ];

    const descHasStrict = strictDescKeywords.some(keyword => description.includes(keyword) || requirements.includes(keyword));
    const isGenericTitle = title.includes('maestro') || title.includes('maestra') || title.includes('auxiliar') || title.includes('teacher') || title.includes('profesor') || title.includes('profesora') || title.includes('docente');
    
    if (titleHasPositive) {
      return true;
    }

    if (isGenericTitle && descHasStrict) {
      // Exclude if description mentions primary/secondary as the active duty
      const negativeDescKeywords = [
        'clases de primaria', 'impartir en primaria', 'etapa de primaria',
        'impartir en secundaria', 'clases de secundaria', 'etapa de secundaria'
      ];
      if (negativeDescKeywords.some(keyword => description.includes(keyword))) {
        return false;
      }
      return true;
    }

    return false;
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
    <div className="app-container">
      
      {/* Left Sidebar: Logo, Metadata and Filters */}
      <aside className="sidebar">
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>
              JobFinder
            </h2>
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="btn-secondary"
              style={{ padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 'auto' }}
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
          <span style={{ 
            color: 'var(--accent-primary)', 
            fontSize: '0.7rem', 
            fontWeight: 600, 
            padding: '2px 8px', 
            borderRadius: '4px', 
            backgroundColor: 'var(--accent-primary-light)', 
            border: '1px solid var(--accent-primary)',
            display: 'inline-block',
            marginTop: '6px'
          }}>
            Madrid y Alrededores
          </span>
          <p style={{ marginTop: '12px' }}>
            Gestión local de ofertas de empleo docente en centros privados y concertados.
          </p>
        </div>

        {/* Filters Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
          <h3 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
            Filtros
          </h3>

          {/* Text Search */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Palabra clave</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Ej: Maestra, Ingles, Colegio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '32px' }}
              />
            </div>
          </div>

          {/* Location Dropdown */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Población / Municipio</label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
            >
              <option value="all">Todas las poblaciones ({uniqueLocations.length})</option>
              {uniqueLocations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Center Type Dropdown */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Tipo de centro</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="all">Todos los centros</option>
              <option value="concertado">Colegios Concertados</option>
              <option value="privado">Colegios Privados</option>
              <option value="catolico">Colegios Católicos</option>
            </select>
          </div>

          {/* Application Status Dropdown */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Estado candidatura</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="not_applied">Sin aplicar</option>
              <option value="applied">Postulado</option>
              <option value="interviewing">En Entrevista</option>
              <option value="offered">Ofrecido / Aceptado</option>
              <option value="rejected">Rechazado</option>
            </select>
          </div>

          {/* Toggle Infantil Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px', padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <label className="switch">
              <input
                type="checkbox"
                checked={isInfantilFilter}
                onChange={(e) => setIsInfantilFilter(e.target.checked)}
              />
              <span className="slider"></span>
            </label>
            <div>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
                Solo Infantil
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', lineHeight: 1.2 }}>
                Filtra maestras, educadoras y auxiliares.
              </span>
            </div>
          </div>
        </div>

        {/* Sync Info / Trigger Scraper Info */}
        <div style={{ 
          fontSize: '0.75rem', 
          color: 'var(--text-muted)', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '8px', 
          borderTop: '1px solid var(--border-color)', 
          paddingTop: '16px', 
          marginTop: 'auto' 
        }}>
          {lastScrapedTime && (
            <span>Último scrapeo: <strong style={{ color: 'var(--text-secondary)' }}>{lastScrapedTime}</strong></span>
          )}
          <button 
            className="btn-secondary"
            onClick={triggerScrape}
            disabled={scraping}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <RefreshCw 
              size={12} 
              className={scraping ? 'animate-spin' : ''} 
              style={scraping ? { animation: 'spin 2s linear infinite' } : undefined} 
            />
            {scraping ? 'Actualizando...' : 'Actualizar ofertas'}
          </button>
        </div>
      </aside>

      {/* Right Main Panel */}
      <main className="main-content">
        
        {/* Statistics top bar */}
        <header className="stats-bar">
          <div className="stat-card">
            <div className="stat-card-icon" style={{ backgroundColor: 'var(--bg-element)' }}>
              <Briefcase size={16} className="text-secondary" />
            </div>
            <div>
              <span className="text-muted" style={{ fontSize: '0.7rem', display: 'block' }}>Total vacantes</span>
              <strong style={{ fontSize: '1.1rem' }}>{stats.total}</strong>
              <span className="text-muted" style={{ fontSize: '0.65rem', display: 'block' }}>{stats.infantil} de Infantil</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-icon" style={{ backgroundColor: 'var(--accent-blue-light)' }}>
              <CheckCircle size={16} style={{ color: 'var(--accent-blue)' }} />
            </div>
            <div>
              <span className="text-muted" style={{ fontSize: '0.7rem', display: 'block' }}>Postulados</span>
              <strong style={{ fontSize: '1.1rem', color: 'var(--accent-blue)' }}>{stats.applied}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-icon" style={{ backgroundColor: 'var(--accent-gold-light)' }}>
              <Clock size={16} style={{ color: 'var(--accent-gold)' }} />
            </div>
            <div>
              <span className="text-muted" style={{ fontSize: '0.7rem', display: 'block' }}>En entrevista</span>
              <strong style={{ fontSize: '1.1rem', color: 'var(--accent-gold)' }}>{stats.interviewing}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-icon" style={{ backgroundColor: 'var(--accent-primary-light)' }}>
              <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} />
            </div>
            <div>
              <span className="text-muted" style={{ fontSize: '0.7rem', display: 'block' }}>Ofrecidos</span>
              <strong style={{ fontSize: '1.1rem', color: 'var(--accent-primary)' }}>{stats.offered}</strong>
            </div>
          </div>
        </header>

        {/* Content Split: Left (List) & Right (Details) */}
        <div className="content-split">
          
          {/* Left Pane (Table) */}
          <div className="list-pane">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Listado de Ofertas</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Mostrando {filteredJobs.length} de {jobs.length} ofertas
              </span>
            </div>

            {loading ? (
              <div className="table-container" style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                <RefreshCw size={20} className="text-secondary" style={{ animation: 'spin 2s linear infinite' }} />
                <span className="text-muted">Cargando base de datos...</span>
                {errorMsg && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{errorMsg}</span>}
              </div>
            ) : (
              <JobTable
                jobs={filteredJobs}
                userStates={userStates}
                onSelectJob={setSelectedJob}
                onUpdateStatus={handleUpdateStatusOnly}
                isInfantilFilter={isInfantilFilter}
                selectedJobId={selectedJob?.id}
              />
            )}
          </div>

          {/* Right Pane (Embedded Job Details on desktop, overlay drawer on mobile) */}
          {selectedJob && (
            <div className="detail-pane animate-fade-in">
              <JobDrawer
                job={selectedJob}
                onClose={() => setSelectedJob(null)}
                userState={userStates[selectedJob.id] || { status: 'not_applied', notes: '', updatedAt: '' }}
                onUpdateState={handleUpdateJobState}
              />
            </div>
          )}

        </div>

      </main>

      {/* CSS definitions for spin animation */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}} />

    </div>
  );
}
