<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    adUnitId?: string;
    adFormat?: 'auto' | 'rectangle' | 'horizontal' | 'vertical';
    adSlot?: string;
    fullWidthResponsive?: boolean;
    className?: string;
  }

  let {
    adUnitId = '',
    adFormat = 'auto',
    adSlot = '',
    fullWidthResponsive = true,
    className = ''
  }: Props = $props();

  let adContainer: HTMLDivElement;
  let adLoaded = $state(false);
  let adError = $state(false);
  let adScriptLoaded = $state(false);

  // Check if AdSense is enabled (publisher ID configured)
  let adsEnabled = $derived(typeof window !== 'undefined' && 
    (import.meta.env.VITE_ADSENSE_PUBLISHER_ID || 
     import.meta.env.VITE_ADSENSE_ENABLED === 'true'));

  // Determine ad size based on format
  let adSize = $derived(getAdSize(adFormat));

  function getAdSize(format: string): { width: string; height: string; style: string } {
    switch (format) {
      case 'rectangle':
        return { width: '300px', height: '250px', style: 'display:inline-block' };
      case 'horizontal':
        return { width: '728px', height: '90px', style: 'display:block' };
      case 'vertical':
        return { width: '300px', height: '600px', style: 'display:inline-block' };
      default: // auto
        return { width: '100%', height: 'auto', style: 'display:block' };
    }
  }

  function loadAdSenseScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Window not available'));
        return;
      }

      // Check if script already loaded
      if ((window as any).adsbygoogle) {
        adScriptLoaded = true;
        resolve();
        return;
      }

      // Check if script tag already exists
      const existingScript = document.querySelector('script[src*="adsbygoogle"]');
      if (existingScript) {
        // Wait for it to load
        existingScript.addEventListener('load', () => {
          adScriptLoaded = true;
          resolve();
        });
        existingScript.addEventListener('error', reject);
        return;
      }

      // Load AdSense script
      const script = document.createElement('script');
      const publisherId = import.meta.env.VITE_ADSENSE_PUBLISHER_ID;
      
      if (!publisherId) {
        reject(new Error('AdSense publisher ID not configured'));
        return;
      }

      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`;
      script.async = true;
      script.crossOrigin = 'anonymous';
      
      script.onload = () => {
        adScriptLoaded = true;
        resolve();
      };
      
      script.onerror = () => {
        reject(new Error('Failed to load AdSense script'));
      };

      document.head.appendChild(script);
    });
  }

  async function loadAd() {
    if (!adsEnabled || !adUnitId || adLoaded || adError) {
      return;
    }

    try {
      // Load AdSense script if not already loaded
      if (!adScriptLoaded) {
        await loadAdSenseScript();
      }

      // Wait a bit for script to initialize
      await new Promise(resolve => setTimeout(resolve, 100));

      if (typeof window === 'undefined' || !(window as any).adsbygoogle) {
        throw new Error('AdSense not available');
      }

      // Create ad element
      if (adContainer) {
        const ins = document.createElement('ins');
        ins.className = 'adsbygoogle';
        ins.style.display = 'block';
        
        if (adFormat === 'auto' && fullWidthResponsive) {
          ins.setAttribute('data-ad-client', import.meta.env.VITE_ADSENSE_PUBLISHER_ID || '');
          ins.setAttribute('data-ad-slot', adSlot || adUnitId);
          ins.setAttribute('data-ad-format', 'auto');
          ins.setAttribute('data-full-width-responsive', 'true');
        } else {
          ins.setAttribute('data-ad-client', import.meta.env.VITE_ADSENSE_PUBLISHER_ID || '');
          ins.setAttribute('data-ad-slot', adSlot || adUnitId);
          
          if (adFormat === 'rectangle') {
            ins.style.width = '300px';
            ins.style.height = '250px';
          } else if (adFormat === 'horizontal') {
            ins.style.width = '728px';
            ins.style.height = '90px';
          } else if (adFormat === 'vertical') {
            ins.style.width = '300px';
            ins.style.height = '600px';
          }
        }

        adContainer.appendChild(ins);

        // Push ad to AdSense
        try {
          ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
          adLoaded = true;
        } catch (err) {
          console.warn('AdSense push error (may be blocked):', err);
          adError = true;
        }
      }
    } catch (err) {
      console.warn('Failed to load ad:', err);
      adError = true;
    }
  }

  onMount(() => {
    // Lazy load ad after a short delay
    const timer = setTimeout(() => {
      loadAd();
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  });

</script>

{#if adsEnabled && adUnitId}
  <div 
    class="ad-banner-container {className}"
    bind:this={adContainer}
    style="min-height: {adFormat === 'auto' ? '100px' : adSize.height}; width: {adFormat === 'auto' ? '100%' : adSize.width}; {adSize.style}"
  >
    {#if !adLoaded && !adError}
      <div class="ad-loading">
        <div class="ad-loading-spinner"></div>
      </div>
    {:else if adError}
      <!-- Ad failed to load (likely blocked) - show nothing -->
    {/if}
  </div>
{/if}

<style>
  .ad-banner-container {
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
    position: relative;
  }

  .ad-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 100px;
    opacity: 0.5;
  }

  .ad-loading-spinner {
    width: 24px;
    height: 24px;
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top-color: rgba(255, 255, 255, 0.6);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Ensure ads don't overflow */
  :global(.adsbygoogle) {
    display: block;
    max-width: 100%;
  }
</style>
