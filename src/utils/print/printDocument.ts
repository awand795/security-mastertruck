/**
 * Utilitas Iframe Cetak Dokumen Tunggal (Enterprise-grade)
 * Memastikan dokumen ditulis ke iframe terisolasi, menunggu seluruh aset/gambar dimuat,
 * lalu memicu dialog cetak browser dengan fallback yang aman.
 */

export function printHtmlDocument(htmlContent: string, documentTitle?: string): void {
  const iframeId = 'app-print-iframe';
  let iframe = document.getElementById(iframeId) as HTMLIFrameElement;

  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = iframeId;
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    console.error('Cannot access iframe contentWindow');
    window.print();
    return;
  }

  doc.open();
  doc.write(htmlContent);
  doc.close();

  if (documentTitle && iframe.contentWindow) {
    iframe.contentWindow.document.title = documentTitle;
  }

  const executePrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error('Iframe print error, falling back to window.print():', err);
      window.print();
    }
  };

  const images = Array.from(doc.images);
  if (images.length === 0) {
    setTimeout(executePrint, 150);
  } else {
    let loaded = 0;
    let isFired = false;

    const fireOnce = () => {
      if (isFired) return;
      isFired = true;
      setTimeout(executePrint, 100);
    };

    // Timeout cadangan maksimal 2.5 detik
    const fallbackTimer = setTimeout(fireOnce, 2500);

    images.forEach((img) => {
      if (img.complete) {
        loaded++;
        if (loaded === images.length) {
          clearTimeout(fallbackTimer);
          fireOnce();
        }
      } else {
        img.onload = img.onerror = () => {
          loaded++;
          if (loaded === images.length) {
            clearTimeout(fallbackTimer);
            fireOnce();
          }
        };
      }
    });
  }
}
