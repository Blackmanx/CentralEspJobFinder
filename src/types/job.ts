export interface Job {
  id: string;
  title: string;
  companyName: string;
  companyLogo?: string;
  companyType?: string;
  companyWeb?: string;
  companyDesc?: string;
  dates?: string;
  province?: string;
  location?: string;
  description?: string;
  requirements: string[];
  hours?: string;
  contract?: string;
  salary?: string;
  publishDate?: string;
  url: string;
  scrapedAt: string;
}

export type ApplicationStatus = 'not_applied' | 'applied' | 'interviewing' | 'offered' | 'rejected';

export interface UserJobState {
  status: ApplicationStatus;
  notes: string;
  updatedAt: string;
  interviewDate?: string;
  cvAnalysis?: {
    summary: string;
    annotatedCV: string;
  };
}

export interface LocalStorageAppState {
  [jobId: string]: UserJobState;
}
