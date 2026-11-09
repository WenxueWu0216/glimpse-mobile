import { create } from 'zustand';

interface NetworkState {
  isOnline: boolean;
  /** Likes/saves waiting in the offline queue. */
  pendingActions: number;
  setOnline: (isOnline: boolean) => void;
  setPendingActions: (count: number) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: true,
  pendingActions: 0,
  setOnline: (isOnline) => set({ isOnline }),
  setPendingActions: (pendingActions) => set({ pendingActions }),
}));
