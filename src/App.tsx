import { useState, useEffect } from 'react';
import { Job, ApplicationStatus, UserJobState, LocalStorageAppState } from './types/job';
import { JobTable } from './components/JobTable';
import { JobDrawer } from './components/JobDrawer';
import { isOfficialPublicJob, isUnedJob } from './jobCategories';
import { getJobFreshness } from './utils/jobFreshness';
import {
  AUTONOMOUS_COMMUNITIES,
  getAutonomousCommunity,
  getLocationFilterKey,
  getMunicipalityLabel
} from './locationGrouping';
import { 
  Search, 
  Briefcase, 
  RefreshCw, 
  CheckCircle,
  Clock,
  Sparkles,
  Sun,
  Moon,
  Bell,
  AlertCircle,
  Info,
  Minimize2,
  Maximize2,
  Mail,
  Filter,
  ChevronDown,
  ChevronUp,
  Send,
  X,
  Trash2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { saveClientCV, getClientCV, removeClientCV, clientCVToFile, ClientCV } from './utils/clientCVStorage';

const LOCAL_STORAGE_KEY = 'jobfinder_states';

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  
  // Toast notifications state
  const [toasts, setToasts] = useState<{ id: string; type: 'success' | 'error' | 'info'; message: string }[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };
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

  // Compact Mode State
  const [compact, setCompact] = useState<boolean>(() => {
    const saved = localStorage.getItem('jobfinder_compact');
    return saved === 'true';
  });

  // Apply compact mode to document element
  useEffect(() => {
    const root = document.documentElement;
    if (compact) {
      root.classList.add('compact');
    } else {
      root.classList.remove('compact');
    }
    localStorage.setItem('jobfinder_compact', String(compact));
  }, [compact]);

  // Selected Job for Drawer
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Scraping State
  const [scraping, setScraping] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState('');

  // Client CV Status (stored strictly inside the browser)
  const [clientCV, setClientCV] = useState<ClientCV | null>(null);
  
  // Background Auto-Scanning States
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [scanQueue, setScanQueue] = useState<string[]>([]);
  const [scanTotal, setScanTotal] = useState(0);
  const [scanCurrentIndex, setScanCurrentIndex] = useState(0);
  const [scanTimeRemaining, setScanTimeRemaining] = useState(0);

  const loadClientCV = async () => {
    try {
      const cv = await getClientCV();
      setClientCV(cv);
    } catch (err) {
      console.error('Error loading client CV:', err);
    }
  };

  const handleUploadClientCV = async (file: File) => {
    try {
      const saved = await saveClientCV(file);
      setClientCV(saved);
      showToast('Currículum guardado de forma privada en este navegador.', 'success');
    } catch (err) {
      console.error('Error saving CV locally:', err);
      showToast('Error al guardar el currículum en el navegador.', 'error');
    }
  };

  const handleRemoveClientCV = async () => {
    try {
      await removeClientCV();
      setClientCV(null);
      showToast('Currículum eliminado de este navegador.', 'info');
    } catch (err) {
      console.error('Error removing CV from storage:', err);
    }
  };

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

  const loadUserStates = () => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        setUserStates(JSON.parse(stored));
      } else {
        setUserStates({});
      }
    } catch (e) {
      console.error('Error loading states from localStorage:', e);
    }
  };

  const loadNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
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
      const res = await fetch('/api/scrape/status');
      if (res.ok) {
        const data = await res.json();
        if (data.isScraping) {
          setScraping(true);
          setScrapeProgress(data.progress || 'Actualizando...');
          loadJobsQuietly();
          setTimeout(checkScrapingStatus, 3000);
        } else {
          setScraping(false);
          setScrapeProgress('');
          loadJobs();
        }
      }
    } catch (err) {
      console.error('Error al comprobar estado del scraper:', err);
      setScraping(false);
      setScrapeProgress('');
    }
  };

  const triggerScrape = async () => {
    if (scraping) return;
    setScraping(true);
    try {
      const res = await fetch('/api/scrape', { method: 'POST' });
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

  const [sendingEmail, setSendingEmail] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [targetRecipientEmail, setTargetRecipientEmail] = useState('velsi12blackman@gmail.com');
  const [emailSendScope, setEmailSendScope] = useState<'current_view' | 'all'>('current_view');

  const triggerSendEmail = async (overrideEmail?: string) => {
    if (sendingEmail) return;
    const recipient = overrideEmail || targetRecipientEmail;
    
    if (!recipient || !recipient.includes('@')) {
      showToast('Por favor introduce una dirección de correo válida.', 'error');
      return;
    }

    setSendingEmail(true);
    try {
      const payload: { to: string; jobs?: Job[] } = { to: recipient };
      
      // If sending current filtered view, pass the filtered jobs
      if (emailSendScope === 'current_view') {
        payload.jobs = filteredJobs;
      }

      const res = await fetch('/api/notify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Correo enviado correctamente', 'success');
        setShowEmailModal(false);
      } else {
        showToast(data.error || 'Error al enviar correo', 'error');
      }
    } catch (err: any) {
      showToast('Error al enviar correo', 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedScope, setSelectedScope] = useState<'infantil' | 'monitor_ocio' | 'bolsas' | 'uned' | 'docente_otros' | 'apoyo_otros' | 'all'>('infantil');
  const [freshnessFilter, setFreshnessFilter] = useState<'all' | 'today' | 'recent'>('all');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

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
    loadClientCV();
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
          
          if (jobToScan && clientCV) {
            const formData = new FormData();
            const cvFile = clientCVToFile(clientCV);
            formData.append('cv', cvFile);
            formData.append('jobTitle', jobToScan.title);
            formData.append('jobDescription', jobToScan.description || '');
            formData.append('jobRequirements', jobToScan.requirements ? jobToScan.requirements.join('\n') : '');

            try {
              const res = await fetch('/api/analyze-cv', {
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
      showToast('El escáner automático de currículum ha completado todas las ofertas de Infantil.', 'success');
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isAutoScanning, scanQueue, scanTimeRemaining, jobs, clientCV, userStates]);

  const startAutoScan = () => {
    if (!clientCV) {
      showToast('Por favor, sube primero tu currículum en el panel lateral (se guarda solo en tu navegador).', 'info');
      return;
    }
    
    const infantilJobs = jobs.filter(isInfantilJob);
    const jobsToScan = infantilJobs.filter(j => !userStates[j.id]?.cvAnalysis);
    
    if (jobsToScan.length === 0) {
      showToast('Todas las ofertas de Educación Infantil ya han sido analizadas.', 'success');
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

  const getJobScope = (job: Job): 'infantil' | 'docente_otros' | 'apoyo_otros' => {
    if (isInfantilJob(job)) {
      return 'infantil';
    }
    
    const title = job.title.toLowerCase();
    const description = (job.description || '').toLowerCase();
    const requirements = job.requirements.map(r => r.toLowerCase()).join(' ');
    const text = `${title} ${description} ${requirements}`.toLowerCase();

    // Teaching keywords
    const teachingKeywords = [
      'maestro', 'maestra', 'profesor', 'profesora', 'docente', 'teacher', 
      'educador', 'educadora', 'tutor', 'tutora', 'enseñanza', 'clases de',
      'bilingual', 'bilingüe', 'secundaria', 'bachillerato', 'primaria', 'eso',
      'peco', 'colegio', 'escuela', 'clases', 'ingles', 'inglés', 'geografia', 'historia',
      'biologia', 'quimica', 'fisica', 'filosofia', 'economia', 'matematicas', 'aula'
    ];

    const isTeaching = teachingKeywords.some(kw => text.includes(kw));

    if (isTeaching) {
      return 'docente_otros';
    } else {
      return 'apoyo_otros';
    }
  };

  // Filter Logic
  // Advanced Fuzzy Search logic
  const fuzzyMatch = (text: string, query: string): boolean => {
    if (!query) return true;
    const cleanText = text.toLowerCase();
    const queryWords = query.toLowerCase().split(/[ \t,.-]+/).filter(Boolean);
    return queryWords.every(word => cleanText.includes(word));
  };

  const matchesSelectedLocation = (job: Job): boolean => {
    if (selectedLocation === 'all') return true;

    const selectedCommunity = selectedLocation.startsWith('community::')
      ? selectedLocation.slice('community::'.length)
      : null;

    return selectedCommunity !== null
      ? getAutonomousCommunity(job) === selectedCommunity
      : getLocationFilterKey(job) === selectedLocation;
  };

  // Filter Logic
  const filteredJobs = jobs.filter((job) => {
    // 1. Text Search (title, company, description, requirements) using Advanced Fuzzy Search
    const jobText = `${job.title} ${job.companyName} ${job.description || ''} ${job.requirements ? job.requirements.join(' ') : ''}`;
    const matchesSearch = fuzzyMatch(jobText, searchQuery);

    // 2. Location
    const matchesLocation = matchesSelectedLocation(job);

    // 3. School/Company Type
    const matchesType = selectedType === 'all' || 
      (selectedType === 'concertado' && job.companyType?.toLowerCase().includes('concertado')) ||
      (selectedType === 'privado' && job.companyType?.toLowerCase().includes('privado')) ||
      (selectedType === 'catolico' && job.companyType?.toLowerCase().includes('catolico'));

    // 4. Application Status
    const jobState = userStates[job.id] || { status: 'not_applied' };
    const matchesStatus = selectedStatus === 'all' || jobState.status === selectedStatus;

    // 5. Scope Filter
    let matchesScope = true;
    if (selectedScope === 'infantil') {
      matchesScope = isInfantilJob(job) || job.certificationTags?.includes('TSEI') === true;
    } else if (selectedScope === 'monitor_ocio') {
      matchesScope = job.certificationTags?.includes('Monitor_Ocio') === true || 
                     job.title.toLowerCase().includes('monitor') || 
                     job.title.toLowerCase().includes('comedor') ||
                     job.title.toLowerCase().includes('ocio') ||
                     job.title.toLowerCase().includes('ludoteca');
    } else if (selectedScope === 'bolsas') {
      matchesScope = isOfficialPublicJob(job) && !isUnedJob(job);
    } else if (selectedScope === 'uned') {
      matchesScope = isUnedJob(job) ||
                     job.companyName?.toLowerCase().includes('uned') === true ||
                     job.url.includes('uned.es');
    } else if (selectedScope === 'docente_otros') {
      matchesScope = getJobScope(job) === 'docente_otros' && !job.certificationTags?.includes('Monitor_Ocio') && !isOfficialPublicJob(job) && !isUnedJob(job);
    } else if (selectedScope === 'apoyo_otros') {
      matchesScope = getJobScope(job) === 'apoyo_otros' && !job.certificationTags?.includes('Monitor_Ocio') && !isOfficialPublicJob(job) && !isUnedJob(job);
    }

    // 6. Freshness Filter
    let matchesFreshness = true;
    if (freshnessFilter === 'today') {
      matchesFreshness = getJobFreshness(job).isToday;
    } else if (freshnessFilter === 'recent') {
      const f = getJobFreshness(job);
      matchesFreshness = f.isToday || f.isYesterday;
    }

    return matchesSearch && matchesLocation && matchesType && matchesStatus && matchesScope && matchesFreshness;
  }).sort((a, b) => {
    const timeA = new Date(a.scrapedAt || a.publishDate || a.dates || 0).getTime();
    const timeB = new Date(b.scrapedAt || b.publishDate || b.dates || 0).getTime();
    return timeB - timeA;
  });

  // Group municipalities by autonomous community while preserving precise filtering.
  const locationsByCommunity = new Map<string, Map<string, { label: string; count: number }>>();
  jobs.forEach((job) => {
    if (!job.location && !job.province) return;
    const community = getAutonomousCommunity(job);
    const locationKey = getLocationFilterKey(job);
    const municipalityKey = locationKey.split('::')[1];
    const communityLocations = locationsByCommunity.get(community) || new Map();
    const current = communityLocations.get(municipalityKey);
    communityLocations.set(municipalityKey, {
      label: current?.label || getMunicipalityLabel(job),
      count: (current?.count || 0) + 1
    });
    locationsByCommunity.set(community, communityLocations);
  });

  // Statistics Calculations
  const locationScopedJobs = jobs.filter(matchesSelectedLocation);
  const stats = {
    total: jobs.length,
    infantil: locationScopedJobs.filter(isInfantilJob).length,
    bolsas: locationScopedJobs.filter(j => isOfficialPublicJob(j) && !isUnedJob(j)).length,
    uned: locationScopedJobs.filter(j => isUnedJob(j) || j.companyName?.toLowerCase().includes('uned')).length,
    today: locationScopedJobs.filter(j => getJobFreshness(j).isToday).length,
    recent: locationScopedJobs.filter(j => {
      const f = getJobFreshness(j);
      return f.isToday || f.isYesterday;
    }).length,
    applied: Object.values(userStates).filter((s) => s.status === 'applied').length,
    interviewing: Object.values(userStates).filter((s) => s.status === 'interviewing').length,
    offered: Object.values(userStates).filter((s) => s.status === 'offered').length,
  };

  // Last update time
  const lastScrapedTime = jobs.length > 0 ? new Date(jobs[0].scrapedAt).toLocaleString('es-ES') : '';

  return (
    <>
      <div className="app-container">
      
      {/* Left Sidebar: Logo, Metadata and Filters */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.4rem' }}>🎒</span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
                JobCrawling
              </h2>
            </div>
            {/* Mobile Toggle Button */}
            <button
              onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
              className="mobile-filter-toggle"
              aria-label="Abrir filtros"
            >
              <Filter size={15} />
              <span>{mobileFiltersOpen ? 'Ocultar Filtros' : 'Filtros'}</span>
              {mobileFiltersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
          <span className="sidebar-badge">
            España · Ofertas Infantiles
          </span>
          <p className="sidebar-desc">
            Portal nacional de empleo docente, educación infantil y convocatorias públicas.
          </p>
        </div>

        {/* Filters Form - Collapsible on Mobile */}
        <div className={`sidebar-collapsible ${mobileFiltersOpen ? 'is-open' : ''}`}>
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
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Comunidad y población</label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
            >
              <option value="all">Todas las comunidades y poblaciones</option>
              {AUTONOMOUS_COMMUNITIES.map((community) => {
                const locations = locationsByCommunity.get(community);
                if (!locations) return null;
                const communityCount = Array.from(locations.values()).reduce((sum, item) => sum + item.count, 0);
                return (
                  <optgroup key={community} label={`${community} (${communityCount})`}>
                    <option value={`community::${community}`}>
                      Toda la comunidad ({communityCount})
                    </option>
                    {Array.from(locations.entries())
                      .sort(([, a], [, b]) => a.label.localeCompare(b.label, 'es'))
                      .map(([municipalityKey, item]) => {
                        const value = `${community}::${municipalityKey}`;
                        return (
                          <option key={value} value={value}>
                            {item.label} ({item.count})
                          </option>
                        );
                      })}
                  </optgroup>
                );
              })}
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

          {/* Scope Select Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Ámbito / Especialidad</label>
            <select
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value as any)}
            >
              <option value="infantil">🧸 Educación Infantil / TSEI (Defecto)</option>
              <option value="monitor_ocio">🎨 Monitores, Ocio y Comedor Infantil</option>
              <option value="bolsas">🏛️ Ofertas/Bolsas Oficiales (España)</option>
              <option value="uned">🎓 UNED BICI: Contratos de Investigación</option>
              <option value="docente_otros">📚 Otros Puestos Docentes (Primaria, Secundaria...)</option>
              <option value="apoyo_otros">🏢 Apoyo / Administración (Limpieza, Conserjería...)</option>
              <option value="all">🌐 Todos los Ámbitos</option>
            </select>
          </div>

          {/* Freshness Select Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Antigüedad / Novedad</label>
            <select
              value={freshnessFilter}
              onChange={(e) => setFreshnessFilter(e.target.value as any)}
            >
              <option value="all">Todas las ofertas ({locationScopedJobs.length})</option>
              <option value="today">🟢 Nuevas de hoy ({stats.today})</option>
              <option value="recent">🔵 Últimas 48h ({stats.recent})</option>
            </select>
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
              Currículum
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
                    handleUploadClientCV(e.target.files[0]);
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
              <span style={{ fontSize: '0.75rem', color: clientCV ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {clientCV ? `CV: ${clientCV.name}` : 'Subir currículum (Privado)'}
              </span>
              {clientCV && (
                <span style={{ display: 'block', fontSize: '0.65rem', color: '#10b981', marginTop: '2px' }}>
                  🔒 Solo en este navegador
                </span>
              )}
            </div>

            {clientCV && (
              <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                <button
                  onClick={startAutoScan}
                  disabled={isAutoScanning}
                  className="btn-primary"
                  style={{ flex: 1, justifyContent: 'center', fontSize: '0.75rem', padding: '8px' }}
                >
                  <Sparkles size={12} />
                  {isAutoScanning ? 'Escaneando...' : 'Auto-analizar Infantil'}
                </button>
                <button
                  onClick={handleRemoveClientCV}
                  className="btn-secondary"
                  title="Eliminar CV de este navegador"
                  style={{ padding: '8px', color: 'var(--danger, #ef4444)' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
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
          <button 
            className="btn-secondary"
            onClick={() => setShowEmailModal(true)}
            disabled={sendingEmail || scraping}
            style={{ width: '100%', justifyContent: 'center' }}
            title="Enviar resumen de ofertas al correo seleccionado"
          >
            <Mail size={12} />
            {sendingEmail ? 'Enviando correo...' : 'Enviar resumen por correo'}
          </button>
          {scraping && scrapeProgress && (
            <div style={{
              fontSize: '0.7rem',
              color: 'var(--accent-primary)',
              marginTop: '4px',
              fontStyle: 'italic',
              textAlign: 'center',
              lineHeight: 1.3,
              wordBreak: 'break-word'
            }}>
              {scrapeProgress}
            </div>
          )}
        </div>
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

            {/* Quick Actions: Actualizar y Enviar Correo */}
            <button
              onClick={triggerScrape}
              disabled={scraping}
              className="btn-secondary header-action-btn"
              title="Actualizar ofertas desde los portales oficiales"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', padding: '6px 12px' }}
            >
              <RefreshCw size={13} style={scraping ? { animation: 'spin 2s linear infinite' } : undefined} />
              <span className="hide-on-very-small">{scraping ? 'Actualizando...' : 'Actualizar'}</span>
            </button>

            <button
              onClick={() => setShowEmailModal(true)}
              disabled={sendingEmail || scraping}
              className="btn-primary header-action-btn"
              title="Enviar resumen de ofertas al correo que elijas"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', padding: '6px 12px' }}
            >
              <Mail size={13} />
              <span className="hide-on-very-small">{sendingEmail ? 'Enviando...' : 'Enviar por Email'}</span>
            </button>

            {/* Compact Mode Switcher */}
            <button 
              onClick={() => setCompact(!compact)}
              className="btn-secondary hidden-mobile"
              style={{ padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 'auto' }}
              title={compact ? 'Desactivar modo compacto' : 'Activar modo compacto'}
            >
              {compact ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
            </button>

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
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--border-color)', 
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', gap: '24px' }}>
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

              {/* Fast Scope Filter Chips */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', paddingBottom: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setSelectedScope('infantil')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '0.72rem',
                    fontWeight: selectedScope === 'infantil' ? 700 : 500,
                    border: '1px solid',
                    borderColor: selectedScope === 'infantil' ? '#0284c7' : 'var(--border-color)',
                    backgroundColor: selectedScope === 'infantil' ? 'rgba(14, 165, 233, 0.12)' : 'var(--bg-element)',
                    color: selectedScope === 'infantil' ? '#0284c7' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  🧸 Técnico Infantil (TSEI / 0-3)
                </button>
                <button
                  onClick={() => setSelectedScope('monitor_ocio')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '0.72rem',
                    fontWeight: selectedScope === 'monitor_ocio' ? 700 : 500,
                    border: '1px solid',
                    borderColor: selectedScope === 'monitor_ocio' ? '#ea580c' : 'var(--border-color)',
                    backgroundColor: selectedScope === 'monitor_ocio' ? 'rgba(234, 88, 12, 0.12)' : 'var(--bg-element)',
                    color: selectedScope === 'monitor_ocio' ? '#c2410c' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  🎨 Monitores y Ocio Infantil
                </button>
                <button
                  onClick={() => setSelectedScope('bolsas')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '0.72rem',
                    fontWeight: selectedScope === 'bolsas' ? 700 : 500,
                    border: '1px solid',
                    borderColor: selectedScope === 'bolsas' ? '#059669' : 'var(--border-color)',
                    backgroundColor: selectedScope === 'bolsas' ? 'rgba(5, 150, 105, 0.15)' : 'var(--bg-element)',
                    color: selectedScope === 'bolsas' ? '#059669' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  🏛️ Bolsas Oficiales ({stats.bolsas})
                </button>
                <button
                  onClick={() => setSelectedScope('uned')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '0.72rem',
                    fontWeight: selectedScope === 'uned' ? 700 : 500,
                    border: '1px solid',
                    borderColor: selectedScope === 'uned' ? '#b45309' : 'var(--border-color)',
                    backgroundColor: selectedScope === 'uned' ? 'rgba(217, 119, 6, 0.15)' : 'var(--bg-element)',
                    color: selectedScope === 'uned' ? '#b45309' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  🎓 UNED BICI ({stats.uned})
                </button>
                <button
                  onClick={() => setSelectedScope('docente_otros')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '0.72rem',
                    fontWeight: selectedScope === 'docente_otros' ? 700 : 500,
                    border: '1px solid',
                    borderColor: selectedScope === 'docente_otros' ? 'var(--accent-primary)' : 'var(--border-color)',
                    backgroundColor: selectedScope === 'docente_otros' ? 'var(--accent-primary-light)' : 'var(--bg-element)',
                    color: selectedScope === 'docente_otros' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  📚 Otros Docentes
                </button>
                <button
                  onClick={() => setSelectedScope('all')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '0.72rem',
                    fontWeight: selectedScope === 'all' ? 700 : 500,
                    border: '1px solid',
                    borderColor: selectedScope === 'all' ? 'var(--text-primary)' : 'var(--border-color)',
                    backgroundColor: selectedScope === 'all' ? 'var(--bg-element)' : 'transparent',
                    color: selectedScope === 'all' ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Todos
                </button>
              </div>

              {/* Fast Freshness Filter Chips */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', paddingBottom: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: '2px' }}>
                  Novedad:
                </span>
                <button
                  onClick={() => setFreshnessFilter('all')}
                  style={{
                    padding: '3px 9px',
                    borderRadius: '16px',
                    fontSize: '0.7rem',
                    fontWeight: freshnessFilter === 'all' ? 700 : 500,
                    border: '1px solid',
                    borderColor: freshnessFilter === 'all' ? 'var(--text-primary)' : 'var(--border-color)',
                    backgroundColor: freshnessFilter === 'all' ? 'var(--bg-element)' : 'transparent',
                    color: freshnessFilter === 'all' ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Todas ({locationScopedJobs.length})
                </button>
                <button
                  onClick={() => setFreshnessFilter('today')}
                  style={{
                    padding: '3px 9px',
                    borderRadius: '16px',
                    fontSize: '0.7rem',
                    fontWeight: freshnessFilter === 'today' ? 700 : 500,
                    border: '1px solid',
                    borderColor: freshnessFilter === 'today' ? '#10b981' : 'var(--border-color)',
                    backgroundColor: freshnessFilter === 'today' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-element)',
                    color: freshnessFilter === 'today' ? '#10b981' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                  Nuevas hoy ({stats.today})
                </button>
                <button
                  onClick={() => setFreshnessFilter('recent')}
                  style={{
                    padding: '3px 9px',
                    borderRadius: '16px',
                    fontSize: '0.7rem',
                    fontWeight: freshnessFilter === 'recent' ? 700 : 500,
                    border: '1px solid',
                    borderColor: freshnessFilter === 'recent' ? '#3b82f6' : 'var(--border-color)',
                    backgroundColor: freshnessFilter === 'recent' ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-element)',
                    color: freshnessFilter === 'recent' ? '#3b82f6' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6' }} />
                  Últimas 48h ({stats.recent})
                </button>
              </div>
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
                  selectedScope={selectedScope}
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
    </div>

    {/* Centered Modal details popup */}
    {selectedJob && (
      <JobDrawer
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        userState={userStates[selectedJob.id] || { status: 'not_applied', notes: '', updatedAt: '' }}
        onUpdateState={handleUpdateJobState}
        showToast={showToast}
        clientCV={clientCV}
        onClientCVChange={setClientCV}
      />
    )}

    {/* Custom Email Dispatch Modal */}
    {showEmailModal && (
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}
        onClick={() => setShowEmailModal(false)}
      >
        <div 
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            width: 'min(480px, 95vw)',
            padding: '24px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={20} style={{ color: 'var(--accent-primary)' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Enviar Resumen por Correo
              </h3>
            </div>
            <button
              onClick={() => setShowEmailModal(false)}
              style={{
                background: 'var(--bg-element)',
                border: '1px solid var(--border-color)',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-secondary)'
              }}
            >
              <X size={15} />
            </button>
          </div>

          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
            Recibe un informe formateado con las ofertas, convenios colectivos aplicables y enlaces directos de postulación.
          </p>

          {/* Email Input */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              Dirección de correo destinatario
            </label>
            <input
              type="email"
              placeholder="tu_correo@ejemplo.com"
              value={targetRecipientEmail}
              onChange={(e) => setTargetRecipientEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.9rem',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-element)',
                color: 'var(--text-primary)'
              }}
            />
          </div>

          {/* Content Scope Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              ¿Qué ofertas deseas incluir?
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setEmailSendScope('current_view')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: emailSendScope === 'current_view' ? 700 : 500,
                  border: '1px solid',
                  borderColor: emailSendScope === 'current_view' ? 'var(--accent-primary)' : 'var(--border-color)',
                  backgroundColor: emailSendScope === 'current_view' ? 'var(--accent-primary-light)' : 'var(--bg-element)',
                  color: emailSendScope === 'current_view' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Filtro actual ({filteredJobs.length} ofertas)
              </button>
              <button
                type="button"
                onClick={() => setEmailSendScope('all')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: emailSendScope === 'all' ? 700 : 500,
                  border: '1px solid',
                  borderColor: emailSendScope === 'all' ? 'var(--accent-primary)' : 'var(--border-color)',
                  backgroundColor: emailSendScope === 'all' ? 'var(--accent-primary-light)' : 'var(--bg-element)',
                  color: emailSendScope === 'all' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Catálogo completo ({jobs.length} ofertas)
              </button>
            </div>
          </div>

          {/* Rate Limit Notice */}
          <div style={{
            backgroundColor: 'var(--bg-element)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            lineHeight: 1.4
          }}>
            ℹ️ Límite de envíos: máximo 2 veces cada 4 horas.
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
            <button
              type="button"
              onClick={() => setShowEmailModal(false)}
              className="btn-secondary"
              style={{ padding: '8px 16px', borderRadius: '8px' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => triggerSendEmail()}
              disabled={sendingEmail}
              className="btn-primary"
              style={{ padding: '8px 20px', borderRadius: '8px', gap: '8px' }}
            >
              {sendingEmail ? (
                <>
                  <RefreshCw size={14} style={{ animation: 'spin 2s linear infinite' }} />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Enviar Ahora</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Toast Notification Container */}
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          {toast.type === 'success' && <CheckCircle size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />}
          {toast.type === 'error' && <AlertCircle size={16} style={{ color: 'var(--accent-red)', flexShrink: 0 }} />}
          {toast.type === 'info' && <Info size={16} style={{ color: 'var(--accent-gold)', flexShrink: 0 }} />}
          <span>{toast.message}</span>
        </div>
      ))}
    </div>

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
  </>
);
}
