/**
 * Compresses an image file to approximately 10KB
 * @param {File} file - The image file to compress
 * @param {number} targetSizeKB - Target size in KB (default: 10)
 * @returns {Promise<Blob>} - Compressed image blob
 */
export async function compressImage(file, targetSizeKB = 150) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Limit maximum dimensions to reduce file size
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;
                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height = Math.round((height * MAX_WIDTH) / width);
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width = Math.round((width * MAX_HEIGHT) / height);
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Iteratively reduce quality until we reach target size
                let quality = 0.92;
                const targetSizeBytes = targetSizeKB * 1024;
                const step = 0.05;
                const minQuality = 0.4;

                const tryCompress = () => {
                    canvas.toBlob(
                        (blob) => {
                            if (blob.size <= targetSizeBytes || quality <= minQuality) {
                                resolve(blob);
                            } else {
                                quality -= step;
                                tryCompress();
                            }
                        },
                        'image/jpeg',
                        quality
                    );
                };

                tryCompress();
            };
            img.onerror = () => reject(new Error('Failed to load image'));
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
    });
}

/**
 * Converts a Blob to File object
 * @param {Blob} blob - The blob to convert
 * @param {string} filename - Filename for the new File
 * @returns {File}
 */
export function blobToFile(blob, filename) {
    return new File([blob], filename, { type: blob.type });
}
