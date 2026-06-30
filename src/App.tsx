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
  Moon,
  Bell
} from 'lucide-react';
import confetti from 'canvas-confetti';

const LOCAL_STORAGE_KEY = 'jobfinder_states';

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [userStates, setUserStates] = useState<LocalStorageAppState>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active view tab (List or Agenda)
  const [activeTab, setActiveTab] = useState<'list' | 'agenda'>('list');

  // Notifications State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

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

  const loadUserStates = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/user-states');
      if (res.ok) {
        const data = await res.json();
        setUserStates(data);
      }
    } catch (e) {
      console.error('Error loading states from server:', e);
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        try {
          setUserStates(JSON.parse(stored));
        } catch (err) {
          console.error(err);
        }
      }
    }
  };

  const loadNotifications = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
        setUnreadNotificationsCount(data.filter((n: any) => !n.read).length);
      }
    } catch (e) {
      console.error('Error loading notifications:', e);
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

  // Load jobs and userStates/notifications on mount
  useEffect(() => {
    loadJobs();
    checkScrapingStatus();
    loadUserStates();
    loadNotifications();
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

  // Update Application Status & Notes with database sync
  const handleUpdateJobState = async (jobId: string, status: ApplicationStatus, notes: string = '') => {
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

    try {
      await fetch('http://localhost:3001/api/user-states', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedStates)
      });
    } catch (e) {
      console.error('Error saving states to server:', e);
    }

    // Confetti triggers!
    if (status === 'applied' || status === 'offered') {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: status === 'offered' ? ['#8b5cf6', '#10b981', '#f59e0b'] : ['#10b981', '#3b82f6']
      });
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
  // Advanced Fuzzy Search logic
  const fuzzyMatch = (text: string, query: string): boolean => {
    if (!query) return true;
    const cleanText = text.toLowerCase();
    const queryWords = query.toLowerCase().split(/[ \t,.-]+/).filter(Boolean);
    return queryWords.every(word => cleanText.includes(word));
  };

  // Filter Logic
  const filteredJobs = jobs.filter((job) => {
    // 1. Text Search (title, company, description, requirements) using Advanced Fuzzy Search
    const jobText = `${job.title} ${job.companyName} ${job.description || ''} ${job.requirements ? job.requirements.join(' ') : ''}`;
    const matchesSearch = fuzzyMatch(jobText, searchQuery);

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
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* Notification Bell */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="btn-secondary"
                  style={{ padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 'auto', position: 'relative' }}
                  title="Notificaciones"
                >
                  <Bell size={14} />
                  {unreadNotificationsCount > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '-2px',
                      right: '-2px',
                      backgroundColor: 'var(--accent-red)',
                      color: '#ffffff',
                      fontSize: '0.6rem',
                      fontWeight: 'bold',
                      borderRadius: '50%',
                      width: '12px',
                      height: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {unreadNotificationsCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div style={{
                    position: 'absolute',
                    top: '32px',
                    right: '0',
                    width: '280px',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 1000,
                    padding: '8px 0',
                    maxHeight: '300px',
                    overflowY: 'auto'
                  }}>
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-primary)' }}>Notificaciones</span>
                      <button 
                        onClick={() => {
                          setUnreadNotificationsCount(0);
                          setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                        }} 
                        style={{ fontSize: '0.65rem', color: 'var(--accent-primary)', border: 'none', background: 'none', cursor: 'pointer' }}
                      >
                        Marcar todo leído
                      </button>
                    </div>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '16px', fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                        No hay notificaciones
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          style={{
                            padding: '10px 12px',
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: n.read ? 'transparent' : 'rgba(59, 130, 246, 0.04)',
                            transition: 'background-color 0.2s'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-primary)' }}>{n.title}</span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.3 }}>{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Theme Switcher */}
              <button 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="btn-secondary"
                style={{ padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 'auto' }}
                title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              >
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            </div>
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
            {/* View Tabs Selector */}
            <div style={{ 
              display: 'flex', 
              borderBottom: '1px solid var(--border-color)', 
              marginBottom: '16px',
              gap: '24px'
            }}>
              <button
                onClick={() => setActiveTab('list')}
                style={{
                  padding: '8px 4px 12px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  border: 'none',
                  background: 'none',
                  color: activeTab === 'list' ? 'var(--accent-primary)' : 'var(--text-muted)',
                  borderBottom: activeTab === 'list' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'color 0.2s, border-bottom-color 0.2s'
                }}
              >
                Listado de Ofertas ({filteredJobs.length})
              </button>
              <button
                onClick={() => setActiveTab('agenda')}
                style={{
                  padding: '8px 4px 12px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  border: 'none',
                  background: 'none',
                  color: activeTab === 'agenda' ? 'var(--accent-primary)' : 'var(--text-muted)',
                  borderBottom: activeTab === 'agenda' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'color 0.2s, border-bottom-color 0.2s'
                }}
              >
                Agenda de Entrevistas
              </button>
            </div>

            {activeTab === 'list' ? (
              loading ? (
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
              )
            ) : (
              /* Agenda Timeline View */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(() => {
                  const agendaJobs = jobs.filter(j => {
                    const state = userStates[j.id];
                    return state && (state.status === 'applied' || state.status === 'interviewing' || state.status === 'offered');
                  });

                  if (agendaJobs.length === 0) {
                    return (
                      <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <Clock size={32} className="text-muted" style={{ margin: '0 auto 12px' }} />
                        <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '4px' }}>Agenda vacía</h4>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cambia el estado de una oferta a "Postulado" o "En Entrevista" para registrarla aquí.</p>
                      </div>
                    );
                  }

                  return agendaJobs.map(job => {
                    const state = userStates[job.id];
                    return (
                      <div 
                        key={job.id} 
                        onClick={() => setSelectedJob(job)}
                        style={{
                          padding: '16px',
                          backgroundColor: 'var(--bg-element)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          transition: 'transform 0.2s, box-shadow 0.2s',
                          borderLeft: state.status === 'interviewing' ? '4px solid var(--accent-gold)' : state.status === 'offered' ? '4px solid var(--accent-primary)' : '4px solid var(--accent-blue)'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            color: state.status === 'interviewing' ? 'var(--accent-gold)' : state.status === 'offered' ? 'var(--accent-primary)' : 'var(--accent-blue)'
                          }}>
                            {state.status === 'interviewing' ? 'Entrevista Programada' : state.status === 'offered' ? 'Oferta Recibida' : 'Postulado / En Espera'}
                          </span>
                          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{job.title}</h4>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{job.companyName} — {job.location}</span>
                          {state.notes && (
                            <p style={{
                              margin: '6px 0 0',
                              padding: '8px',
                              backgroundColor: 'var(--bg-app)',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              color: 'var(--text-secondary)',
                              borderLeft: '2px solid var(--border-color)',
                              lineHeight: 1.4
                            }}>
                              {state.notes}
                            </p>
                          )}
                        </div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                          Modificado: {new Date(state.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
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
