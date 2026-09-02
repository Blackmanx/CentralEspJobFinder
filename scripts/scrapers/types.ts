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
  description?: string;
  requirements: string[];
  hours?: string;
  contract?: string;
  salary?: string;
  publishDate?: string;
  url: string;
  scrapedAt: string;
  source?: string;
}

export interface ScraperModule {
  name: string;
  scrape: () => Promise<ScrapedJob[]>;
}
