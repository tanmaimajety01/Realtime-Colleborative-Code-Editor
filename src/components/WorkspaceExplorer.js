import React, { useMemo } from "react";

function buildTree(paths) {
  const root = { dirs: {}, files: [] };
  const sorted = [...paths].sort((a, b) => a.localeCompare(b));
  sorted.forEach((fullPath) => {
    const parts = fullPath.split(/[/\\]/).filter(Boolean);
    let node = root;
    parts.forEach((part, idx) => {
      if (idx === parts.length - 1) {
        node.files.push({ name: part, path: fullPath });
      } else {
        if (!node.dirs[part]) node.dirs[part] = { dirs: {}, files: [] };
        node = node.dirs[part];
      }
    });
  });
  return root;
}

function fileIcon(name) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["js", "mjs", "cjs"].includes(ext)) return "JS";
  if (["jsx", "tsx"].includes(ext)) return "⚛";
  if (["ts"].includes(ext)) return "TS";
  if (["py"].includes(ext)) return "PY";
  if (["java"].includes(ext)) return "JV";
  if (["html", "htm"].includes(ext)) return "⟨⟩";
  if (["css", "scss", "sass", "less"].includes(ext)) return "#";
  if (["json"].includes(ext)) return "{}";
  if (["md"].includes(ext)) return "Md";
  if (["c", "h"].includes(ext)) return "C";
  if (["cpp", "cc", "cxx", "hpp"].includes(ext)) return "C+";
  return "∿";
}

function DirContents({
  node,
  parentPath,
  depth,
  expanded,
  toggleFolder,
  activeFilePath,
  onSelectFile,
}) {
  const dirNames = Object.keys(node.dirs).sort((a, b) => a.localeCompare(b));
  const files = [...node.files].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      {dirNames.map((dirName) => {
        const folderPath = parentPath ? `${parentPath}/${dirName}` : dirName;
        const isOpen = expanded[folderPath] !== false;
        return (
          <React.Fragment key={folderPath}>
            <button
              type="button"
              className="explorer-row explorer-folder"
              style={{ paddingLeft: 6 + depth * 14 }}
              onClick={() => toggleFolder(folderPath)}
            >
              <span className="explorer-chevron">{isOpen ? "▼" : "▶"}</span>
              <span className="explorer-icon folder-icon" aria-hidden>
                📁
              </span>
              <span className="explorer-name">{dirName}</span>
            </button>
            {isOpen && (
              <DirContents
                node={node.dirs[dirName]}
                parentPath={folderPath}
                depth={depth + 1}
                expanded={expanded}
                toggleFolder={toggleFolder}
                activeFilePath={activeFilePath}
                onSelectFile={onSelectFile}
              />
            )}
          </React.Fragment>
        );
      })}
      {files.map((f) => {
        const active = activeFilePath === f.path;
        return (
          <button
            type="button"
            key={f.path}
            className={`explorer-row explorer-file${active ? " explorer-active" : ""}`}
            style={{ paddingLeft: 10 + depth * 14 }}
            onClick={() => onSelectFile(f.path)}
          >
            <span className="explorer-chevron ghost" aria-hidden>
              ·
            </span>
            <span className="explorer-icon file-icon" aria-hidden>
              {fileIcon(f.name)}
            </span>
            <span className="explorer-name">{f.name}</span>
          </button>
        );
      })}
    </>
  );
}

export default function WorkspaceExplorer({
  paths,
  rootLabel,
  expanded,
  toggleFolder,
  activeFilePath,
  onSelectFile,
  onClose,
}) {
  const tree = useMemo(() => buildTree(paths), [paths]);

  return (
    <aside className="workspaceExplorer" aria-label="Workspace files">
      <div className="workspaceExplorer-head">
        <span className="workspaceExplorer-title">Explorer</span>
        <button
          type="button"
          className="workspaceExplorer-close"
          onClick={onClose}
          title="Close project"
        >
          ×
        </button>
      </div>
      <div className="workspaceExplorer-root" title={rootLabel}>
        📂 {rootLabel}
      </div>
      <div className="workspaceExplorer-tree">
        <DirContents
          node={tree}
          parentPath=""
          depth={0}
          expanded={expanded}
          toggleFolder={toggleFolder}
          activeFilePath={activeFilePath}
          onSelectFile={onSelectFile}
        />
      </div>
    </aside>
  );
}
