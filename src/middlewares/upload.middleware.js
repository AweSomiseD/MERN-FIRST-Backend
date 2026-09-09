import multer from "multer";
import { FILE_TYPE_CONFIG } from "../utils/fileValidation.js";

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FILE_TYPE_CONFIG.audio.maxSizeBytes },
  fileFilter: (req, file, cb) => {
    if (!FILE_TYPE_CONFIG.audio.allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error("INVALID_FILE_TYPE"));
    }
    cb(null, true);
  },
});

export const uploadAudioSingle = (fieldName) => (req, res, next) => {
  audioUpload.single(fieldName)(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        const maxMB = FILE_TYPE_CONFIG.audio.maxSizeBytes / (1024 * 1024);
        return res.status(400).json({
          message: `File is too large. Maximum allowed size is ${maxMB} MB.`,
        });
      }

      if (err.message === "INVALID_FILE_TYPE") {
        return res.status(400).json({
          message: `Unsupported file type. Allowed formats: ${FILE_TYPE_CONFIG.audio.formatsLabel}.`,
        });
      }

      console.error("Upload error:", err);
      return res.status(400).json({ message: "File upload failed." });
    }

    next();
  });
};
