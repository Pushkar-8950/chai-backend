import ApiError from '../utils/ApiError.js' 
import { asyncHandler } from '../utils/asyncHandler.js'
import Jwt from 'jsonwebtoken'
import { User } from '../models/user.model.js'

// Verify user using access token
export const verifyJWT = asyncHandler(async(req, _, next) => {

    try {
        
        // Check if access token is present in cookies or headers
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

        // If token is not present, throw an error
        if(!token){
            throw new ApiError(401, "Unauthorized request");
        }

        // Verify the token
        const decodedToken = Jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        
        // Find the user in the database using the extracted user ID and exclude sensitive fields like password and refreshToken
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")

        // If user is not found, throw an error
        if(!user){
            throw new ApiError(401, "Invalid Access Token");
        }
        
        // Attach the user object to the request object for further use in the request lifecycle
        req.user = user;

        next();

    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Access Token");
    }
})