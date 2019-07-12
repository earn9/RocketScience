/**
 * Loop over all pixels in the cell chunk.
 * @param {Object} chunks The chunks to iterate over.
 * @param {Function} onPixel The function to call per pixel.
 */
export function forChunkPixels(chunks, onPixel) {
    for (const chunk of chunks)
        if (chunk.type === 0x2005)
            for (let x = 0; x < chunk.width; ++x)
                for (let y = 0; y < chunk.height; ++y)
                    onPixel(x, y, chunk);
}

/**
 * Loop over all sprites for all parts.
 * @param {Object} parts The definition for all parts.
 * @param {Function} onSprite The function to call per sprite.
 */
export function forAllSprites(parts, onSprite) {
    for (const category of parts.categories)
        for (const part of category.parts)
            for (const config of part.configurations)
                for (const key in config.sprites)
                    for (const sprite of config.sprites[key])
                        onSprite(sprite.name);
}

/**
 * Loop over all icon sprites for all parts.
 * @param {Object} parts The definition for all parts.
 * @param {Function} onIcon The function to call per icon.
 */
export function forAllIcons(parts, onIcon) {
    for (const category of parts.categories)
        for (const part of category.parts)
            onIcon(part.icon);
}