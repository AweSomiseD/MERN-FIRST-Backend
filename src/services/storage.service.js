import ImageKit from "@imagekit/nodejs";

const client = new ImageKit({
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
});

async function uploadFile(file) {
  const result = await client.files.upload({
    file,
    fileName: "music_" + Date.now(),
    folder: "yt-complete-backend/music",
  });

  return result;
}

export default uploadFile;
