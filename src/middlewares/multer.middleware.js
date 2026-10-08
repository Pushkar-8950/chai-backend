import multer from "multer";
import {randomBytes} from "crypto";

// multer is a middleware for handling multipart/form-data, which is primarily used for uploading files. In this code snippet, we are configuring multer to store uploaded files temporarily in a specific directory before they are uploaded to Cloudinary.
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/temp') // location where we want to store the file temporarily before uploading it to cloudinary
  },
  filename: function (req, file, cb) {
    randomBytes(16, function (err, raw) {
      cb(null, file.originalname) // we can also use raw.toString('hex') + path.extname(file.originalname) to generate a random filename
    })
  }
})

export const upload = multer({ 
    storage,
})