import * as THREE from "three";
import { getDieColor } from "./dice-visuals.js";
import { cryptoRandom } from "./secure-random.js";

// Face order matches the geometry's side indexing
export const FACE_ORDER_BY_SIDE = [2, 5, 1, 6, 3, 4];

/**
 * Creates a procedural felt texture for the dice tray floor.
 * Generates a noisy green felt appearance using canvas pixel manipulation.
 *
 * NOTE: Uses cryptoRandom for texture grain consistency, though this is
 * cosmetic randomness (not fairness-critical). The visual noise does not
 * affect dice roll outcomes.
 *
 * @param {number} feltPlaneScale - Scale factor for texture repeat
 * @returns {THREE.CanvasTexture|null} The generated texture, or null if canvas unavailable
 */
export const createFeltTexture = (feltPlaneScale = 3) => {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  context.fillStyle = "#1f6d45";
  context.fillRect(0, 0, size, size);

  const imageData = context.getImageData(0, 0, size, size);
  const pixels = imageData.data;

  for (let index = 0; index < pixels.length; index += 4) {
    const grain = (cryptoRandom() - 0.5) * 42;
    pixels[index] = THREE.MathUtils.clamp(pixels[index] + grain * 0.45, 0, 255);
    pixels[index + 1] = THREE.MathUtils.clamp(pixels[index + 1] + grain * 0.7, 0, 255);
    pixels[index + 2] = THREE.MathUtils.clamp(pixels[index + 2] + grain * 0.35, 0, 255);
  }

  context.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.8 * feltPlaneScale, 2.8 * feltPlaneScale);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
};

/**
 * Creates a texture for a single die face with the given face value.
 * Renders white text on a colored background using a canvas.
 *
 * @param {number} faceValue - The numeric value (1-6) to render
 * @param {string} dieColor - The hex color for the die background
 * @returns {THREE.CanvasTexture|null} The generated texture, or null if canvas unavailable
 */
export const createFaceTexture = (faceValue, dieColor) => {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  const base = new THREE.Color(dieColor);
  context.fillStyle = base.getStyle();
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.font = "700 122px Avenir Next, Trebuchet MS, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(faceValue), canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
};

/**
 * Creates a complete material set for a die type.
 * Generates 6 materials (one per face) with appropriate textures.
 *
 * @param {string} dieType - The die type (DICE_TYPE.ATTRIBUTE, SKILL, or STRAIN)
 * @returns {THREE.MeshPhongMaterial[]} Array of 6 materials ordered by face geometry
 */
export const createMaterialSet = (dieType) => {
  const dieColor = getDieColor(dieType);

  return FACE_ORDER_BY_SIDE.map((faceValue) => {
    const texture = createFaceTexture(faceValue, dieColor);

    return new THREE.MeshPhongMaterial({
      map: texture,
      color: "#ffffff",
      shininess: 25,
      specular: 0xf0f3ff,
    });
  });
};

/**
 * Disposes of all textures and materials in a material set.
 * Ensures proper cleanup to prevent memory leaks.
 *
 * @param {THREE.MeshPhongMaterial[]} materialSet - Array of materials to dispose
 */
export const disposeMaterialSet = (materialSet) => {
  for (const material of materialSet) {
    if (material.map) {
      material.map.dispose();
    }

    material.dispose();
  }
};