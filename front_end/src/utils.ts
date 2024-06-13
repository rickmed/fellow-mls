const baseUrl = window.location.origin
export function joinP(path: string) {
   return new URL(path, baseUrl).href
}
