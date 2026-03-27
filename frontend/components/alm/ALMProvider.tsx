'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { apiClient } from '@/lib/api';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

interface Institution {
  id: string;
  name: string;
  type: string;
  totalAssets: number;
  currency?: string;
  reportingDate?: string;
}

interface ALMContextType {
  institutions: Institution[];
  selectedId: string;
  institution: Institution | null;
  loading: boolean;
  setSelectedId: (id: string) => void;
  selectInstitution: (id: string) => void;
  refresh: () => Promise<void>;
}

const ALMContext = createContext<ALMContextType>({
  institutions: [],
  selectedId: '',
  institution: null,
  loading: true,
  setSelectedId: () => {},
  selectInstitution: () => {},
  refresh: async () => {},
});

export function useALM() {
  return useContext(ALMContext);
}

export default function ALMProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlId = searchParams.get('id') || '';

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedId, setSelectedIdState] = useState(urlId);
  const [loading, setLoading] = useState(true);

  const setSelectedId = useCallback(
    (id: string) => {
      setSelectedIdState(id);
      const params = new URLSearchParams(searchParams.toString());
      params.set('id', id);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const fetchInstitutions = useCallback(async () => {
    try {
      const data = await apiClient.getInstitutions();
      setInstitutions(data);
      if (data.length > 0) {
        const match = data.find((d: Institution) => d.id === urlId);
        if (match) {
          setSelectedIdState(match.id);
        } else if (!urlId) {
          setSelectedIdState(data[0].id);
          // Update URL silently
          const params = new URLSearchParams(searchParams.toString());
          params.set('id', data[0].id);
          router.replace(`${pathname}?${params.toString()}`);
        }
      }
    } catch {
      setInstitutions([]);
    } finally {
      setLoading(false);
    }
  }, [urlId, pathname, router, searchParams]);

  useEffect(() => {
    fetchInstitutions();
  }, []); // Only fetch once on mount

  const institution = institutions.find((i) => i.id === selectedId) || null;

  return (
    <ALMContext.Provider
      value={{
        institutions,
        selectedId,
        institution,
        loading,
        setSelectedId,
        selectInstitution: setSelectedId,
        refresh: fetchInstitutions,
      }}
    >
      {children}
    </ALMContext.Provider>
  );
}
