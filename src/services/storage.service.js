import ImageKit from "@imagekit/nodejs";
import path from "node:path";
import sharp from "sharp";

const client = new ImageKit({
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
});

const TARGET_SIZE_BYTES = 4 * 1024 * 1024; // ~4MB
async function compressImage(buffer) {
  let quality = 80;
  let width = 1200;
  let output = await sharp(buffer)
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer();

  // Jab tak size target se bara hai, quality kam karo
  while (output.length > TARGET_SIZE_BYTES && quality > 30) {
    quality -= 10;
    output = await sharp(buffer)
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();
  }

  return output;
}

async function uploadFile({
  buffer,
  mimetype,
  originalname,
  folder = "music",
}) {
  let finalBuffer = buffer;
  let finalMimetype = mimetype;
  let extension = path.extname(originalname || "").toLowerCase();

  const COMPRESS_THRESHOLD = 5 * 1024 * 1024; // 5 MB

  // Sirf image ho AUR size 5MB se bara ho, tabhi compress karo
  if (mimetype.startsWith("image/") && buffer.length > COMPRESS_THRESHOLD) {
    finalBuffer = await compressImage(buffer);
    finalMimetype = "image/jpeg";
    extension = ".jpg";
  }

  const fileName = `upload_${Date.now()}${extension}`;

  const result = await client.files.upload({
    file: `data:${finalMimetype};base64,${finalBuffer.toString("base64")}`,
    fileName,
    folder: `yt-complete-backend/${folder}`,
  });

  return result;
}

async function deleteFile(fileId) {
  if (!fileId) return;

  try {
    await client.files.delete(fileId);
  } catch (error) {
    // File ImageKit pe pehle hi delete ho chuki ho to error ignore karo
    if (error?.status === 404) return;
    throw error;
  }
}

export async function deleteMusicFiles(music) {
  const targets = [
    { label: "audio", fileId: music.fileId },
    { label: "cover", fileId: music.coverImageFileId },
  ].filter((t) => t.fileId);

  const results = await Promise.allSettled(
    targets.map((t) => deleteFile(t.fileId)),
  );

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`ImageKit ${targets[i].label} delete failed:`, r.reason);
    }
  });
}

export async function deleteAlbumCover(album) {
  if (!album.coverImageFileId) return;

  try {
    await deleteFile(album.coverImageFileId);
  } catch (error) {
    console.error("ImageKit album cover delete failed:", error);
  }
}

export default uploadFile;
