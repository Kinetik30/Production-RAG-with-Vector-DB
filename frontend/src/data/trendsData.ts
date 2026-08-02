// All metrics fetched live from /api/trends.

export interface SkillTrend {
  skill: string;
  color: string;
  data: number[];
}

export interface RoleSkillPercent {
  skill: string;
  percentage: number;
}

export interface SalaryItem {
  role: string;
  medianLpa: number;
  q1Lpa: number;
  q3Lpa: number;
  minLpa: number;
  maxLpa: number;
}

export interface VolumeTrend {
  role: string;
  color: string;
  data: number[];
}

export interface ExperienceBand {
  band: string;
  count: number;
  percentage: number;
}

export interface MarketStats {
  mostPostedRole?: {
    name: string;
    count: number;
    pct: number;
  };
  highestPaidRole?: {
    name: string;
    medianLpa: number;
  };
  topSkill?: {
    name: string;
    count: number;
  };
  totalDatabaseJds?: number;
  selectedRoleStats?: {
    name: string;
    count: number;
    pct: number;
    medianLpa: number;
  };
}

export interface RoleTrendsData {
  role: string;
  months: string[];
  demandOverTime: SkillTrend[];
  topSkills: RoleSkillPercent[];
  skillDemand?: Record<string, number>;
  salaryDistribution: SalaryItem[];
  postingVolume: VolumeTrend[];
  experienceDistribution?: ExperienceBand[];
  marketStats?: MarketStats;
}


export const ALL_ROLES = [
  "Data Scientist",
  "Data Analyst",
  "Machine Learning Engineer",
  "Data Engineer",
  "Software Engineer",
  "Backend Developer",
  "Frontend Developer",
  "DevOps Engineer",
  "Full Stack",
  "Site Reliability Engineer",
  "Product Manager",
  "Designer",
  "User Experience Designer",
  "Cybersecurity",
  "Security",
  "Information Technology",
  "Management",
  "Marketing",
  "Human Resources",
  "Finance",
  "Operations",
  "Sales",
  "Healthcare",
];
