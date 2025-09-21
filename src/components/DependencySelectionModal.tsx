import React, { useEffect, useMemo, useState } from 'react';
import { X, Check, FileText, Folder } from 'lucide-react';
import type { FileData } from '../types/FileTypes';
import { normalizePath, arePathsEqual } from '../utils/pathUtils';
import '../styles/modals/DependencySelectionModal.css';

interface DependencySelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedDeps: string[]) => void;
  detectedDependencies: string[];
  allFiles: FileData[];
  selectedDependencies: string[];
  onToggleDependency: (path: string, selected: boolean) => void;
}

const DependencySelectionModal: React.FC<DependencySelectionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  detectedDependencies,
  allFiles,
  selectedDependencies,
  onToggleDependency,
}) => {
  const normalizedDetected = useMemo(
    () => detectedDependencies.map((dep) => normalizePath(dep)),
    [detectedDependencies]
  );
  const [currentSelected, setCurrentSelected] = useState<string[]>(normalizedDetected);

  useEffect(() => {
    setCurrentSelected(selectedDependencies.map((dep) => normalizePath(dep)));
  }, [selectedDependencies, isOpen]);

  if (!isOpen) {
    return null;
  }

  const dependencyFiles = useMemo(() => {
    return allFiles.filter((file) =>
      normalizedDetected.some((dep) => arePathsEqual(dep, file.path))
    );
  }, [allFiles, normalizedDetected]);

  const handleToggle = (path: string) => {
    const normalizedPath = normalizePath(path);
    const isAlreadySelected = currentSelected.some((selectedPath) =>
      arePathsEqual(selectedPath, normalizedPath)
    );

    const newSelected = isAlreadySelected
      ? currentSelected.filter((selectedPath) => !arePathsEqual(selectedPath, normalizedPath))
      : [...currentSelected, normalizedPath];

    setCurrentSelected(newSelected);
    onToggleDependency(normalizedPath, !isAlreadySelected);
  };

  const handleSelectAll = () => {
    setCurrentSelected(normalizedDetected);
    normalizedDetected.forEach((path) => onToggleDependency(path, true));
  };

  const handleSelectNone = () => {
    setCurrentSelected([]);
    normalizedDetected.forEach((path) => onToggleDependency(path, false));
  };

  const handleConfirm = () => {
    onConfirm(currentSelected);
  };

  const groupedFiles = dependencyFiles.reduce((groups, file) => {
    const normalized = normalizePath(file.path);
    const pathParts = normalized.split('/');
    const directory = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '/';

    if (!groups[directory]) {
      groups[directory] = [];
    }
    groups[directory].push(file);
    return groups;
  }, {} as Record<string, FileData[]>);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content dependency-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Select Dependencies</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {dependencyFiles.length === 0 ? (
            <div className="no-dependencies">
              <p className="modal-description">
                <strong>No dependencies found!</strong>
              </p>
              <p>This could be because:</p>
              <ul>
                <li>Your selected files don't have any import statements</li>
                <li>The import paths don't match any files in your project</li>
                <li>The files you're importing from don't exist in the current directory</li>
              </ul>
              <p>
                <strong>Try:</strong>
              </p>
              <ul>
                <li>Select files that contain import statements (like `import ... from '...'`)</li>
                <li>Make sure the imported files exist in your project</li>
                <li>Check that import paths are correct</li>
              </ul>
            </div>
          ) : (
            <>
              <p className="modal-description">
                The following files were detected as dependencies of your selected files. Choose which ones you want to include:
              </p>

              <div className="dependency-controls">
                <button className="control-button" onClick={handleSelectAll}>
                  Select All
                </button>
                <button className="control-button" onClick={handleSelectNone}>
                  Select None
                </button>
                <span className="dependency-count">
                  {currentSelected.length} of {normalizedDetected.length} selected
                </span>
              </div>

              <div className="dependency-list">
                {Object.entries(groupedFiles).map(([directory, files]) => (
                  <div key={directory} className="dependency-group">
                    <div className="group-header">
                      <Folder size={16} />
                      <span>{directory === '/' ? 'Root' : directory}</span>
                      <span className="file-count">({files.length})</span>
                    </div>

                    <div className="group-files">
                      {files.map((file) => {
                        const isSelected = currentSelected.some((selectedPath) =>
                          arePathsEqual(selectedPath, file.path)
                        );
                        const normalizedPath = normalizePath(file.path);
                        return (
                          <div
                            key={file.path}
                            className={`dependency-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleToggle(normalizedPath)}
                          >
                            <div className="dependency-checkbox">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggle(normalizedPath)}
                              />
                            </div>

                            <div className="dependency-info">
                              <div className="dependency-path">
                                <FileText size={14} />
                                <span>{file.name}</span>
                              </div>
                              <div className="dependency-fullpath">{normalizedPath}</div>
                            </div>

                            <div className="dependency-actions">
                              {isSelected && <Check size={16} className="check-icon" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="modal-button cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="modal-button confirm"
            onClick={handleConfirm}
            disabled={dependencyFiles.length === 0}
          >
            {dependencyFiles.length === 0
              ? 'No Dependencies Found'
              : `Include Selected (${currentSelected.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DependencySelectionModal;
