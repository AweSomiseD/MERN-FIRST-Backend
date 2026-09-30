// Service layer se "expected" errors (404, 403, validation) aise throw hote hain.
// Controller (REST) aur baad mein socket handlers dono isi ko samajhte hain.
export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status; // HTTP status (REST ke liye)
    this.code = code; // machine-readable code (frontend/socket ke liye)
  }
}

// Controller ke catch block mein use hota hai
export function sendError(res, error, label) {
  if (error instanceof AppError) {
    return res.status(error.status).json({
      message: error.message,
      code: error.code,
    });
  }

  console.error(`${label}:`, error);
  return res.status(500).json({ message: "Internal Server Error" });
}
