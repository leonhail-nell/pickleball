'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api, setAuth } from '@/lib/api';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (opts: object) => void;
          renderButton: (el: HTMLElement, opts: object) => void;
        };
      };
    };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

/** "Continue with Google" via Google Identity Services.
 *  Renders nothing until NEXT_PUBLIC_GOOGLE_CLIENT_ID is configured. */
export function GoogleButton({ next = '/sessions', onError }: { next?: string; onError?: (msg: string) => void }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!CLIENT_ID || !ref.current) return;

    const init = () => {
      if (!window.google || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async (resp: { credential: string }) => {
          try {
            const res = await api<{ token: string; user: object }>('/auth/google', {
              method: 'POST',
              json: { credential: resp.credential },
            });
            setAuth(res.token, res.user);
            router.push(next);
          } catch (e) {
            onError?.((e as Error).message);
          }
        },
      });
      window.google.accounts.id.renderButton(ref.current, {
        theme: 'outline', size: 'large', width: 320, shape: 'pill', text: 'continue_with',
      });
    };

    if (window.google) {
      init();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = init;
      document.head.appendChild(script);
    }
  }, [router, next, onError]);

  if (!CLIENT_ID) return null;
  return <div ref={ref} style={{ display: 'flex', justifyContent: 'center' }} />;
}
