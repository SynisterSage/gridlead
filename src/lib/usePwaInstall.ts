import { useCallback, useEffect, useState } from 'react';

type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string[] }>;
};

export const usePwaInstall = () => {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [supportsSw, setSupportsSw] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setSupportsSw('serviceWorker' in navigator);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
      setCanPrompt(true);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      setCanPrompt(false);
    };

    const displayModeStandalone = window.matchMedia?.('(display-mode: standalone)').matches;
    const isIosStandalone = (window.navigator as any).standalone === true;
    if (displayModeStandalone || isIosStandalone) {
      setInstalled(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<{ outcome: InstallOutcome }> => {
    if (!promptEvent) return { outcome: 'unavailable' };
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      setPromptEvent(null);
      setCanPrompt(false);
      return { outcome: choice.outcome };
    } catch (_e) {
      return { outcome: 'dismissed' };
    }
  }, [promptEvent]);

  return {
    canPrompt,
    installed,
    supportsSw,
    promptInstall,
  };
};
