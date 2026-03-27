/**
 * Comprime y redimensiona una imagen antes de subirla.
 * Usa un <canvas> en el navegador — no requiere libs externas.
 *
 * @param {File} file - Archivo de imagen original
 * @param {Object} options
 * @param {number} options.maxWidth - Ancho máximo en px (default: 1200)
 * @param {number} options.maxHeight - Alto máximo en px (default: 1200)
 * @param {number} options.quality - Calidad JPEG 0-1 (default: 0.8)
 * @returns {Promise<Blob>} - Blob comprimido listo para subir
 */
export function compressImage(file, { maxWidth = 1200, maxHeight = 1200, quality = 0.8 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()

    reader.onload = (e) => {
      img.onload = () => {
        let { width, height } = img

        // Calcular nuevas dimensiones manteniendo proporción
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        // Crear canvas y dibujar imagen redimensionada
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        // Exportar como JPEG comprimido
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Error al comprimir imagen'))
            }
          },
          'image/jpeg',
          quality
        )
      }
      img.onerror = () => reject(new Error('Error al cargar imagen'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('Error al leer archivo'))
    reader.readAsDataURL(file)
  })
}
