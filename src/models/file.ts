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
  fileType: { type: String, required: true, enum: ["image/png", "image/jpeg", "application/pdf", "application/postscript"] 
  },
  uploadAt: { type: Date, default: Date.now },
})

const FileModel = mongoose.model<IFile>('File', FileSchema);

export default FileModel;