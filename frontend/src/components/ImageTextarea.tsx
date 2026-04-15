import { useRef, useState } from "react";
import { uploadQuestionImage } from "../services/imageStorageService";
/**
 * A textarea component that supports image uploads via drag-and-drop or paste. 
 * It uploads the image to a storage service and inserts an `[image:url]` tag at the current cursor position.
 * 
 * ### Props:
 * @param {string} value - The current content of the textarea.
 * @param {(value: string) => void} onChange - Callback to update the textarea content.
 * @param {number} [rows=6] - Number of visible rows for the textarea.
 * @param {string} [placeholder] - Placeholder text for the textarea.
 * @param {string} [className] - Additional CSS class names for styling.
 * 
 * ### Features:
 * - Upload images via drag-and-drop or paste.
 * - Inserts an `[image:url]` tag at the cursor.
 * - Displays a loading indicator during image upload.
 * - Adjusts the cursor position after inserting an image tag.
 */


type Props = {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
};

export default function ImageTextarea({
  value,
  onChange,
  rows = 6,
  placeholder,
  className,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  async function handleImageFile(file: File) {
    console.log("handleImageFile called", file);
    if (!file.type.startsWith("image/")) return;

    setUploading(true);
    try {
      const url = await uploadQuestionImage(file);
      const tag = `[image:${url}]`;

      const textarea = textareaRef.current;
      if (!textarea) {
        onChange(value + "\n" + tag);
        return;
      }

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue =
        value.slice(0, start) + "\n" + tag + "\n" + value.slice(end);
      onChange(newValue);

      setTimeout(() => {
        textarea.selectionStart = start + tag.length + 2;
        textarea.selectionEnd = start + tag.length + 2;
        textarea.focus();
      }, 0);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;

    e.preventDefault();
    const file = imageItem.getAsFile();
    if (file) await handleImageFile(file);
  }

  async function handleDrop(e: React.DragEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = Array.from(e.dataTransfer.files).find((f) =>
      f.type.startsWith("image/")
    );
    console.log("drop files:", e.dataTransfer.files, "found:", file);
    if (file) await handleImageFile(file);
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        className={`${className} ${isDragging ? "border-indigo-400 bg-indigo-50" : ""}`}
      />
      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70">
          <p className="text-sm font-medium text-indigo-600">Uploading image...</p>
        </div>
      )}
      <p className="mt-1 text-xs text-slate-500">
        Paste or drag & drop an image to insert it, or use{" "}
        <code className="bg-slate-100 px-1 rounded">[image:url]</code> manually.
      </p>
    </div>
  );
}