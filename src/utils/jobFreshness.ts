export type FreshnessCategory = 'today' | 'yesterday' | 'recent' | 'older';

export interface JobFreshness {
  category: FreshnessCategory;
  badgeLabel: string;
  timeAgoLabel: string;
  daysAgo: number;
  hoursAgo: number;
  color: string;
  bgColor: string;
  borderColor: string;
  rowBorderColor?: string;
  isToday: boolean;
  isYesterday: boolean;
}

export function getJobFreshness(job: { scrapedAt?: string; publishDate?: string; isOlderThanMonth?: boolean }): JobFreshness {
  const now = new Date();
  const dateStr = job.scrapedAt;
  
  if (!dateStr) {
    return {
      category: 'older',
      badgeLabel: 'Sin fecha',
      timeAgoLabel: job.publishDate || 'Reciente',
      daysAgo: 999,
      hoursAgo: 999,
      color: '#94a3b8',
      bgColor: 'rgba(148, 163, 184, 0.12)',
      borderColor: 'rgba(148, 163, 184, 0.25)',
      isToday: false,
      isYesterday: false
    };
  }

  const scrapedDate = new Date(dateStr);
  const diffMs = Math.max(0, now.getTime() - scrapedDate.getTime());
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Compare calendar days in local time
  const isSameCalendarDay = 
    now.getFullYear() === scrapedDate.getFullYear() &&
    now.getMonth() === scrapedDate.getMonth() &&
    now.getDate() === scrapedDate.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterdayCalendar = 
    yesterday.getFullYear() === scrapedDate.getFullYear() &&
    yesterday.getMonth() === scrapedDate.getMonth() &&
    yesterday.getDate() === scrapedDate.getDate();

  const hoursStr = scrapedDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  // 1. TODAY (< 24h or same calendar day)
  if (isSameCalendarDay || diffHours < 24) {
    return {
      category: 'today',
      badgeLabel: 'Nueva Hoy',
      timeAgoLabel: diffHours < 1 ? 'Hace unos minutos' : `Hoy (${hoursStr})`,
      daysAgo: 0,
      hoursAgo: diffHours,
      color: '#10b981',
      bgColor: 'rgba(16, 185, 129, 0.15)',
      borderColor: 'rgba(16, 185, 129, 0.35)',
      rowBorderColor: '#10b981',
      isToday: true,
      isYesterday: false
    };
  }

  // 2. YESTERDAY (24h - 48h or previous calendar day)
  if (isYesterdayCalendar || (diffHours >= 24 && diffHours < 48)) {
    return {
      category: 'yesterday',
      badgeLabel: 'Ayer',
      timeAgoLabel: `Ayer (${hoursStr})`,
      daysAgo: 1,
      hoursAgo: diffHours,
      color: '#3b82f6',
      bgColor: 'rgba(59, 130, 246, 0.15)',
      borderColor: 'rgba(59, 130, 246, 0.3)',
      rowBorderColor: '#3b82f6',
      isToday: false,
      isYesterday: true
    };
  }

  // 3. RECENT (2 to 7 days)
  if (diffDays <= 7) {
    return {
      category: 'recent',
      badgeLabel: `Hace ${diffDays}d`,
      timeAgoLabel: `Hace ${diffDays} días`,
      daysAgo: diffDays,
      hoursAgo: diffHours,
      color: '#d97706',
      bgColor: 'rgba(217, 119, 6, 0.12)',
      borderColor: 'rgba(217, 119, 6, 0.25)',
      rowBorderColor: 'transparent',
      isToday: false,
      isYesterday: false
    };
  }

  // 4. OLDER (+1 week or +1 month)
  const isOldMonth = job.isOlderThanMonth || diffDays > 30;
  return {
    category: 'older',
    badgeLabel: isOldMonth ? '+1 mes' : '+1 sem',
    timeAgoLabel: scrapedDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
    daysAgo: diffDays,
    hoursAgo: diffHours,
    color: '#94a3b8',
    bgColor: 'rgba(148, 163, 184, 0.12)',
    borderColor: 'rgba(148, 163, 184, 0.2)',
    rowBorderColor: 'transparent',
    isToday: false,
    isYesterday: false
  };
}
