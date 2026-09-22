export const FILE_TYPE_CONFIG = {
  audio: {
    // Real-world MIME types vary by OS/browser for the same file —
    // covering the common variants rather than a single "correct" one.
    allowedMimeTypes: [
      "audio/mpeg", // .mp3 (standard)
      "audio/mp3", // .mp3 (non-standard, sent by some clients)
      "audio/wav",
      "audio/x-wav",
      "audio/wave",
      "audio/m4a",
      "audio/x-m4a",
      "audio/mp4", // .m4a often reports as this (MP4 container)
    ],
    maxSizeBytes: 5 * 1024 * 1024, // 5 MB
    label: "audio",
    formatsLabel: "MP3, WAV, M4A",
  },
  image: {
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxSizeBytes: 15 * 1024 * 1024,
    label: "image",
    formatsLabel: "JPG, PNG, WEBP",
  },
};

export function validateFile(file, type) {
  const config = FILE_TYPE_CONFIG[type];

  if (!config) {
    return { valid: false, message: "Unsupported file category." };
  }

  if (!file) {
    return { valid: false, message: `A ${config.label} file is required.` };
  }

  if (!config.allowedMimeTypes.includes(file.mimetype)) {
    return {
      valid: false,
      message: `Unsupported file type. Allowed formats: ${config.formatsLabel}.`,
    };
  }

  if (file.size > config.maxSizeBytes) {
    const maxMB = config.maxSizeBytes / (1024 * 1024);
    return {
      valid: false,
      message: `File is too large. Maximum allowed size is ${maxMB} MB.`,
    };
  }

  return { valid: true };
}
