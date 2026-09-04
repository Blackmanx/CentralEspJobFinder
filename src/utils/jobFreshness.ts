import { Job } from '../types/job';

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

  // 1. TODAY (< 24h or same calendar day)
  if (isSameCalendarDay || diffHours < 24) {
    return {
      category: 'today',
      badgeLabel: 'Nueva Hoy',
      timeAgoLabel: 'Hoy',
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
      timeAgoLabel: 'Ayer',
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
      timeAgoLabel: `Hace ${diffDays}d`,
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

export interface JobDateGroup {
  key: string;
  title: string;
  subTitle?: string;
  isToday: boolean;
  isYesterday: boolean;
  color: string;
  bgColor: string;
  borderColor: string;
  jobs: Job[];
}

export function groupJobsByDate(jobs: Job[]): JobDateGroup[] {
  const groupsMap = new Map<string, JobDateGroup>();
  const now = new Date();

  jobs.forEach((job) => {
    const freshness = getJobFreshness(job);
    const dateStr = job.scrapedAt || job.publishDate || job.dates;
    
    let key: string;
    let title: string;
    let subTitle: string | undefined;

    if (freshness.isToday) {
      key = 'today';
      title = 'Hoy';
      subTitle = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    } else if (freshness.isYesterday) {
      key = 'yesterday';
      title = 'Ayer';
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      subTitle = y.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    } else if (freshness.category === 'recent' && dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        key = d.toISOString().slice(0, 10);
        const dayName = d.toLocaleDateString('es-ES', { weekday: 'long' });
        const dayFormatted = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
        title = dayName.charAt(0).toUpperCase() + dayName.slice(1);
        subTitle = dayFormatted;
      } else {
        key = 'recent';
        title = 'Esta semana';
      }
    } else {
      key = 'older';
      title = 'Ofertas anteriores (+1 semana)';
    }

    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        key,
        title,
        subTitle,
        isToday: freshness.isToday,
        isYesterday: freshness.isYesterday,
        color: freshness.color,
        bgColor: freshness.bgColor,
        borderColor: freshness.borderColor,
        jobs: []
      });
    }

    groupsMap.get(key)!.jobs.push(job);
  });

  return Array.from(groupsMap.values());
}

export function formatJobDate(job: { scrapedAt?: string; publishDate?: string; dates?: string }): string {
  if (job.publishDate && job.publishDate.trim()) {
    return job.publishDate;
  }
  const dateStr = job.scrapedAt || job.dates;
  if (dateStr) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  }
  return 'Sin fecha';
}
