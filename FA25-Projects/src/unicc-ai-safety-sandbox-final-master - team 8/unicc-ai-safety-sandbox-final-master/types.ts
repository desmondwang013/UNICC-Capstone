export enum RiskTier {
  TIER_1 = 'Tier 1: Low Impact',
  TIER_2 = 'Tier 2: Moderate Impact',
  TIER_3 = 'Tier 3: High Impact',
  TIER_4 = 'Tier 4: Prohibited',
}

export enum ProjectStatus {
  DRAFT = 'Draft',
  TESTING = 'Testing',
  PENDING_REVIEW = 'Pending ASRB Review',
  APPROVED = 'Certified',
  REJECTED = 'Rejected',
  SUSPENDED = 'Suspended',
}

export enum UserRole {
  PROJECT_OWNER = 'Project Owner',
  ASRB_AUDITOR = 'ASRB Auditor',
}

export interface Project {
  id: string;
  name: string;
  description: string;
  owner: string;
  status: ProjectStatus;
  submittedAt: number;
  
  // Risk Profile
  domain: string;
  capabilities: string[];
  isHighAutonomy: boolean;
  riskTier: RiskTier | null;
  riskReasoning: string;

  // Technical
  connectionType?: 'API' | 'FILE';
  endpointUrl?: string;

  // Audit Results
  auditLogs: AuditLog[];
  testResults: TestResult[]; // New structured results
  safetyScore: number;
}

export interface ClassificationState {
  domain: string;
  capabilities: string[];
  isHighAutonomy: boolean;
  calculatedTier: RiskTier | null;
}

export enum AgentRole {
  AUDITOR = 'AUDITOR',
  TARGET = 'TARGET',
  JUDGE = 'JUDGE',
}

export interface AuditLog {
  id: string;
  role: AgentRole;
  content: string;
  timestamp: number;
  metadata?: {
    verdict?: 'PASS' | 'FAIL';
    score?: number;
    testId?: string;
  };
}

export type TestCategory = 'SUITE_A_CORE' | 'SUITE_B_ADVERSARIAL';

export interface TestProtocol {
  id: string;
  name: string;
  description: string;
  category: TestCategory;
  requiredForTiers: RiskTier[];
  active: boolean;
}

export interface TestResult {
  protocolId: string;
  status: 'PENDING' | 'RUNNING' | 'PASS' | 'FAIL';
  score: number; // 0-100
  logs: string[];
}

export const DOMAINS = {
  HIGH_RISK: [
    'Biometrics',
    'Critical Infrastructure',
    'Education',
    'Employment',
    'Essential Services',
    'Law Enforcement',
    'Migration/Border Control',
  ],
  LOW_RISK: [
    'Internal Admin',
    'Translation',
    'Document Search',
  ],
  PROHIBITED: [
    'Social Scoring',
    'Subliminal Manipulation',
    'Exploitation of Vulnerabilities'
  ]
};

export const CAPABILITIES = [
  'CCL-1: Harmful Manipulation',
  'CCL-2: Cyber Operations',
  'CCL-3: Autonomous Reasoning',
  'CCL-4: Weapons Acquisition',
];