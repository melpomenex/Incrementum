export interface Collection {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_COLLECTION_ID = '00000000-0000-0000-0000-000000000001';
