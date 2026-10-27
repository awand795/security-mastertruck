import QRCode from 'qrcode';

/**
 * Generator QR Code inline (Base64 Data URL).
 * Memungkinkan QR Code tercetak di iframe cetak offline tanpa dependensi koneksi jaringan.
 */
export async function generateQrDataUrl(
  text: string,
  options?: QRCode.QRCodeToDataURLOptions
): Promise<string> {
  if (!text) return '';
  try {
    return await QRCode.toDataURL(text, {
      width: options?.width || 180,
      margin: options?.margin ?? 1,
      errorCorrectionLevel: options?.errorCorrectionLevel || 'M',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      ...options,
    });
  } catch (err) {
    console.error('Failed to generate QR data URL:', err);
    return '';
  }
}
