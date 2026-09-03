import userModel from "../models/user.model.js";

const generateUsername = async (name) => {
  const baseUsername = name.toLowerCase().replace(/[^a-z0-9]/g, "");

  let username = baseUsername;
  let counter = 1;

  while (await userModel.findOne({ username })) {
    username = `${baseUsername}${counter}`;
    counter++;
  }

  return username;
};

export default generateUsername;
