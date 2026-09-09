import userModel from "../models/user.model.js";

async function getAllUsers(req, res) {
  try {
    const users = await userModel
      .find()
      .select(
        "-password -emailVerificationToken -emailVerificationExpires -passwordResetToken -passwordResetExpires",
      );

    return res.status(200).json({
      message: "Users fetched successfully",
      users,
    });
  } catch (error) {
    console.error("Get All Users Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

async function updateUserRole(req, res) {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!["listener", "artist", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (userId === req.user.id) {
      return res
        .status(400)
        .json({ message: "You cannot change your own role" });
    }

    const user = await userModel
      .findByIdAndUpdate(userId, { role }, { new: true })
      .select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "User role updated successfully",
      user,
    });
  } catch (error) {
    console.error("Update User Role Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

async function toggleUserBan(req, res) {
  try {
    const { userId } = req.params;

    if (userId === req.user.id) {
      return res
        .status(400)
        .json({ message: "You cannot ban your own account" });
    }

    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.isBanned = !user.isBanned;
    await user.save();

    return res.status(200).json({
      message: user.isBanned
        ? "User banned successfully"
        : "User unbanned successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isBanned: user.isBanned,
      },
    });
  } catch (error) {
    console.error("Toggle User Ban Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

async function deleteUser(req, res) {
  try {
    const { userId } = req.params;

    if (userId === req.user.id) {
      return res
        .status(400)
        .json({ message: "You cannot delete your own account" });
    }

    const user = await userModel.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete User Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

export default {
  getAllUsers,
  updateUserRole,
  toggleUserBan,
  deleteUser,
};
