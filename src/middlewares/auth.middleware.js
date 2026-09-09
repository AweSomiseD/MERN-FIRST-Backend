import jwt from "jsonwebtoken";

// Just a middleware to check if the user is authenticated and has the role of "artist"
async function authArtist(req, res, next) {
  // Check for accessToken instead of token
  const accessToken = req.cookies.accessToken;

  if (!accessToken) {
    return res.status(401).json({
      message: "Unauthorized - Access token required",
    });
  }

  try {
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);

    if (decoded.role !== "artist") {
      return res.status(403).json({
        message: "Artist access required",
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.log("Artist Auth Error:", error);

    // Check if token expired
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Access token expired",
        code: "TOKEN_EXPIRED",
      });
    }

    return res.status(401).json({
      message: "Invalid access token",
    });
  }
}

// Just a middleware to check if the user is authenticated and has the role of "listener" or "artist"
async function authUser(req, res, next) {
  const accessToken = req.cookies.accessToken;

  console.log("AUTH USER COOKIE:", !!accessToken);

  if (!accessToken) {
    return res.status(401).json({
      message: "Unauthorized - Access token required",
    });
  }

  try {
    const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);

    console.log("AUTH USER DECODED:", decoded);

    // if (decoded.role !== "listener" && decoded.role !== "artist") {
    if (!["listener", "artist", "admin"].includes(decoded.role)) {
      return res.status(403).json({
        message: "You Don't Have Access",
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.log("User Auth Error:", error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Access token expired",
        code: "TOKEN_EXPIRED",
      });
    }

    return res.status(401).json({
      message: "Invalid access token",
    });
  }
}

export default {
  authArtist,
  authUser,
};
