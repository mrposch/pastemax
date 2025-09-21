/**
 * Path Resolver Utility
 *
 * This module provides functionality to resolve import paths to actual file paths
 * within the project directory structure.
 */

import { join, dirname, normalizePath, resolvePath } from './pathUtils';
import type { FileData } from '../types/FileTypes';
import { extractLocalImportPaths } from './importParser';

export interface ResolvedImport {
  importPath: string;
  resolvedPaths: string[];
  foundFiles: FileData[];
}

/**
 * Common file extensions to try when resolving imports
 */
const FILE_EXTENSIONS = {
  javascript: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],
  python: ['.py'],
  css: ['.css', '.scss', '.sass'],
  default: ['.js', '.ts', '.jsx', '.tsx', '.py', '.css', '.scss', '.sass']
};

/**
 * Resolve an import path to actual file paths in the project
 */
export function resolveImportPath(
  importPath: string,
  currentFilePath: string,
  allFiles: FileData[],
  projectRoot: string
): string[] {
  const resolvedPaths: string[] = [];

  // If it's already an absolute path, try to find it directly
  if (importPath.startsWith('/')) {
    const absolutePath = join(projectRoot, importPath);
    resolvedPaths.push(...findMatchingFiles(absolutePath, allFiles));
    return resolvedPaths;
  }

  // If it's a relative path, resolve it relative to the current file
  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    const currentDir = dirname(currentFilePath);
    const resolvedRelativePath = resolvePath(currentDir, importPath);

    // Try different file extensions
    const extensions = getFileExtensions(importPath);
    for (const ext of extensions) {
      const pathWithExt = resolvedRelativePath + ext;
      const matchingFiles = findMatchingFiles(pathWithExt, allFiles);
      resolvedPaths.push(...matchingFiles);
    }

    // Also try without extension if no matches found
    if (resolvedPaths.length === 0) {
      const matchingFiles = findMatchingFiles(resolvedRelativePath, allFiles);
      resolvedPaths.push(...matchingFiles);
    }

    return resolvedPaths;
  }

  // For module-style imports (like 'utils/helpers'), search within the project
  const extensions = getFileExtensions(importPath);
  for (const ext of extensions) {
    const pathWithExt = importPath + ext;
    const matchingFiles = findMatchingFiles(pathWithExt, allFiles);
    resolvedPaths.push(...matchingFiles);
  }

  // Also try without extension
  if (resolvedPaths.length === 0) {
    const matchingFiles = findMatchingFiles(importPath, allFiles);
    resolvedPaths.push(...matchingFiles);
  }

  return resolvedPaths;
}

/**
 * Get appropriate file extensions to try based on the import path
 */
function getFileExtensions(importPath: string): string[] {
  const extension = importPath.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
    case 'mjs':
    case 'cjs':
      return ['']; // Already has extension
    case 'py':
      return ['']; // Already has extension
    case 'css':
    case 'scss':
    case 'sass':
      return ['']; // Already has extension
    default:
      return FILE_EXTENSIONS.default;
  }
}

/**
 * Find files that match the given path pattern
 */
function findMatchingFiles(targetPath: string, allFiles: FileData[]): string[] {
  const matchingPaths: string[] = [];

  for (const file of allFiles) {
    // Exact match
    if (arePathsEquivalent(file.path, targetPath)) {
      matchingPaths.push(file.path);
      continue;
    }

    // Check if the file path ends with the target path (for partial matches)
    const normalizedTarget = normalizePath(targetPath).replace(/\\/g, '/');
    const normalizedFile = normalizePath(file.path).replace(/\\/g, '/');

    if (normalizedFile.endsWith('/' + normalizedTarget) ||
        normalizedFile === normalizedTarget ||
        normalizedFile.endsWith('/' + normalizedTarget + '/index.js') ||
        normalizedFile.endsWith('/' + normalizedTarget + '/index.ts') ||
        normalizedFile.endsWith('/' + normalizedTarget + '/index.jsx') ||
        normalizedFile.endsWith('/' + normalizedTarget + '/index.tsx')) {
      matchingPaths.push(file.path);
    }
  }

  return matchingPaths;
}

/**
 * Check if two paths are equivalent (ignoring case and path separators)
 */
function arePathsEquivalent(path1: string, path2: string): boolean {
  const normalized1 = normalizePath(path1).replace(/\\/g, '/').toLowerCase();
  const normalized2 = normalizePath(path2).replace(/\\/g, '/').toLowerCase();
  return normalized1 === normalized2;
}

/**
 * Resolve all imports for a given file
 */
export function resolveFileImports(
  content: string,
  filePath: string,
  allFiles: FileData[],
  projectRoot: string,
  parser: (content: string, filePath: string) => string[]
): ResolvedImport[] {
  const importPaths = parser(content, filePath);
  const resolvedImports: ResolvedImport[] = [];

  for (const importPath of importPaths) {
    const resolvedPaths = resolveImportPath(importPath, filePath, allFiles, projectRoot);
    const foundFiles = allFiles.filter(file => resolvedPaths.includes(file.path));

    resolvedImports.push({
      importPath,
      resolvedPaths,
      foundFiles
    });
  }

  return resolvedImports;
}

/**
 * Get all unique files that are dependencies of the given files
 */
export function getDependencyFiles(
  selectedFiles: FileData[],
  allFiles: FileData[],
  projectRoot: string
): FileData[] {
  const dependencyFiles = new Map<string, FileData>();
  const processedFiles = new Set<string>();


  function processFile(file: FileData) {
    if (processedFiles.has(file.path)) {
      return;
    }
    processedFiles.add(file.path);

    try {
      const importPaths = extractLocalImportPaths(file.content, file.path);

      for (const importPath of importPaths) {
        const resolvedPaths = resolveImportPath(importPath, file.path, allFiles, projectRoot);

        for (const resolvedPath of resolvedPaths) {
          const dependencyFile = allFiles.find(f => arePathsEquivalent(f.path, resolvedPath));
          if (dependencyFile && !selectedFiles.some(f => arePathsEquivalent(f.path, dependencyFile.path))) {
            dependencyFiles.set(dependencyFile.path, dependencyFile);
            processFile(dependencyFile); // Recursively process dependencies
          }
        }
      }
    } catch (error) {
      console.warn(`Error processing imports for ${file.path}:`, error);
    }
  }

  // Process all selected files
  selectedFiles.forEach(processFile);

  return Array.from(dependencyFiles.values());
}

