'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from './keys';

export const useOverview = () => useQuery({ queryKey: qk.overview, queryFn: api.overview });
export const useInbox = () =>
  useQuery({ queryKey: qk.inbox, queryFn: () => api.transactions('?kind=expense&unallocated=true') });
export const useTransactions = () =>
  useQuery({ queryKey: qk.transactions('all'), queryFn: () => api.transactions('') });
export const useRules = () => useQuery({ queryKey: qk.rules, queryFn: api.rules });
export const useAccounts = () => useQuery({ queryKey: ['accounts'], queryFn: api.accounts });
