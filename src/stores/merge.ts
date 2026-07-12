import { create } from 'zustand';
import type { MergeRequest } from '@/db/repos/merge';

interface MergeState {
  request: MergeRequest | null;
  open: (request: MergeRequest) => void;
  close: () => void;
  setTargetEntity: (entityId: string) => void;
  setCanonicalName: (name: string) => void;
}

export const useMergeStore = create<MergeState>((set) => ({
  request: null,
  open: (request) =>
    set({
      request: {
        ...request,
        candidateIds: [...new Set(request.candidateIds ?? [])],
        sourceEntityIds: [...new Set(request.sourceEntityIds ?? [])],
        targetCandidateIds: [...new Set(request.targetCandidateIds ?? [])],
      },
    }),
  close: () => set({ request: null }),
  setTargetEntity: (entityId) =>
    set((state) => ({
      request: state.request
        ? { ...state.request, targetEntityId: entityId, targetCandidateIds: [] }
        : null,
    })),
  setCanonicalName: (name) =>
    set((state) => ({
      request: state.request ? { ...state.request, canonicalName: name } : null,
    })),
}));
