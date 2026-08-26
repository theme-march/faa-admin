(function () {
  'use strict';

  var modal = document.getElementById('qr-scanner-modal');
  var openButtons = document.querySelectorAll('[data-open-qr-scanner]');
  var closeButton = document.getElementById('close-qr-scanner');
  var switchButton = document.getElementById('switch-qr-camera');
  var uploadButton = document.getElementById('upload-qr-button');
  var fileInput = document.getElementById('qr-image-input');
  var reader = document.getElementById('qr-reader');
  var statusBox = document.getElementById('qr-scanner-status');
  var statusText = document.getElementById('qr-scanner-status-text');

  if (!modal || !reader) return;

  var libraryPromise = null;

  function loadScannerScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = function () {
        if (typeof window.Html5Qrcode !== 'undefined') resolve();
        else reject(new Error('QR scanner library did not initialize.'));
      };
      script.onerror = function () { reject(new Error('Unable to load ' + src)); };
      document.head.appendChild(script);
    });
  }

  function ensureScannerLibrary() {
    if (typeof window.Html5Qrcode !== 'undefined') return Promise.resolve();
    if (!libraryPromise) {
      libraryPromise = loadScannerScript('/javascripts/html5-qrcode.min.js?v=2.3.8')
        .catch(function () {
          return loadScannerScript('https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js');
        });
    }
    return libraryPromise;
  }

  var scanner = null;
  var cameras = [];
  var cameraIndex = 0;
  var scannerRunning = false;
  var processingResult = false;
  var openingScanner = false;
  var scannerWanted = false;

  function setStatus(message, state) {
    statusText.textContent = message;
    statusBox.className = 'scanner-status ' + (state || 'info');
  }

  function isLocalHostname(hostname) {
    return hostname === 'localhost' || hostname === '127.0.0.1';
  }

  function isAllowedHost(hostname) {
    hostname = String(hostname || '').toLowerCase();
    return hostname === window.location.hostname.toLowerCase() ||
      isLocalHostname(hostname) ||
      hostname === 'faa-dubd.org' ||
      hostname.endsWith('.faa-dubd.org');
  }

  function getValidFaaUrl(decodedText) {
    var url;
    try {
      url = new URL(String(decodedText || '').trim(), window.location.origin);
    } catch (error) {
      return null;
    }

    var isEventQr = url.pathname === '/event/enter' && Boolean(url.searchParams.get('id'));
    var isMemberQr = /^\/member\/verify\/[^/]+\/?$/.test(url.pathname);
    if (!isAllowedHost(url.hostname) || (!isEventQr && !isMemberQr)) return null;
    if (url.protocol !== 'https:' && !isLocalHostname(url.hostname)) return null;
    return url;
  }

  function chooseInitialCameraIndex() {
    var rearCameraIndex = cameras.findIndex(function (camera) {
      return /back|rear|environment/i.test(camera.label || '');
    });
    return rearCameraIndex >= 0 ? rearCameraIndex : 0;
  }

  function scannerConfig() {
    var viewport = Math.min(window.innerWidth - 72, 310);
    viewport = Math.max(210, viewport);
    return {
      fps: 10,
      qrbox: { width: viewport, height: viewport },
      aspectRatio: 1,
      disableFlip: false,
    };
  }

  async function stopScanner() {
    if (!scanner || !scannerRunning) return;
    try {
      await scanner.stop();
    } catch (error) {
      // The stream may already have been released by the browser.
    }
    scannerRunning = false;
  }

  async function handleDecodedQr(decodedText) {
    if (processingResult) return;
    processingResult = true;

    var destination = getValidFaaUrl(decodedText);
    if (!destination) {
      setStatus('This is not a valid FAA Event or Member Card QR.', 'error');
      window.setTimeout(function () {
        processingResult = false;
        setStatus('Point the camera at an FAA QR code', 'scanning');
      }, 1600);
      return;
    }

    setStatus('FAA QR detected. Verifying…', 'success verifying');
    modal.classList.add('scan-complete', 'verifying');
    await stopScanner();

    // QR codes may contain the public website host. Verification lives on the
    // staff server, so keep the verified path/token but open it on this origin.
    // This also preserves the signed-in staff session used for taking entry.
    var staffDestination = new URL(
      destination.pathname + destination.search + destination.hash,
      window.location.origin
    );
    window.setTimeout(function () {
      if (!scannerWanted) return;
      setStatus('Verified. Opening member details…', 'success');
      window.location.assign(staffDestination.href);
    }, 2000);
  }

  function handleScanFailure() {
    // A decoder miss is expected for most video frames, so no UI update is needed.
  }

  async function startCamera(cameraId) {
    if (openingScanner) return;
    openingScanner = true;
    processingResult = false;
    modal.classList.remove('scan-complete', 'verifying');
    setStatus('Starting camera…', 'loading');

    try {
      await stopScanner();
      if (!scanner) {
        scanner = new window.Html5Qrcode('qr-reader', {
          formatsToSupport: [window.Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
      }

      if (!cameras.length) {
        cameras = await window.Html5Qrcode.getCameras();
        if (!cameras.length) throw new Error('No camera was found on this device.');
        cameraIndex = chooseInitialCameraIndex();
      }

      var selectedCamera = cameraId || cameras[cameraIndex].id;
      await scanner.start(selectedCamera, scannerConfig(), handleDecodedQr, handleScanFailure);
      scannerRunning = true;
      if (!scannerWanted) {
        await stopScanner();
        return;
      }
      switchButton.hidden = cameras.length < 2;
      setStatus('Point the camera at an FAA QR code', 'scanning');
    } catch (error) {
      scannerRunning = false;
      var message = String(error && error.message ? error.message : error || '');
      if (!window.isSecureContext && !isLocalHostname(window.location.hostname)) {
        message = 'Camera access requires a secure HTTPS connection.';
      } else if (/permission|denied|notallowed/i.test(message)) {
        message = 'Camera permission was blocked. Allow camera access, then try again.';
      } else if (/notfound|no camera/i.test(message)) {
        message = 'No camera was found. You can upload a QR image instead.';
      } else {
        message = 'Unable to start the camera. Check browser permission and try again.';
      }
      setStatus(message, 'error');
    } finally {
      openingScanner = false;
    }
  }

  async function openScanner() {
    scannerWanted = true;
    modal.hidden = false;
    document.body.classList.add('scanner-open');
    window.requestAnimationFrame(function () { modal.classList.add('visible'); });
    setStatus('Loading QR scanner…', 'loading');
    try {
      await ensureScannerLibrary();
      if (scannerWanted) await startCamera();
    } catch (error) {
      setStatus('QR scanner could not load. Check the connection and refresh this page.', 'error');
    }
  }

  async function closeScanner() {
    scannerWanted = false;
    modal.classList.remove('visible', 'scan-complete', 'verifying');
    document.body.classList.remove('scanner-open');
    await stopScanner();
    window.setTimeout(function () { modal.hidden = true; }, 180);
  }

  async function switchCamera() {
    if (cameras.length < 2 || openingScanner) return;
    cameraIndex = (cameraIndex + 1) % cameras.length;
    await startCamera(cameras[cameraIndex].id);
  }

  async function scanUploadedImage(file) {
    if (!file) return;
    processingResult = false;
    modal.classList.remove('scan-complete', 'verifying');
    setStatus('Reading QR image…', 'loading');
    await stopScanner();

    try {
      if (!scanner) scanner = new window.Html5Qrcode('qr-reader');
      var decodedText = await scanner.scanFile(file, true);
      await handleDecodedQr(decodedText);
    } catch (error) {
      setStatus('No readable QR code was found in that image.', 'error');
    } finally {
      fileInput.value = '';
    }
  }

  openButtons.forEach(function (button) { button.addEventListener('click', openScanner); });
  closeButton.addEventListener('click', closeScanner);
  switchButton.addEventListener('click', switchCamera);
  uploadButton.addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function () { scanUploadedImage(fileInput.files[0]); });
  modal.addEventListener('click', function (event) {
    if (event.target === modal) closeScanner();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !modal.hidden) closeScanner();
  });
  window.addEventListener('pagehide', stopScanner);
}());
