import React, { useRef, useEffect, useState } from 'react';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';

const VideoPlayer = ({ onComplete }) => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const adContainerRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    // Wait for Google IMA SDK to be available
    if (!window.google || !window.google.ima) {
      console.error('Google IMA SDK not loaded');
      onComplete();
      return;
    }

    const adContainer = adContainerRef.current;
    const videoElement = videoRef.current;
    let adDisplayContainer;
    let adsLoader;
    let adsManager;

    const initializeIMA = () => {
      adDisplayContainer = new window.google.ima.AdDisplayContainer(adContainer, videoElement);
      adDisplayContainer.initialize();

      adsLoader = new window.google.ima.AdsLoader(adDisplayContainer);
      
      // Listen to ad loading events
      adsLoader.addEventListener(
        window.google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
        onAdsManagerLoaded,
        false
      );
      
      adsLoader.addEventListener(
        window.google.ima.AdErrorEvent.Type.AD_ERROR,
        onAdError,
        false
      );

      // Ad request
      const adsRequest = new window.google.ima.AdsRequest();
      // Test VAST tag URL
      adsRequest.adTagUrl = 'https://pubads.g.doubleclick.net/gampad/ads?' +
        'iu=/21775744923/external/single_preroll_skippable&' +
        'sz=640x480&' +
        'ciu_szs=300x250%2C728x90&' +
        'gdfp_req=1&' +
        'output=vast&' +
        'unviewed_position_start=1&' +
        'env=vp&' +
        'impl=s&' +
        'correlator=' + Math.random();

      // Specify required ad parameters
      adsRequest.setAdWillAutoPlay(true);
      adsRequest.setAdWillPlayMuted(false);
      
      // Set ad dimensions
      adsRequest.linearAdSlotWidth = containerRef.current.offsetWidth;
      adsRequest.linearAdSlotHeight = containerRef.current.offsetHeight;

      // Load the ad request
      adsLoader.requestAds(adsRequest);
    };

    const onAdsManagerLoaded = (adsManagerLoadedEvent) => {
      const adsRenderingSettings = new window.google.ima.AdsRenderingSettings();
      
      adsManager = adsManagerLoadedEvent.getAdsManager(videoElement, adsRenderingSettings);

      // Listen to ad events
      adsManager.addEventListener(window.google.ima.AdEvent.Type.COMPLETE, () => {
        onComplete();
      });

      try {
        adsManager.init(
          containerRef.current.offsetWidth,
          containerRef.current.offsetHeight,
          window.google.ima.ViewMode.NORMAL
        );
        adsManager.start();
      } catch (adError) {
        console.error("AdsManager error:", adError);
        onComplete();
      }
    };

    const onAdError = (adErrorEvent) => {
      console.error("Ad error:", adErrorEvent.getError());
      if (adsManager) {
        adsManager.destroy();
      }
      onComplete();
    };

    // Initialize IMA SDK
    initializeIMA();

    // Cleanup
    return () => {
      if (adsManager) {
        adsManager.destroy();
      }
      if (adsLoader) {
        adsLoader.destroy();
      }
    };
  }, [onComplete]);

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'black',
        zIndex: 1000
      }}
    >
      <div ref={adContainerRef} style={{ width: '100%', height: '100%' }}>
        <video
          ref={videoRef}
          style={{ width: '100%', height: '100%' }}
          playsInline
        />
      </div>
    </div>
  );
};

export default VideoPlayer;
