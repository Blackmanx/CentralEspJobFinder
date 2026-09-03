export interface ScrapedJob {
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
  /** True when the fallback location was extracted from the offer title. */
  locationFromTitle?: boolean;
  description?: string;
  requirements: string[];
  hours?: string;
  contract?: string;
  salary?: string;
  publishDate?: string;
  /** True for archived UNED BICI calls published over 30 days ago. */
  isOlderThanMonth?: boolean;
  url: string;
  scrapedAt: string;
  source?: string;
  certificationTags?: ('TSEI' | 'Magisterio_Infantil' | 'Monitor_Ocio' | 'Auxiliar_Infancia')[];
  convenioInfo?: {
    convenioName: string;
    applicableCategory?: string;
    referenceSalary?: string;
    stage?: '0-3_años' | '3-6_años' | 'Ocio_Comedor';
  };
}

export interface ScraperModule {
  name: string;
  scrape: () => Promise<ScrapedJob[]>;
}
