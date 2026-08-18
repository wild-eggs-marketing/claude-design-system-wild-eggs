export function addPropertyControls() {}
export const ControlType = new Proxy({}, { get: (t, k) => String(k) })
export const RenderTarget = {
  canvas: "CANVAS", thumbnail: "THUMBNAIL", export: "EXPORT",
  preview: "PREVIEW", current: () => "PREVIEW",
}
