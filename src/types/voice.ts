// Shared type definitions for voice training

export interface UploadedFile {
  filePath: string;
  gptPath?: string;
  localPath?: string;
  rawPath?: string;
}

export interface TrainingJob {
  id: string;
  userId: string;
  modelId: string;
  status: string;
  progress: number;
  currentStage: string;
  samples: string[];
  language: string;
  modelName: string;
  originalName: string;
  createdAt: string;
  error: string | null;
  gptJobId?: string;
  usingRealGPT?: boolean;
  completedAt?: string;
  modelPath?: string | null;
}

export interface VoiceModel {
  id: string;
  userId: string;
  name: string;
  displayName: string;
  gptName: string;
  status: string;
  language: string;
  sampleCount: number;
  createdAt: string;
  modelPath: string | null;
  isGPTModel: boolean;
  isLocalModel?: boolean;
  metadata?: {
    language: string;
    sampleCount: number;
    createdAt: string;
  };
}

// Global declarations
declare global {
  var uploadedFiles: Map<string, UploadedFile> | undefined;
  var voiceModelsGlobal: Map<string, VoiceModel> | undefined;
  var trainingJobsGlobal: Map<string, TrainingJob> | undefined;
}
