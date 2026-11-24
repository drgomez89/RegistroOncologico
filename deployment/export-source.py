"""Create a reviewed-source ZIP; never include credentials, local history or data."""
from pathlib import Path
import os
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "generated-artifacts" / "cancer-study-registry-source.zip"
FILES = [
    "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc",
    ".gitignore", ".env.example", "tsconfig.json", "tsconfig.base.json",
    "railway.json",
]
TREES = [
    "artifacts/api-server", "artifacts/renal-cancer-study", "lib",
    "scripts", "tests", "deployment",
]
EXCLUDE_DIRS = {
    "node_modules", "dist", ".git", ".agents", ".cache", ".local",
    ".replit-artifact", ".vite", ".vite-temp", "__pycache__",
}
ALLOWED = {
    ".ts", ".tsx", ".mjs", ".cjs", ".js", ".json", ".yaml", ".yml",
    ".css", ".html", ".md", ".sql", ".py", ".sh",
    ".svg", ".png", ".jpg", ".jpeg", ".webp", ".ico", ".woff", ".woff2",
    ".ttf", ".otf", ".txt",
}
TOKEN_PATTERNS = [
    re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(rb"sb_secret_[A-Za-z0-9_-]{24,}"),
    re.compile(rb"sk_(?:live|test)_[A-Za-z0-9]{24,}"),
    re.compile(rb"gh[pousr]_[A-Za-z0-9]{30,}"),
    re.compile(rb"github_pat_[A-Za-z0-9_]{30,}"),
]
selected = {ROOT / filename for filename in FILES}
for tree in TREES:
    for directory, dirs, files in os.walk(ROOT / tree):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not (Path(directory) / d).is_symlink()]
        for filename in files:
            file = Path(directory) / filename
            if file.is_symlink() or filename.startswith(".env") or filename.endswith(".tsbuildinfo"):
                continue
            if file.suffix.lower() not in ALLOWED:
                continue
            # Only our fresh-schema SQL belongs in the source archive, not dumps.
            if file.suffix.lower() == ".sql" and file.relative_to(ROOT).as_posix() != "deployment/supabase-schema.sql":
                continue
            selected.add(file)

for file in sorted(selected):
    if not file.is_file() or file.is_symlink():
        raise RuntimeError(f"Missing or unsafe source file: {file.relative_to(ROOT)}")
    if file.stat().st_size > 5_000_000:
        raise RuntimeError(f"Review large source asset before export: {file.relative_to(ROOT)}")
    if file.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp", ".ico", ".woff", ".woff2", ".ttf", ".otf"}:
        if any(pattern.search(file.read_bytes()) for pattern in TOKEN_PATTERNS):
            raise RuntimeError(f"Review possible credential in {file.relative_to(ROOT)}; export stopped")

DEST.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(DEST, "w", zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(selected):
        archive.write(file, file.relative_to(ROOT).as_posix())
print(f"Prepared {DEST.relative_to(ROOT)}: {len(selected)} files, {DEST.stat().st_size} bytes")
