import {v2} from 'cloudinary';
import fs from 'fs';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {

    try {

        if(!localFilePath) return null;

        // Upload the file on cloudinary
        const response = await v2.uploader.upload(localFilePath, {resource_type: 'auto'})

        // file uploaded successfully
        console.log(`File uploaded succesfully : `, response.url);
        return response;

    } catch(err){
        
        // unlink the file from local storage if any error occurs to avoid trash files 
        console.log(`Error while uploading file on cloudinary : `, err);
        fs.unlinkSync(localFilePath);
        return null;
    }
}

export {uploadOnCloudinary}