'use client';

import { useState, useCallback } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';

interface FacebookAuthResponse {
  code?: string;
  permissions?: string[];
}

interface FacebookLoginResponse {
  authResponse?: FacebookAuthResponse | null;
  status?: string;
}

declare global {
  interface Window {
    FB?: {
      init: (options: Record<string, unknown>) => void;
      login: (
        callback: (response: FacebookLoginResponse) => void,
        options: Record<string, unknown>
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

interface EmbeddedSignupButtonProps {
  mode?: 'connect' | 'reconnect';
}

export default function EmbeddedSignupButton({ mode = 'connect' }: EmbeddedSignupButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);

  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID;

  const handleSdkLoad = useCallback(() => {
    if (!appId || !configId) {
      setError('WhatsApp signup is not configured.');
      return;
    }

    window.fbAsyncInit = () => {
      window.FB?.init({
        appId,
        autoLogAppEvents: false,
        xfbml: true,
        version: 'v22.0',
      });
      setSdkReady(true);
    };

    if (window.FB && appId) {
      window.FB.init({
        appId,
        autoLogAppEvents: false,
        xfbml: true,
        version: 'v22.0',
      });
      setSdkReady(true);
    }
  }, [appId, configId]);

  const handleClick = useCallback(() => {
    if (!sdkReady || !window.FB) {
      setError('Facebook SDK is still loading. Please wait.');
      return;
    }

    if (!configId) {
      setError('WhatsApp signup configuration is missing.');
      return;
    }

    setLoading(true);
    setError(null);

    console.log('WhatsApp Embedded Signup diagnostics:', {
      hasMetaAppId: Boolean(appId),
      hasConfigId: Boolean(configId),
      hasFB: typeof window.FB !== 'undefined',
      sdkReady,
    });

    const handleLoginResponse = async (response: FacebookLoginResponse) => {
      if (!response.authResponse?.code) {
        setLoading(false);
        if (response.status === 'unknown' || !response.status) {
          setError('Popup was closed or login was cancelled.');
        } else {
          setError('Could not receive authorization from Facebook.');
        }
        return;
      }

      try {
        const apiResponse = await fetch('/api/whatsapp/connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: response.authResponse.code,
          }),
        });

        const data = (await apiResponse.json()) as { error?: string };

        if (!apiResponse.ok) {
          throw new Error(data.error || 'Failed to connect WhatsApp.');
        }

        router.refresh();
      } catch (err) {
        setLoading(false);
        setError(err instanceof Error ? err.message : 'Failed to connect WhatsApp.');
      }
    };

    try {
      window.FB.login(
      (response: FacebookLoginResponse) => {
        void handleLoginResponse(response);
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: '3',
        },
      }
    );
    } catch (err) {
      setLoading(false);
      console.error('WhatsApp Embedded Signup FB.login failed:', err);
      setError(err instanceof Error ? err.message : 'WhatsApp Embedded Signup failed to start.');
    }
  }, [sdkReady, appId, configId, router]);

  return (
    <>
      <Script
        src="https://connect.facebook.net/en_US/sdk.js"
        crossOrigin="anonymous"
        strategy="afterInteractive"
        onLoad={handleSdkLoad}
      />
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleClick}
          disabled={loading || !sdkReady}
          className="inline-flex items-center justify-center rounded-xl bg-[#1877F2] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#166fe5] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Connecting...' : mode === 'reconnect' ? 'Reconnect WhatsApp' : 'Connect with Facebook'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {(!appId || !configId) && (
          <p className="text-sm text-amber-600">WhatsApp onboarding is not configured on this deployment.</p>
        )}
      </div>
    </>
  );
}
