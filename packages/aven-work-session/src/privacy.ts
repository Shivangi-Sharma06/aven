import { readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

export const DEFAULT_AVEN_IGNORE = `.env
.env.*
*.pem
*.key
*.p12
node_modules/
.next/
dist/
build/
coverage/
.git/
`;

const SECRET_PATH_PATTERN = /(^|\/)(\.env(?:\.|$)|[^/]*\.(?:pem|key|p12)$)|secret|credential|private[-_]?key|password/i;

function globToRegExp(pattern: string) {
  const directory = pattern.endsWith("/");
  const clean = pattern.replace(/^\//, "").replace(/\/$/, "");
  const escaped = clean
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]");
  return new RegExp(directory ? `(^|/)${escaped}(/|$)` : `(^|/)${escaped}$`);
}

async function readPatterns(path: string) {
  try {
    return (await readFile(path, "utf8"))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && !line.startsWith("!"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function ensureAvenIgnore(repositoryRoot: string) {
  const path = join(repositoryRoot, ".avenignore");
  try {
    await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await writeFile(path, DEFAULT_AVEN_IGNORE, { mode: 0o600 });
  }
}

export async function createPrivacyFilter(repositoryRoot: string) {
  const patterns = [
    ...(await readPatterns(join(repositoryRoot, ".gitignore"))),
    ...(await readPatterns(join(repositoryRoot, ".avenignore"))),
    ".aven/",
    ".avenignore",
    ".git/",
  ];
  const matchers = patterns.map(globToRegExp);
  return (relativePath: string) => {
    const normalized = relativePath.replaceAll("\\", "/").replace(/^\.\//, "");
    return SECRET_PATH_PATTERN.test(normalized) || matchers.some((matcher) => matcher.test(normalized));
  };
}

export function containsSecretSignal(value: string) {
  return /sk-[A-Za-z0-9_-]+|PRIVATE KEY|\bSECRET\b|Bearer\s+[A-Za-z0-9._-]+|password\s*=/i.test(value);
}

export function languageForPath(path: string) {
  const extension = extname(path).toLowerCase();
  const languages: Record<string, string> = {
    ".ts": "TypeScript", ".tsx": "TypeScript", ".js": "JavaScript", ".jsx": "JavaScript",
    ".py": "Python", ".rs": "Rust", ".go": "Go", ".css": "CSS", ".html": "HTML",
    ".md": "Markdown", ".json": "JSON", ".yml": "YAML", ".yaml": "YAML",
  };
  return languages[extension];
}

export function categoryForPath(path: string) {
  const normalized = path.toLowerCase();
  const file = basename(normalized);
  if (/(__tests__|\/tests?\/|\.test\.|\.spec\.)/.test(normalized)) return "test" as const;
  if (/\.(md|mdx|txt|rst)$/.test(normalized)) return "documentation" as const;
  if (/\.(png|jpe?g|gif|webp|svg|psd|ai)$/.test(normalized)) return "asset" as const;
  if (/^(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|cargo\.lock)$/.test(file)) return "dependency" as const;
  if (/(^|\/)(dist|build|generated|coverage)\//.test(normalized)) return "generated" as const;
  if (/\.(json|ya?ml|toml|ini|config\.[^.]+)$/.test(normalized) || file.startsWith(".")) return "configuration" as const;
  if (/\.(ts|tsx|js|jsx|py|rs|go|java|kt|swift|c|cc|cpp|h|hpp|css|scss|html|sol)$/.test(normalized)) return "source" as const;
  return "unknown" as const;
}
