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

  // Global CV File state
  const [globalCVFile, setGlobalCVFile] = useState<File | null>(null);
  
  // Background Auto-Scanning States
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [scanQueue, setScanQueue] = useState<string[]>([]);
  const [scanTotal, setScanTotal] = useState(0);
  const [scanCurrentIndex, setScanCurrentIndex] = useState(0);
  const [scanTimeRemaining, setScanTimeRemaining] = useState(0);

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
  // Background scanner countdown and job execution
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    if (isAutoScanning && scanQueue.length > 0) {
      if (scanTimeRemaining > 0) {
        timer = setTimeout(() => {
          setScanTimeRemaining(prev => prev - 1);
        }, 1000);
      } else {
        const processNextJob = async () => {
          const nextJobId = scanQueue[0];
          const jobToScan = jobs.find(j => j.id === nextJobId);
          
          if (jobToScan && globalCVFile) {
            const formData = new FormData();
            formData.append('cv', globalCVFile);
            formData.append('jobTitle', jobToScan.title);
            formData.append('jobDescription', jobToScan.description || '');
            formData.append('jobRequirements', jobToScan.requirements ? jobToScan.requirements.join('\n') : '');

            try {
              const res = await fetch('http://localhost:3001/api/analyze-cv', {
                method: 'POST',
                body: formData
              });
              
              if (res.ok) {
                const data = await res.json();
                const currentState = userStates[nextJobId] || { status: 'not_applied', notes: '', updatedAt: '' };
                
                await handleUpdateJobState(nextJobId, currentState.status, currentState.notes, currentState.interviewDate, {
                  summary: data.summary,
                  annotatedCV: data.annotatedCV
                });
              } else {
                console.error(`Error al auto-analizar vacante ${nextJobId}:`, res.statusText);
              }
            } catch (err) {
              console.error(`Error al procesar auto-análisis para ${nextJobId}:`, err);
            }
          }
          
          setScanQueue(prev => prev.slice(1));
          setScanCurrentIndex(prev => prev + 1);
          setScanTimeRemaining(60);
        };
        
        processNextJob();
      }
    } else if (isAutoScanning && scanQueue.length === 0) {
      setIsAutoScanning(false);
      alert('¡El escáner automático de currículum ha completado todas las ofertas de Infantil!');
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isAutoScanning, scanQueue, scanTimeRemaining, jobs, globalCVFile, userStates]);

  const startAutoScan = () => {
    if (!globalCVFile) {
      alert('Por favor, sube primero tu currículum (PDF/DOCX) en el cargador global.');
      return;
    }
    
    const infantilJobs = jobs.filter(isInfantilJob);
    const jobsToScan = infantilJobs.filter(j => !userStates[j.id]?.cvAnalysis);
    
    if (jobsToScan.length === 0) {
      alert('Todas las ofertas de Educación Infantil ya han sido analizadas.');
      return;
    }
    
    const confirmScan = window.confirm(
      `Se iniciará un análisis en segundo plano de ${jobsToScan.length} ofertas de Educación Infantil.\n` +
      `Se aplicará una espera de 60 segundos por cada vacante para respetar los límites de la API de Gemini.\n\n` +
      `¿Deseas continuar?`
    );
    
    if (!confirmScan) return;
    
    setScanQueue(jobsToScan.map(j => j.id));
    setScanTotal(jobsToScan.length);
    setScanCurrentIndex(0);
    setScanTimeRemaining(0);
    setIsAutoScanning(true);
  };
  // Update Application Status & Notes with database sync
  const handleUpdateJobState = async (jobId: string, status: ApplicationStatus, notes: string = '', interviewDate?: string, cvAnalysis?: { summary: string; annotatedCV: string; }) => {
    const existing = userStates[jobId];
    const newState: UserJobState = {
      status,
      notes,
      updatedAt: new Date().toISOString(),
      interviewDate,
      cvAnalysis: cvAnalysis || existing?.cvAnalysis
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
    const currentState = userStates[jobId] || { status: 'not_applied', notes: '', updatedAt: '', interviewDate: undefined };
    handleUpdateJobState(jobId, status, currentState.notes, currentState.interviewDate);
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

          {/* Global CV Upload and Auto-Scan Section */}
          <div style={{
            marginTop: '20px',
            padding: '16px',
            backgroundColor: 'var(--bg-element)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Currículum Global (Auto-análisis)
            </h4>
            
            <div style={{
              border: '2px dashed var(--border-color)',
              borderRadius: '6px',
              padding: '12px',
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
                    setGlobalCVFile(e.target.files[0]);
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
              <span style={{ fontSize: '0.75rem', color: globalCVFile ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {globalCVFile ? globalCVFile.name : 'Subir CV (PDF/DOCX)'}
              </span>
            </div>

            {globalCVFile && (
              <button
                onClick={startAutoScan}
                disabled={isAutoScanning}
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', fontSize: '0.75rem', padding: '8px' }}
              >
                <Sparkles size={12} />
                {isAutoScanning ? 'Escaneando...' : 'Auto-analizar Infantil'}
              </button>
            )}

            {isAutoScanning && (
              <div style={{
                padding: '10px',
                backgroundColor: 'var(--bg-app)',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                fontSize: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                  <span>Progreso:</span>
                  <span>{scanCurrentIndex} / {scanTotal}</span>
                </div>
                <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${(scanCurrentIndex / scanTotal) * 100}%`,
                    height: '100%',
                    backgroundColor: 'var(--accent-primary)',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                {scanQueue.length > 0 && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Siguiente análisis en: <strong style={{ color: 'var(--accent-gold)' }}>{scanTimeRemaining}s</strong>
                  </div>
                )}
              </div>
            )}
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
        
        {/* Main Content Header */}
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-surface)'
        }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Tablero de Candidaturas
          </h2>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="btn-secondary"
                style={{ padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 'auto', position: 'relative' }}
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
                  top: '36px',
                  right: '0',
                  width: '320px',
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
                          transition: 'background-color 0.2s',
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          if (n.message.includes('Colegio') || n.message.includes('vacante') || n.message.includes('oferta')) {
                            const matchedJob = jobs.find(j => 
                              (n.message.includes('Brains') && j.companyName.toLowerCase().includes('brains')) ||
                              (n.message.includes('Segovia') && (j.location || '').toLowerCase().includes('segovia')) ||
                              (n.message.includes('Ávila') && (j.location || '').toLowerCase().includes('avila')) ||
                              (n.message.includes('Madrid') && (j.location || '').toLowerCase().includes('madrid'))
                            );
                            if (matchedJob) {
                              setSelectedJob(matchedJob);
                            }
                          }
                          setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
                          setUnreadNotificationsCount(prev => Math.max(0, prev - (n.read ? 0 : 1)));
                          setShowNotifications(false);
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
              style={{ padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 'auto' }}
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </header>

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
                  const agendaJobs = jobs
                    .filter(j => {
                      const state = userStates[j.id];
                      return state && (state.status === 'applied' || state.status === 'interviewing' || state.status === 'offered');
                    })
                    .sort((a, b) => {
                      const stateA = userStates[a.id];
                      const stateB = userStates[b.id];
                      
                      // Interviewing status always takes priority in agenda sorting
                      if (stateA.status === 'interviewing' && stateB.status !== 'interviewing') return -1;
                      if (stateA.status !== 'interviewing' && stateB.status === 'interviewing') return 1;
                      
                      if (stateA.interviewDate && stateB.interviewDate) {
                        return new Date(stateA.interviewDate).getTime() - new Date(stateB.interviewDate).getTime();
                      }
                      if (stateA.interviewDate) return -1;
                      if (stateB.interviewDate) return 1;
                      
                      return new Date(stateB.updatedAt).getTime() - new Date(stateA.updatedAt).getTime();
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
                          
                          {/* Prominent Interview Date/Time display */}
                          {state.status === 'interviewing' && state.interviewDate && (
                            <div style={{
                              marginTop: '8px',
                              padding: '8px 12px',
                              backgroundColor: 'var(--accent-gold-light)',
                              color: 'var(--accent-gold)',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              fontWeight: 'bold',
                              border: '1px solid var(--accent-gold)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              width: 'fit-content'
                            }}>
                              <Clock size={12} />
                              Entrevista: {new Date(state.interviewDate).toLocaleDateString('es-ES', { 
                                weekday: 'long', 
                                day: 'numeric', 
                                month: 'long', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </div>
                          )}

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
        </div>

      </main>

      {/* Centered Modal details popup */}
      {selectedJob && (
        <JobDrawer
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          userState={userStates[selectedJob.id] || { status: 'not_applied', notes: '', updatedAt: '' }}
          onUpdateState={handleUpdateJobState}
        />
      )}

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
