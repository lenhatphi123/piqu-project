/**
 * Client-side "search by photo" using MobileNet image embeddings (TensorFlow.js).
 * Runs entirely in the browser — no external API, no cost. Each product's cover
 * image is embedded once when saved; a search photo is embedded on the fly and
 * compared against stored embeddings with cosine similarity.
 */
import "@tensorflow/tfjs";
import * as mobilenet from "@tensorflow-models/mobilenet";

let modelPromise: Promise<mobilenet.MobileNet> | null = null;

function getModel(): Promise<mobilenet.MobileNet> {
  if (!modelPromise) {
    modelPromise = mobilenet.load({ version: 2, alpha: 1.0 });
  }
  return modelPromise;
}

const loadImage = (dataUrl: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode the image."));
    img.src = dataUrl;
  });

/** Computes a MobileNet embedding vector for an image data URL. */
export async function computeImageEmbedding(dataUrl: string): Promise<number[]> {
  const [model, img] = await Promise.all([getModel(), loadImage(dataUrl)]);
  const activation = model.infer(img, true) as import("@tensorflow/tfjs").Tensor;
  try {
    const values = await activation.data();
    return Array.from(values);
  } finally {
    activation.dispose();
  }
}

/** Cosine similarity between two equal-length vectors, in [-1, 1]. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
