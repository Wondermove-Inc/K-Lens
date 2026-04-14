/**
 * TypeScript declaration for markdown file imports (via webpack asset/source)
 */
declare module "*.md" {
  const content: string;
  export default content;
}
