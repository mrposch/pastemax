const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('fs');
const ts = require('typescript');

require.extensions['.ts'] = function (module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  });

  module._compile(outputText, filename);
};

const { extractLocalImportPaths } = require('../src/utils/importParser.ts');
const { getDependencyFiles } = require('../src/utils/pathResolver.ts');
const { normalizePath } = require('../src/utils/pathUtils.ts');

test('extractLocalImportPaths includes only local JavaScript imports', () => {
  const content = "import helper from './utils/helper';\nimport React from 'react';";
  const imports = extractLocalImportPaths(content, 'C:/project/src/App.ts');

  assert.deepEqual(imports, ['./utils/helper']);
});

test('getDependencyFiles resolves relative imports including parent segments', () => {
  const projectRoot = normalizePath('C:/project');
  const selectedFile = {
    name: 'App.ts',
    path: normalizePath('C:/project/src/components/App.ts'),
    content: "import helper from './utils/helper';\nimport constants from '../shared/constants';",
    tokenCount: 0,
    size: 0,
    isBinary: false,
    isSkipped: false,
  };

  const helperFile = {
    name: 'helper.ts',
    path: normalizePath('C:/project/src/components/utils/helper.ts'),
    content: "export const value = 42;",
    tokenCount: 0,
    size: 0,
    isBinary: false,
    isSkipped: false,
  };

  const constantsFile = {
    name: 'constants.ts',
    path: normalizePath('C:/project/src/shared/constants.ts'),
    content: "export const CONST = 'value';",
    tokenCount: 0,
    size: 0,
    isBinary: false,
    isSkipped: false,
  };

  const additionalFile = {
    name: 'index.ts',
    path: normalizePath('C:/project/src/index.ts'),
    content: "import App from './components/App';",
    tokenCount: 0,
    size: 0,
    isBinary: false,
    isSkipped: false,
  };

  const allFiles = [selectedFile, helperFile, constantsFile, additionalFile];
  const dependencies = getDependencyFiles([selectedFile], allFiles, projectRoot);
  const dependencyPaths = dependencies.map((file) => file.path).sort();

  assert.deepEqual(dependencyPaths, [helperFile.path, constantsFile.path].sort());
});
