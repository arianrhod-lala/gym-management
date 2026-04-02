import QRCode from "qrcode";

/**
 * Generate QR code as data URL
 * @param {string} text - Text/data to encode in QR code
 * @returns {Promise<string>} QR code as data URL
 */
export const generateQRCode = async (text) => {
  try {
    const qrDataUrl = await QRCode.toDataURL(text, {
      errorCorrectionLevel: "H",
      type: "image/png",
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });
    return qrDataUrl;
  } catch (error) {
    console.error("Error generating QR code:", error);
    throw error;
  }
};

/**
 * Generate unique QR code identifier for member
 * @param {string} memberId - Member's UUID
 * @returns {string} QR code text/identifier
 */
export const generateQRIdentifier = (memberId) => {
  return `GYMID-${memberId.substring(0, 8).toUpperCase()}`;
};
