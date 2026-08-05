import multer from "multer";
import path from "path";
import fs from "fs";
import env from "./env.js";

// Make sure target uploads directories are initialized
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const fileExt = path.extname(file.originalname).substring(1).toLowerCase();

  if (env.ALLOWED_FILE_EXTENSIONS.includes(fileExt)) {
    cb(null, true);
  } else {
    cb(
      new Error(`Invalid file type. Allowed formats: ${env.ALLOWED_FILE_EXTENSIONS.join(", ")}`),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.MAX_FILE_SIZE,
  },
});

export default upload;
