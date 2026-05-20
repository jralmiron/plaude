export type Role = 'admin' | 'user';

export interface PermissionSet {
  manageUsers?: boolean;
  viewPasswords?: boolean;
  manageRoles?: boolean;
  deleteUsers?: boolean;
  exportPdfs?: boolean;
  editOwnConversations?: boolean;
  changeOwnPassword?: boolean;
}

export interface CurrentUser {
  id: number;
  username: string;
  displayName?: string | null;
  role: Role;
  canManageUsers?: boolean;
  permissions?: PermissionSet;
}

export interface MeResponse {
  authenticated: boolean;
  user?: CurrentUser;
  stats?: {
    conversations?: number;
    pdfs?: number;
    pendingChunks?: number;
    minutes?: number;
  };
}

export interface TranscriptionItem {
  id: number;
  language: string | null;
  outputLanguage: string | null;
  durationSeconds: number | null;
  formattedText: string;
  rawText: string;
  createdAt: string;
  ownerUsername?: string | null;
  ownerDisplayName?: string | null;
  hasStoredPdf?: boolean;
  pdfStoredAt?: string | null;
  chunkCount?: number | null;
}

export interface AdminUserItem {
  id: number;
  username: string;
  displayName?: string | null;
  role: Role;
  createdAt: string;
  permissions?: PermissionSet;
  conversationCount?: number;
  pdfCount?: number;
  lastActiveAt?: string | null;
  passwordManaged?: boolean;
}
