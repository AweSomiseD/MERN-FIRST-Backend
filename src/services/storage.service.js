import ImageKit from "@imagekit/nodejs";
import path from "node:path";

const client = new ImageKit({
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
});

async function uploadFile({
  buffer,
  mimetype,
  originalname,
  folder = "music",
}) {
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
