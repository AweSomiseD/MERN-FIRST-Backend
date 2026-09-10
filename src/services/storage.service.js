import ImageKit from "@imagekit/nodejs";
import path from "node:path";

const client = new ImageKit({
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
});

async function uploadFile({ buffer, mimetype, originalname, folder = "music" }) {
  const extension = path.extname(originalname || "").toLowerCase();
  const fileName = `upload_${Date.now()}${extension}`;

  const result = await client.files.upload({
    // Include the MIME type so ImageKit does not have to infer it from the
    // generated filename (which is especially important for cover images).
    file: `data:${mimetype};base64,${buffer.toString("base64")}`,
    fileName,
    folder: `yt-complete-backend/${folder}`,
  });

  return result;
}

export default uploadFile;
