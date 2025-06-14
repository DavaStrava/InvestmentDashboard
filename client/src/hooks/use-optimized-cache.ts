import { useQueryClient, QueryKey } from '@tanstack/react-query';
import { useCallback } from 'react';

interface CacheConfig {
  staleTime: number;
  gcTime: number;
  refetchOnWindowFocus: boolean;
  refetchOnMount: boolean;
}

// Optimized cache configurations for different data types
export const CACHE_CONFIGS = {
  // Real-time data - frequently updated
  QUOTES: {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  },
  
  // Prediction data - moderately updated
  PREDICTIONS: {
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  },
  
  // Static-ish data - rarely updated
  WATCHLIST: {
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  },
  
  // Market indices - updated throughout trading day
  INDICES: {
    staleTime: 45 * 1000, // 45 seconds
    gcTime: 3 * 60 * 1000, // 3 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  },
  
  // Portfolio data - updated when holdings change
  PORTFOLIO: {
    staleTime: 90 * 1000, // 90 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  },
} as const;

export function useOptimizedCache() {
  const queryClient = useQueryClient();

  // Intelligent cache invalidation based on data relationships
  const invalidateRelatedQueries = useCallback((baseKey: string, symbol?: string) => {
    const invalidationPatterns: Record<string, QueryKey[]> = {
      predictions: [
        ['/api/predictions'],
        ['/api/predictions/accuracy'],
        ['/api/predictions/accuracy/enhanced'],
        ...(symbol ? [['/api/stocks', symbol, 'prediction/today']] : []),
      ],
      portfolio: [
        ['/api/portfolio/summary'],
        ['/api/holdings'],
      ],
      watchlist: [
        ['/api/watchlist'],
      ],
      quotes: [
        ...(symbol ? [['/api/stocks', symbol, 'quote']] : []),
        ['/api/market/indices'],
      ],
    };

    const patterns = invalidationPatterns[baseKey] || [];
    patterns.forEach(pattern => {
      queryClient.invalidateQueries({ queryKey: pattern });
    });
  }, [queryClient]);

  // Optimistic updates for better UX
  const updateOptimistic = useCallback(<T>(
    queryKey: QueryKey, 
    updater: (oldData: T | undefined) => T
  ) => {
    queryClient.setQueryData(queryKey, updater);
  }, [queryClient]);

  // Prefetch related data to improve perceived performance
  const prefetchRelated = useCallback((symbol: string) => {
    // Prefetch stock quote when viewing stock details
    queryClient.prefetchQuery({
      queryKey: ['/api/stocks', symbol, 'quote'],
      ...CACHE_CONFIGS.QUOTES,
    });

    // Prefetch prediction data
    queryClient.prefetchQuery({
      queryKey: ['/api/stocks', symbol, 'prediction/today'],
      ...CACHE_CONFIGS.PREDICTIONS,
    });
  }, [queryClient]);

  // Background refresh for critical data
  const backgroundRefresh = useCallback((queryKeys: QueryKey[]) => {
    queryKeys.forEach(key => {
      queryClient.invalidateQueries({ 
        queryKey: key,
        refetchType: 'none' // Silent background refresh
      });
    });
  }, [queryClient]);

  // Batch cache operations for performance
  const batchInvalidate = useCallback((operations: Array<{
    type: 'invalidate' | 'remove' | 'prefetch';
    queryKey: QueryKey;
  }>) => {
    queryClient.getQueryCache().clear(); // Clear stale cache first
    
    operations.forEach(({ type, queryKey }) => {
      switch (type) {
        case 'invalidate':
          queryClient.invalidateQueries({ queryKey });
          break;
        case 'remove':
          queryClient.removeQueries({ queryKey });
          break;
        case 'prefetch':
          queryClient.prefetchQuery({ queryKey, ...CACHE_CONFIGS.PREDICTIONS });
          break;
      }
    });
  }, [queryClient]);

  return {
    invalidateRelatedQueries,
    updateOptimistic,
    prefetchRelated,
    backgroundRefresh,
    batchInvalidate,
    CACHE_CONFIGS,
  };
}

// Custom hook for deduplicating requests
export function useRequestDeduplication() {
  const queryClient = useQueryClient();

  const deduplicate = useCallback((queryKey: QueryKey) => {
    const query = queryClient.getQueryState(queryKey);
    
    // If query is already fetching, return existing promise
    if (query?.fetchStatus === 'fetching') {
      return queryClient.fetchQuery({ queryKey });
    }
    
    return null;
  }, [queryClient]);

  return { deduplicate };
}

// Performance monitoring hook
export function useCachePerformance() {
  const queryClient = useQueryClient();

  const getCacheStats = useCallback(() => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    const stats = {
      totalQueries: queries.length,
      activeQueries: queries.filter(q => q.getObserversCount() > 0).length,
      staleQueries: queries.filter(q => q.isStale()).length,
      cachedQueries: queries.filter(q => q.state.status === 'success').length,
      errorQueries: queries.filter(q => q.state.status === 'error').length,
      totalCacheSize: JSON.stringify(queries.map(q => q.state.data)).length,
    };

    return stats;
  }, [queryClient]);

  const logCacheStats = useCallback(() => {
    const stats = getCacheStats();
    console.log('[CACHE_STATS]', stats);
    return stats;
  }, [getCacheStats]);

  return { getCacheStats, logCacheStats };
}