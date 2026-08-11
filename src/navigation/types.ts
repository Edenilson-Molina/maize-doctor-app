import type { DiagnosisClass } from '@/content/diagnosis';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type ScanStackParamList = {
  ScanCamera: undefined;
  ScanResult: {
    imageUri: string;
    label: DiagnosisClass;
    confidence: number;
    distribution: Record<DiagnosisClass, number>;
    temperature: number | null;
    humidity: number | null;
    createdAt: number;
  };
};

export type AppTabParamList = {
  Home: undefined;
  Scan: undefined;
  History: undefined;
  Profile: undefined;
};
