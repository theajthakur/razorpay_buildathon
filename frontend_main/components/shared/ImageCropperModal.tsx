/**
 * Reusable Image Cropper Modal
 * Uses `react-easy-crop` to provide a premium 1:1 or configurable aspect ratio image cropping dialog.
 * 
 * Usage Example:
 * ```tsx
 * import { ImageCropperModal } from "@/components/shared/ImageCropperModal";
 * 
 * <ImageCropperModal
 *   open={isOpen}
 *   file={selectedFile}
 *   aspectRatio={1}
 *   maxOutputSize={512}
 *   onCancel={() => setIsOpen(false)}
 *   onCropComplete={(blob) => handleUpload(blob)}
 * />
 * ```
 */

"use client";

import React, { useState, useEffect, useRef } from "react";
import Cropper, { Point, Area } from "react-easy-crop";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageCropperModalProps {
  open: boolean;
  file: File | null;
  aspectRatio?: number;
  maxOutputSize?: number;
  outputFormat?: string;
  minZoom?: number;
  maxZoom?: number;
  showRotation?: boolean;
  onCancel: () => void;
  onCropComplete: (blob: Blob) => void | Promise<void>;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  open,
  file,
  aspectRatio = 1,
  maxOutputSize = 512,
  outputFormat,
  minZoom = 1,
  maxZoom = 3,
  showRotation = false,
  onCancel,
  onCropComplete,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Revoke object URL on close or unmount to avoid memory leaks
  useEffect(() => {
    if (open && file) {
      const url = URL.createObjectURL(file);
      setImageSrc(url);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setCroppedAreaPixels(null);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setImageSrc(null);
    }
  }, [open, file]);

  if (!open || !file) return null;

  const handleSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    try {
      setIsProcessing(true);
      // Determine format: PNG by default (logo transparency), or fall back to file format
      const format = outputFormat || file.type || "image/png";
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels, {
        maxOutputSize,
        outputFormat: format,
        rotation,
      });
      await onCropComplete(blob);
    } catch (err) {
      console.error("Error cropping image:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-secondary/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-surface max-w-lg w-full rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-background-alt">
          <div>
            <h3 className="font-heading text-lg font-bold text-text-primary">
              Crop Image
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Drag to reposition, and use the zoom slider to adjust size.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background transition-colors cursor-pointer"
            disabled={isProcessing}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body - Cropper Area */}
        <div className="relative h-80 w-full bg-secondary/30">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspectRatio}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={(_, croppedPixels) => setCroppedAreaPixels(croppedPixels)}
              minZoom={minZoom}
              maxZoom={maxZoom}
            />
          )}
        </div>

        {/* Controls Panel */}
        <div className="p-6 space-y-4 bg-surface">
          {/* Zoom Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-sm">
              <label className="font-semibold text-text-primary">
                Zoom
              </label>
              <span className="text-xs font-semibold text-text-secondary">
                {Math.round(zoom * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={minZoom}
              max={maxZoom}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-primary cursor-pointer h-1.5 bg-border rounded-lg appearance-none"
            />
          </div>

          {/* Optional Rotation Slider */}
          {showRotation && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-sm">
                <label className="font-semibold text-text-primary">
                  Rotation
                </label>
                <span className="text-xs font-semibold text-text-secondary">
                  {rotation}°
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                step={1}
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer h-1.5 bg-border rounded-lg appearance-none"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border flex items-center justify-end gap-3 bg-background-alt">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={isProcessing || !croppedAreaPixels}
            className="flex items-center gap-2 font-semibold min-w-[80px]"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save</span>
            )}
          </Button>
        </div>

      </div>
    </div>
  );
};

/**
 * Creates an HTML Image element from a source URL
 */
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (err) => reject(err));
    image.setAttribute("crossOrigin", "anonymous"); // Prevent Canvas CORS pollution
    image.src = url;
  });
}

/**
 * Utility function to crop and resize an image via HTML Canvas and return a Blob
 */
export async function getCroppedImageBlob(
  imageSrc: string,
  pixelCrop: Area,
  options: { maxOutputSize?: number; outputFormat?: string; rotation?: number } = {}
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not obtain 2D canvas context");
  }

  const { maxOutputSize, outputFormat = "image/png", rotation = 0 } = options;

  // Set default canvas size to the cropped area dimensions
  let targetWidth = pixelCrop.width;
  let targetHeight = pixelCrop.height;

  // Handle output dimension clamping/resizing
  if (maxOutputSize) {
    const maxDim = Math.max(pixelCrop.width, pixelCrop.height);
    if (maxDim > maxOutputSize) {
      const scale = maxOutputSize / maxDim;
      targetWidth = Math.round(pixelCrop.width * scale);
      targetHeight = Math.round(pixelCrop.height * scale);
    }
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  // Handle rotation if configured
  if (rotation) {
    const rad = (rotation * Math.PI) / 180;
    // Calculate new canvas size or rotate context
    ctx.translate(targetWidth / 2, targetHeight / 2);
    ctx.rotate(rad);
    ctx.translate(-targetWidth / 2, -targetHeight / 2);
  }

  // Draw the cropped region of the image scaled down to target dimensions
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetWidth,
    targetHeight
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Failed to export canvas to Blob"));
      }
    }, outputFormat);
  });
}
