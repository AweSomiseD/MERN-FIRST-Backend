import multer from "multer";
import { FILE_TYPE_CONFIG } from "../utils/fileValidation.js";

// Music upload: audio (required) + coverImage (optional) — dono ek saath
const musicUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Math.max(
      FILE_TYPE_CONFIG.audio.maxSizeBytes,
      FILE_TYPE_CONFIG.image.maxSizeBytes,
    ),
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "music") {
      if (!FILE_TYPE_CONFIG.audio.allowedMimeTypes.includes(file.mimetype)) {
        return cb(new Error("INVALID_AUDIO_TYPE"));
      }
    } else if (file.fieldname === "coverImage") {
      if (!FILE_TYPE_CONFIG.image.allowedMimeTypes.includes(file.mimetype)) {
        return cb(new Error("INVALID_IMAGE_TYPE"));
      }
    }
    cb(null, true);
  },
});

// Album cover: image only, optional
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FILE_TYPE_CONFIG.image.maxSizeBytes },
  fileFilter: (req, file, cb) => {
    if (!FILE_TYPE_CONFIG.image.allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error("INVALID_IMAGE_TYPE"));
    }
    cb(null, true);
  },
});

function handleMulterError(err, res) {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      message: "File is too large.",
    });
  }

  if (err.message === "INVALID_AUDIO_TYPE") {
    return res.status(400).json({
      message: `Unsupported audio type. Allowed formats: ${FILE_TYPE_CONFIG.audio.formatsLabel}.`,
    });
  }

  if (err.message === "INVALID_IMAGE_TYPE") {
    return res.status(400).json({
      message: `Unsupported image type. Allowed formats: ${FILE_TYPE_CONFIG.image.formatsLabel}.`,
    });
  }

  console.error("Upload error:", err);
  return res.status(400).json({ message: "File upload failed." });
}

export const uploadAudioSingle = (fieldName) => (req, res, next) => {
  musicUpload.fields([
    { name: fieldName, maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ])(req, res, (err) => {
    if (err) return handleMulterError(err, res);

    // .fields() se files req.files.music[0] shape mein aati hain,
    // controller ko purane .single() jaisa req.file (audio ke liye) bhi chahiye,
    // isliye backwards-compatible tareeqe se set kar dete hain
    req.file = req.files?.[fieldName]?.[0] || null;
    req.coverImageFile = req.files?.coverImage?.[0] || null;

    next();
  });
};

export const uploadImageSingle = (fieldName) => (req, res, next) => {
  imageUpload.single(fieldName)(req, res, (err) => {
    if (err) return handleMulterError(err, res);
    next();
  });
};
