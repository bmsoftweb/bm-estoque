import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/** useRouter() no formato que as telas já usam (push/replace/back), com identidade estável entre renders */
export function useRouter() {
  const navigate = useNavigate();
  const ref = useRef(navigate);
  useEffect(() => {
    ref.current = navigate;
  });
  return useMemo(
    () => ({
      push: (to: string) => ref.current(to),
      replace: (to: string) => ref.current(to, { replace: true }),
      back: () => ref.current(-1),
    }),
    [],
  );
}

export const usePathname = () => useLocation().pathname;
