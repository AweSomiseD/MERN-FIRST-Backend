import userModel from "../models/user.model.js";
import musicModel from "../models/music.model.js";
import albumModel from "../models/album.model.js";

async function getAllUsers(req, res) {
  try {
    const { search, role } = req.query;

    const filter = {};

    if (search?.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      filter.$or = [{ username: searchRegex }, { email: searchRegex }];
    }

    if (role?.trim() && ["listener", "artist", "admin"].includes(role)) {
      filter.role = role;
    }

    const users = await userModel
      .find(filter)
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

async function deleteAnyMusic(req, res) {
  try {
    const { musicId } = req.params;

    const music = await musicModel.findByIdAndDelete(musicId);

    if (!music) {
      return res.status(404).json({ message: "Music not found" });
    }

    return res.status(200).json({ message: "Music deleted by admin" });
  } catch (error) {
    console.error("Admin Delete Music Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

async function deleteAnyAlbum(req, res) {
  try {
    const { albumId } = req.params;

    const album = await albumModel.findByIdAndDelete(albumId);

    if (!album) {
      return res.status(404).json({ message: "Album not found" });
    }

    return res.status(200).json({ message: "Album deleted by admin" });
  } catch (error) {
    console.error("Admin Delete Album Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

async function getPlatformStats(req, res) {
  try {
    const [totalUsers, totalSongs, totalAlbums, roleBreakdown, recentSignups] =
      await Promise.all([
        userModel.countDocuments(),
        musicModel.countDocuments(),
        albumModel.countDocuments(),
        userModel.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
        userModel
          .find()
          .select("username email role createdAt")
          .sort({ _id: -1 })
          .limit(5),
      ]);

    // Aggregation ka result [{ _id: "listener", count: 5 }, ...] hota hai,
    // usko { listener: 5, artist: 2, admin: 1 } shape mein convert karo
    const roleCounts = { listener: 0, artist: 0, admin: 0 };
    roleBreakdown.forEach((r) => {
      roleCounts[r._id] = r.count;
    });

    return res.status(200).json({
      message: "Platform stats fetched successfully",
      stats: {
        totalUsers,
        totalSongs,
        totalAlbums,
        roleCounts,
        recentSignups,
      },
    });
  } catch (error) {
    console.error("Get Platform Stats Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

export default {
  getAllUsers,
  updateUserRole,
  toggleUserBan,
  deleteUser,
  deleteAnyMusic,
  deleteAnyAlbum,
  getPlatformStats,
};
