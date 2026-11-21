import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type UploadedPhoto = { name: string; dataUrl: string };
async function preparePhoto(file: File): Promise<UploadedPhoto> {
  if (
    !/^image\/(jpeg|png|webp)$/.test(file.type) ||
    file.size > 15 * 1024 * 1024
  )
    throw new Error("Choose JPEG, PNG or WebP photos up to 15 MB each.");
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Photo processing is unavailable in this browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let dataUrl = canvas.toDataURL("image/jpeg", 0.75);
    // Fit existing document TEXT columns, retaining a useful JPEG quality.
    for (let attempt = 0; dataUrl.length > 60000 && attempt < 6; attempt += 1) {
      canvas.width = Math.max(1, Math.round(canvas.width * 0.75));
      canvas.height = Math.max(1, Math.round(canvas.height * 0.75));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      dataUrl = canvas.toDataURL("image/jpeg", 0.75);
    }
    if (dataUrl.length > 60000)
      throw new Error("This photo is too detailed. Choose a smaller image.");
    return { name: file.name.replace(/\.[^.]+$/, "") + ".jpg", dataUrl };
  } finally {
    image.close();
  }
}
export function VerificationPhotos({
  onChange,
  onBusy,
}: {
  onChange: (photos: UploadedPhoto[]) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  return (
    <div className="space-y-2">
      <Label htmlFor="verification-photos">Asset Photos</Label>
      <Input
        id="verification-photos"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={processing}
        onChange={async event => {
          const files = Array.from(event.target.files ?? []);
          setError("");
          setPhotos([]);
          onChange([]);
          onBusy(true);
          setProcessing(true);
          try {
            if (files.length > 4) throw new Error("Choose up to four photos.");
            const next = await Promise.all(files.map(preparePhoto));
            setPhotos(next);
            onChange(next);
          } catch (error) {
            setError(
              error instanceof Error ? error.message : "Could not read photos."
            );
          } finally {
            onBusy(false);
            setProcessing(false);
          }
        }}
      />
      <p className="text-xs text-slate-500">
        Up to four photos. Images are compressed before saving.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {photos.map((photo, index) => (
          <img
            key={index}
            src={photo.dataUrl}
            alt={photo.name}
            className="h-20 w-20 rounded-lg object-cover"
          />
        ))}
      </div>
    </div>
  );
}
