'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchVoteSummary, type VoteSummary } from '@/lib/game/fetchVoteSummary';

export interface UseVoteSummaryState extends VoteSummary {
  loading: boolean;
  error: string | null;
}

const EMPTY: UseVoteSummaryState = {
  counts: {},
  myVote: null,
  totalVoted: 0,
  round: 0,
  loading: false,
  error: null,
};

/**
 * Server-authoritative voting state.
 *
 * This hook deliberately never subscribes to games/{gameId}/votes.
 * The individual vote documents remain a server-only source of truth.
 */
export function useVoteSummary(gameId: string | null, enabled = true, intervalMs = 2500) {
  const [state, setState] = useState<UseVoteSummaryState>(EMPTY);
  const mounted = useRef(true);

  useEffect(() => () => {
    mounted.current = false;
  }, []);

  const refresh = useCallback(async () => {
    if (!gameId || !enabled) return;

    if (mounted.current) setState((current) => ({ ...current, loading: true, error: null }));

    try {
      const summary = await fetchVoteSummary(gameId);
      if (!mounted.current) return;
      setState({ ...summary, loading: false, error: null });
    } catch (error) {
      if (!mounted.current) return;
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : 'No se pudo consultar el estado de la votación.',
      }));
    }
  }, [gameId, enabled]);

  useEffect(() => {
    if (!gameId || !enabled) {
      setState(EMPTY);
      return;
    }

    void refresh();
    const timer = window.setInterval(() => void refresh(), intervalMs);
    return () => window.clearInterval(timer);
  }, [gameId, enabled, intervalMs, refresh]);

  return { ...state, refresh };
}
