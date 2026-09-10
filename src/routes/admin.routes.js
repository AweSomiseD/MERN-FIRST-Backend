import express from "express";
import adminControllers from "../controllers/admin.controllers.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import roleMiddleware from "../middlewares/role.middleware.js";

const Router = express.Router();

Router.use(authMiddleware.authUser, roleMiddleware(["admin"]));

Router.get("/users", adminControllers.getAllUsers);
Router.patch("/users/:userId/role", adminControllers.updateUserRole);
Router.patch("/users/:userId/ban", adminControllers.toggleUserBan);
Router.delete("/users/:userId", adminControllers.deleteUser);
Router.delete("/music/:musicId", adminControllers.deleteAnyMusic);
Router.delete("/album/:albumId", adminControllers.deleteAnyAlbum);
Router.get("/stats", adminControllers.getPlatformStats);

export default Router;
