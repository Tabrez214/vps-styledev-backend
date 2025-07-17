import mongoose, { Document, Schema } from "mongoose"

interface IFile extends Document {
  fileName: string;
  filePath: string;
  fileSizeInNumber: number;
  fileType: string;
  uploadAt: Date;
}

const FileSchema = new Schema<IFile>({
  fileName: { type: String, required: true},
  filePath: { type: String, required: true},
  fileSizeInNumber: { type: Number, default: 0},
  fileType: { type: String, required: true, enum: [
    // Image formats
    "image/png", 
    "image/jpeg", 
    "image/jpg", 
    "image/gif", 
    "image/webp",
    "image/svg+xml",
    // Design file formats
    "application/pdf",
    "application/postscript",
    "image/vnd.adobe.photoshop",
    "application/x-photoshop",
    "image/photoshop",
    "image/x-photoshop",
    "application/photoshop",
    "image/psd",
    "application/illustrator",
    "application/x-illustrator",
    "image/x-eps",
    "application/eps",
    "application/x-eps"
  ]},
  uploadAt: { type: Date, default: Date.now },
})

const FileModel = mongoose.models.File || mongoose.model<IFile>('File', FileSchema);

export default FileModel;