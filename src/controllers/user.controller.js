import {asyncHandler} from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import { ApiResponse } from '../utils/APIResponse.js';
import Jwt from 'jsonwebtoken'
import mongoose from 'mongoose';

const registerUser = asyncHandler(async (req, res) => {

    // Get user details from frontend
    // validation - if details are not emoty
    // Check if user already exists
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // created user object - create entry in DB
    // remove password and refresh token field from response
    // check if user created or not
    // return response
    
    // Getting user details from frontend
    const {fullName, email, password, userName} = req.body;
    console.log("data : ", req.body);

    // Validation - if details are not empty
    if(
        [fullName, email, password, userName].some((fields) => fields?.trim()==="")
    ){
        throw new ApiError(400, "All fields are required");
    }

    // Check if user already exists
    const existedUser = await User.findOne({
        $or: [{ userName }, { email }]
    });

    if(existedUser){
        throw new ApiError(409, "User already exist")
    }

    // Extract path of avatar and coverImage from req.files object
    console.log("req.files : ", req.files);
    const avatarLocalPath = req.files?.avatarImage[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;

    // 
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    // Upload avatar and coverImage on cloudinary
    const avatarImage = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    // Check if avatar is uploaded or not
    if(!avatarImage){
        throw new ApiError(400, "Avatar file is required");
    }

    // create user object - create entry in DB
    const user = await User.create({
        fullName,
        avatarImage: avatarImage.url,
        coverImage: coverImage?coverImage.url : '',
        email, 
        password,
        username: userName.toLowerCase()
    })

    // After user creation, _id is created automatically by MongoDB, we can use that to find the user and remove password and refreshToken field from response using '-' sign
    const createdUser = await User.findById(user._id).select("-password -refreshToken")

    // if user is not created, throw error
    if(!createdUser){
        throw new ApiError(500, "Something went Wrong while registering the user");
    }

    // if user is created, return response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Registered Successfully")
    )
})

const generateAccessAndRefreshToken = async(userId) => {    

    try {
        
        // get user from DB by userID
        const user = await User.findById(userId);
        
        // Generate tokens
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        // Store the refresh token in the user's document in the database
        user.refreshToken = refreshToken; 

        // Save the user document without running validation checks, since we are only updating the refreshToken field
        await user.save({validateBeforeSave: false}); 

        return {accessToken, refreshToken};
    
    } catch (error){

        console.log(error);
        throw new ApiError(500, "Something went wrong while generating access and refresh tokens");
    }
}

const loginUser = asyncHandler(async (req, res) => {
    
    // username or email from frontend (req.bosy)
    // if all the details provided by user or not - validation
    // check if user exists
    // if user doesn't exist, error
    // if user exist, ask password
    // password check
    // access and refresh token generation
    // send cookie and return response

    // Take username, email and password as input from the user
    const {email, username, password} = req.body;

    // If username or email is not present, throw an error
    if(!username || !email) {
        throw new ApiError(400, "Username or Email is required");
    } 

    // find user in DB with provided username or email
    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    // if user not found, throw error
    if(!user){
        throw new ApiError(404, "user doesn't exist");
    }

    // validate provided password with stored password
    const isValidPassword = await user.isCorrectPassword(password);

    // if not valid password, throw error
    if(!isValidPassword) {
        throw new ApiError(401, "Invalid Password");
    }

    // Generate access token and refresh token 
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    // Get all the details of user after getting logged it excluding password and refresh token
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    // Options for setting cookies in the response
    const options = {
        httpOnly: true,
        secure: true
    }

    // Send the access token and refresh token as cookies in the response, along with the logged-in user data
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "Logged In Successfully"
        )
    );

})

const logoutUser = asyncHandler(async(req, res) => {

    try {
        // Remove refresh token from the DB
        await User.findByIdAndUpdate(req.user._id,
            {
                $unset: {
                    refreshToken: 1
                }
            },
            {
                new: true
            }
        )
    
        // Options for setting cookies in the response
        const options = {
            httpOnly: true,
            secure: true
        }
    
        // return status, clear cookies 
        return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User Logged Out Successfully"))

    } catch (error) {
        console.log(error);
        throw new ApiError(500, "Error in logout function");
    }
})

const refreshAccessToken = asyncHandler(async(req, res) => {

    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if(!incomingRefreshToken){
        throw new ApiError(401, "Refresh token is required");
    }

    try {
        
        //  Verify token using jwt 
        const decodedToken = await Jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    
        // Try finding user from the database using ID
        const user = await User.findById(decodedToken?._id);
        
        console.log("User found:", !!user);
        console.log(
            "Token matches:",
            incomingRefreshToken === user?.refreshToken
        );
    
        if(!user || incomingRefreshToken !== user.refreshToken){
            throw new ApiError(401, "Invalid refresh token");
        }
    
        // Now, if refresh token is valid, generate new Access and refresh tokens 
        const {accessToken, refreshToken: newRefreshToken} = await generateAccessAndRefreshToken(user._id);
    
        const options = {
            httpOnly: true,
            secure: true
        };
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newRefreshToken},
                "Access Token refreshed"
            )
        )
    } catch (error) {
        console.log(error);
        throw new ApiError(401, "Error while refreshing access token");
    }
})

const changeCurrentPassword = asyncHandler(async(req, res) => {

    const {oldPassword, newPassword, confirmPassword} = req.body;

    if(!oldPassword || !newPassword || !confirmPassword) {
        throw new ApiError(400, "Enter all the required fields");
    }

    // check if newPassword and confirmPassword are same or not
    if(newPassword !== confirmPassword){
        throw new ApiError(400, "Password doesn't match");
    }

    // IF the user is logged in, then authentication middleware must have run and req.user must hold user details
    // So, we can fetch user 
    const user = await User.findById(req.user?._id);

    const isPasswordCorrect = await user.isCorrectPassword(oldPassword);

    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid old password");
    }

    user.password = newPassword;
    await user.save({validateBeforeSave: false});

    return res
    .status(200)
    .json(
        new ApiResponse(
            200, {}, "password changed successfully"
        )
    )
})

const getCurrentUser = asyncHandler(async(req, res) => {

    return res
    .status(200)
    .json(
        new ApiResponse(200, req.user, "Current user fetched successfully")
    ) 
})

const updateAccountDetails = asyncHandler(async(req, res) => {
    
    const {fullName, email} = req.body;

    if(!fullName || !email){
        throw new ApiError(400, "All Fields are required");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id, 
        {
            $set: {
                fullName: fullName,
                email: email
            }
        },
        {new: true} // return account details after updation
    ).select("-password -refreshToken");

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Account details updated successfully")
    )
})

const updateAvatarImage = asyncHandler(async(req, res) => {

    const avatarImage = req.file?.path;

    if(!avatarImage){
        throw new ApiError(400, "Avatar file is required");
    }

    const avatar = await uploadOnCloudinary(avatarImage);

    if(!avatar){
        throw new ApiError(400, "Error while uploading file");
    }

    // update url in DB
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatarImage: avatar.url
            }
        },
        {returnDocument: "after"}
    ).select("-password -refreshToken");

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Avatar Updated successfully")
    )
})

const updateCoverImage = asyncHandler(async(req, res) => {

    const newCoverImage = req.file?.path;

    if(!newCoverImage){
        throw new ApiError(400, "Cover Image file is required");
    }

    const cover = await uploadOnCloudinary(newCoverImage);

    if(!cover){
        throw new ApiError(400, "Error while uploading file");
    }

    // update url in DB
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: cover.url
            }
        },
        {returnDocument: "after"}
    ).select("-password -refreshToken");

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "Cover Image Updated successfully")
    )
})

const getUserChannelProfile = asyncHandler(async(req, res) => {

    const {username} = req.params;

    if(!username?.trim()){
        throw new ApiError(400, "Username is missing");
    }

    // now i have username
    const channel = await User.aggregate(
        [
            {
                $match: {
                    username: username?.toLowerCase()
                }
            },
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "channel",
                    as: "subscribers"
                }
            },
            {
                $lookup: {
                    from: "subscriptions",
                    localField: "_id",
                    foreignField: "subscriber",
                    as: "subscribedTo"
                }
            },
            {
                $addFields: {
                    subscribersCount: {
                        $size: "$subscribers"
                    },
                    subscribedToCount: {
                        $size: "$subscribedTo"
                    },
                    isSubscribed: {
                        $cond: {
                            if: {
                                $in: [
                                    req.user?._id,
                                    "$subscribers.subscriber"
                                ]
                            },
                            then: true,
                            else: false
                        }
                    }
                }
            },
            {
                $project: {
                    fullName: 1,
                    username: 1,
                    subscribersCount: 1,
                    subscribedToCount: 1,
                    isSubscribed: 1,
                    email: 1,
                    avatarImage: 1,
                    coverImage: 1
                }
            }
        ]
    )

    if(!channel?.length){
        throw new ApiError(404, "Channel doesn't exist");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User Channel fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async(req, res) => {

    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {   
                                    $project: {
                                        username: 1,
                                        fullName: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(200, user[0].watchHistory, "Watch History fetched successfully")
    )
})

export { registerUser, loginUser, logoutUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetails, updateAvatarImage, updateCoverImage, getUserChannelProfile, getWatchHistory};