import {asyncHandler} from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import { ApiResponse } from '../utils/APIResponse.js';

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
    const avatarLocalPath = req.files?.avatar[0]?.path;
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
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    // Check if avatar is uploaded or not
    if(!avatar){
        throw new ApiError(400, "Avatar file is required");
    }

    // create user object - create entry in DB
    const user = await User.create({
        fullName,
        avatar: avatar.url,
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

export { registerUser };