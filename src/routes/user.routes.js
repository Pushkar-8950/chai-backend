import { Router } from "express";
import { 
    loginUser, 
    registerUser, 
    logoutUser, 
    refreshAccessToken, 
    changeCurrentPassword, 
    getCurrentUser,
    updateAccountDetails, 
    updateAvatarImage, 
    updateCoverImage, 
    getUserChannelProfile, 
    getWatchHistory
} from "../controllers/user.controller.js";
import {upload} from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"

const userRouter = Router();

// According to url and http methods, controllers are activated
userRouter.route('/register').post(
    upload.fields([
        {
            name: "avatarImage",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
);

userRouter.route('/login').post(loginUser);

// SECURED ROUTES

// We are using middleware to logout user successfully, so that we don't have to take any credentials from the user at logout time. We can verify it using access token and add a 'user' object in request using which we can get user _id for logging out the user
userRouter.route('/logout').post(verifyJWT, logoutUser);
userRouter.route('/refresh-token').post(refreshAccessToken);
userRouter.route('/change-password').post(verifyJWT, changeCurrentPassword);
userRouter.route('/get-current-user').post(verifyJWT, getCurrentUser);
userRouter.route('/update-account-details').post(verifyJWT, updateAccountDetails);
userRouter.route('/update-avatar-image').post(
    verifyJWT,
    upload.single("avatarImage"),
    updateAvatarImage
);
userRouter.route('/update-cover-image').post(
    verifyJWT, 
    upload.single("coverImage"),
    updateCoverImage
);

userRouter.route('/c/:username').get(verifyJWT, getUserChannelProfile);
userRouter.route('/history').get(verifyJWT, getWatchHistory);

export default userRouter;