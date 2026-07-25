// Type declarations for side-effect CSS imports
// Next.js handles these natively — this file silences IDE-level TS errors.

declare module '*.css' {
  const content: Record<string, string>
  export default content
}