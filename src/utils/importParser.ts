/**
 * Import Parser Utility
 *
 * This module provides functionality to parse and detect imports in various programming languages.
 * It helps identify dependencies that can be automatically included when copying files.
 */

export interface ImportInfo {
  type: 'import' | 'require' | 'from' | 'dynamic' | 'css_import';
  path: string;
  originalText: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface ParsedImports {
  imports: ImportInfo[];
  errors: string[];
}

/**
 * Parse imports from JavaScript/TypeScript code
 */
function parseJavaScriptImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const lines = content.split('\n');

  const importRegex = /import\s+(?:{[^}]*}|\*\s+as\s+\w+|\w+(?:\s*,\s*{[^}]*})*|\w+)\s+from\s+['"]([^'"]+)['"]/g;
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    let match: RegExpExecArray | null;

    importRegex.lastIndex = 0;
    while ((match = importRegex.exec(line)) !== null) {
      const importPath = match[1];
      if (!importPath) {
        continue;
      }

      imports.push({
        type: 'import',
        path: importPath,
        originalText: match[0],
        startLine: lineIndex + 1,
        startColumn: match.index,
        endLine: lineIndex + 1,
        endColumn: match.index + match[0].length,
      });
    }

    dynamicImportRegex.lastIndex = 0;
    while ((match = dynamicImportRegex.exec(line)) !== null) {
      const importPath = match[1];
      imports.push({
        type: 'dynamic',
        path: importPath,
        originalText: match[0],
        startLine: lineIndex + 1,
        startColumn: match.index,
        endLine: lineIndex + 1,
        endColumn: match.index + match[0].length,
      });
    }

    requireRegex.lastIndex = 0;
    while ((match = requireRegex.exec(line)) !== null) {
      const importPath = match[1];
      imports.push({
        type: 'require',
        path: importPath,
        originalText: match[0],
        startLine: lineIndex + 1,
        startColumn: match.index,
        endLine: lineIndex + 1,
        endColumn: match.index + match[0].length,
      });
    }
  }

  return imports;
}

/**
 * Parse imports from Python code
 */
function parsePythonImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const lines = content.split('\n');

  const importRegex = /import\s+(\w+(?:\s*,\s*\w+)*)/g;
  const fromRegex = /from\s+(\w+(?:\.\w+)*)\s+import\s+([^;]+)/g;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    let match: RegExpExecArray | null;

    importRegex.lastIndex = 0;
    while ((match = importRegex.exec(line)) !== null) {
      const modules = match[1].split(',').map((m) => m.trim());
      modules.forEach((module) => {
        const originalText = 'import ' + module;
        imports.push({
          type: 'import',
          path: module,
          originalText,
          startLine: lineIndex + 1,
          startColumn: match.index,
          endLine: lineIndex + 1,
          endColumn: match.index + originalText.length,
        });
      });
    }

    fromRegex.lastIndex = 0;
    while ((match = fromRegex.exec(line)) !== null) {
      const importPath = match[1];
      imports.push({
        type: 'from',
        path: importPath,
        originalText: match[0],
        startLine: lineIndex + 1,
        startColumn: match.index,
        endLine: lineIndex + 1,
        endColumn: match.index + match[0].length,
      });
    }
  }

  return imports;
}

/**
 * Parse imports from CSS code
 */
function parseCSSImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const lines = content.split('\n');
  const importRegex = /@import\s+(?:url\()?['"]?([^'"\s)]+)['"]?\s*\)?/g;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    let match: RegExpExecArray | null;

    importRegex.lastIndex = 0;
    while ((match = importRegex.exec(line)) !== null) {
      const importPath = match[1];
      imports.push({
        type: 'css_import',
        path: importPath,
        originalText: match[0],
        startLine: lineIndex + 1,
        startColumn: match.index,
        endLine: lineIndex + 1,
        endColumn: match.index + match[0].length,
      });
    }
  }

  return imports;
}

/**
 * Determine if a path is likely a local file (not an external package)
 */
function isLocalImport(importPath: string | undefined): boolean {
  if (!importPath) {
    return false;
  }

  if (importPath.startsWith('http://') || importPath.startsWith('https://')) {
    return false;
  }

  if (importPath.startsWith('./') || importPath.startsWith('../') || importPath.startsWith('/')) {
    return true;
  }

  if (importPath.includes('.js') || importPath.includes('.ts') ||
      importPath.includes('.jsx') || importPath.includes('.tsx') ||
      importPath.includes('.py') || importPath.includes('.css') ||
      importPath.includes('.scss') || importPath.includes('.sass')) {
    return true;
  }

  if (!importPath.includes('/')) {
    return false;
  }

  return true;
}

/**
 * Parse all imports from a file based on its language
 */
export function parseFileImports(content: string, filePath: string): ImportInfo[] {
  const extension = filePath.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return parseJavaScriptImports(content);
    case 'py':
      return parsePythonImports(content);
    case 'css':
    case 'scss':
    case 'sass':
      return parseCSSImports(content);
    default:
      return [];
  }
}

/**
 * Extract all local import paths from a file
 */
export function extractLocalImportPaths(content: string, filePath: string): string[] {
  const imports = parseFileImports(content, filePath);
  return imports
    .map((imp) => imp.path)
    .filter((path): path is string => isLocalImport(path))
    .map((path) => {
      if (path.endsWith('.js') || path.endsWith('.ts') || path.endsWith('.jsx') || path.endsWith('.tsx')) {
        return path.replace(/\.(js|ts|jsx|tsx)$/, '');
      }
      if (path.endsWith('.py')) {
        return path.replace(/\.py$/, '');
      }
      return path;
    });
}

/**
 * Get all unique local import paths from a list of files
 */
export function getAllLocalImports(files: { path: string; content: string }[]): string[] {
  const allImports = new Set<string>();

  files.forEach((file) => {
    const imports = extractLocalImportPaths(file.content, file.path);
    imports.forEach((imp) => allImports.add(imp));
  });

  return Array.from(allImports);
}
