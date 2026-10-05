import { useEffect, useState } from "react";

interface AsyncState<T> {
  data?: T;
  error?: string;
  loading: boolean;
}

/** Runs `fn` on mount and whenever `deps` change; `reload()` runs it again. */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<AsyncState<T>>({ loading: true });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    fn().then(
      (data) => !cancelled && setState({ data, loading: false }),
      (e: unknown) => !cancelled && setState({ loading: false, error: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [...deps, nonce]);

  return { ...state, reload: () => setNonce((n) => n + 1) };
}
