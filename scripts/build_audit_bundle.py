import os
import sys
import zipfile
import hashlib
import shutil

# Root config files
root_files = [
    "package.json",
    "tsconfig.json",
    "vite.config.ts",
    "index.html",
    "server.ts",
    "firestore.rules",
    "firebase.json",
    "firebase-applet-config.json",
    "firebase-blueprint.json",
    "firestore.indexes.json",
    "CHANGELOG.md",
    "metadata.json",
    ".env.example",
    "bun.lock"
]

all_files = []

# Collect root files that exist
for rf in root_files:
    if os.path.exists(rf):
        all_files.append(rf)

# Collect all files under src
for root, _, files in os.walk("src"):
    for f in files:
        rel_path = os.path.join(root, f)
        all_files.append(rel_path)

# Collect all files under scripts
for root, _, files in os.walk("scripts"):
    for f in files:
        rel_path = os.path.join(root, f)
        all_files.append(rel_path)

# Collect all files under artifacts/logs
for root, _, files in os.walk("artifacts/logs"):
    for f in files:
        rel_path = os.path.join(root, f)
        all_files.append(rel_path)

# Sort deterministically
all_files = sorted(list(set(all_files)))

os.makedirs("public/artifacts/logs", exist_ok=True)
os.makedirs("artifacts/logs", exist_ok=True)
if os.path.exists("dist"):
    os.makedirs("dist/artifacts/logs", exist_ok=True)

manifest_lines = []
zip_dest_public = "public/artifacts/CR-AUTH-BACKUP-001-AUDIT-BUNDLE.zip"
zip_dest_root = "artifacts/CR-AUTH-BACKUP-001-AUDIT-BUNDLE.zip"
zip_dest_dist = "dist/artifacts/CR-AUTH-BACKUP-001-AUDIT-BUNDLE.zip"

print(f"Packaging {len(all_files)} total project files into audit bundle...")

for rel_path in all_files:
    with open(rel_path, "rb") as f:
        content = f.read()
        h = hashlib.sha256(content).hexdigest()
        manifest_lines.append(f"{h}  {rel_path}")

manifest_content = "\n".join(manifest_lines) + "\n"
with open("MANIFEST.sha256", "w") as f:
    f.write(manifest_content)

with open("public/artifacts/MANIFEST.sha256", "w") as f:
    f.write(manifest_content)

with open("artifacts/MANIFEST.sha256", "w") as f:
    f.write(manifest_content)

if os.path.exists("dist"):
    with open("dist/artifacts/MANIFEST.sha256", "w") as f:
        f.write(manifest_content)

# Target zip destinations
destinations = [zip_dest_public, zip_dest_root]
if os.path.exists("dist"):
    destinations.append(zip_dest_dist)

# Generate primary zip
with zipfile.ZipFile(zip_dest_root, "w", zipfile.ZIP_DEFLATED) as zf:
    for rel_path in all_files:
        if os.path.exists(rel_path):
            zf.write(rel_path, arcname=rel_path)
    zf.write("MANIFEST.sha256", arcname="MANIFEST.sha256")

root_size = os.path.getsize(zip_dest_root)
with open(zip_dest_root, "rb") as zf:
    root_sha256 = hashlib.sha256(zf.read()).hexdigest()

print(f"Primary bundle created: {zip_dest_root} ({root_size} bytes, SHA-256: {root_sha256})")

# Copy bit-for-bit to public/artifacts and dist/artifacts
shutil.copyfile(zip_dest_root, zip_dest_public)
print(f"Synced to {zip_dest_public}")

if os.path.exists("dist"):
    shutil.copyfile(zip_dest_root, zip_dest_dist)
    print(f"Synced to {zip_dest_dist}")

# Sync logs across all destinations
for log_file in os.listdir("artifacts/logs"):
    src_log = os.path.join("artifacts/logs", log_file)
    if os.path.isfile(src_log):
        shutil.copyfile(src_log, os.path.join("public/artifacts/logs", log_file))
        if os.path.exists("dist"):
            shutil.copyfile(src_log, os.path.join("dist/artifacts/logs", log_file))

print("Audit bundle creation and multi-destination synchronization completed.")
