import {asyncHandler} from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import { ApiResponse } from '../utils/APIResponse.js';
import Jwt from 'jsonwebtoken'

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
                $set: {
                    refreshToken: undefined
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

    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken){
        throw new ApiError(500, "Unauthorized request");
    }

    try {
        // Try finding user from the database using ID
        const user = await User.findById(incomingRefreshToken?._id);
    
        if(!user){
            throw new ApiError("Invalid refresh token");
        }
    
        //  Verify token using jwt 
        const decodedToken = await Jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    
        if(decodedToken !== user.refreshToken){
            throw new ApiError(500, "Invalid decoded token");
        }
    
        // Now, if refresh token is valid, generate new Access and refresh tokens 
        const [accessToken, newRefreshToken] = await generateAccessAndRefreshToken(user._id);
    
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

export { registerUser, loginUser, logoutUser, refreshAccessToken};