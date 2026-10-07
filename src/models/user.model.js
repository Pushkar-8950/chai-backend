import mongoose from "mongoose";
import { Schema } from "mongoose";

// Defining user schema
const UserSchema = new Schema({

    username:{
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        index: true,
        trim: true
    }, 
    email:{
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    }, 
    fullName:{
        type: String,
        required: true,
        trim: true,
        index: true
    },
    avatar:{
        type: String, // cloudinary url
        required: true,
    },  
    coverImage: {
        type: String // cloudinary url
    },
    watchHistory: [
        {
            type: Schema.Types.ObjectId,
            ref: "Video"
        }
    ],
    password: {
        type: String,
        required: [true, "Password is Required"]
    },
    refreshToken: {
        type: String,

    }
}, {timestamps: true});

// Runs before saving a user document
UserSchema.pre("save", async function (next) {

    // If password is not modified, skip hashing
    if(!this.isModified("password")) return next();

    // Converts plain password into a bcrypt hash
    this.password = await bcrypt.hash(this.password, 10);

    //Tells Mongoose: "middleware is finished, continue saving the document"
    next();
})

// UserSchema.methods.isCorrectPassword -> Adds a method to every User document
UserSchema.methods.isCorrectPassword = async function(password){
    return await bcrypt.compare(password, this.password); // compares the user's entered password with the stored bcrypt hash and returns true/false
}

UserSchema.methods.generateAccessToken = function(){

    return jwt.sign(

        // Payload: The data we want to include in the JWT
        {
            _id:this._id,
            email: this.email,
            username: this.username,
            fullname: this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET, // Secret key used to sign/protect the token
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY // Determines how long the token remains valid
        }
    )
}

UserSchema.methods.generateRefreshToken = function(){

    return jwt.sign(
        {
            _id:this._id,
    
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

// creating model to work with DB providing methods to perform CRUD operations on the user collection
export const User = mongoose.model("User", UserSchema);