import { create } from "zustand";

interface PresenceUser {
  userId: string;
  name: string;
  color: string;
  cursorPosition?: { from: number; to: number };
}

interface DocumentState {
  isOnline: boolean;
  activeUsers: PresenceUser[];
  setOnline: (online: boolean) => void;
  setActiveUsers: (users: PresenceUser[]) => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  isOnline: true,
  activeUsers: [],
  setOnline: (isOnline) => set({ isOnline }),
  setActiveUsers: (activeUsers) => set({ activeUsers }),
}));
